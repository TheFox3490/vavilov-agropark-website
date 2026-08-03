#!/usr/bin/env python3
"""Скачивает растровые заливки макета (фотографии, логотипы, фоны)."""

import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from figma_dump import api, load_env  # noqa: E402

import os  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "figma-export" / "assets"


def main():
    load_env()
    file_key = os.environ["FIGMA_FILE_KEY"]

    # Один дешёвый запрос отдаёт ссылки сразу на все растровые заливки файла.
    meta = api(f"/files/{file_key}/images")
    images = meta.get("meta", {}).get("images", {})
    print(f"Figma отдала {len(images)} ссылок на изображения.", flush=True)

    # Эндпоинт возвращает всё, что когда-либо лежало в файле, включая удалённые
    # слои и старые версии — в этом макете мусора больше 80%. Качаем только те
    # картинки, которые действительно стоят в слоях (список собирает figma_tokens.py).
    refs_file = ROOT / "figma-export" / "image_refs.json"
    if refs_file.exists():
        needed = set(json.loads(refs_file.read_text()))
        images = {ref: url for ref, url in images.items() if ref in needed}
        print(f"Из них используется в макете: {len(images)}.", flush=True)
    else:
        print("image_refs.json не найден — сначала запусти figma_tokens.py.", flush=True)

    OUT.mkdir(parents=True, exist_ok=True)
    saved = skipped = failed = 0
    for ref, url in sorted(images.items()):
        if not url:
            skipped += 1
            continue
        name = ref.replace(":", "_").replace("/", "_")
        existing = list(OUT.glob(f"{name}.*"))
        if existing:
            skipped += 1
            continue
        try:
            with urllib.request.urlopen(url, timeout=120) as resp:
                blob = resp.read()
                ctype = resp.headers.get("Content-Type", "")
        except Exception as exc:  # noqa: BLE001
            print(f"  ! {name}: {exc}")
            failed += 1
            continue

        ext = {"image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg"}.get(
            ctype.split(";")[0], "png"
        )
        path = OUT / f"{name}.{ext}"
        path.write_bytes(blob)
        saved += 1
        print(f"  [{saved}] {path.name}  ({len(blob) // 1024} KB)", flush=True)

    print(f"\nСкачано {saved}, пропущено {skipped}, ошибок {failed} → {OUT}")


if __name__ == "__main__":
    main()
