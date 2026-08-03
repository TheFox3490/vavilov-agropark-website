"""Команды обслуживания: сид категорий и создание администратора."""

from __future__ import annotations

import os
from pathlib import Path

import click
from flask import Flask, current_app

from .extensions import db
from .models import (
    Category,
    ContactRequest,
    News,
    Project,
    ProjectImage,
    Service,
    ServiceImage,
    StaffMember,
    User,
)

# Категории и цвета бейджей взяты из макета (экран «Новости»).
DEFAULT_CATEGORIES = [
    {"slug": "events", "title": "Мероприятия", "color": "#FF0AE6", "position": 1},
    {"slug": "courses", "title": "Образовательные курсы", "color": "#8400FF", "position": 2},
    {"slug": "robotics", "title": "Робототехника", "color": "#0090FF", "position": 3},
]


def seed_categories() -> int:
    created = 0
    for payload in DEFAULT_CATEGORIES:
        if Category.query.filter_by(slug=payload["slug"]).first() is None:
            db.session.add(Category(**payload))
            created += 1
    db.session.commit()
    return created


def ensure_admin(username: str, email: str, password: str) -> tuple[User, bool]:
    user = User.query.filter(db.func.lower(User.username) == username.lower()).first()
    if user is not None:
        # Права поднимаем, но существующий пароль не трогаем.
        if not user.is_admin:
            user.is_admin = True
            db.session.commit()
        return user, False

    user = User(username=username, email=email, is_admin=True, email_confirmed=True)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return user, True


# Единственная настоящая новость из макета — дизайнер положила её в экран
# «Новости затемнение» вместе с полным текстом.
REAL_NEWS = {
    "title": (
        "Специалисты Центра VR/AR и агроробототехники изучили опрыскиватель "
        "«Туман-3» для разработки VR-тренажёра"
    ),
    "category": "courses",
    "image_url": "/media/novosti--frame-13-d510b9.webp",
    "body": (
        "Сотрудники Центра VR/AR и агроробототехники Вавиловского университета провели "
        "выездную работу по сбору материалов для создания нового VR-тренажёра. В рамках "
        "поездки специалисты детально изучили работу самоходного опрыскивателя «Туман-3».\n\n"
        "Во время выезда команда центра:\n"
        "— зафиксировала полный процесс раскладывания и подготовки машины к работе;\n"
        "— изучила особенности управления и функционирования узлов;\n"
        "— провела фото- и видеофиксацию всех технологических операций;\n"
        "— собрала данные, необходимые для точной цифровой модели "
        "и последующей симуляции.\n\n"
        "Полученная информация станет основой для разработки высокореалистичного "
        "VR-тренажёра, который позволит обучающимся безопасно и эффективно осваивать "
        "навыки работы с современными агротехническими машинами.\n\n"
        "Проект направлен на повышение качества подготовки кадров для аграрного сектора "
        "и внедрение в обучение современных цифровых технологий."
    ),
}

# Остальные карточки — заглушки на настоящих фотографиях центра из макета.
# Заголовки помечены явно, чтобы их нельзя было принять за настоящие новости:
# выдумывать события за реальную организацию нельзя.
PLACEHOLDER_NEWS = [
    {
        "title": "[Пример] Цифровой мониторинг полей",
        "category": "events",
        "image_url": "/media/novosti--frame-10-7be256.webp",
    },
    {
        "title": "[Пример] Команда центра на соревнованиях",
        "category": "robotics",
        "image_url": "/media/novosti--frame-11-9a841c.webp",
    },
    {
        "title": "[Пример] Рабочая сессия со студентами",
        "category": "events",
        "image_url": "/media/novosti--frame-12-80a282.webp",
    },
    {
        "title": "[Пример] Занятие на сельхозтехнике",
        "category": "courses",
        "image_url": "/media/novosti--frame-14-cabfef.webp",
    },
]

PLACEHOLDER_BODY = (
    "Это демонстрационная запись: она наполняет ленту, пока центр не добавил "
    "собственные новости. Фотография взята из макета. Удалите или отредактируйте "
    "запись в разделе «Админка» → «Новости»."
)


