import CatalogList from "../components/CatalogList";
import { projects } from "../api/client";

const load = () => projects.list();

export default function Startups() {
  return (
    <CatalogList
      title="Наши стартапы"
      fetchItems={load}
      basePath="/startups"
      actionLabel="Перейти к стартапу"
      emptyText="Проекты пока не добавлены."
      upperTitles
    />
  );
}
