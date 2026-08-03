import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import Hero from "../components/Hero";
import { auth as authApi } from "../api/client";
import "./auth.css";

/* Экрана сброса пароля в макете нет — сделан в стиле остальных форм
   (ОТСТУПЛЕНИЕ ОТ МАКЕТА), потому что ссылка «Забыли пароль?» на входе есть. */
export default function ResetPassword() {
  const { token } = useParams();
  const [form, setForm] = useState({ password: "", password_repeat: "" });
  const [state, setState] = useState({ status: "idle", text: "" });

  const update = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setState({ status: "busy", text: "" });
    try {
      await authApi.reset(token, form);
      setState({ status: "ok", text: "Пароль обновлён. Теперь можно войти." });
    } catch (error) {
      setState({ status: "error", text: error.message });
    }
  }

  return (
    <>
      <Hero compact />

      <section className="section">
        <div className="container auth">
          <div className="glass auth__card auth__card--narrow">
            <h2>Новый пароль</h2>

            {state.status === "ok" ? (
              <>
                <p className="auth__message">{state.text}</p>
                <Link to="/login" className="btn btn--light auth__submit">
                  Войти
                </Link>
              </>
            ) : (
              <form className="auth__form" onSubmit={submit}>
                <label className="field">
                  <span className="field__label">Пароль</span>
                  <input
                    className="input"
                    type="password"
                    value={form.password}
                    onChange={update("password")}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>

                <label className="field">
                  <span className="field__label">Повторите пароль</span>
                  <input
                    className="input"
                    type="password"
                    value={form.password_repeat}
                    onChange={update("password_repeat")}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>

                {state.status === "error" && <p className="form-error">{state.text}</p>}

                <button
                  type="submit"
                  className="btn btn--light auth__submit"
                  disabled={state.status === "busy"}
                >
                  {state.status === "busy" ? "Сохраняем…" : "Сохранить"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
