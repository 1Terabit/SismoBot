/**
 * DataCollectorAgent
 * Fetches seismic catalog data from USGS for configured regions.
 * Provides both real-time (30d) and historical baseline data.
 */

import type { IAgent, AgentContext, AgentResult } from "../engine";
import { logger } from "../../utils/logger";

// Global tectonic zones with bounding boxes
export interface SeismicRegion {
  id: string;
  name: string;
  minlat: number;
  maxlat: number;
  minlon: number;
  maxlon: number;
}

export const GLOBAL_TECTONIC_ZONES: SeismicRegion[] = [
  { id: "ring-of-fire-japan", name: "Anillo de Fuego (Japón)", minlat: 30, maxlat: 46, minlon: 128, maxlon: 155 },
  { id: "ring-of-fire-kamchatka", name: "Anillo de Fuego (Kamchatka)", minlat: 46, maxlat: 60, minlon: 155, maxlon: 170 },
  { id: "ring-of-fire-alaska", name: "Anillo de Fuego (Alaska)", minlat: 50, maxlat: 65, minlon: -180, maxlon: -130 },
  { id: "cascadia", name: "Subducción de Cascadia (N.América)", minlat: 40, maxlat: 51, minlon: -130, maxlon: -120 },
  { id: "san-andreas", name: "Falla de San Andrés (N.América)", minlat: 30, maxlat: 40, minlon: -125, maxlon: -114 },
  { id: "mexico-subduction", name: "Subducción Mexicana", minlat: 14, maxlat: 33, minlon: -118, maxlon: -86 },
  { id: "central-america", name: "Arco Centroamericano", minlat: 7, maxlat: 18.5, minlon: -92, maxlon: -77 },
  { id: "caribbean", name: "Placa del Caribe", minlat: 10, maxlat: 25, minlon: -85, maxlon: -58 },
  { id: "andean-subduction-north", name: "Subducción Andina N. (Ven-Col-Ecu)", minlat: -5, maxlat: 13.5, minlon: -82, maxlon: -59.5 },
  { id: "andean-subduction-central", name: "Subducción Andina C. (Perú-Bol)", minlat: -25, maxlat: -5, minlon: -85, maxlon: -65 },
  { id: "andean-subduction-south", name: "Subducción Andina S. (Chile-Arg)", minlat: -56, maxlat: -25, minlon: -80, maxlon: -65 },
  { id: "alpine-himalayan", name: "Cinturón Alpino-Himalayo", minlat: 25, maxlat: 45, minlon: 45, maxlon: 100 },
  { id: "anatolia", name: "Falla de Anatolia (Turquía)", minlat: 35, maxlat: 42, minlon: 25, maxlon: 45 },
  { id: "philippines", name: "Placa Filipina", minlat: 5, maxlat: 20, minlon: 115, maxlon: 130 },
  { id: "indonesia", name: "Fosa de Sunda (Indonesia)", minlat: -12, maxlat: 6, minlon: 90, maxlon: 120 },
  { id: "tonga-kermadec", name: "Fosa de Tonga-Kermadec", minlat: -40, maxlat: -10, minlon: -180, maxlon: -170 },
  { id: "mediterranean", name: "Zona Mediterránea", minlat: 30, maxlat: 47, minlon: -10, maxlon: 25 }
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

async function fetchUSGSCatalogGlobal(
  startTime: Date,
  endTime: Date,
  minMagnitude = 1.0,
): Promise<CatalogEvent[]> {
  const params = new URLSearchParams({
    format: "geojson",
    starttime: startTime.toISOString(),
    endtime: endTime.toISOString(),
    minmagnitude: minMagnitude.toString(),
    orderby: "time",
    limit: "20000",
  });

  const url = `${USGS_API}?${params}`;
  logger.debug("DATA", `Fetching GLOBAL USGS (${startTime.toISOString().slice(0, 10)} → ${endTime.toISOString().slice(0, 10)}) M>=${minMagnitude}`);

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
    regionId: "global",
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
      const regions = (context.metadata.regions as SeismicRegion[] | undefined) ?? GLOBAL_TECTONIC_ZONES;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      // Fetch global data ONCE
      const recentGlobalEvents = await fetchUSGSCatalogGlobal(thirtyDaysAgo, now, 2.5); // increased min to 2.5 globally
      logger.info("DATA", `Fetched ${recentGlobalEvents.length} recent global events (30d, M2.5+)`);
      
      const historicalGlobalEvents = await fetchUSGSCatalogGlobal(oneYearAgo, thirtyDaysAgo, 4.0); // M4.0+ for historical to fit limits
      logger.info("DATA", `Fetched ${historicalGlobalEvents.length} historical global events (1y, M4.0+)`);

      const catalogs: RegionCatalog[] = [];

      // Filter in-memory for each region
      for (const region of regions) {
        const isInside = (e: CatalogEvent) => 
          e.latitude >= region.minlat && e.latitude <= region.maxlat &&
          e.longitude >= region.minlon && e.longitude <= region.maxlon;

        const recentEvents = recentGlobalEvents.filter(isInside).map(e => ({ ...e, regionId: region.id }));
        const historicalEvents = historicalGlobalEvents.filter(isInside).map(e => ({ ...e, regionId: region.id }));

        catalogs.push({
          region,
          events: [...recentEvents, ...historicalEvents],
          fetchedAt: Date.now(),
        });

        logger.info("DATA", `${region.name}: ${recentEvents.length} recent + ${historicalEvents.length} historical`);
      }

      return {
        agentName: this.name,
        success: true,
        data: { catalogs },
        confidence: 1.0,
        durationMs: Date.now() - startTime,
        metadata: {
          totalRegions: catalogs.length,
          totalEventsMatched: catalogs.reduce((sum, c) => sum + c.events.length, 0),
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
