import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Hero from "../components/Hero";
import { auth as authApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./auth.css";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "", remember: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(null); // null | "" | текст статуса

  const update = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(form);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  /* «Забыли пароль?» в макете есть, а экрана восстановления нет.
     Спрашиваем адрес прямо здесь и отправляем письмо со ссылкой. */
  async function requestReset() {
    const email = window.prompt("Укажите адрес почты, на который зарегистрирован аккаунт:");
    if (!email) return;
    await authApi.forgot(email).catch(() => {});
    setForgot("Если такой аккаунт существует, письмо со ссылкой уже отправлено.");
  }

  return (
    <>
      <Hero compact />

      <section className="section">
        <div className="container auth">
          <div className="glass auth__card">
            <h2>Войдите в аккаунт</h2>

            <form className="auth__form" onSubmit={submit}>
              <label className="field">
                <span className="field__label">Логин</span>
                <input
                  className="input"
                  value={form.username}
                  onChange={update("username")}
                  autoComplete="username"
                  required
                />
              </label>

              <label className="field">
                <span className="field__label">Пароль</span>
                <input
                  className="input"
                  type="password"
                  value={form.password}
                  onChange={update("password")}
                  autoComplete="current-password"
                  required
                />
              </label>

              <label className="auth__remember">
                <input type="checkbox" checked={form.remember} onChange={update("remember")} />
                <span>Запомнить меня</span>
              </label>

              {error && <p className="form-error">{error}</p>}
              {forgot && <p className="form-note">{forgot}</p>}

              <button type="submit" className="btn btn--light auth__submit" disabled={busy}>
                {busy ? "Входим…" : "Войти"}
              </button>
            </form>

            <div className="auth__links">
              <button type="button" className="auth__link" onClick={requestReset}>
                Забыли пароль?
              </button>
              <Link to="/register" className="auth__link">
                Нет аккаунта? Зарегистрироваться
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
