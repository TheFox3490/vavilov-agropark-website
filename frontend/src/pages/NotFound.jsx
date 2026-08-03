import { Link } from "react-router-dom";

import Hero from "../components/Hero";
import "./auth.css";

export default function NotFound() {
  return (
    <>
      <Hero compact />

      <section className="section">
        <div className="container auth">
          <div className="glass auth__card auth__card--narrow">
            <h2>Страница не найдена</h2>
            <p className="auth__message">
              Возможно, ссылка устарела или в адресе опечатка.
            </p>
            <Link to="/" className="btn btn--light auth__submit">
              На главную
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
