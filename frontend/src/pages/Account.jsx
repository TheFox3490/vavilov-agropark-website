import { useState } from "react";
import { Link, Navigate } from "react-router-dom";

import Hero from "../components/Hero";
import { auth as authApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import usePageTitle from "../usePageTitle";
import "./auth.css";

/* Личный кабинет: кто вошёл и смена пароля.

   ОТСТУПЛЕНИЕ ОТ МАКЕТА: такого экрана дизайнер не рисовала, но без него
   пароль можно было сменить только через восстановление по почте — а почта
   на новом сервере может быть ещё не настроена. Оформлен как остальные
   формы входа и регистрации. */

const EMPTY = { current_password: "", password: "", password_repeat: "" };

export default function Account() {
  const { user, loading } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [state, setState] = useState({ status: "idle", text: "" });
  usePageTitle("Личный кабинет");

  const update = (field) => (event) => {
    setState({ status: "idle", text: "" });
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  async function submit(event) {
    event.preventDefault();
    setState({ status: "busy", text: "" });
    try {
      await authApi.changePassword(form);
      setForm(EMPTY);
      setState({ status: "ok", text: "Пароль изменён. Он понадобится при следующем входе." });
    } catch (error) {
      setState({ status: "error", text: error.message });
    }
  }

  if (loading) return <div className="container section">Загрузка…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <>
      <Hero compact />

      <section className="section">
        <div className="container auth">
          <div className="glass auth__card auth__card--narrow">
            <h2>Личный кабинет</h2>

            <dl className="account__facts">
              <dt>Логин</dt>
              <dd>{user.username}</dd>
              <dt>Почта</dt>
              <dd>{user.email}</dd>
              {user.is_admin && (
                <>
                  <dt>Права</dt>
                  <dd>
                    администратор — <Link to="/admin">перейти в админку</Link>
                  </dd>
                </>
              )}
            </dl>

            <h3 className="account__subtitle">Смена пароля</h3>

            <form className="auth__form" onSubmit={submit}>
              {/* Браузеру нужно поле с логином рядом, иначе он не понимает,
                  для какой учётной записи предлагать сохранить новый пароль. */}
              <input
                type="text"
                name="username"
                value={user.username}
                autoComplete="username"
                readOnly
                className="visually-hidden"
                tabIndex={-1}
              />

              <label className="field">
                <span className="field__label">Текущий пароль</span>
                <input
                  className="input"
                  type="password"
                  value={form.current_password}
                  onChange={update("current_password")}
                  autoComplete="current-password"
                  required
                />
              </label>

              <label className="field">
                <span className="field__label">Новый пароль</span>
                <input
                  className="input"
                  type="password"
                  value={form.password}
                  onChange={update("password")}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <span className="field__hint">Не короче восьми символов.</span>
              </label>

              <label className="field">
                <span className="field__label">Повторите новый пароль</span>
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
              {state.status === "ok" && <p className="form-note">{state.text}</p>}

              <button
                type="submit"
                className="btn btn--light auth__submit"
                disabled={state.status === "busy"}
              >
                {state.status === "busy" ? "Меняем…" : "Сменить пароль"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}
