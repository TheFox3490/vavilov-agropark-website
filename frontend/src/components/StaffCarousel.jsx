import { useCallback, useEffect, useRef, useState } from "react";

import { staff as staffApi } from "../api/client";
import { ChevronIcon, MailIcon, PhoneIcon, TelegramIcon, UserIcon, VkIcon } from "./Icons";

/* Состав центра — карусель карточек на странице «Контакты».

   ОТСТУПЛЕНИЕ ОТ МАКЕТА: там нарисована одна карточка руководителя.
   Центру нужен весь состав, редактируемый из админки, поэтому карточка
   превращена в прокручиваемую ленту. Оформление сохранено: та же стеклянная
   панель, те же скругления и та же навигация стрелками, что у карусели
   проектов на главной. */

function telegramHref(value) {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  return `https://t.me/${value.replace(/^@/, "")}`;
}

function StaffCard({ member }) {
  const phoneHref = member.phone ? `tel:${member.phone.replace(/[^\d+]/g, "")}` : null;
  const tg = telegramHref(member.telegram);

  return (
    <article className="staff-card">
      <div className="staff-card__photo">
        {member.photo_url ? (
          <img src={member.photo_url} alt={member.full_name} loading="lazy" />
        ) : (
          /* Фотография необязательна: без неё показываем силуэт,
             а не пустой прямоугольник. */
          <span className="staff-card__stub" aria-hidden="true">
            <UserIcon />
          </span>
        )}
      </div>

      <div className="staff-card__body">
        {member.role && <p className="staff-card__role">{member.role}</p>}
        <h3 className="staff-card__name">{member.full_name}</h3>

        <div className="staff-card__contacts">
          {phoneHref && (
            <a href={phoneHref}>
              <PhoneIcon />
              <span>{member.phone}</span>
            </a>
          )}
          {member.email && (
            <a href={`mailto:${member.email}`}>
              <MailIcon />
              <span>{member.email}</span>
            </a>
          )}
          {tg && (
            <a href={tg} target="_blank" rel="noreferrer">
              <TelegramIcon />
              <span>{member.telegram.replace(/^https?:\/\/t\.me\//, "@")}</span>
            </a>
          )}
          {member.vk && (
            <a href={member.vk} target="_blank" rel="noreferrer">
              <VkIcon />
              <span>ВКонтакте</span>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export default function StaffCarousel() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const track = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  useEffect(() => {
    let cancelled = false;
    staffApi
      .list()
      .then((data) => {
        if (!cancelled) setItems(data.items);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sync = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [sync, items]);

  function scrollBy(direction) {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector(".staff-card");
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.7;
    el.scrollBy({ left: step * direction, behavior: "smooth" });
  }

  if (loading) return <p className="staff__hint">Загружаем состав центра…</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (items.length === 0) return null;

  return (
    <div className="staff">
      <div className="staff__head">
        <h2>Наша команда</h2>
        {items.length > 1 && (
          <div className="staff__nav">
            <button
              type="button"
              className="hero__nav hero__nav--prev"
              onClick={() => scrollBy(-1)}
              disabled={atStart}
              aria-label="Предыдущие сотрудники"
            >
              <ChevronIcon />
            </button>
            <button
              type="button"
              className="hero__nav hero__nav--next"
              onClick={() => scrollBy(1)}
              disabled={atEnd}
              aria-label="Следующие сотрудники"
            >
              <ChevronIcon />
            </button>
          </div>
        )}
      </div>

      <div className="staff__track" ref={track} onScroll={sync}>
        {items.map((member) => (
          <StaffCard key={member.id} member={member} />
        ))}
      </div>
    </div>
  );
}