# Руководитель центра — единственная карточка, нарисованная в макете.
# Остальной состав центр добавляет через админку.
HEAD_OF_CENTER = {
    "last_name": "Гончаров",
    "first_name": "Роман",
    "middle_name": "Дмитриевич",
    "role": "Руководитель центра",
    "photo_url": "/media/kontakty--imghawaii-1-984eed.webp",
    "email": "vr.techum@gmail.com",
    "phone": "+7 (987) 800-26-70",
    "sort_order": 10,
}


def seed_staff() -> int:
    """Заводит руководителя, если состав ещё пуст."""
    if StaffMember.query.first() is not None:
        return 0
    db.session.add(StaffMember(**HEAD_OF_CENTER))
    db.session.commit()
    return 1


# Стартапы из макета: четыре карточки на странице «Наши стартапы».
# Заводятся при первом запуске, дальше центр ведёт их сам через админку.
#
# Три из них показываются ещё и в карусели первого экрана — там у карточки
# своё короткое имя («Технум» вместо «VR TEHNUM», иначе не влезает) и свой
# кадр: в макете на странице стартапов у Технума человек в шлеме, а в карусели
# трактор. Кадры карусели пережаты скриптом tools/bake_cards.py.
STARTUP_PROJECTS = [
    {
        "slug": "vr-tehnum",
        "title": "VR TEHNUM",
        "image_url": "/media/startapy--izobrazhenie-2-772796.webp",
        "body": (
            "Современные VR-тренажеры – это симуляторы в виртуальной среде, в которых учтены все "
            "требования к обучению. Тщательно проработана последовательность проведения работ с "
            "обоснованием: почему одни действия верны, а другие нет. Мы используем в работе новые "
            "технологии, следим за выходом новой сельскохозяйственной техники и поможем определиться "
            "со спецификой вашего приложения. Технум-64 специализируется на разработке решений с "
            "использованием современного программного обеспечения. Основным направлением компании "
            "являются VR-решения для агропромышленного комплекса, однако не исключается и создание "
            "приложений для других сфер деятельности."
        ),
        "sort_order": 10,
        "kind": "Платформа",
        "card_title": "Технум",
        "card_image_url": "/media/cards/vav--imgisland-1-323c3d.webp",
        "show_in_slider": True,
    },
    {
        "slug": "vector-service",
        "title": "Вектор-Сервис",
        "image_url": "/media/startapy--izobrazhenie3-397514.webp",
        "body": (
            "Интеллектуальная система технического сервиса предназначена для обеспечения технической "
            "поддержки и помощи принятия решения при выполнении регламентных работ по послепродажному "
            "обслуживанию сельскохозяйственной техники. Система позволяет заполнять цифровые "
            "технологические карты голосовым вводом, обращаться к справочному материалу при "
            "необходимости, а также вести полный контроль за правильностью проведения технического "
            "обслуживания с использованием средств дополненной реальности и программы. Также имеется "
            "возможность распознавания QR-меток на узлах и агрегатах, а мультиплатформенность "
            "программы позволяет пользоваться ею на современных устройствах."
        ),
        "sort_order": 20,
        "kind": "Приложение",
        "card_title": "Вектор-Сервис",
        "card_image_url": "/media/cards/vav--imgisland-1-da3f9f.webp",
        "show_in_slider": True,
    },
    {
        "slug": "sector-cd",
        "title": "Сектор-ЦД",
        "image_url": "/media/startapy--izobrazhenie3-f74fad.webp",
        "body": (
            "Платформа, включающая в себя комплекс цифровых двойников в формате VR и 360 по обучению "
            "растениеводству, животноводству и ветеринарии для специалистов, а также обучающихся "
            "ВУЗов и колледжей. Используется новая методика с полным погружением в рабочий процесс "
            "без необходимости взаимодействовать с реальными растениями и животными, позволяя "
            "экономить физические ресурсы, а также сократить затраты на перемещение сотрудников и "
            "студентов. Учащиеся по-прежнему будут общаться с наставниками, но также будут "
            "взаимодействовать с 3D-моделями реальных оцифрованных объектов, с которыми в последствии "
            "им предстоит работать."
        ),
        "sort_order": 30,
        "kind": "Приложение",
        "card_title": "Сектор-ЦД",
        "card_image_url": "/media/cards/vav--imgisland-1-4b9cda.webp",
        "show_in_slider": True,
    },
    {
        "slug": "sector-mk",
        "title": "Сектор-МК",
        "image_url": "/media/vav--imghawaii-1-479833.webp",
        "body": (
            "Проект представляет собой уникальное транспортное средство, объединяющее в себе наземную "
            "машину и квадрокоптер. Эти две модели, спроектированные для радиоуправления, открывают "
            "двери в мир технических возможностей и креативного обучения. Самостоятельная сборка и "
            "программирование обеих моделей — машинки и квадрокоптера — становятся ключевым этапом "
            "обучения. Это позволяет нашим пользователям развивать навыки инженерии и "
            "программирования, а затем воплощать их в жизнь, управляя устройствами. Мы приглашаем "
            "школьников и студентов технических ВУЗов в захватывающее путешествие, где они могут "
            "создавать, программировать и управлять собственными устройствами."
        ),
        "sort_order": 40,
        "kind": "Платформа",
    },
]

