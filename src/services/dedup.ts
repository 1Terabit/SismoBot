import { SeismicEvent } from "../sources/types";
import { isEventProcessed, markEventProcessed } from "../db/database";
import { logger } from "../utils/logger";

/**
 * Deduplication service — prevents sending multiple alerts
 * for the same seismic event.
 *
 * Uses the database to track processed events by (event_id, source).
 * USGS and EMSC may report the same physical event with different IDs,
 * but we treat them as separate detections for redundancy.
 */
export class DedupService {
  /**
   * Filter events to only those not yet processed.
   * Marks accepted events as processed atomically.
   */
  async filterNew(events: SeismicEvent[]): Promise<SeismicEvent[]> {
    const newEvents: SeismicEvent[] = [];

    for (const event of events) {
      if (await isEventProcessed(event.id, event.source)) {
        continue;
      }

      await markEventProcessed(
        event.id,
        event.source,
        event.magnitude,
        event.lat,
        event.lon,
        event.depth,
        event.location,
        event.timestamp
      );

      newEvents.push(event);
    }

    if (newEvents.length > 0) {
      logger.info(
        "Dedup",
        `${newEvents.length} new event(s) out of ${events.length} total`
      );
    }

    return newEvents;
  }
}
