import { useEffect, useState } from "react";

import { news as newsApi } from "../api/client";
import Lightbox from "./Lightbox";
import Modal from "./Modal";

/* Экран «Новости затемнение» из макета: затемнённая подложка и карточка
   с полным текстом новости поверх сетки.

   Картинка показывается целиком, в своих пропорциях. Раньше она растягивалась
   на всю ширину окна и обрезалась по высоте — у вертикальных фотографий
   пропадали головы, у афиш — надписи. Нажатие открывает её во весь экран,
   тем же просмотрщиком, что галерея проектов. */
export default function NewsModal({ id, onClose }) {
  const [item, setItem] = useState(null);
  const [error, setError] = useState("");
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    newsApi
      .detail(id)
      .then((data) => {
        if (!cancelled) setItem(data.item);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const formatted = item?.created_at
    ? new Date(item.created_at).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <Modal onClose={onClose} labelledBy="news-modal-title">
      {error && <p className="form-error">{error}</p>}
      {!item && !error && <p>Загружаем…</p>}

      {item && (
        <>
          {item.image_url && (
            <button
              type="button"
              className="modal__figure"
              onClick={() => setZoomed(true)}
              aria-label="Открыть изображение во весь экран"
            >
              <img className="modal__image" src={item.image_url} alt={item.title} />
            </button>
          )}
          <div className="modal__meta">
            {formatted && <time dateTime={item.created_at}>{formatted}</time>}
          </div>
          <h2 className="modal__title" id="news-modal-title">
            {item.title}
          </h2>
          <p className="modal__text">{item.body}</p>

          {/* Просмотрщик открывается поверх окна новости. Закрывается только
              он сам: Esc он перехватывает раньше окна (см. Lightbox.jsx),
              а клик по его фону не доходит до подложки окна — всплытие
              останавливает тело окна. */}
          {zoomed && (
            <Lightbox
              frames={[{ url: item.image_url, caption: null }]}
              index={0}
              onIndex={() => {}}
              onClose={() => setZoomed(false)}
              title={item.title}
            />
          )}
        </>
      )}
    </Modal>
  );
}
