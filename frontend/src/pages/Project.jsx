import CatalogDetail from "../components/CatalogDetail";
import { projects } from "../api/client";

const load = (slug) => projects.detail(slug);

export default function Project() {
  return (
    <CatalogDetail
      fetchItem={load}
      backTo="/projects"
      backLabel="Все проекты"
      notFoundTitle="Проект не найден"
      notFoundText="Возможно, он снят с публикации или адрес набран с опечаткой."
      linkLabel="Перейти к проекту"
      upperTitle
    />
  );
}
