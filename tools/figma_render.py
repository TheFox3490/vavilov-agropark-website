#!/usr/bin/env python3
"""Выгружает экраны макета в PNG через Figma Images API."""

import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from figma_dump import api, load_env  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "figma-export" / "screens"

SKIP_TYPES = {"COMPONENT_SET"}


def main():
    load_env()
    file_key = os.environ["FIGMA_FILE_KEY"]
    scale = sys.argv[1] if len(sys.argv) > 1 else "1"

    data = json.loads((ROOT / "figma-export" / "file.json").read_text())
    frames = []
    for page in data["document"]["children"]:
        for node in page.get("children", []):
            if node.get("type") in SKIP_TYPES:
                continue
            frames.append((node["id"], node["name"]))

    OUT.mkdir(parents=True, exist_ok=True)

    # Figma рендерит кадры лениво: просим маленькими пачками, иначе запрос отваливается по таймауту.
    batch_size = 2
    for start in range(0, len(frames), batch_size):
        batch = frames[start : start + batch_size]
        query = urllib.parse.urlencode(
            {"ids": ",".join(nid for nid, _ in batch), "format": "png", "scale": scale}
        )
        result = api(f"/images/{file_key}?{query}")
        if result.get("err"):
            print(f"  ошибка на пачке {start // batch_size + 1}: {result['err']}")
            continue

        for offset, (node_id, name) in enumerate(batch):
            index = start + offset + 1
            url = result["images"].get(node_id)
            if not url:
                print(f"  пропуск: {name} (нет рендера)")
                continue
            safe = "".join(c if c.isalnum() or c in " -_" else "_" for c in name).strip()
            path = OUT / f"{index:02d}_{safe}.png"
            if path.exists() and path.stat().st_size > 0:
                print(f"  {path.name} — уже есть, пропускаю")
                continue
            with urllib.request.urlopen(url, timeout=300) as resp:
                path.write_bytes(resp.read())
            print(f"  {path.name}  ({path.stat().st_size // 1024} KB)")

    print(f"\nГотово: {OUT}")


if __name__ == "__main__":
    main()
