import { SeismicEvent, UserConfig } from "../sources/types";
import { REGIONS } from "../config";
import { isInBoundingBox } from "../utils/geo";
import { logger } from "../utils/logger";

/**
 * Filter service — determines which users should receive alerts
 * for a given seismic event based on their configuration.
 */
export class FilterService {
  /**
   * Get users that should be notified about this event.
   */
  matchUsers(event: SeismicEvent, users: UserConfig[]): UserConfig[] {
    return users.filter((user) => this.shouldNotify(event, user));
  }

  /**
   * Check if a specific user should receive an alert for this event.
   */
  shouldNotify(event: SeismicEvent, user: UserConfig): boolean {
    // 1. Check magnitude threshold
    if (event.magnitude < user.minMagnitude) {
      return false;
    }

    // 2. Check silent hours
    if (this.isInSilentHours(user)) {
      // Still notify for magnitude >= 6.0 even during silent hours
      if (event.magnitude < 6.0) {
        return false;
      }
    }

    // 3. Check if event falls within any of the user's monitored regions
    const matchesRegion = user.regions.some((regionKey) => {
      if (regionKey === "all") return true;

      const region = REGIONS[regionKey];
      if (!region) {
        logger.warn("Filter", `Unknown region key: ${regionKey}`);
        return false;
      }

      return isInBoundingBox(
        event.lat,
        event.lon,
        region.minLat,
        region.maxLat,
        region.minLon,
        region.maxLon
      );
    });

    return matchesRegion;
  }

  /**
   * Check if the current time falls within the user's silent hours.
   */
  private isInSilentHours(user: UserConfig): boolean {
    if (!user.silentStart || !user.silentEnd) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = user.silentStart.split(":").map(Number);
    const [endH, endM] = user.silentEnd.split(":").map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      // Same day range (e.g., 22:00 - 23:00)
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Overnight range (e.g., 23:00 - 07:00)
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }
}
