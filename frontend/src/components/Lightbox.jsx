import { useEffect } from "react";
import { createPortal } from "react-dom";

import { ChevronIcon, CloseIcon } from "./Icons";

/* Просмотр кадра во весь экран.

   Отдельный компонент, а не общая модалка для статей: та рассчитана на текст —
   у неё липкая панель, отступы, собственная прокрутка и max-height 90dvh.
   Картинка внутри неё вылезала за экран, и увеличение приходилось
   разглядывать прокруткой, что лишало его смысла.

   Здесь кадр вписывается в окно всегда: сетка из трёх строк, средняя
   забирает остаток высоты (minmax(0, 1fr) — без нуля она растягивается
   под картинку), а сама картинка ограничена 100% ширины и высоты этой
   строки. Прокрутки нет ни при каком размере окна. */

export default function Lightbox({ frames, index, onIndex, onClose, title }) {
  const single = frames.length === 1;
  const frame = frames[index];

  useEffect(() => {
    /* Просмотрщик бывает открыт поверх другого окна — поверх новости.
       Оба слушают клавиатуру на документе, и без мер Esc закрыл бы оба
       разом. Поэтому здесь слушаем на фазе погружения (capture) — раньше
       всех обычных обработчиков — и дальше свои клавиши не пропускаем. */
    const onKey = (event) => {
      const own = event.key === "Escape" || (!single && (event.key === "ArrowRight" || event.key === "ArrowLeft"));
      if (!own) return;
      event.stopPropagation();
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") onIndex((index + 1) % frames.length);
      if (event.key === "ArrowLeft") onIndex((index - 1 + frames.length) % frames.length);
    };
    document.addEventListener("keydown", onKey, true);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previous;
    };
  }, [onClose, onIndex, index, frames.length, single]);

  return createPortal(
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={frame.caption || title}
      onClick={onClose}
    >
      <div className="lightbox__bar">
        {!single && (
          <span className="lightbox__counter">
            {index + 1} / {frames.length}
          </span>
        )}
        <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
          <CloseIcon />
        </button>
      </div>

      <div className="lightbox__stage">
        {!single && (
          <button
            type="button"
            className="lightbox__nav lightbox__nav--prev"
            onClick={(event) => {
              event.stopPropagation();
              onIndex((index - 1 + frames.length) % frames.length);
            }}
            aria-label="Предыдущий кадр"
          >
            <ChevronIcon />
          </button>
        )}

        {/* Клик по самой картинке не закрывает просмотр — закрывает только фон. */}
        <img
          className="lightbox__img"
          src={frame.url}
          alt={frame.caption || title}
          onClick={(event) => event.stopPropagation()}
        />

        {!single && (
          <button
            type="button"
            className="lightbox__nav lightbox__nav--next"
            onClick={(event) => {
              event.stopPropagation();
              onIndex((index + 1) % frames.length);
            }}
            aria-label="Следующий кадр"
          >
            <ChevronIcon />
          </button>
        )}
      </div>

      <p className="lightbox__caption">{frame.caption || ""}</p>
    </div>,
    document.body,
  );
}
