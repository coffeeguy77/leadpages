// api/cron/sync-instagram.mjs
// Vercel Cron entry point. Runs on the schedule in vercel.json and syncs every
// enabled Instagram connection. Vercel automatically sends the CRON_SECRET as a
// Bearer token on scheduled invocations, which we verify here.

import { listEnabledConnections } from '../../lib/ig/store.mjs';
import { syncSite } from '../../lib/ig/igSync.mjs';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== 'Bearer ' + secret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const conns = await listEnabledConnections();
    const results = [];
    for (const c of conns) {
      try {
        results.push(await syncSite(c.slug));
      } catch (e) {
        results.push({ slug: c.slug, error: String(e.message) });
      }
    }
    return res.status(200).json({ ok: true, count: results.length, results });
  } catch (e) {
    return res.status(500).json({ error: String(e.message) });
  }
}
