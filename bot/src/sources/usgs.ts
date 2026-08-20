import { SeismicEvent, SeismicProvider } from "./types";
import { isInBoundingBox } from "../utils/geo";
import { logger } from "../utils/logger";

/**
 * USGS GeoJSON feed — the most reliable real-time earthquake data source.
 * Polls the "past hour, magnitude 2.5+" feed which updates every ~15 seconds.
 */

interface USGSFeature {
  id: string;
  properties: {
    mag: number;
    place: string;
    time: number;
    updated: number;
    type: string;
    tsunami?: number;
  };
  geometry: {
    coordinates: [number, number, number]; // [lon, lat, depth]
  };
}

interface USGSResponse {
  type: string;
  features: USGSFeature[];
  metadata: {
    generated: number;
    count: number;
    title: string;
  };
}

const USGS_FEED_URL =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_hour.geojson";

export class USGSProvider implements SeismicProvider {
  readonly name = "usgs" as const;

  async fetchEvents(): Promise<SeismicEvent[]> {
    try {
      const response = await fetch(USGS_FEED_URL, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        logger.error("USGS", `HTTP ${response.status}: ${response.statusText}`);
        return [];
      }

      const data = (await response.json()) as USGSResponse;
      logger.debug(
        "USGS",
        `Fetched ${data.features.length} events (generated: ${new Date(data.metadata.generated).toISOString()})`
      );

      return data.features
        .map((f) => this.normalize(f));
    } catch (err) {
      logger.error("USGS", "Failed to fetch events", err);
      return [];
    }
  }

  private normalize(feature: USGSFeature): SeismicEvent {
    const [lon, lat, depth] = feature.geometry.coordinates;
    return {
      id: feature.id,
      magnitude: feature.properties.mag,
      lat,
      lon,
      depth: Math.max(0, depth),
      location: feature.properties.place ?? "Unknown location",
      timestamp: feature.properties.time,
      source: "usgs",
      tsunami: feature.properties.tsunami === 1,
    };
  }
}
