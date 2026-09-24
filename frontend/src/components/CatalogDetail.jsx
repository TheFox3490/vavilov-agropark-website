import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import Gallery from "./Gallery";
import Hero from "./Hero";
import { ApiError } from "../api/client";
import "../pages/cards.css";
import usePageTitle from "../usePageTitle";
import "../pages/detail.css";

/* Страница отдельной карточки каталога: /projects/vr-tehnum, /services/vr-ar.

   ОТСТУПЛЕНИЕ ОТ МАКЕТА: таких экранов дизайнер не рисовала. Собраны
   из уже существующих блоков — стеклянная панель, те же скругления,
   тот же набор кнопок, — чтобы не выбиваться из общего вида. */

export default function CatalogDetail({
  fetchItem,
  backTo,
  backLabel,
  notFoundTitle,
  notFoundText,
  linkLabel,
  upperTitle = false,
}) {
  const { slug } = useParams();
  const [item, setItem] = useState(null);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  usePageTitle(item?.title);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setNotFound(false);
    setItem(null);
    fetchItem(slug)
      .then((data) => {
        if (!cancelled) setItem(data.item);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, fetchItem]);

  return (
    <>
      <Hero compact />

      <section className="section">
        <div className="container">
          <div className="glass detail">
            <Link to={backTo} className="detail__back">
              ← {backLabel}
            </Link>

            {loading && <p className="admin__hint">Загружаем…</p>}
            {error && <p className="form-error">{error}</p>}

            {notFound && (
              <div className="detail__empty">
                <h2>{notFoundTitle}</h2>
                <p>{notFoundText}</p>
                <Link to={backTo} className="btn btn--outline">
                  {backLabel}
                </Link>
              </div>
            )}

            {item && (
              <>
                {item.kind && <p className="detail__kind">{item.kind}</p>}
                <h1 className={`detail__title ${upperTitle ? "detail__title--upper" : ""}`}>
                  {item.title}
                </h1>

                <Gallery cover={item.image_url} images={item.images} title={item.title} />

                {item.body && <p className="detail__body">{item.body}</p>}

                <div className="detail__actions">
                  {item.link_url ? (
                    <a
                      href={item.link_url}
                      className="btn btn--blue"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {linkLabel}
                    </a>
                  ) : (
                    /* Адрес у карточки может быть не задан — тогда ведём
                       на форму обратной связи, а не в никуда. */
                    <Link to="/team" className="btn btn--blue">
                      Связаться с нами
                    </Link>
                  )}
                  <Link to={backTo} className="btn btn--outline">
                    {backLabel}
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
