import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import Hero from "../components/Hero";
import NewsForm from "../components/NewsForm";
import NewsModal from "../components/NewsModal";
import usePageTitle from "../usePageTitle";
import { ChevronIcon, LogoMark } from "../components/Icons";
import { news as newsApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./news.css";

const PAGE_SIZE = 5;

export default function News() {
  const { isAdmin } = useAuth();
  const [categories, setCategories] = useState([]);
  const [active, setActive] = useState("all");
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /* Открытая новость — это адрес /news/<номер>, а не состояние внутри
     страницы. Иначе ссылкой на новость нельзя поделиться, а поисковый робот
     видит только общий список: у каждой записи должен быть свой адрес. */
  const { newsId } = useParams();
  const navigate = useNavigate();
  const openId = newsId ? Number(newsId) : null;
  usePageTitle("Новости");

  useEffect(() => {
    newsApi
      .categories()
      .then((data) => setCategories(data.items))
      .catch(() => setCategories([]));
  }, []);

  const load = useCallback(
    async (category, offset) => {
      setLoading(true);
      setError("");
      try {
        const data = await newsApi.feed({ category, offset, limit: PAGE_SIZE });
        setItems((prev) => (offset === 0 ? data.items : [...prev, ...data.items]));
        setHasMore(data.has_more);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    load(active, 0);
  }, [active, load]);

  const refresh = () => load(active, 0);

  return (
    <>
      <Hero compact />

      <section className="section">
        <div className="container">
          <div className="glass news">
            <h2 className="news__title">Новости</h2>

            <div className="news__filters" role="tablist" aria-label="Категории новостей">
              <button
                type="button"
                role="tab"
                aria-selected={active === "all"}
                className={`chip ${active === "all" ? "chip--active" : ""}`}
                onClick={() => setActive("all")}
              >
                Все
              </button>
              {categories.map((category) => (
                <button
                  key={category.slug}
                  type="button"
                  role="tab"
                  aria-selected={active === category.slug}
                  className={`chip ${active === category.slug ? "chip--active" : ""}`}
                  onClick={() => setActive(category.slug)}
                >
                  {category.title}
                </button>
              ))}
            </div>

            {error && <p className="form-error">{error}</p>}

            <div className="news__grid">
              {/* Форма добавления стоит первой карточкой в сетке — как в макете,
                  и показывается только администратору. */}
              {isAdmin && <NewsForm categories={categories} onCreated={refresh} />}

              {items.map((item) => (
                <article
                  key={item.id}
                  className="news-card"
                  onClick={() => navigate(`/news/${item.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(`/news/${item.id}`);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.title} loading="lazy" />
                  ) : (
                    /* Обложка необязательна: без неё показываем подложку
                       в цвете категории, а не пустой прямоугольник. */
                    <div
                      className="news-card__stub"
                      style={{ "--stub-color": `${item.category?.color ?? "#8400ff"}55` }}
                      aria-hidden="true"
                    >
                      <LogoMark />
                    </div>
                  )}
                  {item.category && (
                    <span
                      className="news-card__badge"
                      style={{ backgroundColor: item.category.color }}
                    >
                      {item.category.title}
                    </span>
                  )}
                  <div className="news-card__overlay">
                    <h3>{item.title}</h3>
                  </div>
                </article>
              ))}

              {!loading && items.length === 0 && (
                <div className="news__empty">
                  <LogoMark />
                  <p>
                    {active === "all"
                      ? "Новостей пока нет."
                      : "В этой категории пока нет новостей."}
                  </p>
                  {isAdmin ? (
                    <span>Добавьте первую через форму слева.</span>
                  ) : (
                    active !== "all" && (
                      <button type="button" className="btn btn--outline btn--sm" onClick={() => setActive("all")}>
                        Показать все
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            {hasMore && (
              <button
                type="button"
                className="btn btn--outline news__more"
                onClick={() => load(active, items.length)}
                disabled={loading}
              >
                {loading ? "Загружаем…" : "Показать больше"}
                <ChevronIcon />
              </button>
            )}
          </div>
        </div>
      </section>

      {openId !== null && <NewsModal id={openId} onClose={() => navigate("/news")} />}
    </>
  );
}
