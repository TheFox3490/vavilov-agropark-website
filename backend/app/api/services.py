"""Услуги центра — публичный список и страница отдельной услуги."""

from __future__ import annotations

from flask import Blueprint, jsonify

from ..models import Service

bp = Blueprint("services", __name__, url_prefix="/api/services")


@bp.get("")
def listing():
    items = (
        Service.query.filter_by(is_published=True).order_by(Service.sort_order, Service.id).all()
    )
    return jsonify(items=[s.to_dict() for s in items])


@bp.get("/<slug>")
def detail(slug: str):
    item = Service.query.filter_by(slug=slug, is_published=True).first()
    if item is None:
        return jsonify(error="Услуга не найдена"), 404
    return jsonify(item=item.to_dict(with_images=True))
