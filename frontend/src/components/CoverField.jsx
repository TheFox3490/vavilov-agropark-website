import { useRef, useState } from "react";

import { PlusIcon } from "./Icons";
import { admin } from "../api/client";

/* Поле «главная картинка» — общее для новостей, проектов и услуг.

   Превью намеренно небольшое и с фиксированной высотой: раньше картинка
   растягивалась во всю ширину модалки и выдавливала остальные поля за экран.
   Здесь важно видеть, что картинка на месте и какая именно, а не разглядывать
   её — для этого есть сама страница.

   Загрузка живёт внутри поля: вызывающему коду остаётся только принять адрес
   готового файла. Через onBusy он может узнать, что идёт отправка,
   и не дать сохранить форму раньше времени. */

export default function CoverField({
  label = "Главная картинка",
  hint,
  url,
  onChange,
  onBusy,
  /* Кадры галереи проекта. Если переданы, рядом с загрузкой появляется
     выбор из уже загруженного — второй раз ту же фотографию не тащить. */
  gallery = [],
}) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);

  function markBusy(value) {
    setBusy(value);
    onBusy?.(value);
  }

  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    markBusy(true);
    setError("");
    try {
      const data = await admin.upload(file);
      onChange(data.url);
    } catch (err) {
      setError(err.message);
    } finally {
      markBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="field">
      <span className="field__label">{label}</span>
      {hint && <span className="field__hint">{hint}</span>}

      <div className="admin__cover">
        {url ? (
          <img className="admin__cover-preview" src={url} alt="" />
        ) : (
          <span className="admin__cover-preview admin__cover-stub">
            <PlusIcon />
          </span>
        )}

        <div className="admin__cover-actions">
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={() => input.current?.click()}
            disabled={busy}
          >
            {busy ? "Загружаем…" : url ? "Заменить" : "Загрузить"}
          </button>
          {gallery.length > 0 && (
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => setPicking((open) => !open)}
            >
              {picking ? "Свернуть" : "Выбрать из галереи"}
            </button>
          )}
          {url && (
            <button type="button" className="admin__danger" onClick={() => onChange("")}>
              Убрать
            </button>
          )}
        </div>

        <input
          ref={input}
          type="file"
          accept="image/*"
          className="visually-hidden"
          onChange={upload}
        />
      </div>

      {picking && (
        <div className="admin__cover-pick">
          {gallery.map((shot, index) => (
            <button
              key={`${shot.url}-${index}`}
              type="button"
              className={`admin__cover-option ${shot.url === url ? "is-current" : ""}`}
              onClick={() => {
                onChange(shot.url);
                setPicking(false);
              }}
              title={shot.caption || `Кадр ${index + 1}`}
            >
              <img src={shot.url} alt="" />
            </button>
          ))}
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
