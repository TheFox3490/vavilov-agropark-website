"""Состав центра — публичный список для карусели на странице «Контакты»."""

from __future__ import annotations

from flask import Blueprint, jsonify

from ..models import StaffMember

bp = Blueprint("staff", __name__, url_prefix="/api/staff")


@bp.get("")
def listing():
    items = (
        StaffMember.query.filter_by(is_published=True)
        .order_by(StaffMember.sort_order, StaffMember.id)
        .all()
    )
    return jsonify(items=[m.to_dict() for m in items])
