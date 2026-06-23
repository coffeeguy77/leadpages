// api/instagram/sync.mjs
// Manual / on-demand sync for a single site. Handy for testing and for a
// "Sync now" button in your admin.
//   GET /api/instagram/sync?slug=joes-plumbing&key=YOUR_CRON_SECRET
//   GET /api/instagram/sync?slug=joes-plumbing&force=1   (ignore source!=instagram)
// Auth: Bearer CRON_SECRET header, or ?key=CRON_SECRET query param.

import { syncSite } from '../../lib/ig/igSync.mjs';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const ok =
    !secret ||
    req.headers.authorization === 'Bearer ' + secret ||
    (req.query.key && req.query.key === secret);
  if (!ok) return res.status(401).json({ error: 'unauthorized' });

  const slug = req.query.slug;
  if (!slug) return res.status(400).json({ error: 'missing ?slug=' });

  try {
    const result = await syncSite(slug, { force: req.query.force === '1' });
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: String(e.message) });
  }
}
