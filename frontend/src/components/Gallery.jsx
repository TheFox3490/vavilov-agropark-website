import { useEffect, useRef, useState } from "react";

import Lightbox from "./Lightbox";
import Picture from "./Picture";

/* Галерея карточки каталога — проекта или услуги: крупный кадр и лента миниатюр под ним.

   Устроено как в интернет-магазине — нажатие на миниатюру ставит её в крупный
   кадр, а прежний крупный возвращается в ленту. Кадры показываются целиком
   (object-fit: contain): в галерею кладут в том числе скриншоты, и обрезать
   их по краям нельзя — пропадёт как раз то, ради чего скриншот вставили.

   Нажатие на крупный кадр открывает его во весь экран: на телефоне мелкий
   текст на скриншоте иначе не разобрать. */

export default function Gallery({ cover, images = [], title }) {
  // Обложка — такой же кадр, как остальные, просто первый.
  const frames = [
    ...(cover ? [{ key: "cover", url: cover, caption: null }] : []),
    ...images.map((image) => ({ key: `i${image.id}`, url: image.url, caption: image.caption })),
  ];

  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const strip = useRef(null);

  // Проект сменился — возвращаемся к первому кадру.
  useEffect(() => {
    setActive(0);
  }, [cover, images.length]);

  // Активная миниатюра всегда должна быть видна: до неё можно долистать
  // стрелками с клавиатуры, а лента на узком экране прокручивается.
  // Двигаем саму ленту, а не зовём scrollIntoView: тот при загрузке страницы
  // утаскивал к галерее весь экран, мимо заголовка проекта.
  useEffect(() => {
    const el = strip.current;
    const thumb = el?.children[active];
    if (!el || !thumb) return;
    const left = thumb.offsetLeft - el.offsetLeft;
    const right = left + thumb.offsetWidth;
    if (left < el.scrollLeft) {
      el.scrollTo({ left, behavior: "smooth" });
    } else if (right > el.scrollLeft + el.clientWidth) {
      el.scrollTo({ left: right - el.clientWidth, behavior: "smooth" });
    }
  }, [active]);

  if (frames.length === 0) return null;

  const current = frames[active];
  const single = frames.length === 1;

  function onKeyDown(event) {
    if (single) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setActive((i) => (i + 1) % frames.length);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActive((i) => (i - 1 + frames.length) % frames.length);
    }
  }

  return (
    <div className="gallery" onKeyDown={onKeyDown}>
      <button
        type="button"
        className="gallery__stage"
        onClick={() => setZoomed(true)}
        aria-label="Открыть изображение во весь экран"
      >
        <Picture src={current.url} alt={current.caption || title} label={title} />
      </button>

      {current.caption && <p className="gallery__caption">{current.caption}</p>}

      {!single && (
        <div className="gallery__strip" ref={strip} role="tablist" aria-label="Кадры проекта">
          {frames.map((frame, index) => (
            <button
              key={frame.key}
              type="button"
              role="tab"
              aria-selected={index === active}
              className={`gallery__thumb ${index === active ? "gallery__thumb--active" : ""}`}
              onClick={() => setActive(index)}
            >
              <img src={frame.url} alt={frame.caption || `Кадр ${index + 1}`} loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {zoomed && (
        <Lightbox
          frames={frames}
          index={active}
          onIndex={setActive}
          onClose={() => setZoomed(false)}
          title={title}
        />
      )}
    </div>
  );
}
