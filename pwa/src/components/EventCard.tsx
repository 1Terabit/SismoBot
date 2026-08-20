import { getMagnitudeClass, getTimeAgo } from "../types";
import type { SeismicEvent } from "../types";
import { useTranslation } from "react-i18next";

interface EventCardProps {
  event: SeismicEvent;
  isNew: boolean;
  onClick: (event: SeismicEvent) => void;
  isSelected?: boolean;
}

export function EventCard({ event, isSelected, isNew, onClick }: EventCardProps) {
  const { t } = useTranslation();
  const magClass = getMagnitudeClass(event.magnitude);

  return (
    <div
      className={`event-card ${isSelected ? "event-card--selected" : ""}`}
      onClick={() => onClick(event)}
      style={isNew ? { borderColor: "var(--accent)", boxShadow: "0 0 20px var(--accent-glow)" } : undefined}
    >
      <div className="event-card__header">
        <div className={`event-card__magnitude event-card__magnitude--${magClass}`}>
          {event.magnitude.toFixed(1)}
        </div>
        <div className="event-card__info">
          <div className="event-card__location" title={event.location}>
            {event.location}
          </div>
          <div className="event-card__meta">
        <span className="event-card__depth">📏 {event.depth.toFixed(1)} km</span>
        <span className="event-card__source">📡 {event.source.toUpperCase()}</span>
      </div>
      
      {event.tsunami && (
        <div className="event-card__warning">
          🌊 {t("event.tsunami_warning")}
        </div>
      )}
        </div>
        <div className="event-card__time">{getTimeAgo(event.timestamp)}</div>
      </div>
    </div>
  );
}
