import CatalogList from "../components/CatalogList";
import { projects } from "../api/client";

const load = () => projects.list();

/* Раздел назывался «Стартапы» и жил по адресу /startups. Прежний адрес
   не умер: внутренний nginx постоянно перенаправляет его сюда. */
export default function Projects() {
  return (
    <CatalogList
      title="Наши проекты"
      fetchItems={load}
      basePath="/projects"
      actionLabel="Подробнее о проекте"
      emptyText="Проекты пока не добавлены."
      upperTitles
    />
  );
}
