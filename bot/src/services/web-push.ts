import webpush from "web-push";
import { SeismicEvent } from "../sources/types";
import { getPushSubscriptions, removePushSubscription } from "../db/database";
import { REGIONS, getSeverityLabel } from "../config";
import { isInBoundingBox } from "../utils/geo";
import { logger } from "../utils/logger";

let initialized = false;

/**
 * Initialize web-push with VAPID keys from environment.
 */
export function initWebPush(): void {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL ?? "mailto:sismobot@example.com";

  if (!publicKey || !privateKey) {
    logger.warn("WebPush", "VAPID keys not configured — Web Push disabled");
    return;
  }

  webpush.setVapidDetails(email, publicKey, privateKey);
  initialized = true;
  logger.info("WebPush", "Web Push initialized with VAPID keys");
}

/**
 * Send a Web Push notification to all subscribers for a seismic event.
 */
export async function sendWebPushNotifications(event: SeismicEvent): Promise<number> {
  if (!initialized) return 0;

  const subscriptions = await getPushSubscriptions();
  if (subscriptions.length === 0) return 0;

  const validSubscriptions = subscriptions.filter(sub => {
    if (event.magnitude < sub.min_magnitude) return false;
    if (sub.regions.includes("all")) return true;
    return sub.regions.some(r => {
      const region = REGIONS[r];
      if (!region) return false;
      return isInBoundingBox(event.lat, event.lon, region.minLat, region.maxLat, region.minLon, region.maxLon);
    });
  });

  if (validSubscriptions.length === 0) return 0;

  const label = getSeverityLabel(event.magnitude);

  const payload = JSON.stringify({
    title: `🌍 Sismo M${event.magnitude.toFixed(1)} — ${label}`,
    body: `📌 ${event.location}\n📏 Profundidad: ${event.depth.toFixed(1)} km`,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    data: {
      eventId: event.id,
      magnitude: event.magnitude,
      lat: event.lat,
      lon: event.lon,
      url: `/?event=${event.id}`,
    },
    tag: `sismo-${event.id}`,
    requireInteraction: event.magnitude >= 5.0,
  });

  let sent = 0;
  const failed: string[] = [];

  await Promise.allSettled(
    validSubscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        sent++;
      } catch (err: any) {
        // 410 Gone or 404 = subscription expired/invalid
        if (err.statusCode === 410 || err.statusCode === 404) {
          failed.push(sub.endpoint);
        } else {
          logger.error("WebPush", `Failed to send to ${sub.endpoint.slice(0, 50)}...`, err);
        }
      }
    })
  );

  // Clean up expired subscriptions
  for (const endpoint of failed) {
    await removePushSubscription(endpoint);
  }

  if (failed.length > 0) {
    logger.info("WebPush", `Removed ${failed.length} expired subscription(s)`);
  }

  logger.info("WebPush", `Push sent to ${sent}/${validSubscriptions.length} subscriber(s)`);
  return sent;
}
