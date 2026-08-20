import type { SeismicEvent } from "../types";
import { EventCard } from "./EventCard";
import { useTranslation } from "react-i18next";

interface EventFeedProps {
  events: SeismicEvent[];
  isLoading: boolean;
  newEventId: string | null;
  onEventClick: (event: SeismicEvent) => void;
}

export function EventFeed({ events, isLoading, newEventId, onEventClick }: EventFeedProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="feed">
        <div className="feed__title">🔔 {t("sidebar.recent_quakes")}</div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton skeleton--card" />
        ))}
      </div>
    );
  }

  return (
    <div className="feed">
      <div className="feed__title">
        🔔 {t("sidebar.recent_quakes")}
        <span className="feed__count">{events.length}</span>
      </div>
      {events.length === 0 ? (
        <div className="feed__empty">
          {t("sidebar.no_quakes_24h")}<br />
          {t("sidebar.monitoring_system")} 🌍
        </div>
      ) : (
        events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            isNew={event.id === newEventId}
            onClick={onEventClick}
          />
        ))
      )}
    </div>
  );
}
