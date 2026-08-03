#!/usr/bin/env python3
"""Сопоставляет скачанные изображения со слоями, в которых они используются,
и раскладывает их в frontend/public/media под понятными именами."""

from __future__ import annotations

import json
import re
import shutil
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "figma-export" / "assets"
TARGET = ROOT / "frontend" / "public" / "media"

TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "",
    "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.strip().lower())
    text = "".join(TRANSLIT.get(ch, ch) for ch in text)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return re.sub(r"-{2,}", "-", text).strip("-") or "image"


def collect(node, page: str, screen: str, usage: dict) -> None:
    for fill in node.get("fills") or []:
        if fill.get("type") == "IMAGE" and fill.get("imageRef"):
            usage[fill["imageRef"]].append((page, screen, node.get("name", "")))
    for child in node.get("children", []):
        collect(child, page, screen or node.get("name", ""), usage)


def main() -> None:
    data = json.loads((ROOT / "figma-export" / "file.json").read_text())
    usage: dict[str, list] = defaultdict(list)

    for page in data["document"]["children"]:
        for frame in page.get("children", []):
            collect(frame, page.get("name", ""), frame.get("name", ""), usage)

    TARGET.mkdir(parents=True, exist_ok=True)
    manifest = {}
    copied = 0

    for ref, places in sorted(usage.items()):
        source = next(iter(ASSETS.glob(f"{ref.replace(':', '_').replace('/', '_')}.*")), None)
        if source is None:
            continue  # ещё не скачалось

        # Имя берём из слоя, где картинка встречается впервые. Дизайнер часто
        # называет разные слои одинаково («Изображение3» на нескольких экранах),
        # поэтому добавляем хвост от imageRef — иначе картинки затирают друг друга.
        _, screen, layer = places[0]
        name = f"{slugify(screen)}--{slugify(layer)}-{ref[:6]}{source.suffix}"
        destination = TARGET / name
        if not destination.exists():
            shutil.copy2(source, destination)
            copied += 1
        manifest[ref] = {
            "file": f"/media/{name}",
            "used_in": [f"{s} → {l}" for _, s, l in places[:6]],
            "count": len(places),
        }

    (ROOT / "figma-export" / "asset_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2)
    )
    print(f"Разложено {copied} новых файлов, всего в манифесте {len(manifest)}.")
    print(f"Каталог: {TARGET}")
    for ref, info in list(manifest.items())[:40]:
        print(f"  {info['file']:<52} ×{info['count']}  {info['used_in'][0][:60]}")


if __name__ == "__main__":
    main()
