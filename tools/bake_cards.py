#!/usr/bin/env python3
"""Готовит кадры для карточек карусели первого экрана.

Кадры из макета выгружены как есть: от 360×360 до 1516×1090, самый тяжёлый —
полтора мегабайта. Слот на странице при этом не больше 295×200 CSS-пикселей,
то есть 590×400 при двойной плотности. Восемь исходников тянули 4.7 МБ,
и первая карточка грузилась на первом же экране.

Здесь они ужимаются в WebP, вписанным в 720×520 с сохранением пропорций.
Обрезку намеренно не делаем: пропорция карточки плавает от 1.44 до 2.61
в зависимости от экрана, и любая запечённая обрезка была бы неверной
для половины устройств — пусть кадрирует браузер.

Запуск (Pillow есть в образе бэкенда):
    docker compose run --rm -v "$(pwd):/work" \\
        --entrypoint python backend /work/tools/bake_cards.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path("/work")
# Исходники лежат вне public: браузеру они не нужны, только этому скрипту.
# В образ фронтенда попадают лишь запечённые кадры, и он легче на 4.7 МБ.
SRC = ROOT / "figma-export" / "card-sources"
OUT = ROOT / "frontend" / "public" / "media" / "cards"

# Вписываем в этот прямоугольник, не обрезая. Запас к 590×400 нужен,
# чтобы на узкой карточке (2.61:1) кадр не пришлось растягивать.
MAX_W, MAX_H = 720, 520
QUALITY = 82

# Кадры карусели из макета. Имена файлов — как в src/media.js.
SOURCES = [
    "vav--imgisland-1-323c3d.png",
    "vav--imgisland-1-4b9cda.png",
    "vav--imgisland-1-afc040.png",
    "vav--imgisland-1-d2eebd.png",
    "vav--imgisland-1-da3f9f.png",
    "vav--imgisland-1-23e31e.png",
    "vav--imgisland-1-05a8a4.png",
    "vav--imgisland-1-14dd91.png",
]


def bake(name: str) -> tuple[int, int]:
    src = SRC / name
    image = Image.open(src)
    before = src.stat().st_size

    # Прозрачность сохраняем: у кадров из макета предмет вырезан, и сквозь фон
    # просвечивает карточка вместе с фотографией первого экрана. Залей мы его
    # сплошным цветом — карточка стала бы плоской и темнее соседних.
    has_alpha = image.mode in ("RGBA", "LA") or "transparency" in image.info
    image = image.convert("RGBA" if has_alpha else "RGB")

    image.thumbnail((MAX_W, MAX_H), Image.LANCZOS)

    out = OUT / f"{Path(name).stem}.webp"
    image.save(out, "WEBP", quality=QUALITY, method=6)
    after = out.stat().st_size
    print(
        f"  {name:32} {before // 1024:>5} КБ → {image.size[0]}×{image.size[1]}"
        f" {after // 1024:>4} КБ{'  с прозрачностью' if has_alpha else ''}"
    )
    return before, after


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    total_before = total_after = 0
    for name in SOURCES:
        before, after = bake(name)
        total_before += before
        total_after += after
    print(
        f"\nВсего: {total_before / 1024 / 1024:.2f} МБ → {total_after / 1024:.0f} КБ "
        f"(в {total_before / total_after:.1f} раза легче)"
    )


if __name__ == "__main__":
    main()
