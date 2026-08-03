import { useCallback, useEffect, useRef, useState } from "react";

import Modal from "../components/Modal";
import { PlusIcon } from "../components/Icons";
import { admin } from "../api/client";

/* Управление составом центра.

   Отчество — отдельное необязательное поле: среди сотрудников есть студенты,
   которым отчество указывать неуместно. Если оно пустое, на сайте выводится
   «Фамилия Имя». */

const EMPTY = {
  last_name: "",
  first_name: "",
  middle_name: "",
  role: "",
  photo_url: "",
  phone: "",
  email: "",
  telegram: "",
  vk: "",
  is_published: true,
};

function StaffForm({ value, onChange, onUpload, busy }) {
  const fileInput = useRef(null);
  const set = (field) => (event) => onChange({ ...value, [field]: event.target.value });

  return (
    <>
      <div className="admin__staff-row">
        <label className="field">
          <span className="field__label">Фамилия *</span>
          <input className="input" value={value.last_name} onChange={set("last_name")} required />
        </label>
        <label className="field">
          <span className="field__label">Имя *</span>
          <input className="input" value={value.first_name} onChange={set("first_name")} required />
        </label>
        <label className="field">
          <span className="field__label">Отчество</span>
          <input
            className="input"
            value={value.middle_name}
            onChange={set("middle_name")}
            placeholder="можно не заполнять"
          />
        </label>
      </div>

      <label className="field">
        <span className="field__label">Должность</span>
        <input
          className="input"
          value={value.role}
          onChange={set("role")}
          placeholder="Например: инженер-программист"
        />
      </label>

      <div className="field">
        <span className="field__label">Фотография</span>
        <div className="admin__staff-photo">
          {value.photo_url ? (
            <img src={value.photo_url} alt="" />
          ) : (
            <span className="admin__staff-photo-stub">
              <PlusIcon />
            </span>
          )}
          <div className="admin__staff-photo-actions">
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
            >
              {value.photo_url ? "Заменить" : "Загрузить"}
            </button>
            {value.photo_url && (
              <button
                type="button"
                className="admin__danger"
                onClick={() => onChange({ ...value, photo_url: "" })}
              >
                Убрать
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="visually-hidden"
            onChange={(event) => onUpload(event, fileInput)}
          />
        </div>
      </div>

      <div className="admin__staff-row">
        <label className="field">
          <span className="field__label">Телефон</span>
          <input className="input" value={value.phone} onChange={set("phone")} />
        </label>
        <label className="field">
          <span className="field__label">Email</span>
          <input className="input" type="email" value={value.email} onChange={set("email")} />
        </label>
      </div>

      <div className="admin__staff-row">
        <label className="field">
          <span className="field__label">Telegram</span>
          <input
            className="input"
            value={value.telegram}
            onChange={set("telegram")}
            placeholder="@username или ссылка"
          />
        </label>
        <label className="field">
          <span className="field__label">ВКонтакте</span>
          <input
            className="input"
            value={value.vk}
            onChange={set("vk")}
            placeholder="ссылка на профиль"
          />
        </label>
      </div>

      <label className="auth__remember">
        <input
          type="checkbox"
          checked={value.is_published}
          onChange={(event) => onChange({ ...value, is_published: event.target.checked })}
        />
        <span>Показывать на сайте</span>
      </label>
    </>
  );
}

export default function AdminStaff() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    admin
      .listStaff()
      .then((data) => setItems(data.items))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  async function upload(event, ref) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const data = await admin.upload(file);
      setEditing((prev) => ({ ...prev, photo_url: data.url }));
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
      if (editing.id) await admin.updateStaff(editing.id, editing);
      else await admin.createStaff(editing);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(member) {
    if (!window.confirm(`Удалить «${member.full_name}»? Отменить будет нельзя.`)) return;
    await admin.deleteStaff(member.id).catch((err) => setError(err.message));
    load();
  }

  async function move(index, delta) {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    await admin.reorderStaff(next.map((m) => m.id)).catch((err) => setError(err.message));
    load();
  }

  return (
    <div className="admin__staff">
      <div className="admin__staff-head">
        <p className="admin__hint">
          Порядок карточек на сайте — как в этом списке. Отчество можно не заполнять:
          для студентов выводится «Фамилия Имя».
        </p>
        <button type="button" className="btn btn--blue btn--sm" onClick={() => setEditing({ ...EMPTY })}>
          Добавить сотрудника
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}
      {items.length === 0 && <p className="admin__hint">Сотрудников пока нет.</p>}

      <div className="admin__list">
        {items.map((member, index) => (
          <article key={member.id} className="admin__row">
            {member.photo_url ? (
              <img src={member.photo_url} alt="" />
            ) : (
              <span className="admin__row-stub" />
            )}
            <div className="admin__row-body">
              <h4>{member.full_name}</h4>
              <p className="admin__row-meta">
                {member.role || "должность не указана"}
                {member.phone ? ` · ${member.phone}` : ""}
                {member.email ? ` · ${member.email}` : ""}
                {member.is_published ? "" : " · скрыт"}
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
              <button
                type="button"
                className="admin__chip"
                onClick={() =>
                  setEditing({
                    id: member.id,
                    last_name: member.last_name,
                    first_name: member.first_name,
                    middle_name: member.middle_name ?? "",
                    role: member.role ?? "",
                    photo_url: member.photo_url ?? "",
                    phone: member.phone ?? "",
                    email: member.email ?? "",
                    telegram: member.telegram ?? "",
                    vk: member.vk ?? "",
                    is_published: member.is_published,
                  })
                }
              >
                Изменить
              </button>
              <button type="button" className="admin__danger" onClick={() => remove(member)}>
                Удалить
              </button>
            </div>
          </article>
        ))}
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)} labelledBy="staff-form-title">
          <form className="admin__edit" onSubmit={save}>
            <h3 id="staff-form-title">
              {editing.id ? "Редактирование сотрудника" : "Новый сотрудник"}
            </h3>

            <StaffForm value={editing} onChange={setEditing} onUpload={upload} busy={busy} />

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
