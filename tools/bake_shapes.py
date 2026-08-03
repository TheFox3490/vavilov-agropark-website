#!/usr/bin/env python3
"""Запекает фоновые 3D-объекты макета в готовые PNG.

Цвет объектам в Figma задаёт фильтр изображения (exposure/temperature/tint),
поэтому исходники серые. Повторять формулы Figma смысла нет — вместо этого
светлота исходника раскладывается по цветовой рампе, снятой прямо с рендера
макета. Размытие группы (10px) запекается сюда же, чтобы в браузере
не было ни одного фильтра — так одинаково работает на любом устройстве.

Объекты выводятся в трёх размерах: размытие должно быть 10px в конечных
пикселях страницы, поэтому мелким объектам нужен свой файл, иначе они
оказались бы заметно резче крупных.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path("/work")
# Серые исходники лежат вне public: браузеру они не нужны, только скрипту.
SRC = ROOT / "figma-export" / "shape-sources"
OUT = ROOT / "frontend" / "public" / "media" / "shapes"
DATA = ROOT / "frontend" / "src" / "shapes.js"

SOURCES = {
    "cube": "glavnaya--box-ceramic-6-c02a2d.png",
    "ring": "glavnaya--donat-black-aluminiom-7-63f11d.png",
    "sphere": "glavnaya--blue-6-0b4132.png",
}

# Рампы сняты с рендера макета: тень → полутон → свет.
RAMPS = {
    "blue": ((0x11, 0x5E, 0x93), (0x31, 0xA6, 0xF6), (0x97, 0xC7, 0xFE)),
    "pink": ((0xE7, 0x04, 0x85), (0xF8, 0x5E, 0xA5), (0xFE, 0xB8, 0xD1)),
}

# Размерные корзины: ширина объекта на странице при макетных 1920px.
BUCKETS = {"lg": 640, "md": 320, "sm": 180}
# Размытая картинка не содержит мелких деталей, поэтому хранить её
# в полном разрешении незачем — 0.75 от экранного размера не отличить.
RETINA = 0.75
BLUR_CSS = 10.0       # размытие группы в макете


def ramp_lut(dark, mid, light):
    """Таблица 256 значений: светлота исходника → цвет рампы."""
    table = []
    for i in range(256):
        t = i / 255
        if t < 0.5:
            k = t / 0.5
            c = tuple(round(dark[j] + (mid[j] - dark[j]) * k) for j in range(3))
        else:
            k = (t - 0.5) / 0.5
            c = tuple(round(mid[j] + (light[j] - mid[j]) * k) for j in range(3))
        table.append(c)
    return table


def bake(src_path: Path, ramp, size_px: int, blur_px: float) -> Image.Image:
    with Image.open(src_path) as raw:
        img = raw.convert("RGBA")
        img.thumbnail((size_px, size_px), Image.LANCZOS)

    rgb = img.convert("RGB")
    lut = ramp_lut(*ramp)
    # Светлота считается по яркости — так сохраняется объёмная светотень.
    grey = rgb.convert("L")
    out = Image.new("RGB", img.size)
    gp, op = grey.load(), out.load()
    for y in range(img.height):
        for x in range(img.width):
            op[x, y] = lut[gp[x, y]]

    result = Image.new("RGBA", img.size)
    result.paste(out, (0, 0))
    result.putalpha(img.getchannel("A"))
    # Холст расширяем, иначе размытие обрежется по краю кадра.
    pad = int(blur_px * 3)
    canvas = Image.new("RGBA", (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
    canvas.paste(result, (pad, pad))
    return canvas.filter(ImageFilter.GaussianBlur(blur_px))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    layout = json.loads((ROOT / "figma-export" / "shape_layout.json").read_text())

    made = {}
    for shape, filename in SOURCES.items():
        for color, ramp in RAMPS.items():
            for bucket, css_px in BUCKETS.items():
                px = round(css_px * RETINA)
                blur = BLUR_CSS * RETINA
                img = bake(SRC / filename, ramp, px, blur)
                name = f"{shape}-{color}-{bucket}.webp"
                # WebP с альфой жмёт плавные градиенты в разы лучше PNG.
                img.save(OUT / name, "WEBP", quality=82, method=6)
                made[(shape, color, bucket)] = (name, img.width)
                print(f"  {name:<22} {img.width}px  {(OUT / name).stat().st_size // 1024} KB")

    def bucket_of(size):
        if size >= 400:
            return "lg"
        return "md" if size >= 200 else "sm"

    items = []
    for it in layout:
        shape = it["shape"].lower()
        color = "pink" if it["tint"] >= 0.5 else "blue"
        bucket = bucket_of(it["size"])
        name, _ = made[(shape, color, bucket)]
        items.append(
            {
                "file": f"/media/shapes/{name}",
                "size": it["size"],
                "x": it["x"],
                "y": it["y"],
                # Ярус назначен по вертикали: убирая старшие ярусы на узких
                # экранах, распределение остаётся равномерным по всей странице.
                "tier": it["tier"],
            }
        )
    items.sort(key=lambda i: i["y"])

    DATA.write_text(
        "/* Сгенерировано tools/bake_shapes.py — не править вручную.\n\n"
        "   Фоновые 3D-объекты макета. Цвет и размытие (10px) запечены в PNG,\n"
        "   поэтому в браузере фильтров нет — одинаково работает на любом устройстве.\n\n"
        "   size — ширина объекта при макетной ширине страницы 1920px,\n"
        "   x / y — положение в процентах от габаритов фонового слоя.\n"
        "   tier — ярус прореживания: 0 виден всегда, 1 скрывается на планшете,\n"
        "   2 — на телефоне. Ярусы чередуются по вертикали, поэтому любое\n"
        "   подмножество остаётся равномерно распределённым по странице. */\n\n"
        "export const SHAPES = " + json.dumps(items, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    total = sum(p.stat().st_size for p in OUT.iterdir())
    print(f"\nОбъектов в раскладке: {len(items)}, файлов: {len(made)}, суммарно {total // 1024} KB")


if __name__ == "__main__":
    main()
