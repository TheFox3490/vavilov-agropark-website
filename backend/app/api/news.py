"""Лента новостей, фильтр по категориям и подгрузка порциями.

Кнопка «Показать больше» в макете догружает следующую порцию карточек
на ту же страницу, поэтому здесь курсорная подгрузка, а не постраничная.
"""

from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request

from ..extensions import db
from ..models import Category, News

bp = Blueprint("news", __name__, url_prefix="/api/news")


@bp.get("/categories")
def categories():
    items = Category.query.order_by(Category.position, Category.id).all()
    return jsonify(items=[c.to_dict() for c in items])


@bp.get("")
def feed():
    """Параметры: category (slug), offset, limit. Пустой category = «Все»."""
    slug = (request.args.get("category") or "").strip()
    try:
        offset = max(0, int(request.args.get("offset", 0)))
    except ValueError:
        offset = 0
    try:
        limit = int(request.args.get("limit", current_app.config["NEWS_PAGE_SIZE"]))
    except ValueError:
        limit = current_app.config["NEWS_PAGE_SIZE"]
    limit = max(1, min(limit, 50))

    query = News.query.filter_by(is_published=True)
    if slug and slug != "all":
        query = query.join(Category).filter(Category.slug == slug)

    total = query.count()
    items = (
        query.order_by(News.created_at.desc(), News.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return jsonify(
        items=[n.to_dict(with_body=False) for n in items],
        total=total,
        offset=offset,
        limit=limit,
        has_more=offset + len(items) < total,
    )


@bp.get("/<int:news_id>")
def detail(news_id: int):
    """Полный текст для модалки «Новости затемнение»."""
    item = db.session.get(News, news_id)
    if item is None or not item.is_published:
        return jsonify(error="Новость не найдена"), 404
    return jsonify(item=item.to_dict())
