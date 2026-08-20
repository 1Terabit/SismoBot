import { neon } from "@neondatabase/serverless";

export default async function handler(req: any, res: any) {
  const sql = neon(process.env.DATABASE_URL!);

  if (req.method === "POST") {
    const { endpoint, p256dh, auth, minMagnitude, regions } = req.body;

    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: "Missing subscription data" });
    }

    const minMag = typeof minMagnitude === 'number' ? minMagnitude : 4.0;
    const regs = Array.isArray(regions) ? regions : ["latam"];

    await sql`
      INSERT INTO push_subscriptions (endpoint, p256dh, auth, min_magnitude, regions)
      VALUES (${endpoint}, ${p256dh}, ${auth}, ${minMag}, ${JSON.stringify(regs)})
      ON CONFLICT (endpoint) DO UPDATE SET 
        p256dh = ${p256dh}, 
        auth = ${auth},
        min_magnitude = ${minMag},
        regions = ${JSON.stringify(regs)}
    `;

    return res.status(201).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: "Missing endpoint" });
    }

    await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
