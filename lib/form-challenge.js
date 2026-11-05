'use strict';
/**
 * "How many arrows?" — LeadPages' own friendly spam check for website forms (Nov 2026).
 *
 * The server draws a small picture: a few pulsing LeadPages arrows mixed with pulses that have
 * no arrow. The visitor taps how many arrows they count (1–8). Other picture styles: leaves,
 * stars, hearts, houses, paws (owner picks one, or "mix" for a different one each time).
 *
 * Opt-in per site:  config.formChallenge = { on: true, style: 'arrows' }
 *
 * Token: stateless and signed (HMAC). It carries an HMAC of the answer, never the answer, and
 * expires after 20 minutes. Each token is accepted once (row in form_challenge_used; see
 * db/form_challenge.sql) so a bot can't try every number on one picture. If that table can't
 * be reached the check still works, just without the one-use guard.
 */
const crypto = require('crypto');

const TTL_MS = 20 * 60 * 1000;
const MIN_COUNT = 2;
const MAX_COUNT = 7;
const MAX_ANSWER = 8;

const STYLES = {
  arrows: { label: 'LeadPages arrows', question: 'How many arrows can you count?', noun: 'arrows' },
  leaves: { label: 'Leaves', question: 'How many leaves can you count?', noun: 'leaves' },
  stars: { label: 'Stars', question: 'How many stars can you count?', noun: 'stars' },
  hearts: { label: 'Hearts', question: 'How many hearts can you count?', noun: 'hearts' },
  houses: { label: 'Houses', question: 'How many houses can you count?', noun: 'houses' },
  paws: { label: 'Paw prints', question: 'How many paw prints can you count?', noun: 'paw prints' }
};
const STYLE_KEYS = Object.keys(STYLES);