# Остальные карточки карусели первого экрана. В макете их восемь, и пять
# из них — не стартапы: описаний у них нет, поэтому в список «Наши стартапы»
# они не попадают, пока центр не напишет текст и не поставит галочку.
SLIDER_ONLY_PROJECTS = [
    {
        "slug": "vr-osemenenie",
        "title": "VR-тренажёр по осеменению коров",
        "kind": "VR тренажёр",
        "card_title": "По осеменению коров",
        "card_image_url": "/media/cards/vav--imgisland-1-afc040.webp",
        "sort_order": 50,
    },
    {
        "slug": "sad-vr",
        "title": "Сад VR",
        "kind": "VR тренажёр",
        "card_title": "Сад VR",
        "card_image_url": "/media/cards/vav--imgisland-1-d2eebd.webp",
        "sort_order": 60,
    },
    {
        "slug": "agrogrom",
        "title": "AgroGROM",
        "kind": "Платформа",
        "card_title": "AgroGROM",
        "card_image_url": "/media/cards/vav--imgisland-1-23e31e.webp",
        "sort_order": 70,
    },
    {
        "slug": "agrotrack",
        "title": "AgroTrack",
        "kind": "Платформа",
        "card_title": "AgroTrack",
        "card_image_url": "/media/cards/vav--imgisland-1-05a8a4.webp",
        "sort_order": 80,
    },
    {
        "slug": "uchet-bolnyh-zhivotnyh",
        "title": "Приложение учёта больных животных",
        "kind": "Приложение",
        "card_title": "Учёта больных животных",
        "card_image_url": "/media/cards/vav--imgisland-1-14dd91.webp",
        "sort_order": 90,
    },
]


def seed_projects() -> int:
    """Заводит проекты из макета, если список ещё пуст."""
    if Project.query.first() is not None:
        return 0
    for payload in STARTUP_PROJECTS:
        # Стартапы показываются в списке и в блоке «Наши проекты» на главной.
        db.session.add(Project(is_featured=True, **payload))
    for payload in SLIDER_ONLY_PROJECTS:
        # Эти — только в карусели: описания у них пока нет.
        db.session.add(Project(show_on_startups=False, show_in_slider=True, **payload))
    db.session.commit()
    return len(STARTUP_PROJECTS) + len(SLIDER_ONLY_PROJECTS)


