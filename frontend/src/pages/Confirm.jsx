import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import Hero from "../components/Hero";
import { auth as authApi } from "../api/client";
import "./auth.css";

/* Страница, на которую ведёт ссылка из письма-подтверждения. */
export default function Confirm() {
  const { token } = useParams();
  const [state, setState] = useState({ status: "pending", text: "Проверяем ссылку…" });

  useEffect(() => {
    let cancelled = false;
    authApi
      .confirm(token)
      .then(() => {
        if (!cancelled) {
          setState({ status: "ok", text: "Адрес подтверждён. Теперь можно войти в аккаунт." });
        }
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", text: error.message });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <>
      <Hero compact />

      <section className="section">
        <div className="container auth">
          <div className="glass auth__card auth__card--narrow">
            <h2>Подтверждение почты</h2>
            <p className={state.status === "error" ? "form-error" : "auth__message"}>{state.text}</p>
            {state.status === "ok" && (
              <Link to="/login" className="btn btn--light auth__submit">
                Войти
              </Link>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
