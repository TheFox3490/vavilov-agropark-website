"""Вся конфигурация читается из переменных окружения — см. .env.example в корне."""

import os
from datetime import timedelta


def _bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-change-me")

    # --- База данных ---
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", "postgresql+psycopg://agropark:agropark@db:5432/agropark"
    )
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True, "pool_recycle": 280}
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # --- JWT в httpOnly-cookie ---
    # Фронт и API живут на одном origin (nginx отдаёт статику и проксирует /api),
    # поэтому cookie-режим работает без CORS-плясок и токен недоступен из JS.
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", SECRET_KEY)
    JWT_TOKEN_LOCATION = ["cookies"]
    JWT_COOKIE_SECURE = _bool("JWT_COOKIE_SECURE", True)
    JWT_COOKIE_SAMESITE = os.environ.get("JWT_COOKIE_SAMESITE", "Lax")
    JWT_COOKIE_CSRF_PROTECT = True
    JWT_CSRF_IN_COOKIES = True
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=_int("JWT_ACCESS_MINUTES", 30))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=_int("JWT_REFRESH_DAYS", 30))
    JWT_ACCESS_COOKIE_PATH = "/"
    JWT_REFRESH_COOKIE_PATH = "/api/auth"

    # --- Загрузка файлов ---
    UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/app/uploads")
    MAX_CONTENT_LENGTH = _int("MAX_UPLOAD_MB", 10) * 1024 * 1024
    ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}

    # --- Почта ---
    # Свой почтовый сервер не нужен: подставь реквизиты любого внешнего SMTP.
    # Пока SMTP_HOST пустой, письма не отправляются, а логируются — сайт работает как обычно.
    SMTP_HOST = os.environ.get("SMTP_HOST", "")
    SMTP_PORT = _int("SMTP_PORT", 587)
    SMTP_USER = os.environ.get("SMTP_USER", "")
    SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
    SMTP_USE_TLS = _bool("SMTP_USE_TLS", True)
    SMTP_USE_SSL = _bool("SMTP_USE_SSL", False)
    MAIL_FROM = os.environ.get("MAIL_FROM", "noreply@agropark.local")
    MAIL_FROM_NAME = os.environ.get("MAIL_FROM_NAME", "Агропарк Вавиловского университета")
    # Куда падают уведомления о новых заявках с формы обратной связи.
    CONTACT_NOTIFY_TO = os.environ.get("CONTACT_NOTIFY_TO", "")

    # --- Прочее ---
    PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "http://localhost:8080")
    REQUIRE_EMAIL_CONFIRMATION = _bool("REQUIRE_EMAIL_CONFIRMATION", True)
    EMAIL_TOKEN_MAX_AGE_HOURS = _int("EMAIL_TOKEN_MAX_AGE_HOURS", 48)
    NEWS_PAGE_SIZE = _int("NEWS_PAGE_SIZE", 5)
    RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")
