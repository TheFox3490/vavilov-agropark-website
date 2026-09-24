import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import Picture from "./Picture";
import { projects as projectsApi } from "../api/client";

/* Блок «Наши проекты» на главной.

   ОТСТУПЛЕНИЕ ОТ МАКЕТА: в макете это три статичные фотографии — крупная
   в центре и две «на фоне» по бокам. Здесь то же самое, но живое: в центре
   текущий проект, нажатие на него ведёт на его страницу, нажатие на боковую
   карточку ставит её в центр.

   На узком экране боковые карточки прятать приходится: втроём они дают
   полоски по 60 px, в которых ничего не разобрать. Вместо них — точки под
   карточкой, механика та же, но пальцем попадать есть куда. */

/* Подпись под фотографией: краткое описание, а если его нет — полный текст.
   Обрезкой занимается CSS (line-clamp): он ставит многоточие ровно в конце
   последней видимой строки, а не в середине абзаца, как обрезка по символам. */
function preview(project) {
  return (project.summary || project.body || "").trim();
}

export default function ProjectsCarousel({ title }) {
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(0);
  const drag = useRef(null);
  const swiped = useRef(false);

  useEffect(() => {
    let cancelled = false;
    projectsApi
      .list("featured")
      .then((data) => {
        if (!cancelled) setItems(data.items);
      })
      .catch(() => {
        // Блок необязательный: если список не пришёл, просто не показываем его.
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) return null;

  const total = items.length;
  const current = items[active];
  const prev = items[(active - 1 + total) % total];
  const next = items[(active + 1) % total];
  const single = total === 1;

  /* Смахивание — основной способ листать на телефоне: боковых карточек там нет,
     а тыкать в точки каждый раз неудобно. Слушаем указатель, а не касания:
     одни и те же обработчики покрывают и палец, и мышь, и перо.

     Порог в 45 px и сравнение с вертикальным сдвигом нужны, чтобы обычная
     прокрутка страницы пальцем не переключала карточки. */
  function onPointerDown(event) {
    if (single) return;
    drag.current = { x: event.clientX, y: event.clientY };
    swiped.current = false;
  }

  function onPointerUp(event) {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    drag.current = null;
    if (Math.abs(dx) < 45 || Math.abs(dx) <= Math.abs(dy)) return;
    swiped.current = true;
    setActive((i) => (i + (dx < 0 ? 1 : -1) + total) % total);
  }

  /* После смахивания браузер всё равно шлёт click по карточке — а она ссылка,
     и палец улетал бы на страницу проекта вместо листания. */
  function onCardClick(event) {
    if (!swiped.current) return;
    event.preventDefault();
    swiped.current = false;
  }

  function onKeyDown(event) {
    if (single) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setActive((i) => (i + 1) % total);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActive((i) => (i - 1 + total) % total);
    }
  }

  return (
    <div className="glass projects" onKeyDown={onKeyDown}>
      <h2 className="projects__title">{title}</h2>

      <div
        className="projects__grid"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {!single && (
          <button
            type="button"
            className="projects__side"
            onClick={() => setActive((i) => (i - 1 + total) % total)}
            aria-label={`Показать проект «${prev.title}»`}
          >
            <Picture src={prev.image_url} alt="" label={prev.title} loading="lazy" draggable={false} />
          </button>
        )}

        <Link
          to={`/projects/${current.slug}`}
          className="projects__featured"
          onClick={onCardClick}
          /* Ссылки браузер даёт перетаскивать: начатое перетаскивание
             отменяет жест, и смахивание мышью не срабатывало. */
          draggable={false}
        >
          <Picture src={current.image_url} alt={current.title} label={current.title} draggable={false} />
          <span className="projects__badge">{current.title}</span>
          <div className="projects__caption">
            <p>{preview(current)}</p>
          </div>
        </Link>

        {!single && (
          <button
            type="button"
            className="projects__side"
            onClick={() => setActive((i) => (i + 1) % total)}
            aria-label={`Показать проект «${next.title}»`}
          >
            <Picture src={next.image_url} alt="" label={next.title} loading="lazy" draggable={false} />
          </button>
        )}
      </div>

      {!single && (
        <div className="projects__dots" role="tablist" aria-label="Проекты центра">
          {items.map((project, index) => (
            <button
              key={project.id}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-label={project.title}
              className={`projects__dot ${index === active ? "projects__dot--active" : ""}`}
              onClick={() => setActive(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
