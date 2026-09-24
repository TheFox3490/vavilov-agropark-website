import { useState } from "react";
import { Link } from "react-router-dom";

import Hero from "../components/Hero";
import { useContacts, useLegalDocsEnabled } from "../context/SettingsContext";
import usePageTitle from "../usePageTitle";
import StaffCarousel from "../components/StaffCarousel";
import { contact } from "../api/client";
import "./contacts.css";

const EMPTY = { name: "", phone: "", message: "", consent: false };

/* Раздел назывался «Контакты» и жил по адресу /contacts. Сейчас это
   «Команда»: главное на странице — состав центра, а адрес и телефон
   и так стоят в шапке и подвале каждой страницы. Прежний адрес внутренний
   nginx постоянно перенаправляет сюда. */
export default function Team() {
  usePageTitle("Команда");
  const contacts = useContacts();
  const legalDocs = useLegalDocsEnabled();
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState({ state: "idle", text: "" });

  const update = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  async function submit(event) {
    event.preventDefault();
    setStatus({ state: "sending", text: "" });
    try {
      await contact.send(form);
      setForm(EMPTY);
      setStatus({ state: "done", text: "Спасибо! Мы получили заявку и свяжемся с вами." });
    } catch (error) {
      setStatus({ state: "error", text: error.message });
    }
  }

  const mapQuery = encodeURIComponent(contacts.address);

  return (
    <>
      <Hero compact />

      <section className="section">
        <div className="container contacts">
          {/* ОТСТУПЛЕНИЕ ОТ МАКЕТА: вместо одной карточки руководителя —
              весь состав центра, редактируемый из админки. */}
          <div className="glass contacts__card contacts__staff">
            <StaffCarousel />
          </div>

          <div className="glass contacts__card">
            <h2>Контакты</h2>
            {contacts.address && (
              <p>
                <b>Адрес:</b> {contacts.address}
              </p>
            )}
            {contacts.schedule && (
              <p>
                <b>График работы:</b> {contacts.schedule}
              </p>
            )}
            {contacts.email && (
              <p>
                <b>Email:</b> <a href={contacts.emailHref}>{contacts.email}</a>
              </p>
            )}
            {contacts.phone && (
              <p>
                <b>Телефон:</b> <a href={contacts.phoneHref}>{contacts.phone}</a>
              </p>
            )}
          </div>

          <div className="glass contacts__card contacts__form-wrap">
            <h2>Форма для связи с нами</h2>
            <form className="contacts__form" onSubmit={submit}>
              <input
                className="input"
                placeholder="Ваше имя"
                value={form.name}
                onChange={update("name")}
                maxLength={255}
                required
              />
              <input
                className="input"
                type="tel"
                placeholder="Ваш телефон"
                value={form.phone}
                onChange={update("phone")}
                required
              />
              <textarea
                className="textarea"
                placeholder="Ваше сообщение…"
                value={form.message}
                onChange={update("message")}
                required
              />

              {/* Документы центр может спрятать галочкой в админке. Тогда
                  строки согласия нет: ссылаться не на что, а обязательная
                  галочка без документа только мешала бы отправить заявку. */}
              {legalDocs && (
                <label className="contacts__consent">
                  <input type="checkbox" checked={form.consent} onChange={update("consent")} required />
                  <span>
                    <Link to="/consent">Согласие</Link> и <Link to="/privacy">политика</Link> обработки
                    персональных данных
                  </span>
                </label>
              )}

              {status.state === "error" && <p className="form-error">{status.text}</p>}
              {status.state === "done" && <p className="form-note">{status.text}</p>}

              <button
                type="submit"
                className="btn btn--outline contacts__submit"
                disabled={status.state === "sending"}
              >
                {status.state === "sending" ? "Отправляем…" : "Отправить"}
              </button>
            </form>
          </div>

          <div className="contacts__map">
            <iframe
              title="Карта проезда"
              src={`https://yandex.ru/map-widget/v1/?text=${mapQuery}&z=17`}
              loading="lazy"
              allowFullScreen
            />
          </div>
        </div>
      </section>
    </>
  );
}
