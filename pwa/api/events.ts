import { neon } from "@neondatabase/serverless";

export default async function handler(_req: any, res: any) {
  if (_req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sql = neon(process.env.DATABASE_URL!);

  const events = await sql`
    SELECT 
      event_id, source, magnitude, lat, lon, depth, location, timestamp, processed_at
    FROM events
    ORDER BY timestamp DESC
    LIMIT 100
  `;

  // Set cache for 15 seconds at the edge
  res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
  return res.status(200).json({ events });
}
