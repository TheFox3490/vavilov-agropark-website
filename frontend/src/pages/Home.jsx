import { Link } from "react-router-dom";

import Hero from "../components/Hero";
import HighlightSlider from "../components/HighlightSlider";
import { ArrowRightIcon } from "../components/Icons";
import Picture from "../components/Picture";
import ProjectsCarousel from "../components/ProjectsCarousel";
import { OFFER, PROJECTS } from "../content";
import { MEDIA } from "../media";
import usePageTitle from "../usePageTitle";
import "./home.css";

export default function Home() {
  usePageTitle("Центр агроробототехники и VR/AR технологий");

  return (
    <>
      <Hero slider={<HighlightSlider />}>
        <div className="hero__actions">
          <Link to="/services" className="btn btn--light">
            Наши услуги
          </Link>
        </div>
      </Hero>

      {/* --- Мы предлагаем --- */}
      <section className="section">
        <div className="container">
          <div className="glass offer">
            <figure className="offer__card">
              <Picture src={MEDIA.offerCard} alt="Работа с VR-оборудованием" label={OFFER.card.title} />
              <figcaption>
                <h3>{OFFER.card.title}</h3>
                <p>{OFFER.card.text}</p>
                <ArrowRightIcon className="offer__card-arrow" />
              </figcaption>
            </figure>

            <div className="offer__text">
              <h2>{OFFER.title}</h2>
              {OFFER.body.map((paragraph) => (
                <p key={paragraph.slice(0, 40)}>{paragraph}</p>
              ))}
              <Link to="/projects" className="btn btn--outline">
                Смотреть проекты
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* --- Наши проекты --- */}
      <section className="section">
        <div className="container">
          <ProjectsCarousel title={PROJECTS.title} />
        </div>
      </section>
    </>
  );
}
