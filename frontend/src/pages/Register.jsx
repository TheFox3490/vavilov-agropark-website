import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Hero from "../components/Hero";
import { auth as authApi } from "../api/client";
import { useLegalDocsEnabled } from "../context/SettingsContext";
import "./auth.css";

export default function Register() {
  const legalDocs = useLegalDocsEnabled();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    password_repeat: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await authApi.register(form);
      navigate("/register/success", {
        state: { needsConfirmation: data.needs_confirmation, mailSent: data.mail_sent },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Hero compact />

      <section className="section">
        <div className="container auth">
          <div className="glass auth__card">
            <h2>Регистрация аккаунта</h2>

            <form className="auth__form" onSubmit={submit}>
              <label className="field">
                <span className="field__label">Логин</span>
                <input
                  className="input"
                  value={form.username}
                  onChange={update("username")}
                  autoComplete="username"
                  minLength={3}
                  required
                />
              </label>

              {/* ОТСТУПЛЕНИЕ ОТ МАКЕТА: поля почты в макете нет, но экран
                  «Регистрация успешна» просит проверить письмо, а на входе
                  есть «Забыли пароль?» — без адреса ни то, ни другое не работает. */}
              <label className="field">
                <span className="field__label">Электронная почта</span>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={update("email")}
                  autoComplete="email"
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

              {error && <p className="form-error">{error}</p>}

              {/* Без документа ссылаться не на что — строку прячем вместе с ним. */}
              {legalDocs && (
                <p className="auth__consent">
                  Нажимая кнопку регистрации, Вы даёте согласие на{" "}
                  <Link to="/consent">обработку персональных данных</Link>
                </p>
              )}

              <button type="submit" className="btn btn--light auth__submit" disabled={busy}>
                {busy ? "Регистрируем…" : "Зарегистрироваться"}
              </button>
            </form>

            <div className="auth__links">
              <Link to="/login" className="auth__link">
                Уже есть аккаунт? Войти
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
