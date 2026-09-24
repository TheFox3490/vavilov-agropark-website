"""Админские операции: управление новостями и просмотр заявок.

Раздел /admin в макете не нарисован — спроектирован самостоятельно
(ОТСТУПЛЕНИЕ ОТ МАКЕТА). Создание новости доступно двумя путями:
через встроенную форму в сетке новостей (как в макете) и через /admin.
"""

from __future__ import annotations

import os
import secrets
import uuid
from pathlib import Path

from flask import Blueprint, current_app, jsonify, request
from PIL import Image, ImageOps, UnidentifiedImageError
from werkzeug.utils import secure_filename

from ..extensions import db
from email_validator import EmailNotValidError, validate_email

from ..models import (
    Category,
    ContactRequest,
    News,
    Project,
    ProjectImage,
    Service,
    ServiceImage,
    StaffMember,
)
from ..security import admin_required, current_user
from ..settings import all_settings, update_settings
from ..slugs import slugify, unique_slug

bp = Blueprint("admin", __name__, url_prefix="/api/admin")

MAX_IMAGE_SIDE = 2400

# Кадр карточки в карусели первого экрана. Слот на странице не больше
# 295×200 CSS-пикселей, то есть 590×400 при двойной плотности; запас нужен,
# потому что пропорция карточки плавает от 1.44 до 2.61 в зависимости
# от экрана. Обрезку не делаем — кадрирует браузер.
CARD_IMAGE_BOX = (720, 520)
CARD_IMAGE_SUFFIX = "--card.webp"


def _card_variant(url: str) -> str:
    """Готовит облегчённую копию кадра для карусели и отдаёт её адрес.

    Кадр может прийти двумя путями: загрузкой файла или выбором готового
    снимка из галереи проекта. Во втором случае это полноразмерная
    фотография до 2400 px, и в карточку 288×200 она весила бы мегабайты,
    поэтому копию делаем в обоих случаях — на сохранении, а не на загрузке.

    Файлы из /media трогать нельзя: они лежат в образе фронтенда и уже
    пережаты скриптом tools/bake_cards.py.
    """
    if not url.startswith("/uploads/") or url.endswith(CARD_IMAGE_SUFFIX):
        return url

    upload_dir = Path(current_app.config["UPLOAD_DIR"])
    source = upload_dir / Path(url).name
    if not source.is_file():
        return url

    target = source.with_name(f"{source.stem}{CARD_IMAGE_SUFFIX}")
    if not target.is_file():
        try:
            with Image.open(source) as img:
                # Анимацию не трогаем: пересохранение в WebP оставило бы
                # от гифки один первый кадр.
                if getattr(img, "n_frames", 1) > 1:
                    return url

                # Телефоны пишут снимок как есть, а поворот кладут в EXIF.
                # Браузер этот тег уважает, а пересохранение его теряет —
                # без этой строки вертикальное фото легло бы набок.
                img = ImageOps.exif_transpose(img)

                has_alpha = img.mode in ("RGBA", "LA") or "transparency" in img.info
                # Цветовой профиль переносим: без него снимки из Adobe RGB
                # выцветают, а из Display P3 — наоборот, перенасыщаются.
                profile = img.info.get("icc_profile")
                img = img.convert("RGBA" if has_alpha else "RGB")
                img.thumbnail(CARD_IMAGE_BOX, Image.LANCZOS)
                img.save(target, "WEBP", quality=82, method=6, icc_profile=profile)
        except (UnidentifiedImageError, OSError, ValueError):
            # Не смогли пережать — не беда, покажем исходник.
            return url

        # Пережатие не всегда выигрывает: у простой графики с прозрачностью
        # PNG бывает легче WebP. Тогда копия только занимает место.
        if target.stat().st_size >= source.stat().st_size:
            target.unlink(missing_ok=True)
            return url

    return f"/uploads/{target.name}"



# --------------------------------------------------------------------------- #
#  Загрузка изображений (кнопка «+» во встроенной форме добавления новости)
# --------------------------------------------------------------------------- #
@bp.post("/upload")
@admin_required
def upload():
    file = request.files.get("file")
    if file is None or not file.filename:
        return jsonify(error="Файл не передан"), 400

    ext = Path(secure_filename(file.filename)).suffix.lower().lstrip(".")
    if ext not in current_app.config["ALLOWED_IMAGE_EXTENSIONS"]:
        return jsonify(error="Допустимы только изображения: png, jpg, webp, gif"), 400

    upload_dir = Path(current_app.config["UPLOAD_DIR"])
    upload_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}_{secrets.token_hex(4)}.{ext}"
    path = upload_dir / name
    file.save(path)

    # Проверяем, что это действительно картинка, и ужимаем гигантские исходники.
    try:
        with Image.open(path) as img:
            img.verify()
        with Image.open(path) as img:
            if max(img.size) > MAX_IMAGE_SIDE:
                img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
                img.save(path)
    except (UnidentifiedImageError, OSError):
        os.remove(path)
        return jsonify(error="Файл не является изображением"), 400

    return jsonify(url=f"/uploads/{name}"), 201


