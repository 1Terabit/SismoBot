interface HeaderProps {
  lastUpdate: number;
  eventCount: number;
  onOpenSettings: () => void;
  onStartTour: () => void;
}

import { useState } from "react";
import { useTranslation } from "react-i18next";

export function Header({ lastUpdate, eventCount, onOpenSettings, onStartTour }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const timeStr = lastUpdate
    ? new Date(lastUpdate).toLocaleTimeString("es-VE", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "--:--:--";

  return (
    <header className="header" id="tour-header">
      <div className="header__brand">
        <span className="header__logo">{t("app.title")}</span>
        <div className="seismic-wave">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="seismic-wave__bar" />
          ))}
        </div>
      </div>

      <div className="header__status">
        <div className="header__dot" />
        <span>{t("app.live")} · {eventCount} sismos · {timeStr}</span>
      </div>

      <button 
        className="header__hamburger"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        title="Menu"
      >
        {isMobileMenuOpen ? "✕" : "☰"}
      </button>

      <div className={`header__actions ${isMobileMenuOpen ? "header__actions--open" : ""}`}>
        <button 
          className="header__btn" 
          onClick={() => {
            i18n.changeLanguage(i18n.language.startsWith('es') ? 'en' : 'es');
            setIsMobileMenuOpen(false);
          }}
          title={i18n.language.startsWith('es') ? "Switch to English" : "Cambiar a Español"}
        >
          {i18n.language.startsWith('es') ? "🇺🇸" : "🇪🇸"}
        </button>
        <button className="header__btn" onClick={() => { onStartTour(); setIsMobileMenuOpen(false); }} title={t("tour.start")}>
          💡
        </button>
        <button id="btn-settings" className="header__btn" onClick={() => { onOpenSettings(); setIsMobileMenuOpen(false); }} title={t("settings.title")}>
          ⚙️
        </button>
        <a
          id="tour-telegram"
          href="https://t.me/Sismove_bot"
          target="_blank"
          rel="noopener noreferrer"
          className="header__btn"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.94z"/>
          </svg>
        </a>
      </div>
    </header>
  );
}
