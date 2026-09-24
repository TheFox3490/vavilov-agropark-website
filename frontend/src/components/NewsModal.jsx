import { useEffect, useState } from "react";

import { news as newsApi } from "../api/client";
import Modal from "./Modal";

/* Экран «Новости затемнение» из макета: затемнённая подложка и карточка
   с полным текстом новости поверх сетки. */
export default function NewsModal({ id, onClose }) {
  const [item, setItem] = useState(null);
  const [error, setError] = useState("");

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
            <img className="modal__image" src={item.image_url} alt={item.title} />
          )}
          <div className="modal__meta">
            {formatted && <time dateTime={item.created_at}>{formatted}</time>}
          </div>
          <h2 className="modal__title" id="news-modal-title">
            {item.title}
          </h2>
          <p className="modal__text">{item.body}</p>
        </>
      )}
    </Modal>
  );
}
