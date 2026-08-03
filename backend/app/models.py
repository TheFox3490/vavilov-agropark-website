"""Модели данных.

Состав таблиц продиктован макетом:
  users            — экраны «Вход в аккаунт» / «Регистрация»
  categories       — фильтры новостей «Мероприятия / Образовательные курсы / Робототехника»
  news             — сетка новостей и модалка с полным текстом
  projects         — карточки на странице «Наши стартапы»
  services         — карточки на странице «Наши услуги»
  project_images   — галерея проекта
  service_images   — галерея услуги
  staff_members    — карусель состава центра на странице «Контакты»
  contact_requests — форма обратной связи на странице «Контакты»
  settings         — контакты центра и правовые документы, правятся из админки

Отступления от макета отмечены комментариями ОТСТУПЛЕНИЕ.
"""

from datetime import datetime, timezone

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .extensions import db

_hasher = PasswordHasher()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)

    # ОТСТУПЛЕНИЕ ОТ МАКЕТА: в форме регистрации поля email нет, но экран
    # «Регистрация успешна» просит проверить почту, а на экране входа есть
    # «Забыли пароль?». Без адреса ни то, ни другое не реализуемо, поэтому поле добавлено.
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)

    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    news: Mapped[list["News"]] = relationship(back_populates="author")

    def set_password(self, raw: str) -> None:
        self.password_hash = _hasher.hash(raw)

    def check_password(self, raw: str) -> bool:
        try:
            _hasher.verify(self.password_hash, raw)
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            return False
        if _hasher.check_needs_rehash(self.password_hash):
            self.password_hash = _hasher.hash(raw)
        return True

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "is_admin": self.is_admin,
            "email_confirmed": self.email_confirmed,
            "avatar_url": self.avatar_url,
        }


class Category(db.Model):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    # Цвет бейджа на карточке — в макете у каждой категории свой.
    color: Mapped[str] = mapped_column(String(16), nullable=False, default="#8400FF")
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    news: Mapped[list["News"]] = relationship(back_populates="category")

    def to_dict(self) -> dict:
        return {"id": self.id, "slug": self.slug, "title": self.title, "color": self.color}


class News(db.Model):
    __tablename__ = "news"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # ОТСТУПЛЕНИЕ ОТ МАКЕТА: во встроенной форме добавления новости поля заголовка нет,
    # хотя в модалке с раскрытой новостью заголовок отображается. Считаем обязательным.
    title: Mapped[str] = mapped_column(String(255), nullable=False)

    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    author_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=utcnow, nullable=False
    )

    category: Mapped["Category | None"] = relationship(back_populates="news")
    author: Mapped["User | None"] = relationship(back_populates="news")

    __table_args__ = (Index("ix_news_feed", "is_published", "created_at"),)

    def to_dict(self, with_body: bool = True) -> dict:
        data = {
            "id": self.id,
            "title": self.title,
            "image_url": self.image_url,
            "is_published": self.is_published,
            "category": self.category.to_dict() if self.category else None,
            "author": self.author.username if self.author else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if with_body:
            data["body"] = self.body
        return data


class CatalogItem:
    """Общие поля карточки каталога — проекта и услуги.

    ОТСТУПЛЕНИЕ ОТ МАКЕТА: в макете «Стартапы» и «Услуги» нарисованы
    статичными списками. Центру нужно вести их самому, поэтому обе страницы
    работают одинаково: список карточек, у каждой своя страница с галереей,
    всё правится из админки.

    Примесь, а не общая таблица: у проекта есть поля карусели первого экрана,
    которых у услуги нет и не будет, а адреса /startups/… и /services/…
    живут в своих пространствах имён — одинаковый slug в разных разделах
    конфликтовать не должен.
    """

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Адрес страницы: /startups/vr-tehnum. Складывается из названия,
    # но правится вручную — после публикации адрес менять нельзя.
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(160), nullable=False)

    # Подпись над названием: у проектов «Платформа» / «Приложение» /
    # «VR тренажёр». Обычная строка, а не справочник: значений единицы,
    # фильтрации по ним нет.
    kind: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Короткий текст для карточки в списке. Пусто — берётся начало body.
    summary: Mapped[str | None] = mapped_column(String(600), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")

    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Адрес кнопки на странице карточки. Пусто — ведём на форму обратной
    # связи: в макете у кнопки адреса нет.
    link_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    sort_order: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=utcnow, nullable=False
    )

    def to_dict(self, with_body: bool = True, with_images: bool = False) -> dict:
        data = {
            "id": self.id,
            "slug": self.slug,
            "title": self.title,
            "kind": self.kind,
            "summary": self.summary,
            "image_url": self.image_url,
            "link_url": self.link_url,
            "sort_order": self.sort_order,
            "is_published": self.is_published,
        }
        if with_body:
            data["body"] = self.body
        if with_images:
            data["images"] = [i.to_dict() for i in self.images]
        return data


class GalleryImage:
    """Общие поля кадра галереи."""

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    url: Mapped[str] = mapped_column(String(512), nullable=False)
    caption: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=100, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "url": self.url,
            "caption": self.caption,
            "sort_order": self.sort_order,
        }