# --------------------------------------------------------------------------- #
#  Новости
# --------------------------------------------------------------------------- #
def _payload_to_news(item: News, data: dict) -> str | None:
    title = (data.get("title") or "").strip()
    body = (data.get("body") or "").strip()
    if not title:
        return "Укажите заголовок новости"
    if len(title) > 255:
        return "Заголовок длиннее 255 символов"

    # Категорию трогаем, только если её прислали. На сайте категорий больше
    # нет, и админка поле не отправляет, — а у старых новостей оно в базе
    # заполнено. Без этой проверки любая правка новости молча стирала бы
    # категорию, и вернуть их потом было бы уже не к чему.
    if "category_id" in data:
        category = None
        category_id = data.get("category_id")
        if category_id:
            category = db.session.get(Category, int(category_id))
            if category is None:
                return "Категория не найдена"
        item.category = category

    item.title = title
    item.body = body
    item.image_url = (data.get("image_url") or "").strip() or None
    if "is_published" in data:
        item.is_published = bool(data["is_published"])
    return None


@bp.get("/news")
@admin_required
def list_news():
    """Включая черновики — в публичной ленте их не видно."""
    items = News.query.order_by(News.created_at.desc(), News.id.desc()).all()
    return jsonify(items=[n.to_dict() for n in items])


@bp.post("/news")
@admin_required
def create_news():
    data = request.get_json(silent=True) or {}
    item = News(author=current_user())
    error = _payload_to_news(item, data)
    if error:
        return jsonify(error=error), 400
    db.session.add(item)
    db.session.commit()
    return jsonify(item=item.to_dict()), 201


@bp.patch("/news/<int:news_id>")
@admin_required
def update_news(news_id: int):
    item = db.session.get(News, news_id)
    if item is None:
        return jsonify(error="Новость не найдена"), 404
    data = request.get_json(silent=True) or {}
    error = _payload_to_news(item, data)
    if error:
        return jsonify(error=error), 400
    db.session.commit()
    return jsonify(item=item.to_dict())


@bp.delete("/news/<int:news_id>")
@admin_required
def delete_news(news_id: int):
    item = db.session.get(News, news_id)
    if item is None:
        return jsonify(error="Новость не найдена"), 404
    db.session.delete(item)
    db.session.commit()
    return jsonify(ok=True)


# --------------------------------------------------------------------------- #
#  Каталог: проекты («Наши стартапы») и услуги («Наши услуги»)
#
#  Разделы устроены одинаково — список карточек, у каждой своя страница
#  с галереей, — поэтому разбор запроса общий, а различается только модель
#  и набор дополнительных флагов.
# --------------------------------------------------------------------------- #
PROJECT_FLAGS = ("show_on_startups", "show_in_slider", "is_featured")

# Поля-строки и их предельные длины. У услуги полей карусели нет, лишние
# ключи в запросе просто игнорируются — setattr вызывается по этому списку.
TEXT_LIMITS = {
    "kind": 64,
    "summary": 600,
    "image_url": 512,
    "link_url": 512,
}
PROJECT_TEXT_LIMITS = {**TEXT_LIMITS, "card_title": 120, "card_image_url": 512}


def _payload_to_item(item, data: dict, *, model, image_model, what: str, limits, flags) -> str | None:
    title = (data.get("title") or "").strip()
    if not title:
        return f"Укажите название {what}"
    if len(title) > 160:
        return "Название длиннее 160 символов"

    # Адрес: что прислали, иначе из названия. Меняется только по явной правке —
    # ссылки на опубликованную карточку не должны протухать при переименовании.
    slug = slugify(data.get("slug") or "")
    if not slug and not item.slug:
        slug = slugify(title)
    if slug and slug != item.slug:

        def taken(candidate: str) -> bool:
            others = model.query.filter(model.slug == candidate, model.id != item.id)
            return others.first() is not None

        item.slug = unique_slug(slug, taken)
    if not item.slug:
        return "Не удалось составить адрес страницы — укажите его вручную"

    item.title = title

    # Трогаем только то, что прислали: форма админки отправляет карточку
    # целиком, но частичное обновление не должно стирать текст и картинки.
    for field, limit in limits.items():
        if field in data:
            value = (data.get(field) or "").strip()[:limit] or None
            if field == "card_image_url" and value:
                value = _card_variant(value)
            setattr(item, field, value)
    if "body" in data:
        item.body = (data.get("body") or "").strip()

    for flag in (*flags, "is_published"):
        if flag in data:
            setattr(item, flag, bool(data[flag]))

    if "images" in data:
        return _replace_images(item, data["images"], image_model)
    return None


