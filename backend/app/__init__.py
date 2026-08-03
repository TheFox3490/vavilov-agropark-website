"""Фабрика приложения."""

from __future__ import annotations

import logging
import os

from flask import Flask, jsonify, send_from_directory
from werkzeug.exceptions import HTTPException

from .config import Config
from .extensions import cors, db, jwt, limiter, migrate


def create_app(config_object: type[Config] = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_object)

    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    limiter.init_app(app)

    # В проде фронт и API отдаются одним nginx, то есть origin общий и CORS не нужен.
    # Список задаётся только для режима разработки, когда Vite слушает отдельный порт.
    origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
    if origins:
        cors.init_app(app, resources={r"/api/*": {"origins": origins}}, supports_credentials=True)

    from .api.admin import bp as admin_bp
    from .api.auth import bp as auth_bp
    from .api.contact import bp as contact_bp
    from .api.news import bp as news_bp
    from .api.projects import bp as projects_bp
    from .api.services import bp as services_bp
    from .api.meta import bp as meta_bp, seo_bp
    from .api.site import bp as site_bp
    from .api.staff import bp as staff_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(news_bp)
    app.register_blueprint(contact_bp)
    app.register_blueprint(projects_bp)
    app.register_blueprint(services_bp)
    app.register_blueprint(site_bp)
    app.register_blueprint(meta_bp)
    app.register_blueprint(seo_bp)
    app.register_blueprint(staff_bp)
    app.register_blueprint(admin_bp)

    from .cli import register_cli

    register_cli(app)

    @app.get("/api/health")
    def health():
        return jsonify(status="ok")

    @app.get("/uploads/<path:filename>")
    def uploads(filename: str):
        """Резервная отдача загруженных файлов. В проде их раздаёт nginx напрямую."""
        return send_from_directory(app.config["UPLOAD_DIR"], filename)

    @app.errorhandler(HTTPException)
    def handle_http_error(exc: HTTPException):
        return jsonify(error=exc.description), exc.code

    @app.errorhandler(Exception)
    def handle_unexpected(exc: Exception):
        app.logger.exception("Необработанная ошибка: %s", exc)
        return jsonify(error="Внутренняя ошибка сервера"), 500

    return app
