/**
 * Geographic utility functions.
 */

const EARTH_RADIUS_KM = 6371;

/** Convert degrees to radians. */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Calculate distance between two geographic points using the Haversine formula.
 * @returns Distance in kilometers.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Check if a point falls within a bounding box.
 */
export function isInBoundingBox(
  lat: number,
  lon: number,
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number
): boolean {
  return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
}

/**
 * Format a distance in kilometers for display.
 */
export function formatDistance(km: number): string {
  if (km < 1) return "<1 km";
  if (km < 10) return `~${km.toFixed(1)} km`;
  return `~${Math.round(km)} km`;
}

/**
 * Get cardinal direction from point A to point B.
 */
export function getCardinalDirection(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): string {
  const dLat = toLat - fromLat;
  const dLon = toLon - fromLon;
  const angle = (Math.atan2(dLon, dLat) * 180) / Math.PI;

  const directions = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  const index = Math.round(((angle + 360) % 360) / 45) % 8;
  return directions[index];
}
