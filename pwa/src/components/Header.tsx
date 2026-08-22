interface HeaderProps {
  lastUpdate: number;
  eventCount: number;
}


import { useTranslation } from "react-i18next";

export function Header({ lastUpdate, eventCount }: HeaderProps) {
  const { t } = useTranslation();
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

    </header>
  );
}