class Project(CatalogItem, db.Model):
    """Проект центра — карточка на странице «Наши стартапы».

    Один и тот же проект показывается в нескольких местах сайта с разным
    оформлением, поэтому «где показывать» — это флаги, а не отдельные таблицы:
    в макете Технум, Сектор-ЦД и Вектор-Сервис есть и на странице стартапов,
    и в карусели первого экрана, просто с другими кадрами и короткими именами.

    Поля card_* и show_in_slider/is_featured заведены заранее: карусель
    первого экрана и блок «Наши проекты» на главной пока читают статику
    из content.js, их перевод на эту таблицу — следующий шаг. Столбцы
    добавлены сразу, чтобы тогда не понадобилась ещё одна миграция.
    """

    __tablename__ = "projects"

    # Короткое имя и отдельный кадр для карусели первого экрана: там у Технума
    # трактор, а на странице стартапов — человек в шлеме. Одной картинкой
    # эти два места не закрыть.
    card_title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    card_image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    show_on_startups: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    show_in_slider: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    images: Mapped[list["ProjectImage"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="ProjectImage.sort_order, ProjectImage.id",
    )

    __table_args__ = (Index("ix_projects_order", "is_published", "sort_order"),)

    @property
    def slider_title(self) -> str:
        """Имя для карусели: короткое, если задано, иначе обычное."""
        return (self.card_title or "").strip() or self.title

    @property
    def card_image(self) -> str | None:
        """Кадр для карточки в карусели.

        Свой кадр, иначе главная картинка, иначе первый снимок галереи.
        Считается здесь, а не на клиенте: в списке проектов галерея
        не передаётся, и на странице до неё было бы не дотянуться.
        """
        for candidate in (self.card_image_url, self.image_url):
            if candidate and candidate.strip():
                return candidate
        return self.images[0].url if self.images else None

    def to_dict(self, with_body: bool = True, with_images: bool = False) -> dict:
        data = super().to_dict(with_body=with_body, with_images=with_images)
        data.update(
            card_title=self.card_title,
            card_image_url=self.card_image_url,
            card_image=self.card_image,
            slider_title=self.slider_title,
            show_on_startups=self.show_on_startups,
            show_in_slider=self.show_in_slider,
            is_featured=self.is_featured,
        )
        return data


class ProjectImage(GalleryImage, db.Model):
    """Кадр в галерее проекта на странице /startups/<slug>."""

    __tablename__ = "project_images"

    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )

    project: Mapped["Project"] = relationship(back_populates="images")


class Service(CatalogItem, db.Model):
    """Услуга центра — карточка на странице «Наши услуги».

    Устроена так же, как проект: список, своя страница, галерея, порядок
    и публикация из админки. Полей карусели у услуги нет — на главной
    услуги отдельным блоком не показываются.
    """

    __tablename__ = "services"

    images: Mapped[list["ServiceImage"]] = relationship(
        back_populates="service",
        cascade="all, delete-orphan",
        order_by="ServiceImage.sort_order, ServiceImage.id",
    )

    __table_args__ = (Index("ix_services_order", "is_published", "sort_order"),)


class ServiceImage(GalleryImage, db.Model):
    """Кадр в галерее услуги на странице /services/<slug>."""

    __tablename__ = "service_images"

    service_id: Mapped[int] = mapped_column(
        ForeignKey("services.id", ondelete="CASCADE"), nullable=False, index=True
    )

    service: Mapped["Service"] = relationship(back_populates="images")


class StaffMember(db.Model):
    """Сотрудник центра — карточка в карусели на странице «Контакты».

    ОТСТУПЛЕНИЕ ОТ МАКЕТА: в макете нарисована одна карточка руководителя.
    Центру нужен весь состав с возможностью править его из админки.

    Имя хранится по частям, а не одной строкой: среди сотрудников есть
    студенты, у которых отчество указывать неуместно. Поле middle_name
    необязательное, и в выводе оно просто опускается.
    """

    __tablename__ = "staff_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    last_name: Mapped[str] = mapped_column(String(80), nullable=False)
    first_name: Mapped[str] = mapped_column(String(80), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(80), nullable=True)

    role: Mapped[str | None] = mapped_column(String(160), nullable=True)  # должность
    photo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    telegram: Mapped[str | None] = mapped_column(String(255), nullable=True)
    vk: Mapped[str | None] = mapped_column(String(255), nullable=True)

    sort_order: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (Index("ix_staff_order", "is_published", "sort_order"),)

    @property
    def full_name(self) -> str:
        """«Фамилия Имя Отчество», а без отчества — «Фамилия Имя»."""
        parts = [self.last_name, self.first_name, self.middle_name]
        return " ".join(p.strip() for p in parts if p and p.strip())

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "last_name": self.last_name,
            "first_name": self.first_name,
            "middle_name": self.middle_name,
            "full_name": self.full_name,
            "role": self.role,
            "photo_url": self.photo_url,
            "phone": self.phone,
            "email": self.email,
            "telegram": self.telegram,
            "vk": self.vk,
            "sort_order": self.sort_order,
            "is_published": self.is_published,
        }


class Setting(db.Model):
    """Настройки сайта: ключ — значение.

    Сюда сложены вещи, которые меняются раз в год, но лезть за ними в код
    нельзя: контакты центра и тексты правовых документов. Отдельная таблица
    на каждую мелочь была бы избыточной, а список ключей известен заранее —
    он вместе со значениями по умолчанию лежит в app/settings.py.

    Значения хранятся строками, в том числе многострочными: разбирать типы
    незачем, всё это идёт прямо в разметку.
    """

    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=utcnow, nullable=False
    )


class ContactRequest(db.Model):
    """Заявка с формы «Форма для связи с нами» на странице Контакты."""

    __tablename__ = "contact_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(64), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    consent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_handled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "phone": self.phone,
            "message": self.message,
            "consent": self.consent,
            "is_handled": self.is_handled,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
