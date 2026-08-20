import "dotenv/config";
import cron from "node-cron";
import { createBot } from "./bot/bot";
import { registerCommands } from "./bot/commands";
import { AlertService } from "./bot/alerts";
import { USGSProvider } from "./sources/usgs";
import { EMSCProvider } from "./sources/emsc";
import { DedupService } from "./services/dedup";
import { FilterService } from "./services/filter";
import { SeismicEvent, SeismicProvider } from "./sources/types";
import { getAllActiveUsers, cleanOldEvents, initDatabase } from "./db/database";
import { POLL_INTERVAL_MS } from "./config";
import { initWebPush } from "./services/web-push";
import { logger } from "./utils/logger";

async function main(): Promise<void> {
  logger.info("Main", "═══════════════════════════════════════════════");
  logger.info("Main", "  🌍 SismoBot — Seismic Alert System");
  logger.info("Main", "═══════════════════════════════════════════════");

  // 1. Initialize database
  await initDatabase();

  // 2. Initialize Web Push
  initWebPush();

  // 3. Create and configure bot
  const bot = createBot();
  registerCommands(bot);

  // 3. Initialize services
  const providers: SeismicProvider[] = [new USGSProvider(), new EMSCProvider()];
  const dedup = new DedupService();
  const filter = new FilterService();
  const alertService = new AlertService(bot);

  // 4. Start the bot (long polling for Telegram updates)
  bot.start({
    onStart: (botInfo) => {
      logger.info("Main", `Bot started as @${botInfo.username}`);
      logger.info("Main", `Polling interval: ${POLL_INTERVAL_MS / 1000}s`);
      logger.info("Main", `Sources: ${providers.map((p) => p.name).join(", ")}`);
    },
  });

  // 5. Start seismic data polling & streams
  let isPolling = false;

  async function handleNewEvents(allEvents: SeismicEvent[]): Promise<void> {
    if (allEvents.length === 0) return;

    // Deduplicate
    const newEvents = await dedup.filterNew(allEvents);

    if (newEvents.length === 0) return;

    // Get active users
    const users = await getAllActiveUsers();

    if (users.length === 0) {
      logger.debug("Poller/Stream", "No active users to notify");
      return;
    }

    // For each new event, find matching users and send alerts
    for (const event of newEvents) {
      const matchedUsers = filter.matchUsers(event, users);

      if (matchedUsers.length > 0) {
        logger.info(
          "Poller/Stream",
          `🔔 M${event.magnitude} ${event.location} — ${matchedUsers.length} user(s) to notify`
        );
        await alertService.sendAlerts(event, matchedUsers);
      } else {
        logger.debug(
          "Poller/Stream",
          `M${event.magnitude} ${event.location} — no matching users`
        );
      }
    }
  }

  // Handle push providers (WebSockets)
  for (const provider of providers) {
    if (provider.start) {
      provider.start((events) => {
        handleNewEvents(events).catch((err) => {
          logger.error("Stream", `Error handling push events from ${provider.name}`, err);
        });
      });
    }
  }

  async function pollSeismicData(): Promise<void> {
    if (isPolling) {
      logger.debug("Poller", "Skipping — previous poll still running");
      return;
    }

    isPolling = true;

    try {
      // Fetch events from polling sources in parallel
      const pollingProviders = providers.filter((p) => p.fetchEvents);
      const results = await Promise.allSettled(
        pollingProviders.map((p) => p.fetchEvents!())
      );

      const allEvents: SeismicEvent[] = [];
      for (const result of results) {
        if (result.status === "fulfilled") {
          allEvents.push(...result.value);
        }
      }

      await handleNewEvents(allEvents);
    } catch (err) {
      logger.error("Poller", "Polling cycle failed", err);
    } finally {
      isPolling = false;
    }
  }

  // Poll using setInterval for precise timing
  const pollIntervalSeconds = Math.max(5, POLL_INTERVAL_MS / 1000);
  setInterval(pollSeismicData, POLL_INTERVAL_MS);

  // Run first poll immediately
  await pollSeismicData();

  logger.info("Main", `Seismic polling started (every ${pollIntervalSeconds}s)`);

  // 6. Schedule daily cleanup (at 03:00 AM)
  cron.schedule("0 3 * * *", async () => {
    try {
      const deleted = await cleanOldEvents();
      logger.info("Cleanup", `Cleaned ${deleted} old events`);
    } catch (err) {
      logger.error("Cleanup", "Failed to clean old events", err);
    }
  });

  // 7. Graceful shutdown
  const shutdown = async (): Promise<void> => {
    logger.info("Main", "Shutting down...");
    bot.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  logger.info("Main", "✅ SismoBot is running. Press Ctrl+C to stop.");
}

main().catch((err) => {
  logger.error("Main", "Fatal error", err);
  process.exit(1);
});
