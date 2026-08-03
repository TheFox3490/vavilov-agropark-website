import { useRef, useState } from "react";

import { admin } from "../api/client";
import { ChevronIcon, PlusIcon } from "./Icons";

const EMPTY = { title: "", body: "", category_id: "", image_url: "" };

/* Встроенная в сетку форма добавления новости — как первая карточка в макете.
   ОТСТУПЛЕНИЕ ОТ МАКЕТА: добавлено поле заголовка. В макете его нет, но модалка
   с раскрытой новостью заголовок показывает, значит без него новость неполна. */
export default function NewsForm({ categories, onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef(null);

  const update = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  async function pickImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const data = await admin.upload(file);
      setForm((prev) => ({ ...prev, image_url: data.url }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await admin.createNews({
        ...form,
        category_id: form.category_id ? Number(form.category_id) : null,
      });
      setForm(EMPTY);
      onCreated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="news-form" onSubmit={submit}>
      <div className="news-form__select">
        <select value={form.category_id} onChange={update("category_id")}>
          <option value="">Направление</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.title}
            </option>
          ))}
        </select>
        <ChevronIcon />
      </div>

      <button
        type="button"
        className="news-form__drop"
        onClick={() => fileInput.current?.click()}
        disabled={busy}
      >
        {form.image_url ? (
          <img src={form.image_url} alt="Загруженная обложка" />
        ) : (
          <span className="news-form__plus">
            <PlusIcon />
          </span>
        )}
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        onChange={pickImage}
        className="visually-hidden"
      />

      <input
        className="news-form__input"
        placeholder="Заголовок новости"
        value={form.title}
        onChange={update("title")}
        maxLength={255}
        required
      />

      <textarea
        className="news-form__input news-form__textarea"
        placeholder="Опишите событие"
        value={form.body}
        onChange={update("body")}
      />

      {error && <p className="news-form__error">{error}</p>}

      <button type="submit" className="btn btn--blue btn--sm news-form__submit" disabled={busy}>
        {busy ? "Сохраняем…" : "Добавить новость"}
      </button>
    </form>
  );
}
