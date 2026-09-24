import { useCallback, useEffect, useRef, useState } from "react";

import CoverField from "../components/CoverField";
import Modal from "../components/Modal";
import { PlusIcon } from "../components/Icons";
import { admin } from "../api/client";

/* Управление разделом каталога — «Наши проекты» или «Наши услуги».

   Один компонент на оба раздела: карточки устроены одинаково, а две копии
   этой формы разъехались бы при первой правке. Различия передаются
   настройками: заголовки, подсказки и адрес страницы карточки.

   Адрес (slug) заполняется сам из названия, но остаётся доступным для правки:
   после публикации его лучше не менять, иначе внешние ссылки перестанут
   работать. */

const EMPTY = {
  title: "",
  slug: "",
  kind: "",
  summary: "",
  body: "",
  image_url: "",
  link_url: "",
  images: [],
  card_title: "",
  card_image_url: "",
  show_in_slider: false,
  is_published: true,
};

function CatalogForm({ value, onChange, onCoverBusy, onUploadShot, busy, texts }) {
  const galleryInput = useRef(null);
  const set = (field) => (event) => onChange({ ...value, [field]: event.target.value });

  function moveShot(index, delta) {
    const next = [...value.images];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ ...value, images: next });
  }

  return (
    <>
      <label className="field">
        <span className="field__label">Название *</span>
        <input className="input" value={value.title} onChange={set("title")} required />
      </label>

      <div className="admin__catalog-row">
        <label className="field">
          <span className="field__label">Адрес страницы</span>
          <input
            className="input"
            value={value.slug}
            onChange={set("slug")}
            placeholder="заполнится из названия"
          />
          <span className="field__hint">
            {texts.basePath}/{value.slug || "адрес"}
          </span>
        </label>
        {texts.kinds && (
          <label className="field">
            <span className="field__label">Тип</span>
            <input
              className="input"
              value={value.kind}
              onChange={set("kind")}
              list={`${texts.key}-kinds`}
              placeholder={texts.kinds.join(", ")}
            />
            <datalist id={`${texts.key}-kinds`}>
              {texts.kinds.map((kind) => (
                <option key={kind} value={kind} />
              ))}
            </datalist>
          </label>
        )}
      </div>

      <label className="field">
        <span className="field__label">Краткое описание</span>
        <textarea
          className="textarea textarea--short"
          value={value.summary}
          onChange={set("summary")}
          maxLength={600}
          placeholder={`Показывается в списке «${texts.listTitle}». Пусто — возьмём начало полного текста.`}
        />
      </label>

      <label className="field">
        <span className="field__label">Полный текст</span>
        <textarea
          className="textarea textarea--long"
          value={value.body}
          onChange={set("body")}
        />
      </label>

      <CoverField
        url={value.image_url}
        onChange={(url) => onChange({ ...value, image_url: url })}
        onBusy={onCoverBusy}
      />

      <div className="field">
        <span className="field__label">Галерея</span>
        <span className="field__hint">
          Дополнительные кадры на странице проекта: скриншоты, фотографии.
          Посетитель переключает их, и выбранный показывается крупно.
          Порядок в этом списке — порядок на странице.
        </span>

        {/* Список строками, а не плиткой: подписи бывают длинными, а в узкой
            плитке поле ввода превращалось в щель на пару символов. */}
        <div className="admin__gallery">
          {value.images.map((image, index) => (
            <div key={`${image.url}-${index}`} className="admin__gallery-row">
              <img className="admin__gallery-thumb" src={image.url} alt="" />

              <div className="admin__gallery-fields">
                <input
                  className="input input--sm"
                  value={image.caption ?? ""}
                  onChange={(event) => {
                    const next = [...value.images];
                    next[index] = { ...image, caption: event.target.value };
                    onChange({ ...value, images: next });
                  }}
                  placeholder="Подпись под кадром — можно не заполнять"
                  maxLength={255}
                />
                <span className="admin__gallery-num">
                  Кадр {index + 1} из {value.images.length}
                </span>
              </div>

              <div className="admin__gallery-actions">
                <button
                  type="button"
                  className="admin__chip"
                  onClick={() => moveShot(index, -1)}
                  disabled={index === 0}
                  aria-label="Выше"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="admin__chip"
                  onClick={() => moveShot(index, 1)}
                  disabled={index === value.images.length - 1}
                  aria-label="Ниже"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="admin__danger"
                  onClick={() =>
                    onChange({ ...value, images: value.images.filter((_, i) => i !== index) })
                  }
                >
                  Убрать
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="admin__gallery-add"
            onClick={() => galleryInput.current?.click()}
            disabled={busy}
          >
            <PlusIcon />
            <span>{busy ? "Загружаем…" : "Добавить кадры"}</span>
            <span className="admin__gallery-add-hint">можно выбрать сразу несколько</span>
          </button>
          <input
            ref={galleryInput}
            type="file"
            accept="image/*"
            multiple
            className="visually-hidden"
            onChange={(event) => onUploadShot(event, galleryInput)}
          />
        </div>
      </div>

      <label className="field">
        <span className="field__label">{texts.linkLabel}</span>
        <input
          className="input"
          value={value.link_url}
          onChange={set("link_url")}
          placeholder="https://… — пусто, кнопка ведёт на форму связи"
        />
      </label>

      {texts.sliderLabel && (
        /* Карусель первого экрана. Отдельная группа, а не поля вперемешку:
           у карточки там своя картинка и своё короткое имя, и путать их
           с главными не стоит. */
        <fieldset className="admin__group">
          <legend>Карусель на первом экране</legend>

          <label className="auth__remember">
            <input
              type="checkbox"
              checked={value.show_in_slider}
              onChange={(event) => onChange({ ...value, show_in_slider: event.target.checked })}
            />
            <span>{texts.sliderLabel}</span>
          </label>

          {value.show_in_slider && (
            <>
              <label className="field">
                <span className="field__label">Короткое имя</span>
                <input
                  className="input"
                  value={value.card_title}
                  onChange={set("card_title")}
                  maxLength={120}
                  placeholder={value.title || "как в названии"}
                />
                <span className="field__hint">
                  Карточка узкая: «VR TEHNUM» в неё не влезает, «Технум» влезает.
                  Пусто — возьмём обычное название.
                </span>
              </label>

              <CoverField
                label="Кадр для карточки"
                hint="Горизонтальный снимок, предмет по центру, ничего важного в нижней трети — там затемнение и подпись. Пусто — возьмём главную картинку, потом первый кадр галереи."
                url={value.card_image_url}
                onChange={(url) => onChange({ ...value, card_image_url: url })}
                onBusy={onCoverBusy}
                gallery={value.images}
              />
            </>
          )}
        </fieldset>
      )}

      {texts.featureLabel && (
        <label className="auth__remember">
          <input
            type="checkbox"
            checked={value.is_featured}
            onChange={(event) => onChange({ ...value, is_featured: event.target.checked })}
          />
          <span>{texts.featureLabel}</span>
        </label>
      )}

      <label className="auth__remember">
        <input
          type="checkbox"
          checked={value.is_published}
          onChange={(event) => onChange({ ...value, is_published: event.target.checked })}
        />
        <span>Опубликован</span>
      </label>
    </>
  );
}

export default function AdminCatalog({ api, texts }) {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .list()
      .then((data) => setItems(data.items))
      .catch((err) => setError(err.message));
  }, [api]);

  useEffect(load, [load]);

  async function uploadShot(event, ref) {
    const files = [...(event.target.files ?? [])];
    if (files.length === 0) return;
    setBusy(true);
    setError("");
    try {
      // Файлы грузим по очереди: параллельная отправка десятка снимков
      // упирается в ограничитель запросов на бэкенде.
      for (const file of files) {
        const data = await admin.upload(file);
        setEditing((prev) => ({ ...prev, images: [...prev.images, { url: data.url, caption: "" }] }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (editing.id) await api.update(editing.id, editing);
      else await api.create(editing);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(item) {
    if (!window.confirm(`Удалить «${item.title}»? Отменить будет нельзя.`)) return;
    await api.remove(item.id).catch((err) => setError(err.message));
    load();
  }

  async function move(index, delta) {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    await api.reorder(next.map((i) => i.id)).catch((err) => setError(err.message));
    load();
  }

  function edit(item) {
    setEditing({
      id: item.id,
      title: item.title,
      slug: item.slug,
      kind: item.kind ?? "",
      summary: item.summary ?? "",
      body: item.body ?? "",
      image_url: item.image_url ?? "",
      link_url: item.link_url ?? "",
      is_featured: item.is_featured ?? false,
      show_in_slider: item.show_in_slider ?? false,
      card_title: item.card_title ?? "",
      card_image_url: item.card_image_url ?? "",
      images: (item.images ?? []).map((shot) => ({ url: shot.url, caption: shot.caption ?? "" })),
      is_published: item.is_published,
    });
  }

  return (
    <div className="admin__catalog">
      <div className="admin__staff-head">
        <p className="admin__hint">
          Порядок карточек на странице «{texts.listTitle}» — как в этом списке.
          У каждой карточки есть своя страница, адрес складывается из названия.
        </p>
        <button
          type="button"
          className="btn btn--blue btn--sm"
          onClick={() => setEditing({ ...EMPTY, ...(texts.defaults ?? {}), images: [] })}
        >
          {texts.addLabel}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}
      {items.length === 0 && <p className="admin__hint">{texts.emptyText}</p>}

      <div className="admin__list">
        {items.map((item, index) => (
          <article key={item.id} className="admin__row">
            {item.image_url ? (
              <img src={item.image_url} alt="" />
            ) : (
              <span className="admin__row-stub" />
            )}
            <div className="admin__row-body">
              <h4>{item.title}</h4>
              <p className="admin__row-meta">
                {texts.basePath}/{item.slug}
                {item.kind ? ` · ${item.kind}` : ""}
                {item.images?.length ? ` · кадров: ${item.images.length}` : ""}
                {item.is_published ? "" : " · снята с публикации"}
                {texts.featureLabel && !item.is_featured ? " · не на главной" : ""}
                {item.show_in_slider ? " · в карусели" : ""}
              </p>
            </div>
            <div className="admin__row-actions">
              <button
                type="button"
                className="admin__chip"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="Выше"
              >
                ↑
              </button>
              <button
                type="button"
                className="admin__chip"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                aria-label="Ниже"
              >
                ↓
              </button>
              <button type="button" className="admin__chip" onClick={() => edit(item)}>
                Изменить
              </button>
              <button type="button" className="admin__danger" onClick={() => remove(item)}>
                Удалить
              </button>
            </div>
          </article>
        ))}
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)} labelledBy="catalog-form-title">
          <form className="admin__edit" onSubmit={save}>
            <h3 id="catalog-form-title">
              {editing.id ? texts.editTitle : texts.createTitle}
            </h3>

            <CatalogForm
              value={editing}
              onChange={setEditing}
              onCoverBusy={setBusy}
              onUploadShot={uploadShot}
              busy={busy}
              texts={texts}
            />

            {error && <p className="form-error">{error}</p>}

            <div className="admin__edit-actions">
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => setEditing(null)}
              >
                Отмена
              </button>
              <button type="submit" className="btn btn--blue btn--sm" disabled={busy}>
                {busy ? "Сохраняем…" : "Сохранить"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
