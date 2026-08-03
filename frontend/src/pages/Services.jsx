import CatalogList from "../components/CatalogList";
import { services } from "../api/client";

const load = () => services.list();

export default function Services() {
  return (
    <CatalogList
      title="Наши услуги"
      fetchItems={load}
      basePath="/services"
      actionLabel="Подробнее об услуге"
      emptyText="Услуги пока не добавлены."
    />
  );
}
