import { useRef, useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { Header } from "./components/Header";
import { SeismicMap } from "./components/SeismicMap";
import { EventFeed } from "./components/EventFeed";
import { PushSubscribe } from "./components/PushSubscribe";
import type { PushSubscribeHandle } from "./components/PushSubscribe";
import { SettingsModal } from "./components/SettingsModal";
import { FloatingMenu } from "./components/FloatingMenu";
import { useSeismicData } from "./hooks/useSeismicData";
import { useSettings } from "./hooks/useSettings";
import type { Settings } from "./hooks/useSettings";
import { isEventInRegion } from "./utils/regions";
import type { SeismicEvent } from "./types";

export default function App() {
  const { t, i18n } = useTranslation();
  const { events, isLoading, lastUpdate, newEventId } = useSeismicData();
  const { settings, updateSettings } = useSettings();
  const [selectedEvent, setSelectedEvent] = useState<SeismicEvent | null>(null);
  const [alertEventId, setAlertEventId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const pushRef = useRef<PushSubscribeHandle>(null);

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (e.magnitude < settings.minMagnitude) return false;
      if (settings.regions.includes("latam") || settings.regions.includes("all")) return true;
      return settings.regions.some(r => isEventInRegion(e.lat, e.lon, r));
    });
  }, [events, settings]);

  const handleSaveSettings = async (newSettings: Settings) => {
    updateSettings(newSettings);
    if (pushRef.current) {
      await pushRef.current.syncSettings(newSettings);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const eventParam = params.get("event");
    if (eventParam && events.length > 0) {
      setAlertEventId(eventParam);
      const ev = events.find(e => e.id === eventParam);
      if (ev) setSelectedEvent(ev);
      window.history.replaceState({}, document.title, "/");
      
      const timer = setTimeout(() => setAlertEventId(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [events]);

  const startTour = () => {
    const driverObj = driver({
      showProgress: true,
      nextBtnText: t("tour.next"),
      prevBtnText: t("tour.prev"),
      doneBtnText: t("tour.done"),
      steps: [
        {
          element: '#tour-header',
          popover: { title: t("tour.step1.title"), description: t("tour.step1.desc"), side: "bottom", align: "start" }
        },
        {
          element: '.header__status',
          popover: { title: t("tour.step_live.title"), description: t("tour.step_live.desc"), side: "bottom", align: "center" }
        },
        {
          element: '#tour-feed',
          popover: { title: t("tour.step2.title"), description: t("tour.step2.desc"), side: "left", align: "start" }
        },
        {
          element: '#tour-dynamic-island',
          popover: { title: "Menú Dinámico", description: "Usa esta flecha para mostrar u ocultar opciones como el Idioma, Configuración y Telegram.", side: "top", align: "center" }
        },
        {
          element: '#tour-push',
          popover: { title: t("tour.step3.title"), description: t("tour.step3.desc"), side: "top", align: "start" }
        },
        {
          element: '#tour-telegram',
          popover: { title: t("tour.step_telegram.title"), description: t("tour.step_telegram.desc"), side: "bottom", align: "end" }
        },
        {
          element: '#btn-settings',
          popover: { title: t("tour.step4.title"), description: t("tour.step4.desc"), side: "bottom", align: "end" }
        }
      ]
    });
    driverObj.drive();
  };

  const hasStartedTour = useRef(false);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem("hasSeenTour");
    if (!hasSeenTour && !hasStartedTour.current) {
      hasStartedTour.current = true;
      setTimeout(() => {
        startTour();
        localStorage.setItem("hasSeenTour", "true");
      }, 1000);
    }
  }, [t]); // Depends on `t` so it can translate properly when first rendering

  const handleEventClick = (event: SeismicEvent) => {
    setSelectedEvent(event);
    setIsSidebarOpen(false); // Close sidebar so flyTo map animation is visible on mobile
  };

  return (
    <div className="app">
      <Header 
        lastUpdate={lastUpdate} 
        eventCount={filteredEvents.length} 
        onOpenSettings={() => setIsSettingsOpen(true)}
        onStartTour={startTour}
      />
      <div className={`app__main ${!isSidebarOpen ? "app__main--collapsed" : ""}`}>
        <div className={`app__map ${alertEventId ? "app__map--alert" : ""}`}>
          <SeismicMap
            events={filteredEvents}
            selectedEvent={selectedEvent}
            newEventId={newEventId}
            alertEventId={alertEventId}
          />
          <div className="brand-watermark">
            By <span>Anthwam</span>
          </div>
          <FloatingMenu
            onOpenSettings={() => setIsSettingsOpen(true)}
            onStartTour={startTour}
            onChangeLanguage={() => {
              i18n.changeLanguage(i18n.language.startsWith('es') ? 'en' : 'es');
            }}
            currentLang={i18n.language}
          />
          <button 
            className="sidebar-toggle"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title={isSidebarOpen ? "Ocultar panel" : "Mostrar panel"}
          >
            {isSidebarOpen ? "▶" : "◀"}
          </button>
        </div>
        <aside className="app__sidebar">
          <EventFeed
            events={filteredEvents}
            isLoading={isLoading}
            newEventId={newEventId}
            onEventClick={handleEventClick}
          />
          <PushSubscribe ref={pushRef} settings={settings} />
        </aside>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={settings}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
