"""Регистрация, вход, подтверждение почты и восстановление пароля.

Соответствие макету:
  «Регистрация»        — логин, пароль, повтор пароля (+ email, см. ОТСТУПЛЕНИЕ)
  «Вход в аккаунт»     — логин, пароль, «Запомнить меня», «Забыли пароль?»
  «Регистрация успешна» — просит подтвердить адрес письмом
"""

from __future__ import annotations

import re

from email_validator import EmailNotValidError, validate_email
from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    set_access_cookies,
    set_refresh_cookies,
    unset_jwt_cookies,
)

from ..extensions import db, limiter
from ..mail import send_confirmation, send_password_reset
from ..models import User
from ..security import CONFIRM_SALT, RESET_SALT, current_user, make_token, read_token

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,64}$")
MIN_PASSWORD_LEN = 8


def _issue_tokens(user: User, remember: bool):
    """Кладёт JWT в httpOnly-cookie. «Запомнить меня» добавляет refresh-токен."""
    response = jsonify(user=user.to_dict())
    set_access_cookies(response, create_access_token(identity=str(user.id)))
    if remember:
        set_refresh_cookies(response, create_refresh_token(identity=str(user.id)))
    return response


@bp.post("/register")
@limiter.limit("10 per hour")
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    password_repeat = data.get("password_repeat") or ""

    if not USERNAME_RE.match(username):
        return jsonify(error="Логин: 3–64 символа, латиница, цифры, точка, дефис, подчёркивание"), 400
    if password != password_repeat:
        return jsonify(error="Пароли не совпадают"), 400
    if len(password) < MIN_PASSWORD_LEN:
        return jsonify(error=f"Пароль должен быть не короче {MIN_PASSWORD_LEN} символов"), 400
    try:
        email = validate_email(email, check_deliverability=False).normalized
    except EmailNotValidError:
        return jsonify(error="Некорректный адрес почты"), 400

    if User.query.filter(db.func.lower(User.username) == username.lower()).first():
        return jsonify(error="Такой логин уже занят"), 409
    if User.query.filter_by(email=email).first():
        return jsonify(error="На этот адрес уже зарегистрирован аккаунт"), 409

    needs_confirmation = current_app.config["REQUIRE_EMAIL_CONFIRMATION"]
    user = User(username=username, email=email, email_confirmed=not needs_confirmation)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    mail_sent = False
    if needs_confirmation:
        link = (
            f"{current_app.config['PUBLIC_BASE_URL'].rstrip('/')}"
            f"/confirm/{make_token(user.id, CONFIRM_SALT)}"
        )
        mail_sent = send_confirmation(user.email, user.username, link)

    # Экран «Регистрация успешна» показывается всегда; поле mail_sent позволяет
    # честно предупредить пользователя, если почта на сервере ещё не настроена.
    return jsonify(ok=True, needs_confirmation=needs_confirmation, mail_sent=mail_sent), 201


@bp.post("/login")
@limiter.limit("20 per hour")
def login():
    data = request.get_json(silent=True) or {}
    login_value = (data.get("username") or "").strip()
    password = data.get("password") or ""
    remember = bool(data.get("remember"))

    # В макете поле называется «Логин», но пускаем и по адресу почты — так удобнее.
    user = User.query.filter(
        db.or_(
            db.func.lower(User.username) == login_value.lower(),
            db.func.lower(User.email) == login_value.lower(),
        )
    ).first()

    if user is None or not user.check_password(password):
        return jsonify(error="Неверный логин или пароль"), 401
    if not user.is_active:
        return jsonify(error="Аккаунт отключён"), 403
    if current_app.config["REQUIRE_EMAIL_CONFIRMATION"] and not user.email_confirmed:
        return jsonify(error="Подтвердите адрес почты — письмо со ссылкой отправлено при регистрации"), 403

    db.session.commit()  # сохраняет перехешированный пароль, если параметры argon2 поменялись
    return _issue_tokens(user, remember)


@bp.post("/logout")
def logout():
    response = jsonify(ok=True)
    unset_jwt_cookies(response)
    return response


@bp.get("/me")
@jwt_required(optional=True)
def me():
    user = current_user()
    return jsonify(user=user.to_dict() if user else None)


@bp.post("/change-password")
@jwt_required()
@limiter.limit("10 per hour")
def change_password():
    """Смена пароля своей учётной записи.

    Текущий пароль спрашиваем обязательно: сессия может остаться открытой
    на чужом компьютере, и без проверки её хватило бы, чтобы отобрать доступ
    у владельца. Ограничитель запросов заодно не даёт перебирать текущий
    пароль через эту ручку.
    """
    user = current_user()
    if user is None or not user.is_active:
        return jsonify(error="Требуется авторизация"), 401

    data = request.get_json(silent=True) or {}
    current = data.get("current_password") or ""
    password = data.get("password") or ""

    if not user.check_password(current):
        return jsonify(error="Текущий пароль указан неверно"), 400
    if len(password) < MIN_PASSWORD_LEN:
        return jsonify(error=f"Пароль должен быть не короче {MIN_PASSWORD_LEN} символов"), 400
    if password != (data.get("password_repeat") or ""):
        return jsonify(error="Пароли не совпадают"), 400
    if password == current:
        return jsonify(error="Новый пароль совпадает со старым"), 400

    user.set_password(password)
    db.session.commit()

    # Выдаём новый токен доступа: пароль сменился, но выкидывать человека
    # из его же сессии незачем.
    response = jsonify(ok=True)
    set_access_cookies(response, create_access_token(identity=str(user.id)))
    return response


@bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    user = current_user()
    if user is None or not user.is_active:
        return jsonify(error="Требуется авторизация"), 401
    response = jsonify(user=user.to_dict())
    set_access_cookies(response, create_access_token(identity=str(user.id)))
    return response


@bp.post("/confirm/<token>")
def confirm(token: str):
    user_id = read_token(token, CONFIRM_SALT)
    if user_id is None:
        return jsonify(error="Ссылка недействительна или истекла"), 400
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify(error="Аккаунт не найден"), 404
    user.email_confirmed = True
    db.session.commit()
    return jsonify(ok=True)


@bp.post("/forgot")
@limiter.limit("5 per hour")
def forgot():
    """Экран входа содержит «Забыли пароль?», но самих экранов сброса в макете нет —
    поток реализован по стандартной схеме (ОТСТУПЛЕНИЕ ОТ МАКЕТА)."""
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    user = User.query.filter_by(email=email).first()
    if user is not None:
        link = (
            f"{current_app.config['PUBLIC_BASE_URL'].rstrip('/')}"
            f"/reset/{make_token(user.id, RESET_SALT)}"
        )
        send_password_reset(user.email, user.username, link)
    # Отвечаем одинаково в любом случае, чтобы нельзя было перебором узнать,
    # какие адреса зарегистрированы.
    return jsonify(ok=True)


@bp.post("/reset/<token>")
@limiter.limit("10 per hour")
def reset(token: str):
    data = request.get_json(silent=True) or {}
    password = data.get("password") or ""
    if len(password) < MIN_PASSWORD_LEN:
        return jsonify(error=f"Пароль должен быть не короче {MIN_PASSWORD_LEN} символов"), 400
    if password != (data.get("password_repeat") or ""):
        return jsonify(error="Пароли не совпадают"), 400

    user_id = read_token(token, RESET_SALT)
    if user_id is None:
        return jsonify(error="Ссылка недействительна или истекла"), 400
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify(error="Аккаунт не найден"), 404

    user.set_password(password)
    user.email_confirmed = True
    db.session.commit()
    return jsonify(ok=True)
