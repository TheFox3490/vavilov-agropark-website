"""Форма обратной связи со страницы «Команда».

Заявка всегда сохраняется в БД (её видно в админке), а письмо-уведомление
уходит дополнительно, если в .env настроены SMTP и CONTACT_NOTIFY_TO.
"""

from __future__ import annotations

import re

from flask import Blueprint, jsonify, request

from ..extensions import db, limiter
from ..mail import send_contact_notification
from ..models import ContactRequest
from ..settings import legal_docs_enabled

bp = Blueprint("contact", __name__, url_prefix="/api/contact")

PHONE_RE = re.compile(r"^[\d\s()+\-]{5,32}$")


@bp.post("")
@limiter.limit("10 per hour")
def create():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    message = (data.get("message") or "").strip()

    if not name or len(name) > 255:
        return jsonify(error="Укажите имя"), 400
    if not PHONE_RE.match(phone):
        return jsonify(error="Укажите корректный телефон"), 400
    if not message:
        return jsonify(error="Напишите сообщение"), 400
    # В макете это обязательный чекбокс рядом со ссылками на политику и согласие.
    # Если документы в админке спрятаны, строки согласия в форме нет —
    # и требовать её нельзя, иначе форма перестала бы отправляться вовсе.
    consent = bool(data.get("consent"))
    if legal_docs_enabled() and not consent:
        return jsonify(error="Требуется согласие на обработку персональных данных"), 400

    item = ContactRequest(name=name, phone=phone, message=message, consent=consent)
    db.session.add(item)
    db.session.commit()

    # Проблемы с почтой не должны мешать пользователю: заявка уже сохранена.
    notified = send_contact_notification(item)
    return jsonify(ok=True, notified=notified), 201
