'use strict';

/**
 * Cloudinary geometry for AI Composer.
 *
 * Claude's vision downsizes any image whose long edge is over ~1568px, so a tall
 * full-page screenshot would arrive too small to read. We cut it into tiles with
 * Cloudinary URL transformations (no server-side image library), and turn the
 * AI's tile-relative boxes back into crops of the original upload.
 */

const DEFAULT_CLOUD = 'dzx6x1hou';
/** Long edge sent to the model per image (under the 1568px standard limit). */
const MODEL_EDGE = 1400;
/** Most tiles sent in one design-plan call (keeps the call inside 60s). */
const MAX_TILES = 8;

function cloudName() {
  return process.env.CLOUDINARY_CLOUD_NAME || DEFAULT_CLOUD;
}

/**
 * Accept only images uploaded to our own Cloudinary account under leadpages/.
 * @param {string} url
 * @returns {{ cloud: string, rest: string }} rest = "v123/leadpages/..../id.png"
 */
function parseUploadUrl(url) {
  const m = String(url || '').match(/^https:\/\/res\.cloudinary\.com\/([a-zA-Z0-9_-]+)\/image\/upload\/(.+)$/);
  if (!m) throw new Error('Design image must be a Cloudinary upload URL');
  if (m[1] !== cloudName()) throw new Error('Design image is not from the LeadPages Cloudinary account');
  // Strip any transformation segments already on the URL; keep version + public id.
  const segs = m[2].split('/');
  let i = 0;
  while (i < segs.length && !/^v\d+$/.test(segs[i]) && segs[i] !== 'leadpages') i++;
  const rest = segs.slice(i).join('/');
  if (!/^(v\d+\/)?leadpages\//.test(rest)) {
    throw new Error('Design image must live under leadpages/ in Cloudinary');
  }
  return { cloud: m[1], rest: rest };
}

function transformUrl(parsed, transforms) {
  return 'https://res.cloudinary.com/' + parsed.cloud + '/image/upload/' +
    transforms.filter(Boolean).join('/') + '/' + parsed.rest;
}

