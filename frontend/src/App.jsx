import { useEffect, useRef } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import Layout from "./components/Layout.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import Account from "./pages/Account.jsx";
import Admin from "./pages/Admin.jsx";
import Confirm from "./pages/Confirm.jsx";
import Contacts from "./pages/Contacts.jsx";
import Home from "./pages/Home.jsx";
import Legal from "./pages/Legal.jsx";
import Login from "./pages/Login.jsx";
import News from "./pages/News.jsx";
import NotFound from "./pages/NotFound.jsx";
import Project from "./pages/Project.jsx";
import Register from "./pages/Register.jsx";
import RegisterSuccess from "./pages/RegisterSuccess.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Service from "./pages/Service.jsx";
import Services from "./pages/Services.jsx";
import Startups from "./pages/Startups.jsx";

function ScrollToTop() {
  const { pathname } = useLocation();
  const previous = useRef(pathname);

  useEffect(() => {
    /* Новость открывается поверх ленты и меняет адрес на /news/<номер>.
       Это не переход на другую страницу, и утаскивать ленту наверх
       при открытии и закрытии карточки не нужно. */
    const inNews = (p) => p === "/news" || p.startsWith("/news/");
    if (!(inNews(previous.current) && inNews(pathname))) window.scrollTo(0, 0);
    previous.current = pathname;
  }, [pathname]);

  return null;
}

function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <div className="container section">Загрузка…</div>;
  return isAdmin ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="news" element={<News />} />
          {/* Новость открывается поверх ленты, но своим адресом:
              так ссылкой можно поделиться, и робот её видит. */}
          <Route path="news/:newsId" element={<News />} />
          <Route path="startups" element={<Startups />} />
          <Route path="startups/:slug" element={<Project />} />
          <Route path="services" element={<Services />} />
          <Route path="services/:slug" element={<Service />} />
          <Route path="contacts" element={<Contacts />} />

          <Route path="account" element={<Account />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="register/success" element={<RegisterSuccess />} />
          <Route path="confirm/:token" element={<Confirm />} />
          <Route path="reset/:token" element={<ResetPassword />} />

          <Route path="privacy" element={<Legal kind="privacy" />} />
          <Route path="consent" element={<Legal kind="consent" />} />

          <Route
            path="admin"
            element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
