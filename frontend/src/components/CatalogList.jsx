import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Hero from "./Hero";
import Picture from "./Picture";
import usePageTitle from "../usePageTitle";
import "../pages/cards.css";

/* Список карточек каталога — общая начинка страниц «Стартапы» и «Услуги».

   ОТСТУПЛЕНИЕ ОТ МАКЕТА: в макете оба списка статичные. Здесь карточки
   приходят из базы и ведутся через админку. Оформление сохранено:
   картинка слева, название и текст справа.

   Один компонент на две страницы: в макете они свёрстаны одинаково,
   и две копии этой разметки разъехались бы при первой же правке. */

/* В карточке показываем краткое описание, а если его не задали — начало
   полного текста, обрезанное по границе предложения, чтобы не выходило
   «…разработке реш». */
function preview(item) {
  if (item.summary) return item.summary;
  const body = (item.body || "").trim();
  if (body.length <= 420) return body;
  const cut = body.slice(0, 420);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (stop > 200) return cut.slice(0, stop + 1);
  // Границы предложения рядом нет — обрываем по слову, а не посреди него.
  const space = cut.lastIndexOf(" ");
  return `${(space > 200 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export default function CatalogList({ title, fetchItems, basePath, actionLabel, emptyText, upperTitles = false }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  usePageTitle(title);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchItems()
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
  }, [fetchItems]);

  return (
    <>
      <Hero compact />

      <section className="section">
        <div className="container">
          <div className="glass card-list">
            <h2 className="card-list__title">{title}</h2>

            {loading && <p className="admin__hint">Загружаем…</p>}
            {error && <p className="form-error">{error}</p>}
            {!loading && !error && items.length === 0 && <p className="admin__hint">{emptyText}</p>}

            {items.map((item) => {
              const href = `${basePath}/${item.slug}`;
              return (
                <article key={item.id} className="info-card">
                  <Link to={href} className="info-card__media">
                    <Picture
                      src={item.image_url}
                      alt={item.title}
                      label={item.title}
                      loading="lazy"
                    />
                  </Link>
                  <div className="info-card__body">
                    {item.kind && <p className="info-card__kind">{item.kind}</p>}
                    <h3 className={upperTitles ? "info-card__title--upper" : ""}>
                      <Link to={href}>{item.title}</Link>
                    </h3>
                    <p>{preview(item)}</p>
                    <Link to={href} className="btn btn--outline info-card__action">
                      {actionLabel}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