# Услуги из макета. У четырёх из пяти в макете продублирован один и тот же
# абзац про лазерную резку — так у дизайнера. Тексты перенесены как есть,
# центр правит их в админке, вкладка «Услуги».
CENTER_SERVICES = [
    {
        "slug": "vr-ar",
        "title": "Разработка VR/AR",
        "image_url": "/media/uslugi--vr-395f51.webp",
        "body": (
            "Создание VR — игры, приложения, полноценные симуляторы и тренажеры для коммерческих "
            "проектов с максимально приближенными к реальности условиями и с полным взаимодействием "
            "сенсорного восприятия человека. Услуги профессиональной разработки панорамного видео 360 "
            "градусов. Современное оборудование позволяет создать уникальный видеоряд, способный ярко "
            "и красочно рассказать о продукции или услуге. При совмещении видео 360 с очками "
            "виртуальной реальности можно добиться действительно удивительного эффекта присутствия в "
            "местах не всегда доступных для их посещения."
        ),
        "sort_order": 10,
    },
    {
        "slug": "laser-cut",
        "title": "Лазерная резка",
        "image_url": "/media/uslugi--lazer-0eda70.webp",
        "body": (
            "Услуги лазерной резки дерева (фанеры), оргстекла, пластика для изготовления различных "
            "деталей рекламных конструкций (таблички, номерки, буквы, плашки, световые полоски, "
            "световые декоративные элементы в виде фигур). В короткие сроки сделаем макет по образцу "
            "или придумаем оригинальный макет. Лазерная гравировка наносится на различные предметы из "
            "дерева, пластика, для создания сувенирной продукции. Лазерная резка и гравировка "
            "позволяет сделать элементы декора для дома и офиса: шкатулки, светильники, подставки для "
            "полиграфии, карманы, трафареты и сувениры."
        ),
        "sort_order": 20,
    },
    {
        "slug": "laser-mark",
        "title": "Лазерная маркировка",
        "image_url": "/media/uslugi--mark-650192.webp",
        "body": (
            "Услуги лазерной резки дерева (фанеры), оргстекла, пластика для изготовления различных "
            "деталей рекламных конструкций (таблички, номерки, буквы, плашки, световые полоски, "
            "световые декоративные элементы в виде фигур). В короткие сроки сделаем макет по образцу "
            "или придумаем оригинальный макет. Лазерная гравировка наносится на различные предметы из "
            "дерева, пластика, для создания сувенирной продукции. Лазерная резка и гравировка "
            "позволяет сделать элементы декора для дома и офиса: шкатулки, светильники, подставки для "
            "полиграфии, карманы, трафареты и сувениры."
        ),
        "sort_order": 30,
    },
    {
        "slug": "courses",
        "title": "Образовательные курсы",
        "image_url": "/media/uslugi--kursy-9df0c2.webp",
        "body": (
            "Услуги лазерной резки дерева (фанеры), оргстекла, пластика для изготовления различных "
            "деталей рекламных конструкций (таблички, номерки, буквы, плашки, световые полоски, "
            "световые декоративные элементы в виде фигур). В короткие сроки сделаем макет по образцу "
            "или придумаем оригинальный макет. Лазерная гравировка наносится на различные предметы из "
            "дерева, пластика, для создания сувенирной продукции. Лазерная резка и гравировка "
            "позволяет сделать элементы декора для дома и офиса: шкатулки, светильники, подставки для "
            "полиграфии, карманы, трафареты и сувениры."
        ),
        "sort_order": 40,
    },
    {
        "slug": "prototyping",
        "title": "Прототипирование",
        "image_url": "/media/uslugi--3d-b61be6.webp",
        "body": (
            "Услуги лазерной резки дерева (фанеры), оргстекла, пластика для изготовления различных "
            "деталей рекламных конструкций (таблички, номерки, буквы, плашки, световые полоски, "
            "световые декоративные элементы в виде фигур). В короткие сроки сделаем макет по образцу "
            "или придумаем оригинальный макет. Лазерная гравировка наносится на различные предметы из "
            "дерева, пластика, для создания сувенирной продукции. Лазерная резка и гравировка "
            "позволяет сделать элементы декора для дома и офиса: шкатулки, светильники, подставки для "
            "полиграфии, карманы, трафареты и сувениры."
        ),
        "sort_order": 50,
    },
]


def seed_services() -> int:
    """Заводит услуги из макета, если список ещё пуст."""
    if Service.query.first() is not None:
        return 0
    for payload in CENTER_SERVICES:
        db.session.add(Service(**payload))
    db.session.commit()
    return len(CENTER_SERVICES)


