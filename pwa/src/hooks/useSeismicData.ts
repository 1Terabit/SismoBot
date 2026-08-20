import { useState, useEffect, useCallback, useRef } from "react";
import type { SeismicEvent } from "../types";

const USGS_URL =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";

const POLL_INTERVAL = 30_000; // 30 seconds

/**
 * Hook that fetches real-time earthquake data from USGS GeoJSON API.
 * Polls every 30 seconds and deduplicates by event ID.
 */
export function useSeismicData() {
  const [events, setEvents] = useState<SeismicEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const seenIds = useRef(new Set<string>());
  const [newEventId, setNewEventId] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(USGS_URL);
      if (!res.ok) throw new Error(`USGS API error: ${res.status}`);

      const data = await res.json();
      const features = data.features as any[];

      const parsed: SeismicEvent[] = features.map((f: any) => ({
        id: f.id,
        magnitude: f.properties.mag,
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
        depth: f.geometry.coordinates[2],
        location: f.properties.place ?? "Unknown",
        timestamp: f.properties.time,
        source: "usgs",
        tsunami: f.properties.tsunami === 1,
      }));

      // Sort by time descending
      parsed.sort((a, b) => b.timestamp - a.timestamp);

      // Detect new events
      let latestNewId: string | null = null;
      for (const ev of parsed) {
        if (!seenIds.current.has(ev.id)) {
          seenIds.current.add(ev.id);
          if (events.length > 0) {
            latestNewId = ev.id;
          }
        }
      }

      if (latestNewId) {
        setNewEventId(latestNewId);
        setTimeout(() => setNewEventId(null), 5000);
      }

      setEvents(parsed);
      setLastUpdate(Date.now());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setIsLoading(false);
    }
  }, [events.length]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  const latestEvent = events[0] ?? null;

  return { events, isLoading, error, lastUpdate, latestEvent, newEventId };
}
