#!/usr/bin/env python3
"""Собирает дизайн-токены из выгруженного дерева макета.

Считает, насколько часто встречается каждый цвет / шрифт / радиус,
чтобы отделить настоящие токены от случайных одноразовых значений.
"""

import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILE_JSON = ROOT / "figma-export" / "file.json"


def to_hex(color, opacity=1.0):
    r, g, b = (round(color[k] * 255) for k in ("r", "g", "b"))
    alpha = color.get("a", 1) * opacity
    if alpha < 0.99:
        return f"rgba({r}, {g}, {b}, {round(alpha, 2)})"
    return f"#{r:02x}{g:02x}{b:02x}".upper()


def collect(node, acc):
    for fill in node.get("fills") or []:
        if fill.get("visible") is False:
            continue
        if fill.get("type") == "SOLID" and "color" in fill:
            acc["colors"][to_hex(fill["color"], fill.get("opacity", 1))] += 1
        elif fill.get("type", "").startswith("GRADIENT"):
            stops = " → ".join(
                to_hex(s["color"]) for s in fill.get("gradientStops", [])
            )
            acc["gradients"][f"{fill['type']}: {stops}"] += 1
        elif fill.get("type") == "IMAGE" and fill.get("imageRef"):
            acc["images"].add(fill["imageRef"])

    for stroke in node.get("strokes") or []:
        if stroke.get("type") == "SOLID" and "color" in stroke:
            acc["strokes"][to_hex(stroke["color"], stroke.get("opacity", 1))] += 1

    style = node.get("style") or {}
    if style.get("fontFamily"):
        acc["fonts"][style["fontFamily"]] += 1
        acc["type_styles"][
            (
                style["fontFamily"],
                style.get("fontWeight"),
                round(style.get("fontSize", 0)),
                round(style.get("lineHeightPx", 0)),
                round(style.get("letterSpacing", 0), 2),
            )
        ] += 1

    radius = node.get("cornerRadius")
    if isinstance(radius, (int, float)) and radius:
        acc["radii"][round(radius)] += 1

    for effect in node.get("effects") or []:
        if effect.get("visible") is False:
            continue
        kind = effect.get("type")
        if kind in ("LAYER_BLUR", "BACKGROUND_BLUR"):
            acc["blurs"][f"{kind} {round(effect.get('radius', 0))}px"] += 1
        elif kind in ("DROP_SHADOW", "INNER_SHADOW"):
            off = effect.get("offset", {})
            acc["shadows"][
                f"{kind} {round(off.get('x', 0))}/{round(off.get('y', 0))} "
                f"blur {round(effect.get('radius', 0))} {to_hex(effect.get('color', {}))}"
            ] += 1

    for child in node.get("children", []):
        collect(child, acc)


def main():
    data = json.loads(FILE_JSON.read_text())
    acc = {
        "colors": Counter(),
        "gradients": Counter(),
        "strokes": Counter(),
        "fonts": Counter(),
        "type_styles": Counter(),
        "radii": Counter(),
        "blurs": Counter(),
        "shadows": Counter(),
        "images": set(),
    }
    collect(data["document"], acc)

    print("=== ЦВЕТА ЗАЛИВОК (топ-20) ===")
    for value, count in acc["colors"].most_common(20):
        print(f"  {value:<26} ×{count}")

    print("\n=== ГРАДИЕНТЫ (топ-6) ===")
    for value, count in acc["gradients"].most_common(6):
        print(f"  ×{count}  {value[:150]}")

    print("\n=== ОБВОДКИ (топ-8) ===")
    for value, count in acc["strokes"].most_common(8):
        print(f"  {value:<26} ×{count}")

    print("\n=== ШРИФТЫ ===")
    for value, count in acc["fonts"].most_common():
        print(f"  {value:<26} ×{count}")

    print("\n=== ТЕКСТОВЫЕ СТИЛИ: семейство / вес / размер / интерлиньяж / трекинг ===")
    for (fam, weight, size, lh, ls), count in acc["type_styles"].most_common(22):
        print(f"  {fam:<18} {weight:<5} {size:>3}px / {lh:>3}px / {ls:>5} ×{count}")

    print("\n=== РАДИУСЫ СКРУГЛЕНИЯ ===")
    for value, count in sorted(acc["radii"].items()):
        print(f"  {value}px ×{count}")

    print("\n=== РАЗМЫТИЯ ===")
    for value, count in acc["blurs"].most_common(10):
        print(f"  {value:<28} ×{count}")

    print("\n=== ТЕНИ ===")
    for value, count in acc["shadows"].most_common(8):
        print(f"  {value} ×{count}")

    print(f"\n=== РАСТРОВЫЕ ЗАЛИВКИ: {len(acc['images'])} уникальных изображений ===")
    (ROOT / "figma-export" / "image_refs.json").write_text(
        json.dumps(sorted(acc["images"]), indent=2)
    )


if __name__ == "__main__":
    main()
