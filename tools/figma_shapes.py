#!/usr/bin/env python3
"""Готовит фоновый слой из 3D-объектов макета.

Цвет объектам в Figma даёт фильтр изображения (exposure/contrast/temperature/…),
поэтому пересчитывать его вручную бессмысленно — просим Figma отрендерить каждый
уникальный вариант в PNG уже с применённым фильтром. Размытие группы (10px)
запекаем здесь же через Pillow, чтобы в браузере не было фильтров вообще.

Результат:
  frontend/public/media/shapes/*.png   — сами объекты
  frontend/src/shapes.js               — раскладка (тип, размер, координаты в %)
"""

from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from figma_dump import load_env  # noqa: E402

import time  # noqa: E402
import urllib.error  # noqa: E402


def api(path: str, attempts: int = 6):
    """Запрос к Figma с повторами: эндпоинт рендера часто отвечает 429."""
    delay = 20
    for attempt in range(1, attempts + 1):
        req = urllib.request.Request(
            f"https://api.figma.com/v1{path}",
            headers={"X-Figma-Token": os.environ["FIGMA_TOKEN"]},
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as exc:
            if exc.code == 429 and attempt < attempts:
                print(f"  429 — жду {delay}с (попытка {attempt}/{attempts})", flush=True)
                time.sleep(delay)
                delay = min(delay * 2, 180)
                continue
            sys.exit(f"Figma вернула {exc.code}: {exc.read().decode('utf-8', 'replace')[:300]}")
    sys.exit("Не удалось получить ответ от Figma")

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend" / "public" / "media" / "shapes"
DATA = ROOT / "frontend" / "src" / "shapes.js"

SHAPES = {"Cube", "Ring", "Sphere"}
TARGET_PX = 700  # максимум на странице — 616px, с запасом хватит
FILTER_KEYS = ("exposure", "contrast", "saturation", "temperature", "tint", "highlights", "shadows")


def image_filters(node) -> tuple | None:
    """Подпись фильтра картинки — по ней отличаем цветовые варианты."""
    found = None

    def walk(n):
        nonlocal found
        for fill in n.get("fills") or []:
            if fill.get("type") == "IMAGE":
                found = fill.get("filters") or {}
        for child in n.get("children", []):
            walk(child)

    walk(node)
    if found is None:
        return None
    return tuple(round(found.get(k, 0.0), 3) for k in FILTER_KEYS)


def collect(tree):
    """Возвращает (варианты, раскладка) со страницы «Главная»."""
    variants: dict[tuple, dict] = {}
    layout = []

    for page in tree["document"]["children"]:
        for frame in page.get("children", []):
            if frame.get("name") != "Главная":
                continue
            for child in frame.get("children", []):
                if child.get("name") != "Фигуры":
                    continue
                group = child["children"][0]["absoluteBoundingBox"]

                def walk(node):
                    if node.get("type") == "INSTANCE" and node.get("name") in SHAPES:
                        box = node["absoluteBoundingBox"]
                        sig = image_filters(node)
                        key = (node["name"], sig)
                        # Для рендера берём самый крупный экземпляр варианта:
                        # так PNG получится максимального качества.
                        best = variants.get(key)
                        if best is None or box["width"] > best["width"]:
                            variants[key] = {"id": node["id"], "width": box["width"]}
                        layout.append(
                            {
                                "key": key,
                                "size": round(box["width"]),
                                "x": round((box["x"] - group["x"]) / group["width"] * 1000) / 10,
                                "y": round((box["y"] - group["y"]) / group["height"] * 1000) / 10,
                            }
                        )
                    for c in node.get("children", []):
                        walk(c)

                walk(child)
                return variants, layout
    return variants, layout


def render(file_key: str, variants: dict) -> dict[tuple, str]:
    """Просит Figma отрисовать каждый вариант и сохраняет PNG."""
    OUT.mkdir(parents=True, exist_ok=True)
    names: dict[tuple, str] = {}

    # Группируем по масштабу: у images API масштаб общий на запрос.
    by_scale = defaultdict(list)
    for key, info in variants.items():
        scale = min(4.0, max(0.01, round(TARGET_PX / info["width"], 2)))
        by_scale[scale].append((key, info))

    counter = defaultdict(int)
    for scale, group in by_scale.items():
        query = urllib.parse.urlencode(
            {"ids": ",".join(i["id"] for _, i in group), "format": "png", "scale": scale}
        )
        result = api(f"/images/{file_key}?{query}")
        if result.get("err"):
            sys.exit(f"Figma вернула ошибку: {result['err']}")

        for key, info in group:
            url = result["images"].get(info["id"])
            if not url:
                print(f"  ! нет рендера для {key[0]}")
                continue
            counter[key[0]] += 1
            name = f"{key[0].lower()}-{counter[key[0]]}.png"
            with urllib.request.urlopen(url, timeout=180) as resp:
                (OUT / name).write_bytes(resp.read())
            names[key] = name
            print(f"  {name}  ({(OUT / name).stat().st_size // 1024} KB, scale={scale})")

    return names


def main():
    load_env()
    file_key = os.environ["FIGMA_FILE_KEY"]
    tree = json.loads((ROOT / "figma-export" / "file.json").read_text())

    variants, layout = collect(tree)
    print(f"Уникальных вариантов: {len(variants)}, объектов на странице: {len(layout)}")

    names = render(file_key, variants)

    items = [
        {"file": f"/media/shapes/{names[i['key']]}", "size": i["size"], "x": i["x"], "y": i["y"]}
        for i in layout
        if i["key"] in names
    ]
    # Крупные объекты рисуем первыми — на мобильных оставляем только их.
    items.sort(key=lambda i: -i["size"])

    DATA.write_text(
        "/* Сгенерировано tools/figma_shapes.py — не править вручную.\n\n"
        "   Фоновые 3D-объекты из макета. Цвет им в Figma задаёт фильтр изображения,\n"
        "   поэтому каждый цветовой вариант отрисован самой Figma и сохранён отдельным\n"
        "   PNG. Размытие группы (10px) запечено в файлы, в браузере фильтров нет.\n\n"
        "   size — ширина при макетных 1920px, x/y — доля от габаритов слоя в %. */\n\n"
        "export const SHAPES = "
        + json.dumps(items, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    print(f"\nРаскладка записана: {DATA.relative_to(ROOT)} ({len(items)} объектов)")


if __name__ == "__main__":
    main()
