import CatalogDetail from "../components/CatalogDetail";
import { services } from "../api/client";

const load = (slug) => services.detail(slug);

export default function Service() {
  return (
    <CatalogDetail
      fetchItem={load}
      backTo="/services"
      backLabel="Все услуги"
      notFoundTitle="Услуга не найдена"
      notFoundText="Возможно, она снята с публикации или адрес набран с опечаткой."
      linkLabel="Подробнее"
    />
  );
}
