import { useCallback, useEffect, useState } from "react";

import Hero from "../components/Hero";
import AdminCatalog from "./AdminCatalog";
import AdminSite from "./AdminSite";
import CoverField from "../components/CoverField";
import AdminStaff from "./AdminStaff";
import Modal from "../components/Modal";
import NewsForm from "../components/NewsForm";
import { admin } from "../api/client";
import { useRequests } from "../context/RequestsContext";
import "./admin.css";

/* Раздела админки в макете нет — спроектирован самостоятельно в той же
   тёмной эстетике. Создание новости продублировано здесь и во встроенной
   форме на странице «Новости», чтобы не бегать между разделами. */

function formatDate(value) {
  return value
    ? new Date(value).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
}

/* Настройки двух разделов каталога. Ручки API и подписи — единственное,
   чем «Проекты» и «Услуги» отличаются друг от друга в админке. */
const PROJECTS_TAB = {
  api: {
    list: admin.listProjects,
    create: admin.createProject,
    update: admin.updateProject,
    remove: admin.deleteProject,
    reorder: admin.reorderProjects,
  },
  texts: {
    key: "project",
    listTitle: "Наши проекты",
    basePath: "/projects",
    addLabel: "Добавить проект",
    emptyText: "Проектов пока нет.",
    editTitle: "Редактирование проекта",
    createTitle: "Новый проект",
    linkLabel: "Ссылка на проект",
    kinds: ["Платформа", "Приложение", "VR тренажёр"],
    featureLabel: "Показывать в блоке «Наши проекты» на главной",
    sliderLabel: "Показывать в карусели на первом экране",
    defaults: { is_featured: true },
  },
};

const SERVICES_TAB = {
  api: {
    list: admin.listServices,
    create: admin.createService,
    update: admin.updateService,
    remove: admin.deleteService,
    reorder: admin.reorderServices,
  },
  texts: {
    key: "service",
    listTitle: "Наши услуги",
    basePath: "/services",
    addLabel: "Добавить услугу",
    emptyText: "Услуг пока нет.",
    editTitle: "Редактирование услуги",
    createTitle: "Новая услуга",
    linkLabel: "Ссылка на страницу услуги",
    // Подписи-типа у услуг в макете нет, поле не показываем.
    kinds: null,
  },
};

