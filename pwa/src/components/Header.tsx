interface HeaderProps {
  lastUpdate: number;
  eventCount: number;
  onOpenSettings: () => void;
  onStartTour: () => void;
}

import { useTranslation } from "react-i18next";

export function Header({ lastUpdate, eventCount, onOpenSettings, onStartTour }: HeaderProps) {
  const { t, i18n } = useTranslation();
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

      <div className="header__actions">
        <button 
          className="header__btn" 
          onClick={() => i18n.changeLanguage(i18n.language.startsWith('es') ? 'en' : 'es')}
          title={i18n.language.startsWith('es') ? "Switch to English" : "Cambiar a Español"}
        >
          {i18n.language.startsWith('es') ? "🇺🇸" : "🇪🇸"}
        </button>
        <button className="header__btn" onClick={onStartTour} title={t("tour.start")}>
          💡
        </button>
        <button id="btn-settings" className="header__btn" onClick={onOpenSettings} title={t("settings.title")}>
          ⚙️
        </button>
        <a
          id="tour-telegram"
          href="https://t.me/Sismove_bot"
          target="_blank"
          rel="noopener noreferrer"
          className="header__btn"
        >
          📱 Telegram
        </a>
      </div>
    </header>
  );
}
