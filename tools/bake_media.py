#!/usr/bin/env python3
"""Пережимает картинки макета в WebP под их настоящие места на странице.

Из Figma всё выгрузилось в исходном разрешении: фотография проекта весила
1.4 МБ при слоте 531×366, фон первого экрана — 1.1 МБ. В сумме страницы
тянули по несколько мегабайт там, где хватает пары сотен килобайт.

Предельная ширина зависит от места: фон первого экрана растягивается
на всё окно, обложки открываются во весь экран из галереи, фотография
сотрудника стоит в карточке 304×405. Обрезки нет — только уменьшение
и смена формата, так что кадрирование остаётся за браузером.

Запуск (Pillow есть в образе бэкенда):
    docker compose run --rm -v "$(pwd):/work" \\
        --entrypoint python backend /work/tools/bake_media.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path("/work")
# Исходники лежат вне public: браузеру они не нужны, только этому скрипту.
SRC = ROOT / "figma-export" / "media-sources"
OUT = ROOT / "frontend" / "public" / "media"

QUALITY = 82

# Предельная ширина по месту на странице. Ключ — начало имени файла,
# имена сгенерированы из имён экранов макета.
WIDTHS = {
    "glavnaya--imgbackground": 1920,  # фон первого экрана, во всю ширину окна
    "kontakty--": 900,  # фотография сотрудника, слот 304×405
    "novosti--": 1400,  # новость в ленте и в модалке шириной 56rem
    "default": 1600,  # обложки: открываются во весь экран из галереи
}

# Что нужно сайту в работе: пути из кода, из сидера и из базы.
# Остальные 11 файлов макета остаются только в исходниках.
SOURCES = [
    "glavnaya--imgbackground-1-8f81ae.png",
    "kontakty--imghawaii-1-984eed.jpg",
    "novosti--frame-10-7be256.jpg",
    "novosti--frame-11-9a841c.jpg",
    "novosti--frame-12-80a282.jpg",
    "novosti--frame-13-d510b9.jpg",
    "novosti--frame-14-cabfef.jpg",
    "startapy--izobrazhenie-2-772796.png",
    "startapy--izobrazhenie3-397514.png",
    "startapy--izobrazhenie3-f74fad.png",
    "uslugi--3d-b61be6.jpg",
    "uslugi--kursy-9df0c2.jpg",
    "uslugi--lazer-0eda70.jpg",
    "uslugi--mark-650192.jpg",
    "uslugi--vr-395f51.jpg",
    "vav--imghawaii-1-479833.jpg",
    "vav--imghawaii-1-a0599a.jpg",
]


def max_width(name: str) -> int:
    for prefix, width in WIDTHS.items():
        if prefix != "default" and name.startswith(prefix):
            return width
    return WIDTHS["default"]


def bake(name: str) -> tuple[int, int]:
    src = SRC / name
    before = src.stat().st_size
    image = Image.open(src)

    has_alpha = image.mode in ("RGBA", "LA") or "transparency" in image.info
    image = image.convert("RGBA" if has_alpha else "RGB")

    width = max_width(name)
    if image.width > width:
        image.thumbnail((width, image.height * width // image.width), Image.LANCZOS)

    out = OUT / f"{Path(name).stem}.webp"
    image.save(out, "WEBP", quality=QUALITY, method=6)
    after = out.stat().st_size
    print(f"  {name:40} {before // 1024:>5} КБ → {image.size[0]}×{image.size[1]} {after // 1024:>4} КБ")
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
