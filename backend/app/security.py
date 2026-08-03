"""Подписанные токены для писем и проверка прав администратора."""

from __future__ import annotations

from functools import wraps

from flask import current_app, jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from .models import User

CONFIRM_SALT = "email-confirm"
RESET_SALT = "password-reset"


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"])


def make_token(user_id: int, salt: str) -> str:
    return _serializer().dumps({"uid": user_id}, salt=salt)


def read_token(token: str, salt: str) -> int | None:
    max_age = current_app.config["EMAIL_TOKEN_MAX_AGE_HOURS"] * 3600
    try:
        data = _serializer().loads(token, salt=salt, max_age=max_age)
    except (BadSignature, SignatureExpired):
        return None
    return data.get("uid")


def current_user() -> User | None:
    identity = get_jwt_identity()
    if identity is None:
        return None
    return User.query.get(int(identity))


def admin_required(view):
    """Пускает дальше только активного администратора."""

    @wraps(view)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user = current_user()
        if user is None or not user.is_active:
            return jsonify(error="Требуется авторизация"), 401
        if not user.is_admin:
            return jsonify(error="Недостаточно прав"), 403
        return view(*args, **kwargs)

    return wrapper
