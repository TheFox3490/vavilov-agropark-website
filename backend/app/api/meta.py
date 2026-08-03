"""Метатеги страниц: заголовок, описание, карточка ссылки.

Зачем это на сервере, а не в React: Telegram, ВКонтакте и поисковые роботы
не выполняют JavaScript. Что бы приложение ни выставило в document.title
после загрузки, робот увидит только то, что пришло в HTML. Поэтому голову
страницы собирает бэкенд, а nginx вклеивает её в index.html директивой SSI
(`<!--#include virtual="/api/meta?path=$request_uri" -->`). Отдельного
рендеринга и лишних контейнеров это не требует: разворачивание остаётся
прежним — docker compose up -d.

Если бэкенд не ответит, nginx просто вставит пустоту: страница откроется,
метатеги не появятся. Ломаться тут нечему.
"""

from __future__ import annotations

import re
from html import escape

from flask import Blueprint, Response, current_app, request

from ..models import News, Project, Service
from ..settings import all_settings

bp = Blueprint("meta", __name__, url_prefix="/api/meta")
# robots.txt и карта сайта: их адреса роботы ищут в корне, поэтому nginx
# проксирует их сюда отдельными правилами.
seo_bp = Blueprint("seo", __name__, url_prefix="/api/seo")

SITE_NAME = "Центр агроробототехники и VR/AR технологий"
# «ВавГУ» — сокращение неверное, университет так себя не называет.
# В заголовке нужен вариант покороче полного официального названия,
# иначе он не помещается в выдачу целиком: берём тот, которым
# университет пользуется сам.
SITE_TITLE = f"{SITE_NAME} — Вавиловский университет"
SITE_DESCRIPTION = (
    "Центр агроробототехники и VR/AR технологий Вавиловского университета: тренажёры "
    "в виртуальной реальности, приложения дополненной реальности и робототехнические "
    "системы для агропромышленного комплекса."
)
DEFAULT_IMAGE = "/media/glavnaya--imgbackground-1-8f81ae.webp"

# Статичные страницы. Заголовок дополняется названием центра, чтобы
# в выдаче было видно, чей это раздел.
PAGES = {
    "/": (SITE_TITLE, SITE_DESCRIPTION),
    "/news": ("Новости", "Новости центра агроробототехники и VR/AR технологий: мероприятия, образовательные курсы, робототехника."),
    "/startups": ("Наши стартапы", "Проекты центра: VR-тренажёры, приложения дополненной реальности и платформы для агропромышленного комплекса."),
    "/services": ("Наши услуги", "Услуги центра: разработка VR/AR, лазерная резка и маркировка, образовательные курсы, прототипирование."),
    "/contacts": ("Контакты", "Как связаться с центром агроробототехники и VR/AR технологий: адрес, телефон, почта и форма обратной связи."),
    "/login": ("Вход в аккаунт", SITE_DESCRIPTION),
    "/register": ("Регистрация", SITE_DESCRIPTION),
    "/account": ("Личный кабинет", SITE_DESCRIPTION),
}

# Разделы, которые роботам индексировать незачем.
NOINDEX = ("/admin", "/account", "/login", "/register", "/confirm", "/reset")


def _clean(text: str, limit: int = 300) -> str:
    """Из текста статьи делает описание: одна строка без переносов."""
    value = " ".join((text or "").split())
    if len(value) <= limit:
        return value
    cut = value[:limit]
    space = cut.rfind(" ")
    return f"{cut[:space] if space > limit // 2 else cut}…"


def _absolute(url: str | None) -> str:
    base = (current_app.config.get("PUBLIC_BASE_URL") or "").rstrip("/")
    if not url:
        url = DEFAULT_IMAGE
    return url if url.startswith("http") else f"{base}{url}"


def _lookup(path: str) -> tuple[str, str, str | None]:
    """Заголовок, описание и картинка для конкретного адреса."""
    if path in PAGES:
        title, description = PAGES[path]
        return title, description, None

    # Записи ищем по адресу, снятые с публикации не раскрываем.
    if m := re.fullmatch(r"/news/(\d+)", path):
        item = News.query.filter_by(id=int(m.group(1)), is_published=True).first()
        if item:
            return item.title, _clean(item.body) or SITE_DESCRIPTION, item.image_url

    if m := re.fullmatch(r"/startups/([\w-]+)", path):
        item = Project.query.filter_by(slug=m.group(1), is_published=True).first()
        if item:
            return item.title, _clean(item.summary or item.body) or SITE_DESCRIPTION, item.image_url

    if m := re.fullmatch(r"/services/([\w-]+)", path):
        item = Service.query.filter_by(slug=m.group(1), is_published=True).first()
        if item:
            return item.title, _clean(item.summary or item.body) or SITE_DESCRIPTION, item.image_url

    if path == "/privacy":
        return all_settings()["legal_privacy_title"], SITE_DESCRIPTION, None
    if path == "/consent":
        return all_settings()["legal_consent_title"], SITE_DESCRIPTION, None

    return SITE_TITLE, SITE_DESCRIPTION, None


