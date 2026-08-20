import { Pool } from "pg";
import { initializeSchema } from "./schema";
import { UserConfig } from "../sources/types";
import { DEFAULT_MIN_MAGNITUDE } from "../config";
import { logger } from "../utils/logger";

let pool: Pool;

/**
 * Initialize and return the pg database connection pool.
 */
export async function initDatabase(): Promise<Pool> {
  if (pool) return pool;

  pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? "postgres://sismobot:sismobot@localhost:5432/sismobot",
    ssl: process.env.DATABASE_URL?.includes("neon.tech")
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    await pool.query("SELECT 1");
    logger.info("DB", "Connected to PostgreSQL database");
  } catch (err) {
    logger.error("DB", "Failed to connect to PostgreSQL", err);
    throw err;
  }

  await initializeSchema(pool);

  return pool;
}

export function getDb(): Pool {
  if (!pool) throw new Error("Database not initialized. Call initDatabase() first.");
  return pool;
}

// ─── User Operations ────────────────────────────────────────────

export async function upsertUser(
  telegramId: number,
  username: string | null
): Promise<boolean> {
  const d = getDb();
  
  const existing = await d.query("SELECT telegram_id FROM users WHERE telegram_id = $1", [telegramId]);

  if (existing.rowCount && existing.rowCount > 0) {
    await d.query(
      "UPDATE users SET username = $1, active = 1 WHERE telegram_id = $2",
      [username, telegramId]
    );
    return false;
  }

  await d.query(
    `INSERT INTO users (telegram_id, username, min_magnitude, regions)
     VALUES ($1, $2, $3, $4)`,
    [telegramId, username, DEFAULT_MIN_MAGNITUDE, JSON.stringify(["venezuela"])]
  );
  return true;
}

export async function getUser(telegramId: number): Promise<UserConfig | null> {
  const d = getDb();
  const result = await d.query(
    "SELECT * FROM users WHERE telegram_id = $1 AND active = 1",
    [telegramId]
  );

  if (result.rowCount === 0) return null;
  return rowToUserConfig(result.rows[0]);
}

export async function getAllActiveUsers(): Promise<UserConfig[]> {
  const d = getDb();
  const result = await d.query("SELECT * FROM users WHERE active = 1");
  return result.rows.map(rowToUserConfig);
}

export async function setUserMagnitude(telegramId: number, magnitude: number): Promise<void> {
  const d = getDb();
  await d.query("UPDATE users SET min_magnitude = $1 WHERE telegram_id = $2", [magnitude, telegramId]);
}

export async function setUserRegions(telegramId: number, regions: string[]): Promise<void> {
  const d = getDb();
  await d.query("UPDATE users SET regions = $1 WHERE telegram_id = $2", [JSON.stringify(regions), telegramId]);
}

export async function setUserLocation(telegramId: number, lat: number, lon: number): Promise<void> {
  const d = getDb();
  await d.query("UPDATE users SET lat = $1, lon = $2 WHERE telegram_id = $3", [lat, lon, telegramId]);
}

export async function setUserSilentHours(telegramId: number, start: string | null, end: string | null): Promise<void> {
  const d = getDb();
  await d.query(
    "UPDATE users SET silent_start = $1, silent_end = $2 WHERE telegram_id = $3",
    [start, end, telegramId]
  );
}

export async function deactivateUser(telegramId: number): Promise<void> {
  const d = getDb();
  await d.query("UPDATE users SET active = 0 WHERE telegram_id = $1", [telegramId]);
}

export async function getUserCount(): Promise<number> {
  const d = getDb();
  const result = await d.query("SELECT COUNT(*) as count FROM users WHERE active = 1");
  return parseInt(result.rows[0].count, 10);
}

// ─── Event Operations ───────────────────────────────────────────

