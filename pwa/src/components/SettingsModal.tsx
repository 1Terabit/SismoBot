import { useState } from "react";
import type { Settings } from "../hooks/useSettings";
import { REGION_LABELS } from "../utils/regions";
import { useTranslation } from "react-i18next";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (newSettings: Settings) => Promise<void>;
}

export function SettingsModal({ isOpen, onClose, settings, onSave }: SettingsModalProps) {
  const { t, i18n } = useTranslation();
  const [minMag, setMinMag] = useState(settings.minMagnitude);
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set(settings.regions));
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const toggleRegion = (regionId: string) => {
    const next = new Set(selectedRegions);
    
    if (regionId === "all") {
      next.clear();
      next.add("all");
    } else {
      next.delete("all");
      next.delete("latam"); // If they pick a specific one, they probably aren't doing broad anymore, though latam could be treated normally now.
      if (next.has(regionId)) {
        next.delete(regionId);
      } else {
        next.add(regionId);
      }
      if (next.size === 0) {
        next.add("all"); // Default fallback
      }
    }
    setSelectedRegions(next);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        minMagnitude: minMag,
        regions: Array.from(selectedRegions),
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} id="tour-settings">
        <div className="modal__header">
          <h2>⚙️ {t("settings.title")}</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal__body">
          <div className="settings-group">
            <label>Idioma / Language</label>
            <div className="regions-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <button 
                className={`region-btn ${i18n.language.startsWith('es') ? "region-btn--active" : ""}`}
                onClick={() => i18n.changeLanguage('es')}
              >
                🇪🇸 Español
              </button>
              <button 
                className={`region-btn ${i18n.language.startsWith('en') ? "region-btn--active" : ""}`}
                onClick={() => i18n.changeLanguage('en')}
              >
                🇺🇸 English
              </button>
            </div>
          </div>

          <div className="settings-group">
            <label>{t("settings.magnitude_label")}: <strong>M{minMag.toFixed(1)}</strong></label>
            <input 
              type="range" 
              min="2.5" 
              max="7.0" 
              step="0.5" 
              value={minMag}
              onChange={(e) => setMinMag(parseFloat(e.target.value))}
              className="range-slider"
            />
            <p className="settings-help">{t("settings.magnitude_description")}</p>
          </div>

          <div className="settings-group">
            <label>{t("settings.regions_label")}</label>
            <p className="settings-help" style={{ marginTop: 0, marginBottom: '8px' }}>{t("settings.regions_description")}</p>
            <div className="regions-grid">
              {Object.entries(REGION_LABELS).map(([id, label]) => (
                <button
                  key={id}
                  className={`region-btn ${selectedRegions.has(id) ? "region-btn--active" : ""}`}
                  onClick={() => toggleRegion(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal__footer">
          <button className="btn-save" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "..." : t("settings.save_button")}
          </button>
        </div>
      </div>
    </div>
  );
}
