import { useTranslation } from "react-i18next";
import { useInstallPrompt } from "../hooks/useInstallPrompt";

interface FloatingMenuProps {
  onOpenSettings: () => void;
  onStartTour: () => void;
  onChangeLanguage: () => void;
  currentLang: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export function FloatingMenu({
  onOpenSettings,
  onStartTour,
  onChangeLanguage,
  currentLang,
  isOpen,
  setIsOpen,
}: FloatingMenuProps) {
  const { t } = useTranslation();
  const { promptInstall, isInstallable } = useInstallPrompt();

  return (
    <div className={`dynamic-island-wrapper ${isOpen ? "is-open" : ""}`} id="tour-dynamic-island">
      <button 
        className="island-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? "Ocultar menú" : "Mostrar menú"}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
          {isOpen ? <polyline points="6 15 12 9 18 15" /> : <polyline points="6 9 12 15 18 9" />}
        </svg>
      </button>

      <div className="dynamic-island">
        <button 
          className="island-btn" 
          onClick={onChangeLanguage}
          title={currentLang.startsWith('es') ? "Switch to English" : "Cambiar a Español"}
        >
          {currentLang.startsWith('es') ? "🇺🇸" : "🇪🇸"}
        </button>
        
        <button className="island-btn" onClick={onStartTour} title={t("tour.start")}>
          💡
        </button>

        <button id="btn-settings-island" className="island-btn" onClick={onOpenSettings} title={t("settings.title")}>
          ⚙️
        </button>

        {isInstallable && (
          <button id="tour-install-app" className="island-btn" onClick={promptInstall} title={t("install_app")}>
            📲
          </button>
        )}

        <a
          id="btn-download-pdf-island"
          href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/report?lang=${currentLang.startsWith('en') ? 'en' : 'es'}`}
          target="_blank"
          rel="noopener noreferrer"
          className="island-btn"
          title="Descargar Boletín PDF"
        >
          📄
        </a>

        <a
          id="tour-telegram-island"
          href="https://t.me/Sismove_bot"
          target="_blank"
          rel="noopener noreferrer"
          className="island-btn"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.94z"/>
          </svg>
        </a>
      </div>
    </div>
  );
}
