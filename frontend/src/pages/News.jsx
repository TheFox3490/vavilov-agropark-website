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

/* Категорий у новостей на сайте больше нет. Их никто не заполнял, а фильтры
   по пустым категориям только путали. В базе поле осталось — у старых
   новостей оно заполнено, и понадобись категории снова, возвращать их
   проще, чем заводить заново. Подложка карточки без обложки теперь одного
   фирменного цвета, а не цвета категории. */
const STUB_COLOR = "#8400ff55";

export default function News() {
  const { isAdmin } = useAuth();
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

  const load = useCallback(
    async (offset) => {
      setLoading(true);
      setError("");
      try {
        const data = await newsApi.feed({ offset, limit: PAGE_SIZE });
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
    load(0);
  }, [load]);

  const refresh = () => load(0);

  return (
    <>
      <Hero compact />

      <section className="section">
        <div className="container">
          <div className="glass news">
            <h2 className="news__title">Новости</h2>

            {error && <p className="form-error">{error}</p>}

            <div className="news__grid">
              {/* Форма добавления стоит первой карточкой в сетке — как в макете,
                  и показывается только администратору. */}
              {isAdmin && <NewsForm onCreated={refresh} />}

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
                    /* Обложка необязательна: без неё показываем фирменную
                       подложку, а не пустой прямоугольник. */
                    <div
                      className="news-card__stub"
                      style={{ "--stub-color": STUB_COLOR }}
                      aria-hidden="true"
                    >
                      <LogoMark />
                    </div>
                  )}
                  <div className="news-card__overlay">
                    <h3>{item.title}</h3>
                  </div>
                </article>
              ))}

              {!loading && items.length === 0 && (
                <div className="news__empty">
                  <LogoMark />
                  <p>Новостей пока нет.</p>
                  {isAdmin && <span>Добавьте первую через форму слева.</span>}
                </div>
              )}
            </div>

            {hasMore && (
              <button
                type="button"
                className="btn btn--outline news__more"
                onClick={() => load(items.length)}
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
