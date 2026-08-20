import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

const resources = {
  es: {
    translation: {
      "app.title": "SismoBot",
      "app.subtitle": "{{count}} sismos • {{time}}",
      "app.live": "En vivo",
      
      "sidebar.recent_quakes": "Sismos recientes",
      "sidebar.active_notifications": "Notificaciones activas",
      "sidebar.inactive_notifications": "Notificaciones pausadas",
      "sidebar.no_events": "No hay sismos recientes",
      "sidebar.no_quakes_24h": "No hay sismos registrados en las últimas 24h.",
      "sidebar.monitoring_system": "El sistema sigue monitoreando...",

      "event.magnitude": "Magnitud",
      "event.depth": "Profundidad",
      "event.tsunami_warning": "Alerta de Tsunami",

      "settings.title": "Configuración de Alertas",
      "settings.close": "Cerrar",
      "settings.magnitude_label": "Magnitud Mínima",
      "settings.magnitude_description": "Recibir alertas para sismos de magnitud igual o mayor a:",
      "settings.regions_label": "Regiones a Monitorear",
      "settings.regions_description": "Selecciona qué zonas del mundo te interesan:",
      "settings.save_button": "Guardar Preferencias",

      "push.enable": "Activar Alertas",
      "push.disable": "Desactivar Alertas",
      "push.unsupported": "Notificaciones no soportadas",
      "push.denied": "Permiso denegado",
      
      "tour.start": "Iniciar Tour",
      "tour.next": "Siguiente",
      "tour.prev": "Anterior",
      "tour.done": "¡Entendido!",

      "tour.step1.title": "¡Bienvenido a SismoBot!",
      "tour.step1.desc": "Aquí puedes ver los terremotos que ocurren en el mundo en tiempo real. ¡El mapa es interactivo!",
      
      "tour.step_science.title": "🌎 ¿Sabías Qué?",
      "tour.step_science.desc": "La Tectónica de Placas explica cómo se acumula la energía bajo tus pies, y la Sismología estudia qué pasa cuando esa energía explota. ¡SismoBot usa ambas ciencias para protegerte!",
      
      "tour.step_live.title": "Conexión Satelital En Vivo",
      "tour.step_live.desc": "Estamos conectados directamente a las redes sísmicas de USGS y EMSC. Recibes los datos al instante.",
      
      "tour.step2.title": "Lista de Sismos",
      "tour.step2.desc": "Esta es la lista de sismos recientes. Los colores te indican la fuerza (magnitud) del terremoto. ¡Mientras más rojo, más fuerte!",
      
      "tour.step3.title": "Alertas Inmediatas",
      "tour.step3.desc": "¡No te pierdas ninguna alerta! Activa esta opción para recibir notificaciones en tu dispositivo cuando ocurra un temblor importante.",
      
      "tour.step4.title": "Configura a tu gusto",
      "tour.step4.desc": "Aquí puedes ajustar qué regiones del mundo quieres vigilar y cuán fuerte debe ser el sismo para notificarte.",
      
      "tour.step_telegram.title": "Bot de Telegram",
      "tour.step_telegram.desc": "Al darle clic aquí, te llevará a nuestro bot de Telegram para más alertas integradas.",
      
      "tour.step_install.title": "Instalar Aplicación",
      "tour.step_install.desc": "¡Instala SismoBot en tu pantalla de inicio para una experiencia nativa y más rápida!",
      
      "install_app": "Instalar App"
    }
  },
  en: {
    translation: {
      "app.title": "QuakeBot",
      "app.subtitle": "{{count}} quakes • {{time}}",
      "app.live": "Live",
      
      "sidebar.recent_quakes": "Recent Earthquakes",
      "sidebar.active_notifications": "Notifications Active",
      "sidebar.inactive_notifications": "Notifications Paused",
      "sidebar.no_events": "No recent earthquakes",
      "sidebar.no_quakes_24h": "No earthquakes recorded in the last 24h.",
      "sidebar.monitoring_system": "System is still monitoring...",

      "event.magnitude": "Magnitude",
      "event.depth": "Depth",
      "event.tsunami_warning": "Tsunami Warning",

      "settings.title": "Alert Settings",
      "settings.close": "Close",
      "settings.magnitude_label": "Minimum Magnitude",
      "settings.magnitude_description": "Receive alerts for earthquakes with a magnitude of or greater than:",
      "settings.regions_label": "Regions to Monitor",
      "settings.regions_description": "Select which areas of the world you are interested in:",
      "settings.save_button": "Save Preferences",

      "push.enable": "Enable Alerts",
      "push.disable": "Disable Alerts",
      "push.unsupported": "Notifications not supported",
      "push.denied": "Permission denied",

      "tour.start": "Start Tour",
      "tour.next": "Next",
      "tour.prev": "Previous",
      "tour.done": "Got it!",

      "tour.step1.title": "Welcome to QuakeBot!",
      "tour.step1.desc": "Here you can see the earthquakes happening around the world in real time. The map is interactive!",
      
      "tour.step_science.title": "🌎 Did You Know?",
      "tour.step_science.desc": "Plate Tectonics explains how energy accumulates under your feet, and Seismology studies what happens when that energy is released. QuakeBot uses both sciences to protect you!",
      
      "tour.step_live.title": "Live Satellite Connection",
      "tour.step_live.desc": "We are directly connected to the USGS and EMSC seismic networks. You receive data instantly.",
      
      "tour.step2.title": "Earthquake List",
      "tour.step2.desc": "This is the live list of recent earthquakes. Colors indicate the strength (magnitude) of the quake. The redder it is, the stronger it is!",
      
      "tour.step3.title": "Instant Alerts",
      "tour.step3.desc": "Don't miss an alert! Enable this option to receive notifications on your device when a significant earthquake occurs.",
      
      "tour.step4.title": "Customize Settings",
      "tour.step4.desc": "Here you can adjust which regions of the world you want to monitor and how strong the quake needs to be to notify you.",
      
      "tour.step_telegram.title": "Telegram Bot",
      "tour.step_telegram.desc": "Clicking here will take you to our Telegram bot for more integrated alerts.",

      "tour.step_install.title": "Install Application",
      "tour.step_install.desc": "Install QuakeBot on your home screen for a native and faster experience!",
      
      "install_app": "Install App"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "es",
    interpolation: {
      escapeValue: false // React already escapes by default
    }
  });

export default i18n;