function clampInt(n, lo, hi) {
  n = Math.round(Number(n) || 0);
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Split a design into horizontal bands.
 * @param {number} width
 * @param {number} height
 * @returns {{ index: number, y: number, h: number }[]}
 */
function planTiles(width, height) {
  const W = clampInt(width, 1, 100000);
  const H = clampInt(height, 1, 100000);
  if (H <= Math.round(W * 1.3)) return [{ index: 0, y: 0, h: H }];
  let tileH = Math.round(W * 0.85);
  const overlap = Math.round(tileH * 0.06);
  let count = Math.max(2, Math.ceil((H - overlap) / (tileH - overlap)));
  if (count > MAX_TILES) {
    count = MAX_TILES;
    // Grow tiles so MAX_TILES covers the page with ~6% overlap: H = n*t - (n-1)*0.06t.
    tileH = Math.ceil(H / (count - (count - 1) * 0.06));
  }
  // Spread tiles evenly from top to bottom; the step is never bigger than
  // tileH minus the overlap, so no rows are skipped.
  const step = (H - tileH) / (count - 1);
  const tiles = [];
  for (let i = 0; i < count; i++) {
    const y = Math.round(i * step);
    tiles.push({ index: i, y: y, h: Math.min(tileH, H - y) });
  }
  return tiles;
}

/** A tile image sized for the model. */
function tileUrl(parsed, width, tile) {
  return transformUrl(parsed, [
    'c_crop,x_0,y_' + tile.y + ',w_' + clampInt(width, 1, 100000) + ',h_' + tile.h,
    'c_limit,w_' + MODEL_EDGE + ',h_' + MODEL_EDGE,
    'q_auto:good,f_jpg'
  ]);
}

/**
 * Convert a tile-relative box (percentages 0–100) to original-image pixels.
 * @param {{y:number,h:number}} tile
 * @param {{x:number,y:number,w:number,h:number}} box
 * @param {number} width
 * @param {number} height
 */
function boxToPixels(tile, box, width, height) {
  const W = clampInt(width, 1, 100000);
  const H = clampInt(height, 1, 100000);
  const pct = function (v) { return Math.max(0, Math.min(100, Number(v) || 0)) / 100; };
  let x = Math.round(pct(box.x) * W);
  let y = tile.y + Math.round(pct(box.y) * tile.h);
  let w = Math.round(pct(box.w) * W);
  let h = Math.round(pct(box.h) * tile.h);
  x = clampInt(x, 0, W - 1);
  y = clampInt(y, 0, H - 1);
  w = clampInt(w, 1, W - x);
  h = clampInt(h, 1, H - y);
  return { x: x, y: y, w: w, h: h };
}

/**
 * Grow (frac > 0) or shrink (frac < 0) a pixel box on every side by a fraction of
 * its own size, kept inside the image.
 */
function scalePx(px, frac, width, height) {
  const W = clampInt(width, 1, 100000);
  const H = clampInt(height, 1, 100000);
  const dx = Math.round(px.w * frac);
  const dy = Math.round(px.h * frac);
  const x = clampInt(px.x - dx, 0, W - 1);
  const y = clampInt(px.y - dy, 0, H - 1);
  const x2 = clampInt(px.x + px.w + dx, x + 1, W);
  const y2 = clampInt(px.y + px.h + dy, y + 1, H);
  return { x: x, y: y, w: x2 - x, h: y2 - y };
}

/** A crop with some surrounding margin, sized for the model (photo check). */
function contextUrl(parsed, px) {
  return transformUrl(parsed, [
    'c_crop,x_' + px.x + ',y_' + px.y + ',w_' + px.w + ',h_' + px.h,
    'c_limit,w_900,h_900',
    'q_auto:good,f_jpg'
  ]);
}

/** Too small to be a usable photo (icons, bullets, stray boxes). */
function isUsableCrop(px) {
  return px.w >= 48 && px.h >= 48;
}

/** A crop of the original upload, for use as a site image. */
function cropUrl(parsed, px) {
  return transformUrl(parsed, [
    'c_crop,x_' + px.x + ',y_' + px.y + ',w_' + px.w + ',h_' + px.h,
    'c_limit,w_1600,h_1600',
    'q_auto,f_auto'
  ]);
}

/**
 * Page rows covered by a section, from tile + percentage marks.
 * @returns {{ y0: number, y1: number }}
 */
function sectionRows(tiles, mark, height) {
  const H = clampInt(height, 1, 100000);
  const t0 = tiles[clampInt(mark.startTile, 0, tiles.length - 1)];
  const t1 = tiles[clampInt(mark.endTile != null ? mark.endTile : mark.startTile, 0, tiles.length - 1)];
  const pct = function (v, d) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) / 100 : d;
  };
  let y0 = t0.y + Math.round(pct(mark.startPct, 0) * t0.h);
  let y1 = t1.y + Math.round(pct(mark.endPct, 1) * t1.h);
  if (y1 < y0) { const s = y0; y0 = y1; y1 = s; }
  y0 = clampInt(y0, 0, H - 1);
  y1 = clampInt(Math.max(y1, y0 + 40), 1, H);
  return { y0: y0, y1: y1 };
}

/**
 * Images of one section for the fill call. Tall sections are split so each
 * piece stays readable once the model scales it.
 */
function sectionImageUrls(parsed, width, rows) {
  const W = clampInt(width, 1, 100000);
  const maxPiece = Math.round(W * 1.1);
  const out = [];
  let y = rows.y0;
  while (y < rows.y1 && out.length < 4) {
    const h = Math.min(maxPiece, rows.y1 - y);
    out.push(transformUrl(parsed, [
      'c_crop,x_0,y_' + y + ',w_' + W + ',h_' + h,
      'c_limit,w_' + MODEL_EDGE + ',h_' + MODEL_EDGE,
      'q_auto:good,f_jpg'
    ]));
    y += h;
  }
  return out;
}

module.exports = {
  MODEL_EDGE,
  MAX_TILES,
  parseUploadUrl,
  transformUrl,
  planTiles,
  tileUrl,
  boxToPixels,
  isUsableCrop,
  scalePx,
  contextUrl,
  cropUrl,
  sectionRows,
  sectionImageUrls
};
