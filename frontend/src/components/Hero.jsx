import { HERO } from "../content";
import { MEDIA } from "../media";
import Picture from "./Picture";
import { SocialLinks } from "./Layout";
import "./hero.css";

/* Первый экран повторяется на всех страницах макета: заголовок центра,
   фотография с VR-шлемом и колонка соцсетей слева.
   На главной он крупнее и содержит текст, кнопку и слайдер проектов. */
export default function Hero({ compact = false, slider = null, children }) {
  return (
    <section className={`hero ${compact ? "hero--compact" : ""}`}>
      <div className="hero__media" aria-hidden="true">
        <Picture src={MEDIA.hero} alt="" loading="eager" fetchPriority="high" />
        <span className="hero__veil" />
      </div>

      <div className="hero__inner container">
        <div className="hero__text">
          <h1 className="hero__title">{HERO.title}</h1>
          {!compact && <p className="hero__lead">{HERO.lead}</p>}
          {children}
        </div>

        {/* Нижняя строка первого экрана: иконки слева, карусель справа.
            В макете они на одном уровне и отцентрованы друг относительно друга
            (иконки 737–863, карточки 700–900), поэтому лежат в одной строке,
            а не в разных системах координат. */}
        <div className="hero__bottom">
          <SocialLinks className="hero__socials" />
          {slider}
        </div>
      </div>
    </section>
  );
}
