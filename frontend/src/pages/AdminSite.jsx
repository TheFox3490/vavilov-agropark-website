import { useCallback, useEffect, useState } from "react";

import { admin } from "../api/client";

/* Настройки сайта: контакты центра и тексты правовых документов.

   ОТСТУПЛЕНИЕ ОТ МАКЕТА: контакты в макете нарисованы прямо в подвале,
   а текстов политики и согласия нет вовсе. И то и другое должно меняться
   без правки кода, поэтому вынесено сюда. */

const CONTACT_FIELDS = [
  { key: "contact_phone", label: "Телефон", placeholder: "+7 (987) 800-26-70" },
  { key: "contact_email", label: "Почта", placeholder: "vr.techum@gmail.com" },
  {
    key: "contact_telegram",
    label: "Telegram",
    placeholder: "https://t.me/имя",
    hint: "Полная ссылка. Пусто — иконку в шапке и подвале не показываем.",
  },
  {
    key: "contact_vk",
    label: "ВКонтакте",
    placeholder: "https://vk.com/имя",
    hint: "Полная ссылка. Пусто — иконку не показываем.",
  },
  { key: "contact_address", label: "Адрес", placeholder: "г. Саратов, ул. Советская, д. 60в" },
  {
    key: "contact_schedule",
    label: "График работы",
    placeholder: "Понедельник — Пятница, 10:00–17:00",
  },
];

const DOCS = [
  { titleKey: "legal_privacy_title", bodyKey: "legal_privacy_body", path: "/privacy" },
  { titleKey: "legal_consent_title", bodyKey: "legal_consent_body", path: "/consent" },
];

export default function AdminSite() {
  const [values, setValues] = useState(null);
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const load = useCallback(() => {
    admin
      .readSettings()
      .then((data) => {
        setValues(data.settings);
        setSaved(data.settings);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  const set = (key) => (event) => {
    setDone(false);
    setValues({ ...values, [key]: event.target.value });
  };

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await admin.saveSettings(values);
      setValues(data.settings);
      setSaved(data.settings);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!values) {
    return error ? <p className="form-error">{error}</p> : <p className="admin__hint">Загружаем…</p>;
  }

  // Кнопку сохранения включаем только когда есть что сохранять: так видно,
  // что правки не потерялись, и не возникает соблазна жать её вхолостую.
  const changed = Object.keys(values).some((key) => values[key] !== saved[key]);

  return (
    <form className="admin__site" onSubmit={save}>
      <fieldset className="admin__group">
        <legend>Контакты центра</legend>
        <p className="field__hint">
          Показываются в шапке, в подвале и на странице «Контакты». Адрес заодно
          задаёт точку на карте проезда.
        </p>

        <div className="admin__catalog-row">
          {CONTACT_FIELDS.map((field) => (
            <label key={field.key} className="field">
              <span className="field__label">{field.label}</span>
              <input
                className="input"
                value={values[field.key] ?? ""}
                onChange={set(field.key)}
                placeholder={field.placeholder}
              />
              {field.hint && <span className="field__hint">{field.hint}</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="admin__group">
        <legend>Правовые документы</legend>
        <p className="field__hint">
          Разметка простая: строка, начинающаяся с «## », становится заголовком раздела,
          пустая строка разделяет абзацы. Ничего другого не нужно.
        </p>

        {DOCS.map((doc) => (
          <div key={doc.bodyKey} className="admin__doc">
            <label className="field">
              <span className="field__label">Заголовок</span>
              <input
                className="input"
                value={values[doc.titleKey] ?? ""}
                onChange={set(doc.titleKey)}
              />
              <span className="field__hint">
                Страница: <a href={doc.path} target="_blank" rel="noreferrer">{doc.path}</a>
              </span>
            </label>

            <label className="field">
              <span className="field__label">Текст документа</span>
              <textarea
                className="textarea textarea--long"
                value={values[doc.bodyKey] ?? ""}
                onChange={set(doc.bodyKey)}
              />
            </label>
          </div>
        ))}

        <label className="auth__remember">
          <input
            type="checkbox"
            checked={values.legal_draft_notice === "on"}
            onChange={(event) => {
              setDone(false);
              setValues({ ...values, legal_draft_notice: event.target.checked ? "on" : "" });
            }}
          />
          <span>
            Показывать под документами пометку, что текст предварительный
          </span>
        </label>
      </fieldset>

      {error && <p className="form-error">{error}</p>}
      {done && !changed && <p className="form-note">Сохранено.</p>}

      <div className="admin__edit-actions">
        <button type="submit" className="btn btn--blue btn--sm" disabled={busy || !changed}>
          {busy ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </form>
  );
}