function secret() {
  const s = process.env.FORM_CHALLENGE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
  // Derive so the service key itself is never used directly as a signing key.
  return crypto.createHash('sha256').update('lp-form-challenge:' + (s || 'dev-only-secret')).digest();
}
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const unb64u = (s) => Buffer.from(String(s || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const hmac = (data) => b64u(crypto.createHmac('sha256', secret()).update(String(data)).digest());

/** Site setting: { on, style }. Off unless config.formChallenge.on === true. */
function settings(cfg) {
  const fc = (cfg && cfg.formChallenge) || {};
  const style = (STYLES[fc.style] || fc.style === 'mix') ? fc.style : 'arrows';
  return { on: fc.on === true, style };
}

function pickStyle(style) {
  if (style === 'mix') return STYLE_KEYS[crypto.randomInt(STYLE_KEYS.length)];
  return STYLES[style] ? style : 'arrows';
}

function safeColour(c, fallback) {
  const v = String(c || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
}

/* ---------- drawing ---------- */

// The LeadPages arrow (from assets/leadpages-logo.svg, icon part), scaled to sit in a 0–100 box.
const ARROW_PATH = 'M331.86,266.49l-53.89-53.89,39.47-17.97c3.07-1.4,4.5-4.84,3.57-8.55-.49-1.94-1.57-3.74-3.02-5.19-1.33-1.33-2.97-2.36-4.75-2.89l-142.93-43.06c-2.95-.89-5.82-.31-7.68,1.55-1.86,1.86-2.44,4.73-1.55,7.68l43.06,142.93c1.12,3.7,4.36,6.82,8.08,7.76,3.72.94,7.16-.49,8.55-3.57l17.97-39.47,53.89,53.89c3.8,3.8,9.38,4.4,12.44,1.34l28.13-28.13c3.06-3.06,2.46-8.64-1.34-12.44Z';

function starPoints(cx, cy, r1, r2) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? r2 : r1;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
  }
  return pts.join(' ');
}

/** The shape for a target item, centred on (0,0), about 30px across. */
function shape(style, ink, accent, rot) {
  switch (style) {
    case 'arrows':
      // arrow tip sits at the pulse centre, like the logo
      return '<g transform="rotate(' + rot + ') translate(-2,-2) scale(0.17) translate(-140,-118)"><path d="' + ARROW_PATH + '" fill="' + ink + '"/></g>';
    case 'leaves':
      return '<g transform="rotate(' + rot + ')"><path d="M0,-16 C11,-10 12,6 0,16 C-12,6 -11,-10 0,-16Z" fill="' + accent + '"/><path d="M0,-12 L0,14" stroke="#fff" stroke-width="1.6" opacity=".75"/></g>';
    case 'stars':
      return '<polygon points="' + starPoints(0, 0, 15, 6.5) + '" fill="' + accent + '" transform="rotate(' + (rot % 72) + ')"/>';
    case 'hearts':
      return '<path d="M0,13 C-15,2 -14,-12 -6,-12 C-2,-12 0,-9 0,-6 C0,-9 2,-12 6,-12 C14,-12 15,2 0,13Z" fill="' + accent + '" transform="rotate(' + (rot % 30 - 15) + ')"/>';
    case 'houses':
      return '<path d="M-13,1 L0,-12 L13,1 L9,1 L9,13 L3,13 L3,5 L-3,5 L-3,13 L-9,13 L-9,1Z" fill="' + ink + '" transform="rotate(' + (rot % 24 - 12) + ')"/>';
    case 'paws':
      return '<g fill="' + ink + '" transform="rotate(' + (rot % 50 - 25) + ')"><ellipse cx="0" cy="6" rx="8" ry="6.5"/><circle cx="-9" cy="-4" r="3.4"/><circle cx="-3.2" cy="-10" r="3.4"/><circle cx="3.2" cy="-10" r="3.4"/><circle cx="9" cy="-4" r="3.4"/></g>';
    default:
      return '';
  }
}

/** Random non-overlapping spots in a w×h field. */
function spots(n, w, h, gap) {
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < 4000) {
    const x = 34 + crypto.randomInt(w - 68);   // keep room for an arrow's tail inside the picture
    const y = 32 + crypto.randomInt(h - 64);
    if (out.every((p) => (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) > gap * gap)) out.push({ x, y });
  }
  return out;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

/**
 * The picture: `count` targets (pulse + shape) and some pulse-only decoys, all pulsing at
 * different times. Returns an SVG string.
 */
function drawSvg(style, count, opts) {
  opts = opts || {};
  const accent = safeColour(opts.accent, '#1565D8');
  const ink = safeColour(opts.ink, '#0A2463');
  const bg = safeColour(opts.bg, '#F3F7FD');
  const W = 320, H = 150;
  const decoys = 3 + crypto.randomInt(3);
  // Every target must be drawn (the answer depends on it): shrink the spacing until all fit.
  let gap = 46, all = spots(count + decoys, W, H, gap);
  while (all.length < count + decoys && gap > 22) { gap -= 4; all = spots(count + decoys, W, H, gap); }
  if (all.length < count) throw new Error('form-challenge: could not place the picture');
  const items = shuffle(all.map((p, i) => ({ p, target: i < count })));
  let body = '';
  items.forEach((it) => {
    const d = (crypto.randomInt(1600) / 1000).toFixed(2);
    const rot = crypto.randomInt(360);
    const ring = '<circle class="r" r="9" fill="none" stroke="' + accent + '" stroke-width="2.2" style="animation-delay:' + d + 's"/>' +
      '<circle class="r" r="9" fill="none" stroke="' + accent + '" stroke-width="1.6" style="animation-delay:' + (+d + 0.8).toFixed(2) + 's"/>' +
      '<circle r="' + (it.target ? 4 : 5) + '" fill="' + accent + '" opacity=".9"/>';
    body += '<g transform="translate(' + it.p.x + ',' + it.p.y + ')">' + ring + (it.target ? shape(style, ink, accent, rot) : '') + '</g>';
  });
  // Soft background dots so the field isn't flat.
  let dots = '';
  for (let i = 0; i < 14; i++) dots += '<circle cx="' + crypto.randomInt(W) + '" cy="' + crypto.randomInt(H) + '" r="' + (1 + crypto.randomInt(3)) + '" fill="' + accent + '" opacity=".10"/>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' +
    '<style>.r{transform-box:fill-box;transform-origin:center;animation:p 1.6s ease-out infinite;opacity:0}' +
    '@keyframes p{0%{transform:scale(.6);opacity:.85}100%{transform:scale(2.6);opacity:0}}' +
    '@media (prefers-reduced-motion:reduce){.r{animation:none;opacity:.35;transform:scale(1.6)}}</style>' +
    '<rect width="' + W + '" height="' + H + '" rx="12" fill="' + bg + '"/>' + dots + body + '</svg>';
}

/* ---------- token ---------- */

function create(opts) {
  opts = opts || {};
  const style = pickStyle(opts.style);
  const count = MIN_COUNT + crypto.randomInt(MAX_COUNT - MIN_COUNT + 1);
  const jti = b64u(crypto.randomBytes(12));
  const exp = Date.now() + TTL_MS;
  const payload = { j: jti, e: exp, s: style, h: hmac(jti + ':' + count) };
  const body = b64u(JSON.stringify(payload));
  const token = body + '.' + hmac(body);
  const svg = drawSvg(style, count, opts);
  return {
    token,
    style,
    question: STYLES[style].question,
    noun: STYLES[style].noun,
    max: MAX_ANSWER,
    image: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'),
    expiresAt: exp
  };
}

function decode(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  const expect = hmac(parts[0]);
  const a = Buffer.from(parts[1]), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { return JSON.parse(unb64u(parts[0]).toString('utf8')); } catch (e) { return null; }
}

/**
 * Check an answer. admin = Supabase service client (for the one-use guard), optional.
 * Returns { ok: true } or { ok: false, reason: 'missing'|'bad_token'|'expired'|'wrong'|'used' }.
 */
async function verify(token, answer, admin) {
  if (!token || answer == null || answer === '') return { ok: false, reason: 'missing' };
  const p = decode(token);
  if (!p || !p.j || !p.h) return { ok: false, reason: 'bad_token' };
  if (!(p.e > Date.now())) return { ok: false, reason: 'expired' };
  const n = parseInt(answer, 10);
  if (!(n >= 1 && n <= MAX_ANSWER)) return { ok: false, reason: 'wrong' };
  // Use the token up first, right or wrong: one try per picture.
  if (admin && typeof admin.from === 'function') {
    try {
      const { error } = await admin.from('form_challenge_used').insert({ jti: p.j });
      if (error && (error.code === '23505' || /duplicate/i.test(error.message || ''))) return { ok: false, reason: 'used' };
    } catch (e) { /* table missing / network: carry on without the one-use guard */ }
  }
  const a = Buffer.from(hmac(p.j + ':' + n)), b = Buffer.from(String(p.h));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'wrong' };
  return { ok: true };
}

module.exports = { STYLES, STYLE_KEYS, MIN_COUNT, MAX_COUNT, MAX_ANSWER, settings, create, verify, decode, drawSvg };
