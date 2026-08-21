export interface SeismicEvent {
  id: string;
  magnitude: number;
  lat: number;
  lon: number;
  depth: number;
  location: string;
  timestamp: number;
  source: string;
  tsunami?: boolean;
}

export interface RiskAssessment {
  regionId: string;
  regionName: string;
  bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  riskScore: number;
  riskLevel: "low" | "moderate" | "high" | "critical";
  summary: string;
}

export function getMagnitudeClass(mag: number): string {
  if (mag >= 6.0) return "major";
  if (mag >= 5.0) return "strong";
  if (mag >= 4.0) return "moderate";
  if (mag >= 3.0) return "minor";
  return "micro";
}

export function getShakeClass(mag: number): string {
  if (mag >= 6.0) return "shake-major";
  if (mag >= 5.0) return "shake-strong";
  if (mag >= 4.0) return "shake-moderate";
  if (mag >= 3.0) return "shake-minor";
  return "shake-micro";
}

export function getMagnitudeColor(mag: number): string {
  if (mag >= 7.0) return "#991b1b";
  if (mag >= 6.0) return "#dc2626";
  if (mag >= 5.0) return "#ef4444";
  if (mag >= 4.0) return "#f97316";
  if (mag >= 3.0) return "#facc15";
  return "#22c55e";
}

export function getMarkerRadius(mag: number): number {
  if (mag >= 7.0) return 28;
  if (mag >= 6.0) return 22;
  if (mag >= 5.0) return 18;
  if (mag >= 4.0) return 14;
  if (mag >= 3.0) return 10;
  return 7;
}

export function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
