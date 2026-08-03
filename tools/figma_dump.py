#!/usr/bin/env python3
"""Читает макет из Figma REST API и печатает карту экранов.

Запуск:  python3 tools/figma_dump.py
Требует: FIGMA_TOKEN и FIGMA_FILE_KEY в .env
"""

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "figma-export"


def load_env():
    env_file = ROOT / ".env"
    if not env_file.exists():
        sys.exit("Нет файла .env — скопируй .env.example в .env и впиши токен.")
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def api(path):
    token = os.environ.get("FIGMA_TOKEN", "")
    if not token:
        sys.exit("FIGMA_TOKEN пустой — впиши токен в .env")
    req = urllib.request.Request(
        f"https://api.figma.com/v1{path}",
        headers={"X-Figma-Token": token},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")[:400]
        if exc.code == 403:
            sys.exit(f"403 — токен неверный, истёк, или нет scope 'File content'.\n{body}")
        if exc.code == 404:
            sys.exit(f"404 — файл не найден или у аккаунта нет к нему доступа.\n{body}")
        sys.exit(f"Figma API вернула {exc.code}: {body}")


def dims(node):
    box = node.get("absoluteBoundingBox") or {}
    if "width" not in box:
        return ""
    return f"  {round(box['width'])}x{round(box['height'])}"


def walk(node, depth, lines, max_depth):
    if depth > max_depth:
        return
    kind = node.get("type", "?")
    name = node.get("name", "")
    lines.append(f"{'  ' * depth}[{kind}] {name}{dims(node)}")
    if kind == "TEXT":
        text = (node.get("characters") or "").strip().replace("\n", " ")
        if text:
            lines.append(f"{'  ' * (depth + 1)}“{text[:120]}”")
    for child in node.get("children", []):
        walk(child, depth + 1, lines, max_depth)


def main():
    load_env()
    file_key = os.environ.get("FIGMA_FILE_KEY", "")
    if not file_key:
        sys.exit("FIGMA_FILE_KEY пустой — впиши ключ файла в .env")

    print(f"Читаю файл {file_key} ...")
    data = api(f"/files/{file_key}")

    OUT.mkdir(exist_ok=True)
    (OUT / "file.json").write_text(json.dumps(data, ensure_ascii=False, indent=2))

    print(f"\nНазвание макета: {data.get('name')}")
    print(f"Последнее изменение: {data.get('lastModified')}\n")

    lines = []
    for page in data["document"].get("children", []):
        lines.append(f"\n=== СТРАНИЦА: {page.get('name')} ===")
        for frame in page.get("children", []):
            walk(frame, 1, lines, max_depth=3)

    report = "\n".join(lines)
    (OUT / "structure.txt").write_text(report)
    print(report[:6000])
    print(f"\n\nПолное дерево: {OUT / 'file.json'}")
    print(f"Читаемая структура: {OUT / 'structure.txt'}")


if __name__ == "__main__":
    main()
