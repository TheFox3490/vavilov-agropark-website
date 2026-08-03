import { Link, useLocation } from "react-router-dom";

import Hero from "../components/Hero";
import "./auth.css";

export default function RegisterSuccess() {
  const { state } = useLocation();
  const needsConfirmation = state?.needsConfirmation ?? true;
  const mailSent = state?.mailSent ?? false;

  return (
    <>
      <Hero compact />

      <section className="section">
        <div className="container auth">
          <div className="glass auth__card auth__card--narrow">
            <h2>Вы успешно зарегистрировались</h2>

            {needsConfirmation ? (
              <p className="auth__message">
                Проверьте почту и перейдите по ссылке в письме для завершения регистрации
              </p>
            ) : (
              <p className="auth__message">Можно сразу входить в аккаунт.</p>
            )}

            {/* Честно предупреждаем, если SMTP на сервере ещё не настроен —
                иначе человек будет бесконечно ждать письмо, которого нет. */}
            {needsConfirmation && !mailSent && (
              <p className="form-note">
                Письмо отправить не удалось: на сервере не настроена почта. Обратитесь
                к администратору сайта, он подтвердит аккаунт вручную.
              </p>
            )}

            <Link to="/login" className="btn btn--light auth__submit">
              Перейти ко входу
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
