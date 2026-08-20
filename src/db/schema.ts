import { Pool } from "pg";
import { logger } from "../utils/logger";

/**
 * Initialize database schema. Creates tables if they don't exist.
 */
export async function initializeSchema(pool: Pool): Promise<void> {
  logger.info("DB", "Initializing database schema...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id BIGINT PRIMARY KEY,
      username TEXT,
      min_magnitude REAL NOT NULL DEFAULT 4.0,
      regions JSONB NOT NULL DEFAULT '["venezuela"]'::jsonb,
      lat REAL,
      lon REAL,
      silent_start TEXT,
      silent_end TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      event_id TEXT NOT NULL,
      source TEXT NOT NULL,
      magnitude REAL NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      depth REAL NOT NULL,
      location TEXT NOT NULL,
      timestamp BIGINT NOT NULL,
      processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      PRIMARY KEY (event_id, source)
    )
  `);

  await pool.query("CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_events_processed ON events(processed_at)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      event_id TEXT NOT NULL,
      source TEXT NOT NULL,
      telegram_id BIGINT NOT NULL,
      sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
    )
  `);

  await pool.query("CREATE INDEX IF NOT EXISTS idx_notifications_event ON notifications(event_id, source)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_reports (
      event_id TEXT NOT NULL,
      telegram_id BIGINT NOT NULL,
      felt BOOLEAN NOT NULL,
      reported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      PRIMARY KEY (event_id, telegram_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      min_magnitude REAL NOT NULL DEFAULT 4.0,
      regions JSONB NOT NULL DEFAULT '["latam"]'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query("CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON push_subscriptions(endpoint)");

  logger.info("DB", "Schema initialized successfully");
}