def _replace_images(item, images, image_model) -> str | None:
    """Галерея приходит целиком: список {url, caption} в нужном порядке."""
    if not isinstance(images, list):
        return "Ожидается список изображений"
    if len(images) > 24:
        return "В галерее не больше 24 изображений"

    item.images.clear()
    for position, raw in enumerate(images, start=1):
        if isinstance(raw, str):
            raw = {"url": raw}
        if not isinstance(raw, dict):
            return "Изображение должно быть объектом с полем url"
        url = (raw.get("url") or "").strip()
        if not url:
            continue
        item.images.append(
            image_model(
                url=url[:512],
                caption=(raw.get("caption") or "").strip()[:255] or None,
                sort_order=position * 10,
            )
        )
    return None


def _register_catalog(path: str, *, model, image_model, what: str, missing: str, limits, flags=()):
    """Заводит на блюпринте пять ручек CRUD для одного раздела каталога.

    Ручки объявляются функцией, а не копированием: у проектов и услуг они
    отличались бы только именем модели и текстом ошибки, а разъезжаются
    такие копии быстро.
    """

    def parse(item, data):
        return _payload_to_item(
            item, data, model=model, image_model=image_model, what=what, limits=limits, flags=flags
        )

    @bp.get(f"/{path}", endpoint=f"list_{path}")
    @admin_required
    def listing():
        """Включая снятые с публикации."""
        items = model.query.order_by(model.sort_order, model.id).all()
        return jsonify(items=[i.to_dict(with_images=True) for i in items])

    @bp.post(f"/{path}", endpoint=f"create_{path}")
    @admin_required
    def create():
        data = request.get_json(silent=True) or {}
        item = model()
        if "sort_order" not in data:
            last = model.query.order_by(model.sort_order.desc()).first()
            item.sort_order = (last.sort_order + 10) if last else 10
        error = parse(item, data)
        if error:
            return jsonify(error=error), 400
        db.session.add(item)
        db.session.commit()
        return jsonify(item=item.to_dict(with_images=True)), 201

    @bp.patch(f"/{path}/<int:item_id>", endpoint=f"update_{path}")
    @admin_required
    def update(item_id: int):
        item = db.session.get(model, item_id)
        if item is None:
            return jsonify(error=missing), 404
        error = parse(item, request.get_json(silent=True) or {})
        if error:
            return jsonify(error=error), 400
        db.session.commit()
        return jsonify(item=item.to_dict(with_images=True))

    @bp.delete(f"/{path}/<int:item_id>", endpoint=f"delete_{path}")
    @admin_required
    def remove(item_id: int):
        item = db.session.get(model, item_id)
        if item is None:
            return jsonify(error=missing), 404
        db.session.delete(item)
        db.session.commit()
        return jsonify(ok=True)

    @bp.post(f"/{path}/reorder", endpoint=f"reorder_{path}")
    @admin_required
    def reorder():
        data = request.get_json(silent=True) or {}
        ids = data.get("ids") or []
        if not isinstance(ids, list):
            return jsonify(error="Ожидается список id"), 400
        for position, item_id in enumerate(ids, start=1):
            item = db.session.get(model, int(item_id))
            if item is not None:
                item.sort_order = position * 10
        db.session.commit()
        return jsonify(ok=True)


_register_catalog(
    "projects",
    model=Project,
    image_model=ProjectImage,
    what="проекта",
    missing="Проект не найден",
    limits=PROJECT_TEXT_LIMITS,
    flags=PROJECT_FLAGS,
)

_register_catalog(
    "services",
    model=Service,
    image_model=ServiceImage,
    what="услуги",
    missing="Услуга не найдена",
    limits=TEXT_LIMITS,
)


