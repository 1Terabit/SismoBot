import "dotenv/config";
import http from "http";
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
import { startAnalysisScheduler, getLastReport } from "./analysis/workflow";

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

  // 6.1 Weekly Notification (Every Monday at 9:00 AM America/Caracas timezone)
  // Since server is UTC, we use timezone setting or just use UTC equivalent.
  // 9 AM VET = 13:00 UTC
  cron.schedule("0 13 * * 1", async () => {
    try {
      const users = await getAllActiveUsers();
      let sent = 0;
      for (const user of users) {
        try {
          await bot.api.sendMessage(
            user.telegramId, 
            "📊 *¡Nuevo Boletín de Inteligencia Sísmica disponible!*\n\n" +
            "Se ha generado un nuevo reporte semanal de riesgos tectónicos.\n" +
            "Envía /reporte para descargarlo en formato PDF.",
            { parse_mode: "Markdown" }
          );
          sent++;
          await new Promise(resolve => setTimeout(resolve, 50)); // rate limiting
        } catch(e) {
          logger.error("WeeklyCron", `Failed to send to ${user.telegramId}`);
        }
      }
      logger.info("WeeklyCron", `Sent weekly digest notification to ${sent} users.`);
    } catch (err) {
      logger.error("WeeklyCron", "Failed to broadcast weekly digest", err);
    }
  });

  // 7. Start Seismic Risk Analysis Scheduler (runs every 6 hours)
  startAnalysisScheduler();

  // 8. Graceful shutdown
  const shutdown = async (): Promise<void> => {
    logger.info("Main", "Shutting down...");
    bot.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  logger.info("Main", "✅ SismoBot is running. Press Ctrl+C to stop.");

  // 8. Start a dummy HTTP server for Render free tier keep-alive
  const server = http.createServer((req, res) => {
    if (req.url && req.url.startsWith("/api/report")) {
      const fs = require("fs");
      const path = require("path");
      const os = require("os");
      
      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const lang = parsedUrl.searchParams.get("lang") === "en" ? "en" : "es";
      
      const reportPath = path.join(os.tmpdir(), `sismobot_boletin_latest_${lang}.pdf`);
      
      if (fs.existsSync(reportPath)) {
        res.writeHead(200, {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename=boletin_sismico_latest_${lang}.pdf`,
          "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "https://sismobot.vercel.app" // Restrict to PWA domain
        });
        const stream = fs.createReadStream(reportPath);
        stream.pipe(res);
      } else {
        res.writeHead(404);
        res.end("Report not generated yet. Please try again later.");
      }
    } else if (req.url && req.url.startsWith("/api/analysis")) {
      const report = getLastReport();
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "https://sismobot.vercel.app"
      });
      res.end(JSON.stringify(report || { status: "pending" }));
    } else if (req.url === "/ping" || req.url === "/") {
      res.writeHead(200);
      res.end("pong");
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    logger.info("Main", `Keep-alive HTTP server listening on port ${port}`);
  });
}

main().catch((err) => {
  logger.error("Main", "Fatal error", err);
  process.exit(1);
});