@bp.get("")
def head_fragment():
    path = (request.args.get("path") or "/").split("?")[0].split("#")[0]
    if len(path) > 1:
        path = path.rstrip("/")
    if not path:
        path = "/"

    title, description, image = _lookup(path)
    full_title = title if title == SITE_TITLE else f"{title} — {SITE_NAME}"
    base = (current_app.config.get("PUBLIC_BASE_URL") or "").rstrip("/")
    canonical = f"{base}{path}"

    tags = [
        f"<title>{escape(full_title)}</title>",
        f'<meta name="description" content="{escape(description)}" />',
        f'<link rel="canonical" href="{escape(canonical)}" />',
        f'<meta property="og:type" content="{"article" if path.count("/") > 1 else "website"}" />',
        f'<meta property="og:title" content="{escape(full_title)}" />',
        f'<meta property="og:description" content="{escape(description)}" />',
        f'<meta property="og:url" content="{escape(canonical)}" />',
        f'<meta property="og:image" content="{escape(_absolute(image))}" />',
        f'<meta property="og:site_name" content="{escape(SITE_NAME)}" />',
        '<meta property="og:locale" content="ru_RU" />',
        '<meta name="twitter:card" content="summary_large_image" />',
    ]
    if path.startswith(NOINDEX):
        tags.append('<meta name="robots" content="noindex, nofollow" />')

    # Кэш держим коротким: заголовок новости может поменяться в админке,
    # и ждать сутки, пока обновится карточка ссылки, никто не станет.
    return Response(
        "\n    ".join(tags),
        mimetype="text/html",
        headers={"Cache-Control": "public, max-age=60"},
    )


@seo_bp.get("/robots.txt")
def robots():
    base = (current_app.config.get("PUBLIC_BASE_URL") or "").rstrip("/")
    lines = ["User-agent: *"]
    # Закрываем то, что роботу видеть незачем: личные разделы и API.
    lines += [f"Disallow: {path}/" for path in ("/admin", "/api")]
    lines += ["Disallow: /account", "Disallow: /login", "Disallow: /register"]
    lines += ["Disallow: /confirm/", "Disallow: /reset/"]
    lines += ["", f"Sitemap: {base}/sitemap.xml", ""]
    return Response("\n".join(lines), mimetype="text/plain")


@seo_bp.get("/sitemap.xml")
def sitemap():
    """Карта сайта из базы: статичные страницы плюс все опубликованные записи."""
    base = (current_app.config.get("PUBLIC_BASE_URL") or "").rstrip("/")
    urls: list[tuple[str, str | None, str]] = [
        ("/", None, "daily"),
        ("/news", None, "daily"),
        ("/startups", None, "weekly"),
        ("/services", None, "weekly"),
        ("/contacts", None, "monthly"),
        ("/privacy", None, "yearly"),
        ("/consent", None, "yearly"),
    ]

    for item in News.query.filter_by(is_published=True).all():
        stamp = item.updated_at or item.created_at
        urls.append((f"/news/{item.id}", stamp.date().isoformat() if stamp else None, "monthly"))
    for model, prefix in ((Project, "/startups"), (Service, "/services")):
        for item in model.query.filter_by(is_published=True).all():
            stamp = item.updated_at or item.created_at
            urls.append((f"{prefix}/{item.slug}", stamp.date().isoformat() if stamp else None, "monthly"))

    body = ['<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path, lastmod, freq in urls:
        body.append("  <url>")
        body.append(f"    <loc>{escape(base + path)}</loc>")
        if lastmod:
            body.append(f"    <lastmod>{lastmod}</lastmod>")
        body.append(f"    <changefreq>{freq}</changefreq>")
        body.append("  </url>")
    body.append("</urlset>")
    return Response("\n".join(body), mimetype="application/xml")
