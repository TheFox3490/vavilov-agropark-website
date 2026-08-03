"""Настройки сайта — публичное чтение.

Контакты стоят в подвале и в шапке каждой страницы, поэтому запрос лёгкий
и без параметров: один ответ обслуживает весь сайт.
"""

from __future__ import annotations

from flask import Blueprint, jsonify

from ..settings import all_settings

bp = Blueprint("site", __name__, url_prefix="/api/settings")


@bp.get("")
def listing():
    return jsonify(settings=all_settings())
