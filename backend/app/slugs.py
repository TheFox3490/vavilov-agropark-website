"""Адреса вида /startups/vektor-servis из русских названий.

Готовые библиотеки транслитерации тянуть ради одной таблицы не стали:
нужен ровно один стандарт и предсказуемый результат.
"""

from __future__ import annotations

import re

_TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "sch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}


def slugify(value: str) -> str:
    """«Вектор-Сервис» → vektor-servis, «VR TEHNUM» → vr-tehnum."""
    text = "".join(_TRANSLIT.get(ch, ch) for ch in (value or "").lower())
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text[:80]


def unique_slug(base: str, exists) -> str:
    """Добавляет -2, -3… пока `exists(slug)` возвращает истину.

    Проверку принимаем функцией, чтобы модуль не знал о моделях.
    """
    slug = base or "project"
    if not exists(slug):
        return slug
    for suffix in range(2, 1000):
        candidate = f"{slug[:76]}-{suffix}"
        if not exists(candidate):
            return candidate
    raise ValueError("Не удалось подобрать свободный адрес")
