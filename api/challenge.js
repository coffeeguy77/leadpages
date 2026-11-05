'use strict';
/**
 * GET /api/challenge?style=arrows&accent=%231565D8&ink=%230A2463
 * A new "How many arrows?" picture + signed token for a website form (see lib/form-challenge.js).
 * Public, no site lookup; the site's own setting decides whether /api/leads asks for it.
 */
const { limited } = require('./_rate-limit');
const FC = require('../lib/form-challenge');

module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'GET') { res.statusCode = 405; return res.end('{"ok":false}'); }
  if (limited(req, { key: 'challenge', max: 40, windowMs: 60000 })) { res.statusCode = 429; return res.end('{"ok":false,"error":"slow_down"}'); }
  const q = req.query || {};
  const c = FC.create({ style: String(q.style || ''), accent: q.accent, ink: q.ink, bg: q.bg });
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, token: c.token, image: c.image, question: c.question, noun: c.noun, max: c.max, style: c.style }));
};