# Все места, где в базе может лежать ссылка на загруженный файл. Список
# перечислен явно, а не собран по метаданным: забыть новую колонку страшнее,
# чем написать лишнюю строку — забытая означает удаление нужного файла.
FILE_COLUMNS = (
    (News, "image_url"),
    (Project, "image_url"),
    (Project, "card_image_url"),
    (ProjectImage, "url"),
    (Service, "image_url"),
    (ServiceImage, "url"),
    (StaffMember, "photo_url"),
    (User, "avatar_url"),
)


def used_uploads() -> set[str]:
    """Имена файлов из /uploads, на которые есть ссылка в базе."""
    names: set[str] = set()
    for model, column in FILE_COLUMNS:
        for (value,) in db.session.query(getattr(model, column)).distinct():
            if value and value.startswith("/uploads/"):
                names.add(Path(value).name)
    return names


def wipe_content() -> dict[str, int]:
    """Удаляет всё наполнение сайта. Учётки и настройки не трогает."""
    removed = {}
    # Галереи уходят каскадом вместе с карточками, но считаем их отдельно —
    # чтобы в отчёте было видно, сколько всего исчезло.
    removed["кадров галерей"] = ProjectImage.query.count() + ServiceImage.query.count()
    removed["проектов"] = Project.query.delete()
    removed["услуг"] = Service.query.delete()
    removed["новостей"] = News.query.delete()
    removed["сотрудников"] = StaffMember.query.delete()
    removed["заявок"] = ContactRequest.query.delete()
    db.session.commit()
    return removed


def seed_demo_news() -> int:
    """Наполняет ленту демонстрационным содержимым: одна настоящая статья
    из макета плюс карточки с пометкой «[Пример]» на фотографиях центра.
    Записи с такими же заголовками повторно не заводятся."""
    seed_categories()
    categories = {c.slug: c for c in Category.query.all()}
    author = User.query.filter_by(is_admin=True).order_by(User.id).first()

    created = 0
    for payload in [REAL_NEWS, *PLACEHOLDER_NEWS]:
        if News.query.filter_by(title=payload["title"]).first() is not None:
            continue
        db.session.add(
            News(
                title=payload["title"],
                body=payload.get("body", PLACEHOLDER_BODY),
                image_url=payload["image_url"],
                category=categories.get(payload["category"]),
                author=author,
                is_published=True,
            )
        )
        created += 1
    db.session.commit()
    return created


