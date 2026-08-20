import { Bot, InlineKeyboard } from "grammy";
import { SeismicEvent, UserConfig } from "../sources/types";
import { getSeverityEmoji, getSeverityLabel, TELEGRAM_RATE_LIMIT } from "../config";
import { haversineDistance, formatDistance, getCardinalDirection } from "../utils/geo";
import { estimateMercalli } from "../utils/mercalli";
import { recordNotification } from "../db/database";
import { sendWebPushNotifications } from "../services/web-push";
import { logger } from "../utils/logger";

/**
 * Alert service — formats and sends seismic alerts to matched users.
 */
export class AlertService {
  private bot: Bot;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  /**
   * Send an alert to all matched users for a given seismic event.
   * Rate-limited to respect Telegram API limits.
   */
  async sendAlerts(event: SeismicEvent, users: UserConfig[]): Promise<number> {
    if (users.length === 0) return 0;

    logger.info(
      "Alert",
      `Sending alert for M${event.magnitude} ${event.location} to ${users.length} user(s)`
    );

    let sent = 0;
    const batchSize = TELEGRAM_RATE_LIMIT;

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map((user) => this.sendAlertToUser(event, user))
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          sent++;
        }
      }

      // Rate limit: wait 1 second between batches
      if (i + batchSize < users.length) {
        await sleep(1000);
      }
    }

    logger.info("Alert", `Alert sent to ${sent}/${users.length} users`);

    // Send Web Push notifications in parallel (fire-and-forget)
    sendWebPushNotifications(event).catch((err) => {
      logger.error("Alert", "Web Push failed", err);
    });

    return sent;
  }

  /**
   * Send a formatted alert to a single user.
   */
  private async sendAlertToUser(
    event: SeismicEvent,
    user: UserConfig
  ): Promise<boolean> {
    try {
      const message = this.formatAlert(event, user);
      
      const keyboard = new InlineKeyboard()
        .text("✅ Sí lo sentí", `report:yes:${event.id}`)
        .text("❌ No", `report:no:${event.id}`);

      await this.bot.api.sendMessage(user.telegramId, message, {
        parse_mode: "Markdown",
        // Disable link preview for cleaner messages
        link_preview_options: { is_disabled: true },
        reply_markup: keyboard,
      });

      await recordNotification(event.id, event.source, user.telegramId);
      return true;
    } catch (err) {
      logger.error(
        "Alert",
        `Failed to send to ${user.telegramId}`,
        err
      );
      return false;
    }
  }

  /**
   * Format a seismic event into a user-friendly alert message.
   */
  private formatAlert(event: SeismicEvent, user: UserConfig): string {
    const severity = getSeverityEmoji(event.magnitude);
    const label = getSeverityLabel(event.magnitude);
    const eventDate = new Date(event.timestamp);

    // Format time in Venezuela timezone
    const timeStr = eventDate.toLocaleString("es-VE", {
      timeZone: "America/Caracas",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const dateStr = eventDate.toLocaleDateString("es-VE", {
      timeZone: "America/Caracas",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    // Distance calculation and Mercalli intensity
    let distanceLine = "";
    if (user.lat !== null && user.lon !== null) {
      const dist = haversineDistance(user.lat, user.lon, event.lat, event.lon);
      const direction = getCardinalDirection(user.lat, user.lon, event.lat, event.lon);
      distanceLine = `\n📏 Distancia a ti: *${formatDistance(dist)}* al ${direction}`;
      
      const mercalli = estimateMercalli(event.magnitude, dist);
      distanceLine += `\n💥 Intensidad esperada: *${mercalli.romanNumeral} (${mercalli.description})*`;
    }

    // Urgency header based on magnitude
    let header: string;
    if (event.magnitude >= 7.0) {
      header = "🚨🚨🚨 *ALERTA SÍSMICA MAYOR* 🚨🚨🚨";
    } else if (event.magnitude >= 6.0) {
      header = "🚨🚨 *ALERTA SÍSMICA FUERTE* 🚨🚨";
    } else if (event.magnitude >= 5.0) {
      header = "🚨 *ALERTA SÍSMICA* 🚨";
    } else {
      header = "⚠️ *Sismo detectado* ⚠️";
    }

    // Tsunami warning banner
    let tsunamiBanner = "";
    if (event.tsunami && event.magnitude >= 6.0) {
      tsunamiBanner = "\n\n🌊 *POSIBLE ALERTA DE TSUNAMI* 🌊";
    }

    // Safety message for significant quakes
    let safetyMsg = "";
    if (event.magnitude >= 5.0) {
      safetyMsg =
        "\n\n🛡 *Mantén la calma.* Aléjate de ventanas y objetos pesados. " +
        "Si estás en un edificio, ubícate en zona segura. NO uses ascensores.";
    }

    return (
      `${header}\n\n` +
      `${severity} Magnitud: *${event.magnitude.toFixed(1)}* (${label})\n` +
      `📌 ${event.location}\n` +
      `📏 Profundidad: ${event.depth.toFixed(1)} km\n` +
      `🕐 ${timeStr} — ${dateStr} (VET)` +
      `${distanceLine}\n` +
      `📡 Fuente: ${event.source.toUpperCase()}` +
      `${tsunamiBanner}` +
      `${safetyMsg}`
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
