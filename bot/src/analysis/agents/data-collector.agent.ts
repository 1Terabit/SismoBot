/**
 * DataCollectorAgent
 * Fetches seismic catalog data from USGS for configured regions.
 * Provides both real-time (30d) and historical baseline data.
 */

import type { IAgent, AgentContext, AgentResult } from "../engine";
import { logger } from "../../utils/logger";

// Latin America seismic regions with bounding boxes
export interface SeismicRegion {
  id: string;
  name: string;
  minlat: number;
  maxlat: number;
  minlon: number;
  maxlon: number;
}

export const LATAM_REGIONS: SeismicRegion[] = [
  { id: "venezuela",     name: "Venezuela",       minlat: 0.5,   maxlat: 12.5,  minlon: -73.5, maxlon: -59.5 },
  { id: "colombia",      name: "Colombia",        minlat: -4.5,  maxlat: 13.5,  minlon: -82,   maxlon: -66.5 },
  { id: "peru",          name: "Perú",            minlat: -18.5, maxlat: 0,     minlon: -81.5, maxlon: -68 },
  { id: "chile",         name: "Chile",           minlat: -56,   maxlat: -17.5, minlon: -76,   maxlon: -66 },
  { id: "mexico",        name: "México",          minlat: 14,    maxlat: 33,    minlon: -118,  maxlon: -86 },
  { id: "centroamerica", name: "Centroamérica",   minlat: 7,     maxlat: 18.5,  minlon: -92,   maxlon: -77 },
  { id: "caribe",        name: "Caribe",          minlat: 10,    maxlat: 25,    minlon: -85,   maxlon: -58 },
  { id: "argentina",     name: "Argentina",       minlat: -55,   maxlat: -21.5, minlon: -73.5, maxlon: -53.5 },
  { id: "ecuador",       name: "Ecuador",         minlat: -5,    maxlat: 2,     minlon: -81.5, maxlon: -75 },
];

export interface CatalogEvent {
  id: string;
  time: number; // epoch ms
  latitude: number;
  longitude: number;
  depth: number; // km
  magnitude: number;
  magType: string;
  place: string;
  regionId: string;
}

export interface RegionCatalog {
  region: SeismicRegion;
  events: CatalogEvent[];
  fetchedAt: number;
}

const USGS_API = "https://earthquake.usgs.gov/fdsnws/event/1/query";

async function fetchUSGSCatalog(
  region: SeismicRegion,
  startTime: Date,
  endTime: Date,
  minMagnitude = 1.0,
): Promise<CatalogEvent[]> {
  const params = new URLSearchParams({
    format: "geojson",
    starttime: startTime.toISOString(),
    endtime: endTime.toISOString(),
    minmagnitude: minMagnitude.toString(),
    minlatitude: region.minlat.toString(),
    maxlatitude: region.maxlat.toString(),
    minlongitude: region.minlon.toString(),
    maxlongitude: region.maxlon.toString(),
    orderby: "time",
    limit: "2000",
  });

  const url = `${USGS_API}?${params}`;
  logger.debug("DATA", `Fetching USGS: ${region.name} (${startTime.toISOString().slice(0, 10)} → ${endTime.toISOString().slice(0, 10)})`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`USGS API error: ${res.status} ${res.statusText}`);
  }

  const geojson = await res.json() as {
    features: Array<{
      id: string;
      properties: {
        time: number;
        place: string;
        mag: number;
        magType: string;
      };
      geometry: {
        coordinates: [number, number, number];
      };
    }>;
  };

  return geojson.features.map((f) => ({
    id: f.id,
    time: f.properties.time,
    latitude: f.geometry.coordinates[1],
    longitude: f.geometry.coordinates[0],
    depth: f.geometry.coordinates[2],
    magnitude: f.properties.mag,
    magType: f.properties.magType,
    place: f.properties.place ?? "Unknown",
    regionId: region.id,
  }));
}

export class DataCollectorAgent implements IAgent {
  readonly name = "data-collector";
  readonly capabilities = ["fetch-seismic-catalog"];

  canHandle(_context: AgentContext): boolean {
    return true; // Always runs — it's the first step
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      // Determine which regions to analyze (default: all LATAM)
      const regions = (context.metadata.regions as SeismicRegion[] | undefined) ?? LATAM_REGIONS;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      const catalogs: RegionCatalog[] = [];

      for (const region of regions) {
        // Fetch recent 30-day data (all magnitudes ≥ 1.0)
        const recentEvents = await fetchUSGSCatalog(region, thirtyDaysAgo, now, 1.0);

        // Fetch 1-year historical for baseline (only ≥ 2.5 to keep manageable)
        const historicalEvents = await fetchUSGSCatalog(region, oneYearAgo, thirtyDaysAgo, 2.5);

        catalogs.push({
          region,
          events: [...recentEvents, ...historicalEvents],
          fetchedAt: Date.now(),
        });

        logger.info("DATA", `${region.name}: ${recentEvents.length} recent + ${historicalEvents.length} historical events`);

        // Throttle requests to be respectful to USGS
        await new Promise((r) => setTimeout(r, 300));
      }

      return {
        agentName: this.name,
        success: true,
        data: { catalogs },
        confidence: 1.0,
        durationMs: Date.now() - startTime,
        metadata: {
          totalRegions: catalogs.length,
          totalEvents: catalogs.reduce((sum, c) => sum + c.events.length, 0),
        },
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      return {
        agentName: this.name,
        success: false,
        data: null,
        durationMs: Date.now() - startTime,
        error: errMsg,
      };
    }
  }
}
