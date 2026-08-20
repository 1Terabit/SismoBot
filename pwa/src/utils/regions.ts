export const REGION_LABELS: Record<string, string> = {
  all: "🌍 Todo el Mundo",
  latam: "🌎 Toda LatAm",
  venezuela: "🇻🇪 Venezuela",
  colombia: "🇨🇴 Colombia",
  caribe: "🌴 Caribe",
  mexico: "🇲🇽 México",
  centroamerica: "🌎 Centroamérica",
  sudamerica: "🌎 Sudamérica",
  norteamerica: "🌎 Norteamérica",
  europa: "🌍 Europa",
  africa: "🌍 África",
  asia: "🌏 Asia",
};

export const REGION_BOUNDS: Record<string, { minLat: number; maxLat: number; minLon: number; maxLon: number }> = {
  all: { minLat: -90, maxLat: 90, minLon: -180, maxLon: 180 },
  latam: { minLat: -56, maxLat: 72, minLon: -170, maxLon: -34 },
  venezuela: { minLat: 0.5, maxLat: 12.5, minLon: -73.5, maxLon: -59.5 },
  colombia: { minLat: -4.5, maxLat: 13.5, minLon: -79.5, maxLon: -66.5 },
  caribe: { minLat: 10, maxLat: 27, minLon: -90, maxLon: -58 },
  mexico: { minLat: 14, maxLat: 33, minLon: -118, maxLon: -86 },
  centroamerica: { minLat: 7, maxLat: 18, minLon: -93, maxLon: -77 },
  sudamerica: { minLat: -56, maxLat: 13, minLon: -82, maxLon: -34 },
  norteamerica: { minLat: 14, maxLat: 72, minLon: -170, maxLon: -50 },
  europa: { minLat: 34, maxLat: 72, minLon: -30, maxLon: 60 },
  africa: { minLat: -35, maxLat: 37, minLon: -18, maxLon: 52 },
  asia: { minLat: -10, maxLat: 80, minLon: 25, maxLon: 180 },
};

export function isEventInRegion(lat: number, lon: number, regionKey: string): boolean {
  if (regionKey === "latam" || regionKey === "all") return true;
  const b = REGION_BOUNDS[regionKey];
  if (!b) return false;
  return lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon;
}