function RequestsTab() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  // Значок в шапке должен гаснуть сразу, как заявку отметили обработанной.
  const { refresh } = useRequests();

  const load = useCallback(() => {
    setLoading(true);
    admin
      .listRequests()
      .then((data) => setItems(data.items))
      .catch((err) => setError(err.message))
      .finally(() => {
        setLoading(false);
        refresh();
      });
  }, [refresh]);

  useEffect(load, [load]);

  async function toggle(item) {
    await admin.updateRequest(item.id, { is_handled: !item.is_handled }).catch(() => {});
    load();
  }

  async function remove(item) {
    if (!window.confirm(`Удалить заявку от «${item.name}»? Отменить будет нельзя.`)) return;
    await admin.deleteRequest(item.id).catch(() => {});
    load();
  }

  if (loading) return <p className="admin__hint">Загружаем заявки…</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (items.length === 0) return <p className="admin__hint">Заявок пока нет.</p>;

  return (
    <div className="admin__table-wrap">
      <table className="admin__table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Имя</th>
            <th>Телефон</th>
            <th>Сообщение</th>
            <th>Статус</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={item.is_handled ? "is-handled" : ""}>
              <td className="admin__nowrap">{formatDate(item.created_at)}</td>
              <td>{item.name}</td>
              <td className="admin__nowrap">
                <a href={`tel:${item.phone.replace(/[^\d+]/g, "")}`}>{item.phone}</a>
              </td>
              <td className="admin__message">{item.message}</td>
              <td>
                <button type="button" className="admin__chip" onClick={() => toggle(item)}>
                  {item.is_handled ? "Обработана" : "Новая"}
                </button>
              </td>
              <td>
                <button type="button" className="admin__danger" onClick={() => remove(item)}>
                  Удалить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NewsTab() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    admin
      .listNews()
      .then((data) => setItems(data.items))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(item) {
    if (!window.confirm(`Удалить новость «${item.title}»? Отменить будет нельзя.`)) return;
    await admin.deleteNews(item.id).catch((err) => setError(err.message));
    load();
  }

  async function togglePublish(item) {
    await admin
      .updateNews(item.id, {
        title: item.title,
        body: item.body,
        image_url: item.image_url,
        is_published: !item.is_published,
      })
      .catch((err) => setError(err.message));
    load();
  }

  async function saveEdit(event) {
    event.preventDefault();
    try {
      await admin.updateNews(editing.id, {
        title: editing.title,
        body: editing.body,
        image_url: editing.image_url,
        is_published: editing.is_published,
      });
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="admin__news">
      <div className="admin__create">
        <h3>Добавить новость</h3>
        <div className="admin__create-form">
          <NewsForm onCreated={load} />
        </div>
      </div>

      <div className="admin__list">
        <h3>Опубликованные материалы</h3>
        {error && <p className="form-error">{error}</p>}

        {items.length === 0 && <p className="admin__hint">Новостей пока нет.</p>}

        {items.map((item) => (
          <article key={item.id} className="admin__row">
            {item.image_url ? (
              <img src={item.image_url} alt="" />
            ) : (
              <span className="admin__row-stub" />
            )}
            <div className="admin__row-body">
              <h4>{item.title}</h4>
              <p className="admin__row-meta">
                {formatDate(item.created_at)}
                {item.author ? ` · ${item.author}` : ""}
                {item.is_published ? "" : " · черновик"}
              </p>
            </div>
            <div className="admin__row-actions">
              <button
                type="button"
                className="admin__chip"
                onClick={() =>
                  setEditing({
                    id: item.id,
                    title: item.title,
                    body: item.body ?? "",
                    image_url: item.image_url ?? "",
                    is_published: item.is_published,
                  })
                }
              >
                Изменить
              </button>
              <button type="button" className="admin__chip" onClick={() => togglePublish(item)}>
                {item.is_published ? "Снять" : "Опубликовать"}
              </button>
              <button type="button" className="admin__danger" onClick={() => remove(item)}>
                Удалить
              </button>
            </div>
          </article>
        ))}
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)} labelledBy="admin-edit-title">
          <form className="admin__edit" onSubmit={saveEdit}>
            <h3 id="admin-edit-title">Редактирование новости</h3>

            <label className="field">
              <span className="field__label">Заголовок</span>
              <input
                className="input"
                value={editing.title}
                onChange={(event) => setEditing({ ...editing, title: event.target.value })}
                required
              />
            </label>

            <label className="field">
              <span className="field__label">Текст</span>
              <textarea
                className="textarea textarea--long"
                value={editing.body}
                onChange={(event) => setEditing({ ...editing, body: event.target.value })}
              />
            </label>

            <CoverField
              label="Картинка новости"
              hint="Показывается на карточке в ленте и в открытой новости."
              url={editing.image_url}
              onChange={(url) => setEditing((prev) => ({ ...prev, image_url: url }))}
              onBusy={setUploading}
            />

            <div className="admin__edit-actions">
              <button type="button" className="btn btn--outline btn--sm" onClick={() => setEditing(null)}>
                Отмена
              </button>
              <button type="submit" className="btn btn--blue btn--sm" disabled={uploading}>
                {uploading ? "Загружаем картинку…" : "Сохранить"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState("news");
  const { unhandled } = useRequests();

  return (
    <>
      <Hero compact />

      <section className="section">
        <div className="container">
          <div className="glass admin">
            <h2 className="admin__title">Админка</h2>

            <div className="admin__tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "news"}
                className={`chip ${tab === "news" ? "chip--active" : ""}`}
                onClick={() => setTab("news")}
              >
                Новости
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "projects"}
                className={`chip ${tab === "projects" ? "chip--active" : ""}`}
                onClick={() => setTab("projects")}
              >
                Проекты
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "services"}
                className={`chip ${tab === "services" ? "chip--active" : ""}`}
                onClick={() => setTab("services")}
              >
                Услуги
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "staff"}
                className={`chip ${tab === "staff" ? "chip--active" : ""}`}
                onClick={() => setTab("staff")}
              >
                Состав центра
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "site"}
                className={`chip ${tab === "site" ? "chip--active" : ""}`}
                onClick={() => setTab("site")}
              >
                Сайт
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "requests"}
                className={`chip ${tab === "requests" ? "chip--active" : ""}`}
                onClick={() => setTab("requests")}
              >
                Заявки
                {unhandled > 0 && <span className="nav__badge">{unhandled}</span>}
              </button>
            </div>

            {tab === "news" && <NewsTab />}
            {tab === "projects" && <AdminCatalog {...PROJECTS_TAB} />}
            {tab === "services" && <AdminCatalog {...SERVICES_TAB} />}
            {tab === "staff" && <AdminStaff />}
            {tab === "site" && <AdminSite />}
            {tab === "requests" && <RequestsTab />}
          </div>
        </div>
      </section>
    </>
  );
}
