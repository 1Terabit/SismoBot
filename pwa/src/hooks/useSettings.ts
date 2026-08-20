import { useState, useEffect } from "react";

export interface Settings {
  minMagnitude: number;
  regions: string[];
}

const DEFAULT_SETTINGS: Settings = {
  minMagnitude: 4.0,
  regions: ["all"],
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem("sismobot_settings");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const updateSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    localStorage.setItem("sismobot_settings", JSON.stringify(newSettings));
  };

  return { settings, updateSettings };
}
