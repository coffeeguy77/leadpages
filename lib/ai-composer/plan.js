'use strict';

/**
 * Turn the raw design-plan JSON from the model into a safe, consistent plan:
 * known apps only, one hero first, one of each app, footer last, photo boxes
 * converted to Cloudinary crops of the original upload.
 */

const { getApp, HERO_APPS } = require('./catalogue');
const tiles = require('./tiles');

const MAX_SECTIONS = 20;
const MAX_PHOTOS = 40;
/** Fraction trimmed from each side of a model photo box before cropping. */
const PHOTO_INSET = 0.03;

function str(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max || 300);
}

/** '#abc' / '#aabbcc' / 'aabbcc' → '#aabbcc', anything else → '' */
function normHex(v) {
  let s = String(v == null ? '' : v).trim();
  if (!s) return '';
  if (s[0] !== '#') s = '#' + s;
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  }
  return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : '';
}

/** Model tile numbers are 1-based as labelled; clamp into range, 0-based. */
function tileIndex(n, count) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(count - 1, v - 1));
}

/**
 * @param {object} raw model output (already schema-checked)
 * @param {{ url: string, width: number, height: number }} design
 * @returns {object} plan
 */
function normalizePlan(raw, design) {
  const parsed = tiles.parseUploadUrl(design.url);
  const W = Math.round(Number(design.width));
  const H = Math.round(Number(design.height));
  const tileList = tiles.planTiles(W, H);
  const gaps = [];

  (Array.isArray(raw.gaps) ? raw.gaps : []).forEach(function (g) {
    if (!g || !str(g.what)) return;
    gaps.push({ what: str(g.what, 200), suggestion: str(g.suggestion, 200) });
  });

  // ---- sections ----
  const used = {};
  let heroTaken = false;
  const idMap = {};
  let sections = [];
  (Array.isArray(raw.sections) ? raw.sections : []).forEach(function (s) {
    if (!s) return;
    const key = str(s.appKey, 40);
    const label = str(s.label, 120) || key;
    const app = getApp(key);
    if (!app) {
      gaps.push({ what: label, suggestion: 'No matching LeadPages app (AI suggested "' + key + '").' });
      return;
    }
    if (app.hero && heroTaken) {
      gaps.push({ what: label, suggestion: 'A second hero area — LeadPages pages have one hero. Add this content to another app manually.' });
      return;
    }
    if (used[key]) {
      gaps.push({ what: label, suggestion: 'Uses the ' + app.label + ' app again — each app can appear once per page.' });
      return;
    }
    used[key] = true;
    if (app.hero) heroTaken = true;
    const mark = {
      startTile: tileIndex(s.startTile, tileList.length),
      startPct: s.startPct,
      endTile: tileIndex(s.endTile != null ? s.endTile : s.startTile, tileList.length),
      endPct: s.endPct
    };
    const rows = tiles.sectionRows(tileList, mark, H);
    const id = 's' + (sections.length + 1);
    if (s.id) idMap[str(s.id, 20)] = id;
    sections.push({
      id: id,
      appKey: key,
      label: label,
      reason: str(s.reason, 200),
      rows: rows,
      background: normHex(s.background),
      hero: app.hero
    });
  });

  // Hero first (an emergency strip may sit above it).
  const heroIdx = sections.findIndex(function (s) { return s.hero; });
  if (heroIdx > 0) {
    const hero = sections.splice(heroIdx, 1)[0];
    const at = sections[0] && sections[0].appKey === 'emerg' ? 1 : 0;
    sections.splice(at, 0, hero);
  }
  // Footer last; add one if the design had none detected (sites need a footer).
  const footIdx = sections.findIndex(function (s) { return s.appKey === 'footer'; });
  if (footIdx >= 0 && footIdx !== sections.length - 1) {
    sections.push(sections.splice(footIdx, 1)[0]);
  }
  if (sections.length > MAX_SECTIONS) {
    sections.slice(MAX_SECTIONS - 1, sections.length - 1).forEach(function (s) {
      gaps.push({ what: s.label, suggestion: 'Left out — more than ' + MAX_SECTIONS + ' sections.' });
    });
    const foot = sections[sections.length - 1];
    sections = sections.slice(0, MAX_SECTIONS - 1).concat(foot.appKey === 'footer' ? [foot] : []);
  }
  if (footIdx < 0) {
    sections.push({
      id: 's' + (sections.length + 1),
      appKey: 'footer',
      label: 'Footer',
      reason: 'Added so the site has a footer.',
      rows: { y0: Math.max(0, Math.round(H * 0.92)), y1: H },
      background: '',
      hero: false,
      synthetic: true
    });
  }

  // ---- photos ----
  const photos = [];
  let logo = null;
  (Array.isArray(raw.photos) ? raw.photos : []).forEach(function (p) {
    if (!p || photos.length >= MAX_PHOTOS) return;
    const t = tileList[tileIndex(p.tile, tileList.length)];
    const px = tiles.boxToPixels(t, p, W, H);
    const role = str(p.role, 20).toLowerCase();
    if (role === 'logo') {
      // Logos are often small; accept anything at least 16px each way.
      if (!logo && px.w >= 16 && px.h >= 16) {
        logo = { photoId: 'logo', px: px, url: tiles.cropUrl(parsed, px) };
      }
      return; // a logo is not a content photo
    }
    if (!tiles.isUsableCrop(px)) return;
    // Pull every edge in a little: model boxes tend to run past the photo into
    // surrounding text, card borders and padding.
    const inset = tiles.scalePx(px, -PHOTO_INSET, W, H);
    const id = 'p' + (photos.length + 1);
    let sectionId = idMap[str(p.sectionId, 20)] || '';
    if (!sectionId || !sections.some(function (s) { return s.id === sectionId; })) {
      // Fall back to the section whose rows contain the photo's centre.
      const cy = px.y + px.h / 2;
      const hit = sections.find(function (s) { return cy >= s.rows.y0 && cy <= s.rows.y1; });
      sectionId = hit ? hit.id : '';
    }
    const photo = {
      id: id,
      sectionId: sectionId,
      description: str(p.description, 140),
      role: role,
      px: inset,
      url: tiles.cropUrl(parsed, inset)
    };
    photos.push(photo);
  });

  const theme = {};
  ['pipe', 'hivis', 'steel', 'safety', 'lightBg'].forEach(function (k) {
    const v = normHex(raw.theme && raw.theme[k]);
    if (v) theme[k] = v;
  });

  return {
    version: 1,
    design: { url: design.url, width: W, height: H, tiles: tileList.length },
    businessName: str(raw.businessName, 120),
    tagline: str(raw.tagline, 200),
    phone: str(raw.phone, 40),
    email: str(raw.email, 120),
    seoTitle: str(raw.seoTitle, 70),
    seoDescription: str(raw.seoDescription, 170),
    theme: theme,
    logo: logo,
    sections: sections.map(function (s) {
      const o = Object.assign({}, s);
      delete o.hero;
      return o;
    }),
    photos: photos,
    gaps: gaps
  };
}