# --------------------------------------------------------------------------- #
#  Состав центра
# --------------------------------------------------------------------------- #
def _payload_to_staff(item: StaffMember, data: dict) -> str | None:
    last_name = (data.get("last_name") or "").strip()
    first_name = (data.get("first_name") or "").strip()
    if not last_name or not first_name:
        return "Фамилия и имя обязательны"

    email = (data.get("email") or "").strip()
    if email:
        try:
            email = validate_email(email, check_deliverability=False).normalized
        except EmailNotValidError:
            return "Некорректный адрес почты"

    item.last_name = last_name
    item.first_name = first_name
    # Отчество необязательно: у студентов его указывать неуместно.
    item.middle_name = (data.get("middle_name") or "").strip() or None
    item.role = (data.get("role") or "").strip() or None
    item.photo_url = (data.get("photo_url") or "").strip() or None
    item.phone = (data.get("phone") or "").strip() or None
    item.email = email or None
    item.telegram = (data.get("telegram") or "").strip() or None
    item.vk = (data.get("vk") or "").strip() or None
    if "sort_order" in data:
        try:
            item.sort_order = int(data["sort_order"])
        except (TypeError, ValueError):
            return "Порядок должен быть числом"
    if "is_published" in data:
        item.is_published = bool(data["is_published"])
    return None


@bp.get("/staff")
@admin_required
def list_staff():
    items = StaffMember.query.order_by(StaffMember.sort_order, StaffMember.id).all()
    return jsonify(items=[m.to_dict() for m in items])


@bp.post("/staff")
@admin_required
def create_staff():
    data = request.get_json(silent=True) or {}
    item = StaffMember()
    if "sort_order" not in data:
        # Новый сотрудник встаёт в конец списка.
        last = StaffMember.query.order_by(StaffMember.sort_order.desc()).first()
        item.sort_order = (last.sort_order + 10) if last else 10
    error = _payload_to_staff(item, data)
    if error:
        return jsonify(error=error), 400
    db.session.add(item)
    db.session.commit()
    return jsonify(item=item.to_dict()), 201


@bp.patch("/staff/<int:staff_id>")
@admin_required
def update_staff(staff_id: int):
    item = db.session.get(StaffMember, staff_id)
    if item is None:
        return jsonify(error="Сотрудник не найден"), 404
    data = request.get_json(silent=True) or {}
    error = _payload_to_staff(item, data)
    if error:
        return jsonify(error=error), 400
    db.session.commit()
    return jsonify(item=item.to_dict())


@bp.delete("/staff/<int:staff_id>")
@admin_required
def delete_staff(staff_id: int):
    item = db.session.get(StaffMember, staff_id)
    if item is None:
        return jsonify(error="Сотрудник не найден"), 404
    db.session.delete(item)
    db.session.commit()
    return jsonify(ok=True)


@bp.post("/staff/reorder")
@admin_required
def reorder_staff():
    """Принимает список id в нужном порядке и перенумеровывает."""
    data = request.get_json(silent=True) or {}
    ids = data.get("ids") or []
    if not isinstance(ids, list):
        return jsonify(error="Ожидается список id"), 400
    for position, staff_id in enumerate(ids, start=1):
        item = db.session.get(StaffMember, int(staff_id))
        if item is not None:
            item.sort_order = position * 10
    db.session.commit()
    return jsonify(ok=True)


# --------------------------------------------------------------------------- #
#  Настройки сайта: контакты центра и правовые документы
# --------------------------------------------------------------------------- #
@bp.get("/settings")
@admin_required
def read_settings():
    return jsonify(settings=all_settings())


@bp.patch("/settings")
@admin_required
def write_settings():
    data = request.get_json(silent=True) or {}
    error = update_settings(data.get("settings") if "settings" in data else data)
    if error:
        return jsonify(error=error), 400
    return jsonify(settings=all_settings())


# --------------------------------------------------------------------------- #
#  Заявки с формы обратной связи
# --------------------------------------------------------------------------- #
@bp.get("/contact-requests")
@admin_required
def list_requests():
    items = ContactRequest.query.order_by(ContactRequest.created_at.desc()).all()
    return jsonify(
        items=[r.to_dict() for r in items],
        unhandled=sum(1 for r in items if not r.is_handled),
    )


@bp.patch("/contact-requests/<int:request_id>")
@admin_required
def update_request(request_id: int):
    item = db.session.get(ContactRequest, request_id)
    if item is None:
        return jsonify(error="Заявка не найдена"), 404
    data = request.get_json(silent=True) or {}
    if "is_handled" in data:
        item.is_handled = bool(data["is_handled"])
    db.session.commit()
    return jsonify(item=item.to_dict())


@bp.delete("/contact-requests/<int:request_id>")
@admin_required
def delete_request(request_id: int):
    item = db.session.get(ContactRequest, request_id)
    if item is None:
        return jsonify(error="Заявка не найдена"), 404
    db.session.delete(item)
    db.session.commit()
    return jsonify(ok=True)
