import { createContext, useContext, useEffect, useState } from "react";

import { settings as settingsApi } from "../api/client";

/* Настройки сайта: контакты центра и тексты правовых документов.
   Приходят из базы, правятся в админке, вкладка «Сайт».

   Значения по умолчанию продублированы здесь не для красоты: контакты стоят
   в шапке и подвале каждой страницы, и если показывать их только после
   ответа сервера, при каждом заходе подвал перестраивался бы на глазах.
   Пока ответ в пути, работают эти значения — те же, что заведены в базу
   при первом запуске. */
const FALLBACK = {
  contact_phone: "+7 (987) 800-26-70",
  contact_email: "vr.techum@gmail.com",
  contact_telegram: "https://t.me/",
  contact_vk: "https://vk.com/",
  contact_address: "г. Саратов, ул. Советская, д. 60в",
  contact_schedule: "Понедельник — Пятница, 10:00–17:00",
  legal_privacy_title: "Политика конфиденциальности",
  legal_privacy_body: "",
  legal_consent_title: "Согласие на обработку персональных данных",
  legal_consent_body: "",
  legal_draft_notice: "on",
};

const SettingsContext = createContext({ settings: FALLBACK, loading: true });

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    settingsApi
      .list()
      .then((data) => {
        if (!cancelled) setSettings({ ...FALLBACK, ...data.settings });
      })
      .catch(() => {
        // Сайт должен работать и без ответа: остаются значения по умолчанию.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading }}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext).settings;
}

/* Контакты в виде, удобном для разметки: ссылки на звонок и почту
   собираются здесь, а не в каждой странице по отдельности. */
export function useContacts() {
  const s = useSettings();
  return {
    phone: s.contact_phone,
    email: s.contact_email,
    telegram: s.contact_telegram,
    vk: s.contact_vk,
    address: s.contact_address,
    schedule: s.contact_schedule,
    phoneHref: `tel:${(s.contact_phone || "").replace(/[^\d+]/g, "")}`,
    emailHref: `mailto:${s.contact_email}`,
  };
}