/**
 * The browser holds the plan between steps and may drop or reorder sections.
 * Re-check everything that comes back: known apps only, one of each, one hero,
 * and rebuild every image URL from pixel boxes (never trust a sent URL).
 * @param {object} plan
 * @returns {object}
 */
function sanitizeClientPlan(plan) {
  if (!plan || typeof plan !== 'object') throw new Error('plan is required');
  const design = plan.design || {};
  const parsed = tiles.parseUploadUrl(design.url);
  const W = Math.round(Number(design.width));
  const H = Math.round(Number(design.height));
  if (!(W > 0 && H > 0)) throw new Error('plan.design needs width and height');

  const used = {};
  let heroTaken = false;
  const sections = [];
  (Array.isArray(plan.sections) ? plan.sections : []).forEach(function (s) {
    if (!s || sections.length >= MAX_SECTIONS) return;
    const app = getApp(str(s.appKey, 40));
    if (!app || used[app.key]) return;
    if (app.hero && heroTaken) return;
    used[app.key] = true;
    if (app.hero) heroTaken = true;
    const r = s.rows || {};
    const y0 = Math.max(0, Math.min(H - 1, Math.round(Number(r.y0) || 0)));
    const y1 = Math.max(y0 + 1, Math.min(H, Math.round(Number(r.y1) || H)));
    sections.push({
      id: str(s.id, 20) || ('s' + (sections.length + 1)),
      appKey: app.key,
      label: str(s.label, 120) || app.label,
      reason: str(s.reason, 200),
      rows: { y0: y0, y1: y1 },
      background: normHex(s.background),
      synthetic: !!s.synthetic,
      _hero: app.hero
    });
  });
  const heroIdx = sections.findIndex(function (s) { return s._hero; });
  if (heroIdx > 0) {
    const hero = sections.splice(heroIdx, 1)[0];
    const at = sections[0] && sections[0].appKey === 'emerg' ? 1 : 0;
    sections.splice(at, 0, hero);
  }
  sections.forEach(function (s) { delete s._hero; });

  function cleanPx(px) {
    px = px || {};
    const x = Math.max(0, Math.min(W - 1, Math.round(Number(px.x) || 0)));
    const y = Math.max(0, Math.min(H - 1, Math.round(Number(px.y) || 0)));
    const w = Math.max(1, Math.min(W - x, Math.round(Number(px.w) || 1)));
    const h = Math.max(1, Math.min(H - y, Math.round(Number(px.h) || 1)));
    return { x: x, y: y, w: w, h: h };
  }

  const photos = [];
  (Array.isArray(plan.photos) ? plan.photos : []).forEach(function (p) {
    if (!p || photos.length >= MAX_PHOTOS) return;
    const id = str(p.id, 10);
    if (!/^p\d+$/.test(id)) return;
    const px = cleanPx(p.px);
    if (!tiles.isUsableCrop(px)) return;
    photos.push({
      id: id,
      sectionId: str(p.sectionId, 20),
      description: str(p.description, 140),
      role: str(p.role, 20),
      px: px,
      url: tiles.cropUrl(parsed, px)
    });
  });

  let logo = null;
  if (plan.logo && plan.logo.px) {
    const lpx = cleanPx(plan.logo.px);
    if (lpx.w >= 16 && lpx.h >= 16) {
      logo = { photoId: 'logo', px: lpx, url: tiles.cropUrl(parsed, lpx) };
    }
  }

  const theme = {};
  ['pipe', 'hivis', 'steel', 'safety', 'lightBg'].forEach(function (k) {
    const v = normHex(plan.theme && plan.theme[k]);
    if (v) theme[k] = v;
  });

  return {
    version: 1,
    design: { url: design.url, width: W, height: H, tiles: Number(design.tiles) || 1 },
    businessName: str(plan.businessName, 120),
    tagline: str(plan.tagline, 200),
    phone: str(plan.phone, 40),
    email: str(plan.email, 120),
    seoTitle: str(plan.seoTitle, 70),
    seoDescription: str(plan.seoDescription, 170),
    theme: theme,
    logo: logo,
    sections: sections,
    photos: photos,
    gaps: (Array.isArray(plan.gaps) ? plan.gaps : []).slice(0, 40).map(function (g) {
      return { what: str(g && g.what, 200), suggestion: str(g && g.suggestion, 200) };
    })
  };
}