def register_cli(app: Flask) -> None:
    @app.cli.command("seed")
    def seed_command():
        """Заполняет категории и создаёт администратора из переменных окружения."""
        created = seed_categories()
        click.echo(f"Категорий добавлено: {created}")
        click.echo(f"Сотрудников добавлено: {seed_staff()}")
        click.echo(f"Проектов добавлено: {seed_projects()}")
        click.echo(f"Услуг добавлено: {seed_services()}")

        username = os.environ.get("ADMIN_USERNAME", "").strip()
        password = os.environ.get("ADMIN_PASSWORD", "").strip()
        email = os.environ.get("ADMIN_EMAIL", "").strip()
        if not (username and password and email):
            click.echo("ADMIN_USERNAME / ADMIN_EMAIL / ADMIN_PASSWORD не заданы — админ не создан.")
            return

        user, is_new = ensure_admin(username, email, password)
        click.echo(
            f"Администратор {user.username}: {'создан' if is_new else 'уже существовал'}"
        )

    @app.cli.command("seed-slider")
    def seed_slider_command():
        """Наполняет карусель первого экрана карточками из макета.

        Нужна для базы, заведённой до того, как карусель научилась читать
        проекты: обычный `seed` пропускает непустую таблицу. Команду можно
        запускать повторно — заполняются только пустые поля, а карточки,
        которые уже есть, не трогаются.
        """
        updated = created = 0
        for payload in STARTUP_PROJECTS:
            if not payload.get("show_in_slider"):
                continue
            item = Project.query.filter_by(slug=payload["slug"]).first()
            if item is None or item.show_in_slider:
                continue
            item.kind = item.kind or payload.get("kind")
            item.card_title = item.card_title or payload.get("card_title")
            item.card_image_url = item.card_image_url or payload.get("card_image_url")
            item.show_in_slider = True
            updated += 1

        for payload in SLIDER_ONLY_PROJECTS:
            if Project.query.filter_by(slug=payload["slug"]).first() is not None:
                continue
            db.session.add(Project(show_on_startups=False, show_in_slider=True, **payload))
            created += 1

        db.session.commit()
        click.echo(f"Проектов добавлено в карусель: {updated}, заведено новых: {created}")

    @app.cli.command("seed-demo")
    @click.option("--clear", is_flag=True, help="Сначала удалить все существующие новости")
    def seed_demo_command(clear: bool):
        """Наполняет ленту новостей демонстрационным содержимым.

        Нужна, чтобы страница «Новости» не выглядела пустой до того, как центр
        добавит свои материалы. На боевом сервере запускать необязательно.
        """
        if clear:
            removed = News.query.delete()
            db.session.commit()
            click.echo(f"Удалено новостей: {removed}")

        created = seed_demo_news()
        click.echo(f"Добавлено новостей: {created}")
        if created:
            click.echo("Записи с пометкой [Пример] удаляются в админке в два клика.")

    @app.cli.command("prune-uploads")
    @click.option("--dry-run", is_flag=True, help="Только показать, ничего не удалять")
    def prune_uploads_command(dry_run: bool):
        """Удаляет из /uploads файлы, на которые в базе нет ссылок.

        Такие остаются после замены картинки и после удаления записи: сам файл
        при этом никуда не девается. Со временем том распухает.
        """
        upload_dir = Path(current_app.config["UPLOAD_DIR"])
        if not upload_dir.is_dir():
            click.echo("Папка загрузок не найдена.")
            return

        used = used_uploads()
        orphans = [f for f in sorted(upload_dir.iterdir()) if f.is_file() and f.name not in used]
        if not orphans:
            click.echo(f"Потерявшихся файлов нет, используется: {len(used)}.")
            return

        freed = sum(f.stat().st_size for f in orphans)
        for f in orphans:
            click.echo(f"  {'нашёлся' if dry_run else 'удалён'}: {f.name} ({f.stat().st_size // 1024} КБ)")
            if not dry_run:
                f.unlink()

        verb = "Нашлось" if dry_run else "Удалено"
        click.echo(f"{verb}: {len(orphans)} файлов, {freed / 1024 / 1024:.2f} МБ. Осталось: {len(used)}.")
        if dry_run:
            click.echo("Это был пробный прогон — запусти без --dry-run, чтобы удалить.")

    @app.cli.command("reset-content")
    @click.option("--yes", is_flag=True, help="Не спрашивать подтверждения")
    @click.option("--demo-news", is_flag=True, help="Заодно наполнить ленту новостей примерами")
    def reset_content_command(yes: bool, demo_news: bool):
        """Стирает наполнение сайта и заводит его заново из макета.

        Учётные записи и настройки сайта остаются на месте: сбрасывается
        только то, что наполняли через админку.
        """
        if not yes:
            click.confirm(
                "Удалить все новости, проекты, услуги, сотрудников и заявки?", abort=True
            )

        removed = wipe_content()
        for what, count in removed.items():
            click.echo(f"  удалено {what}: {count}")

        click.echo(f"Категорий добавлено: {seed_categories()}")
        click.echo(f"Сотрудников добавлено: {seed_staff()}")
        click.echo(f"Проектов добавлено: {seed_projects()}")
        click.echo(f"Услуг добавлено: {seed_services()}")
        if demo_news:
            click.echo(f"Демонстрационных новостей: {seed_demo_news()}")
        click.echo("Готово. Файлы, оставшиеся без ссылок, уберёт команда prune-uploads.")

    @app.cli.command("create-admin")
    @click.argument("username")
    @click.argument("email")
    @click.password_option()
    def create_admin_command(username: str, email: str, password: str):
        """Создаёт администратора вручную."""
        user, is_new = ensure_admin(username, email, password)
        click.echo(f"{user.username}: {'создан' if is_new else 'уже существовал'}")