export async function isEventProcessed(eventId: string, source: string): Promise<boolean> {
  const d = getDb();
  const result = await d.query(
    "SELECT 1 FROM events WHERE event_id = $1 AND source = $2",
    [eventId, source]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function markEventProcessed(
  eventId: string,
  source: string,
  magnitude: number,
  lat: number,
  lon: number,
  depth: number,
  location: string,
  timestamp: number
): Promise<void> {
  const d = getDb();
  await d.query(
    `INSERT INTO events (event_id, source, magnitude, lat, lon, depth, location, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (event_id, source) DO NOTHING`,
    [eventId, source, magnitude, lat, lon, depth, location, timestamp]
  );
}

export async function recordNotification(
  eventId: string,
  source: string,
  telegramId: number
): Promise<void> {
  const d = getDb();
  await d.query(
    "INSERT INTO notifications (event_id, source, telegram_id) VALUES ($1, $2, $3)",
    [eventId, source, telegramId]
  );
}

export async function getLatestEvent(): Promise<Record<string, unknown> | null> {
  const d = getDb();
  const result = await d.query("SELECT * FROM events ORDER BY timestamp DESC LIMIT 1");
  if (result.rowCount === 0) return null;
  return result.rows[0];
}

export async function cleanOldEvents(): Promise<number> {
  const d = getDb();
  const result = await d.query("DELETE FROM events WHERE processed_at < NOW() - INTERVAL '7 days'");
  return result.rowCount ?? 0;
}

export async function getEventCount(): Promise<number> {
  const d = getDb();
  const result = await d.query("SELECT COUNT(*) as count FROM events");
  return parseInt(result.rows[0].count, 10);
}

// ─── Reports Operations ─────────────────────────────────────────

export async function addEventReport(eventId: string, telegramId: number, felt: boolean): Promise<boolean> {
  const d = getDb();
  const result = await d.query(
    `INSERT INTO event_reports (event_id, telegram_id, felt) 
     VALUES ($1, $2, $3) 
     ON CONFLICT (event_id, telegram_id) DO NOTHING`,
    [eventId, telegramId, felt]
  );
  return result.rowCount === 1; // True if it was a new vote
}

export async function getEventReportsCount(eventId: string): Promise<{ felt: number, notFelt: number }> {
  const d = getDb();
  const result = await d.query(
    "SELECT felt, COUNT(*) as count FROM event_reports WHERE event_id = $1 GROUP BY felt",
    [eventId]
  );
  
  let felt = 0;
  let notFelt = 0;
  
  for (const row of result.rows) {
    if (row.felt) felt = parseInt(row.count, 10);
    else notFelt = parseInt(row.count, 10);
  }
  
  return { felt, notFelt };
}

// ─── Push Subscription Operations ───────────────────────────────

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
  min_magnitude: number;
  regions: string[];
}

export async function getPushSubscriptions(): Promise<PushSubscriptionRecord[]> {
  const d = getDb();
  const result = await d.query("SELECT endpoint, p256dh, auth, min_magnitude, regions FROM push_subscriptions");
  return result.rows;
}

export async function addPushSubscription(
  endpoint: string,
  p256dh: string,
  auth: string,
  minMagnitude: number = 4.0,
  regions: string[] = ["latam"]
): Promise<boolean> {
  const d = getDb();
  const result = await d.query(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, min_magnitude, regions)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE SET p256dh = $2, auth = $3, min_magnitude = $4, regions = $5`,
    [endpoint, p256dh, auth, minMagnitude, JSON.stringify(regions)]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const d = getDb();
  await d.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [endpoint]);
}

export async function getRecentEvents(limit: number = 50): Promise<Record<string, unknown>[]> {
  const d = getDb();
  const result = await d.query(
    "SELECT * FROM events ORDER BY timestamp DESC LIMIT $1",
    [limit]
  );
  return result.rows;
}

// ─── Helpers ────────────────────────────────────────────────────

function rowToUserConfig(row: any): UserConfig {
  return {
    telegramId: parseInt(row.telegram_id, 10),
    username: row.username,
    minMagnitude: row.min_magnitude,
    regions: typeof row.regions === 'string' ? JSON.parse(row.regions) : row.regions,
    lat: row.lat,
    lon: row.lon,
    silentStart: row.silent_start,
    silentEnd: row.silent_end,
    createdAt: row.created_at,
  };
}
