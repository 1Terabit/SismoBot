import { RegionBounds } from "./sources/types";

/**
 * Predefined geographic regions for Latin America.
 * Bounding boxes are intentionally generous to avoid missing border events.
 */
export const REGIONS: Record<string, RegionBounds> = {
  venezuela: {
    name: "venezuela",
    label: "🇻🇪 Venezuela",
    minLat: 0.5,
    maxLat: 12.5,
    minLon: -73.5,
    maxLon: -59.5,
  },
  colombia: {
    name: "colombia",
    label: "🇨🇴 Colombia",
    minLat: -4.5,
    maxLat: 13.5,
    minLon: -79.5,
    maxLon: -66.5,
  },
  caribe: {
    name: "caribe",
    label: "🌴 Caribe",
    minLat: 10,
    maxLat: 27,
    minLon: -90,
    maxLon: -58,
  },
  mexico: {
    name: "mexico",
    label: "🇲🇽 México",
    minLat: 14,
    maxLat: 33,
    minLon: -118,
    maxLon: -86,
  },
  centroamerica: {
    name: "centroamerica",
    label: "🌎 Centroamérica",
    minLat: 7,
    maxLat: 18,
    minLon: -93,
    maxLon: -77,
  },
  sudamerica: {
    name: "sudamerica",
    label: "🌎 Sudamérica",
    minLat: -56,
    maxLat: 13,
    minLon: -82,
    maxLon: -34,
  },
  norteamerica: {
    name: "norteamerica",
    label: "🌎 Norteamérica",
    minLat: 14,
    maxLat: 72,
    minLon: -170,
    maxLon: -50,
  },
  europa: {
    name: "europa",
    label: "🌍 Europa",
    minLat: 34,
    maxLat: 72,
    minLon: -30,
    maxLon: 60,
  },
  africa: {
    name: "africa",
    label: "🌍 África",
    minLat: -35,
    maxLat: 37,
    minLon: -18,
    maxLon: 52,
  },
  asia: {
    name: "asia",
    label: "🌏 Asia",
    minLat: -10,
    maxLat: 80,
    minLon: 25,
    maxLon: 180,
  },
};

/** All region keys for "all" selection */
export const ALL_REGION_KEYS = Object.keys(REGIONS);

/** Default minimum magnitude for new users */
export const DEFAULT_MIN_MAGNITUDE = 4.0;

/** Polling interval in milliseconds */
export const POLL_INTERVAL_MS = (parseInt(process.env.POLL_INTERVAL_SECONDS ?? "15", 10)) * 1000;

/** How long to keep events in the dedup cache (24 hours) */
export const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Telegram API rate limit: max messages per second */
export const TELEGRAM_RATE_LIMIT = 25;

/** Magnitude thresholds for user configuration */
export const MAGNITUDE_OPTIONS = [2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0];

/** Severity levels based on magnitude */
export function getSeverityEmoji(magnitude: number): string {
  if (magnitude >= 7.0) return "🔴🔴🔴";
  if (magnitude >= 6.0) return "🔴🔴";
  if (magnitude >= 5.0) return "🔴";
  if (magnitude >= 4.0) return "🟠";
  if (magnitude >= 3.0) return "🟡";
  return "🟢";
}

export function getSeverityLabel(magnitude: number): string {
  if (magnitude >= 8.0) return "CATASTRÓFICO";
  if (magnitude >= 7.0) return "MUY FUERTE";
  if (magnitude >= 6.0) return "FUERTE";
  if (magnitude >= 5.0) return "MODERADO";
  if (magnitude >= 4.0) return "LEVE";
  if (magnitude >= 3.0) return "MENOR";
  return "MICRO";
}
