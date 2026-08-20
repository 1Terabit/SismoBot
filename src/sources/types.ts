/**
 * Normalized seismic event from any data source.
 */
export interface SeismicEvent {
  /** Unique event ID from the source (e.g., "us7000n1b2") */
  id: string;
  /** Magnitude (Richter/moment scale) */
  magnitude: number;
  /** Latitude of epicenter */
  lat: number;
  /** Longitude of epicenter */
  lon: number;
  /** Depth in kilometers */
  depth: number;
  /** Human-readable location description */
  location: string;
  /** Event timestamp (UTC milliseconds) */
  timestamp: number;
  /** Data source identifier */
  source: SeismicSource;
  /** Tsunami warning flag */
  tsunami?: boolean;
}

export type SeismicSource = "usgs" | "emsc";

export type SeismicEventHandler = (events: SeismicEvent[]) => void | Promise<void>;

/**
 * Interface for seismic data providers.
 */
export interface SeismicProvider {
  readonly name: SeismicSource;
  /** Fetch recent seismic events manually (for polling). */
  fetchEvents?(): Promise<SeismicEvent[]>;
  /** Start listening to events and push them via callback (for streaming). */
  start?(onNewEvent: SeismicEventHandler): void;
}

/**
 * User configuration stored in the database.
 */
export interface UserConfig {
  telegramId: number;
  username: string | null;
  minMagnitude: number;
  regions: string[];
  lat: number | null;
  lon: number | null;
  silentStart: string | null;
  silentEnd: string | null;
  createdAt: string;
}

/**
 * Region bounding box definition.
 */
export interface RegionBounds {
  name: string;
  label: string;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}
