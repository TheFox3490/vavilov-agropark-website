import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { ArrowRightIcon, ChevronIcon } from "./Icons";
import { projects as projectsApi } from "../api/client";

/* Карусель проектов на первом экране. В макете видно три карточки и стрелку
   справа — всего проектов восемь. Листаем горизонтальной прокруткой трека:
   работает и мышью, и свайпом, и с клавиатуры.

   ОТСТУПЛЕНИЕ ОТ МАКЕТА: в макете это статичный ряд картинок. Здесь карточки
   приходят из базы, а нажатие ведёт на страницу проекта. Какие проекты сюда
   попадают, решает галочка «Показывать в карусели» в админке. */

/* Кадр карточки (свой → главная картинка → первый снимок галереи) и короткое
   имя приходят с сервера готовыми: в списке проектов галерея не передаётся,
   и до неё здесь было бы не дотянуться. */

export default function HighlightSlider() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const track = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    let cancelled = false;
    projectsApi
      .list("slider")
      .then((data) => {
        if (!cancelled) setItems(data.items);
      })
      .catch(() => {
        // Первый экран не должен ломаться из-за карусели: не пришла — и ладно.
        if (!cancelled) setItems([]);
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
    const card = el.querySelector(".hero-card");
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.6;
    el.scrollBy({ left: step * direction, behavior: "smooth" });
  }

  /* Пока карточки едут из базы, место под них держится пустым: высота первого
     экрана выверена по пикселям, и без брони страница дёргалась бы при каждом
     заходе. А если в карусели нет ни одного проекта — блок исчезает совсем,
     и первый экран просто становится ниже. */
  if (loading) return <div className="hero__cards hero__cards--loading" aria-hidden="true" />;
  if (items.length === 0) return null;

  return (
    <div className="hero__cards">
      <button
        type="button"
        className="hero__nav hero__nav--prev"
        onClick={() => scrollBy(-1)}
        disabled={atStart}
        aria-label="Предыдущие проекты"
      >
        <ChevronIcon />
      </button>

      <div className="hero__track" ref={track} onScroll={sync}>
        {items.map((project, index) => {
          const image = project.card_image;
          return (
            <Link key={project.id} to={`/startups/${project.slug}`} className="hero-card">
              {image && <img src={image} alt="" loading="lazy" />}
              <span className="hero-card__shade" />
              {/* Номер считается от позиции: храни мы его в базе, после
                  удаления проекта в нумерации осталась бы дыра. */}
              <span className="hero-card__num">{String(index + 1).padStart(2, "0")}</span>
              {project.kind && <span className="hero-card__kind">{project.kind}</span>}
              <span className="hero-card__name">{project.slider_title}</span>
              <ArrowRightIcon className="hero-card__arrow" />
            </Link>
          );
        })}
      </div>

      <button
        type="button"
        className="hero__nav hero__nav--next"
        onClick={() => scrollBy(1)}
        disabled={atEnd}
        aria-label="Следующие проекты"
      >
        <ChevronIcon />
      </button>
    </div>
  );
}
