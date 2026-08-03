"""Отправка почты через любой внешний SMTP.

Свой почтовый сервер разворачивать не нужно: в .env указываются хост, порт,
логин и пароль стороннего провайдера (Gmail с app password, Яндекс 360, Mail.ru,
или транзакционный сервис — любой, кто говорит по SMTP).

Если SMTP_HOST не задан, письма не отправляются, а пишутся в лог. Это позволяет
поднять сайт и пользоваться им до того, как решён вопрос с почтой.
"""

from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from flask import current_app

log = logging.getLogger(__name__)


def _send(to: str, subject: str, text: str, html: str | None = None) -> bool:
    cfg = current_app.config
    host = cfg.get("SMTP_HOST", "").strip()

    if not host:
        log.warning(
            "SMTP не настроен — письмо не отправлено. Кому: %s | Тема: %s\n%s",
            to,
            subject,
            text,
        )
        return False

    msg = EmailMessage()
    msg["From"] = formataddr((cfg["MAIL_FROM_NAME"], cfg["MAIL_FROM"]))
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")

    port = cfg["SMTP_PORT"]
    user, password = cfg["SMTP_USER"], cfg["SMTP_PASSWORD"]

    try:
        if cfg["SMTP_USE_SSL"]:
            server = smtplib.SMTP_SSL(host, port, timeout=20, context=ssl.create_default_context())
        else:
            server = smtplib.SMTP(host, port, timeout=20)
        with server:
            server.ehlo()
            if cfg["SMTP_USE_TLS"] and not cfg["SMTP_USE_SSL"]:
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
            if user:
                server.login(user, password)
            server.send_message(msg)
    except Exception:  # noqa: BLE001 — письмо не должно ронять основной запрос
        log.exception("Не удалось отправить письмо на %s", to)
        return False

    log.info("Письмо отправлено на %s: %s", to, subject)
    return True


def send_confirmation(email: str, username: str, link: str) -> bool:
    return _send(
        email,
        "Подтверждение регистрации — Агропарк Вавиловского университета",
        f"Здравствуйте, {username}!\n\n"
        f"Для завершения регистрации перейдите по ссылке:\n{link}\n\n"
        "Если вы не регистрировались на сайте Центра агроробототехники "
        "и VR/AR технологий, просто проигнорируйте это письмо.",
        f"<p>Здравствуйте, {username}!</p>"
        f'<p>Для завершения регистрации <a href="{link}">перейдите по ссылке</a>.</p>'
        f"<p style=\"color:#888;font-size:13px\">Если вы не регистрировались на сайте "
        "Центра агроробототехники и VR/AR технологий, просто проигнорируйте это письмо.</p>",
    )


def send_password_reset(email: str, username: str, link: str) -> bool:
    return _send(
        email,
        "Восстановление пароля — Агропарк Вавиловского университета",
        f"Здравствуйте, {username}!\n\n"
        f"Чтобы задать новый пароль, перейдите по ссылке:\n{link}\n\n"
        "Если вы не запрашивали смену пароля, проигнорируйте это письмо.",
        f"<p>Здравствуйте, {username}!</p>"
        f'<p>Чтобы задать новый пароль, <a href="{link}">перейдите по ссылке</a>.</p>'
        f"<p style=\"color:#888;font-size:13px\">Если вы не запрашивали смену пароля, "
        "проигнорируйте это письмо.</p>",
    )


def send_contact_notification(request_obj) -> bool:
    """Уведомляет центр о новой заявке. Заявка в любом случае уже сохранена в БД."""
    to = current_app.config.get("CONTACT_NOTIFY_TO", "").strip()
    if not to:
        return False
    return _send(
        to,
        f"Новая заявка с сайта — {request_obj.name}",
        f"Имя: {request_obj.name}\n"
        f"Телефон: {request_obj.phone}\n"
        f"Сообщение:\n{request_obj.message}\n\n"
        f"Заявка №{request_obj.id} также сохранена в админке сайта.",
    )
