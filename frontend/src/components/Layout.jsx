import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useRequests } from "../context/RequestsContext";
import { useContacts, useLegalDocsEnabled } from "../context/SettingsContext";
import { LogoMark, MailIcon, PhoneIcon, TelegramIcon, UserIcon, VkIcon } from "./Icons";
import Shapes from "./Shapes";
import "./layout.css";

const NAV = [
  { to: "/", label: "Главная", end: true },
  { to: "/news", label: "Новости" },
  { to: "/projects", label: "Проекты" },
  { to: "/services", label: "Услуги" },
  { to: "/team", label: "Команда" },
];

function Logo({ className = "" }) {
  return (
    <Link to="/" className={`logo ${className}`}>
      <LogoMark className="logo__mark" />
      <span className="logo__text">
        АГРОПАРК
        <small>Вавиловский университет</small>
      </span>
    </Link>
  );
}

export function SocialLinks({ className = "" }) {
  const contacts = useContacts();

  /* Ссылку на соцсеть показываем, только если она задана: пустое поле
     в админке значит «у центра этого нет», и висящая иконка в никуда
     выглядела бы недоделкой. */
  return (
    <div className={`socials ${className}`}>
      {contacts.phone && (
        <a href={contacts.phoneHref} aria-label="Позвонить">
          <PhoneIcon />
        </a>
      )}
      {contacts.telegram && (
        <a href={contacts.telegram} target="_blank" rel="noreferrer" aria-label="Telegram">
          <TelegramIcon />
        </a>
      )}
      {contacts.email && (
        <a href={contacts.emailHref} aria-label="Написать на почту">
          <MailIcon />
        </a>
      )}
      {contacts.vk && (
        <a href={contacts.vk} target="_blank" rel="noreferrer" aria-label="ВКонтакте">
          <VkIcon />
        </a>
      )}
    </div>
  );
}

function Header() {
  const { user, isAdmin, logout } = useAuth();
  const { unhandled } = useRequests();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className="header">
      <div className="header__inner container">
        <Logo />

        <button
          type="button"
          className={`burger ${open ? "burger--open" : ""}`}
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label="Меню"
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`nav ${open ? "nav--open" : ""}`}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav__link ${isActive ? "nav__link--active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `nav__link ${isActive ? "nav__link--active" : ""}`}
            >
              Админка
              {unhandled > 0 && (
                <span className="nav__badge" title={`Необработанных заявок: ${unhandled}`}>
                  {unhandled > 99 ? "99+" : unhandled}
                </span>
              )}
            </NavLink>
          )}
        </nav>

        <div className="header__account">
          {user ? (
            <div className="account">
              {/* Имя ведёт в личный кабинет: там видно, кто вошёл,
                  и там же меняется пароль. */}
              <Link to="/account" className="account__name">
                {user.username}
              </Link>
              <UserIcon className="account__avatar" />
              <button type="button" className="account__exit" onClick={logout}>
                Выйти
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn btn--light btn--sm">
              Войти
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const legalDocs = useLegalDocsEnabled();

  return (
    <footer className="footer">
      <div className="footer__inner container">
        <Logo className="logo--footer" />
        {/* Ссылки на документы — только пока документы не спрятаны
            галочкой в админке. Соцсети прижаты вправо через margin-left:
            auto, так что без этого блока подвал не перекашивается. */}
        {legalDocs && (
          <nav className="footer__links" aria-label="Документы">
            <Link to="/privacy">
              Политика
              <br />
              конфиденциальности
            </Link>
            <Link to="/consent">
              Соглашение на обработку
              <br />
              персональных данных
            </Link>
          </nav>
        )}
        <SocialLinks className="socials--row" />
      </div>
    </footer>
  );
}

export default function Layout() {
  return (
    /* Обёртка нужна слою фигур: он position: absolute и растягивается
       на всю высоту документа, а не только экрана — объекты прокручиваются
       вместе с содержимым, как в макете. */
    <div className="page">
      <Shapes />
      <Header />
      <main className="main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