/** Margin added around a photo box before the photo check looks at it. */
const CHECK_MARGIN = 0.08;

/**
 * Context boxes for the photo check: each photo's box plus a margin.
 * @param {object} plan sanitised plan
 * @param {string[]} ids
 */
function photoCheckItems(plan, ids) {
  const parsed = tiles.parseUploadUrl(plan.design.url);
  return plan.photos
    .filter(function (p) { return ids.indexOf(p.id) >= 0; })
    .map(function (p) {
      const ctx = tiles.scalePx(p.px, CHECK_MARGIN, plan.design.width, plan.design.height);
      return { id: p.id, description: p.description, ctx: ctx, url: tiles.contextUrl(parsed, ctx) };
    });
}

/**
 * Apply the photo check: tighter boxes replace the old ones; rejected photos are
 * dropped. Anything malformed keeps the original crop.
 * @returns {{ photos: object[], removed: string[], tightened: string[] }}
 */
function applyPhotoCheck(plan, items, raw) {
  const parsed = tiles.parseUploadUrl(plan.design.url);
  const W = plan.design.width;
  const H = plan.design.height;
  const byId = {};
  (raw && Array.isArray(raw.photos) ? raw.photos : []).forEach(function (r) { if (r && r.id) byId[String(r.id)] = r; });
  const removed = [];
  const tightened = [];
  const out = [];
  plan.photos.forEach(function (p) {
    const item = items.find(function (i) { return i.id === p.id; });
    const r = item && byId[p.id];
    if (!r) { out.push(p); return; }
    if (r.keep === false) { removed.push(p.id); return; }
    const pct = function (v) { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) / 100 : null; };
    const x = pct(r.x), y = pct(r.y), w = pct(r.w), h = pct(r.h);
    if (x == null || y == null || !w || !h) { out.push(p); return; }
    const c = item.ctx;
    const px = {
      x: Math.round(c.x + x * c.w),
      y: Math.round(c.y + y * c.h),
      w: Math.round(w * c.w),
      h: Math.round(h * c.h)
    };
    px.x = Math.max(0, Math.min(W - 1, px.x));
    px.y = Math.max(0, Math.min(H - 1, px.y));
    px.w = Math.max(1, Math.min(W - px.x, px.w));
    px.h = Math.max(1, Math.min(H - px.y, px.h));
    if (!tiles.isUsableCrop(px)) { removed.push(p.id); return; }
    tightened.push(p.id);
    out.push(Object.assign({}, p, { px: px, url: tiles.cropUrl(parsed, px) }));
  });
  return { photos: out, removed: removed, tightened: tightened };
}

module.exports = {
  normalizePlan,
  photoCheckItems,
  applyPhotoCheck,
  sanitizeClientPlan,
  normHex,
  HERO_APPS,
  MAX_SECTIONS,
  MAX_PHOTOS
};
