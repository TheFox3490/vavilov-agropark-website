"""Проекты центра — публичные списки и страница отдельного проекта."""

from __future__ import annotations

from flask import Blueprint, jsonify, request
from sqlalchemy.orm import selectinload

from ..models import Project

bp = Blueprint("projects", __name__, url_prefix="/api/projects")

# Витрины сайта: страница «Наши стартапы», карусель первого экрана
# и блок «Наши проекты» на главной. Один проект может показываться сразу
# в нескольких — это флаги, а не отдельные списки.
PLACEMENTS = {
    "startups": Project.show_on_startups,
    "slider": Project.show_in_slider,
    "featured": Project.is_featured,
}


@bp.get("")
def listing():
    query = Project.query.filter_by(is_published=True)

    placement = (request.args.get("placement") or "startups").strip()
    column = PLACEMENTS.get(placement)
    if column is None:
        return jsonify(error="Неизвестная витрина"), 400
    query = query.filter(column.is_(True))

    # Галерея нужна как запасной кадр для карточки карусели: без неё
    # получился бы отдельный запрос на каждый проект.
    items = (
        query.options(selectinload(Project.images))
        .order_by(Project.sort_order, Project.id)
        .all()
    )
    return jsonify(items=[p.to_dict() for p in items])


@bp.get("/<slug>")
def detail(slug: str):
    item = Project.query.filter_by(slug=slug, is_published=True).first()
    if item is None:
        return jsonify(error="Проект не найден"), 404
    return jsonify(item=item.to_dict(with_images=True))
