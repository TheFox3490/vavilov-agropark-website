import { useEffect } from "react";
import { createPortal } from "react-dom";

import { CloseIcon } from "./Icons";

/* Общая оболочка модального окна.

   Рендерится порталом в <body>, а не на месте вызова. Иначе окно попадает
   внутрь .main, у которого position: relative и z-index: 1 — это отдельный
   контекст наложения, и z-index окна начинает соревноваться не с шапкой,
   а только с соседями внутри .main. В результате липкая шапка (z-index: 50)
   рисовалась поверх окна и накрывала кнопку закрытия.

   Кнопка закрытия вынесена в липкую панель: раньше она была absolute внутри
   прокручиваемого тела и на длинных материалах уезжала вверх за пределы
   видимой области — окно становилось невозможно закрыть мышью. */
export default function Modal({ onClose, children, labelledBy, className = "" }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    // Фиксируем страницу под окном, чтобы прокрутка не «проваливалась» на неё.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return createPortal(
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy} onClick={onClose}>
      <div className={`modal__body ${className}`} onClick={(event) => event.stopPropagation()}>
        <div className="modal__bar">
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            <CloseIcon />
          </button>
        </div>
        <div className="modal__content">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
