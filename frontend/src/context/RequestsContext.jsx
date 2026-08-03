import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { admin } from "../api/client";
import { useAuth } from "./AuthContext";

/* Число необработанных заявок.

   Живёт в контексте, а не внутри вкладки «Заявки»: смысл счётчика в том,
   чтобы заявку заметили, а для этого он должен быть виден в шапке на любой
   странице — иначе обращение может пролежать до следующего захода в админку.

   Считаем только для администратора: остальным этот запрос ни к чему. */

const RequestsContext = createContext({ unhandled: 0, refresh: () => {} });

export function RequestsProvider({ children }) {
  const { isAdmin } = useAuth();
  const [unhandled, setUnhandled] = useState(0);

  const refresh = useCallback(() => {
    if (!isAdmin) {
      setUnhandled(0);
      return;
    }
    admin
      .listRequests()
      .then((data) => setUnhandled(data.unhandled ?? 0))
      .catch(() => {
        // Счётчик — вещь второстепенная: не ответило, значит просто не покажем.
      });
  }, [isAdmin]);

  useEffect(refresh, [refresh]);

  return (
    <RequestsContext.Provider value={{ unhandled, refresh }}>{children}</RequestsContext.Provider>
  );
}

export function useRequests() {
  return useContext(RequestsContext);
}
