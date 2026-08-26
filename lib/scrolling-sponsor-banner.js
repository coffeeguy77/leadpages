/**
 * Scrolling Sponsor Banner — defaults, normalisation, scheduling, URL safety.
 * Shared by manage editor helpers (Node tests) and documented for client renderers.
 */
'use strict';

var SPEED_PRESETS = { slow: 20, medium: 40, fast: 70 };
var SPEED_MIN = 8;
var SPEED_MAX = 160;
var MAX_TILES = 48;
var MAX_INSTANCES = 12;

function uid(prefix) {
  return (prefix || 'ssb') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultLayout() {
  return {
    imageHeightDesktop: 120,
    imageHeightMobile: 88,
    tileWidthDesktop: 200,
    tileWidthMobile: 150,
    gapDesktop: 24,
    gapMobile: 16,
    tilePadding: 16,
    imageFit: 'contain',
    imagePos: 'center'
  };
}

function defaultMotion() {
  return {
    scrolling: true,
    direction: 'left',
    speedPxPerSec: 40,
    pauseOnHover: true,
    showPauseControl: true,
    staticGrid: false
  };
}

function defaultAppearance() {
  return {
    sectionBg: '',
    tileBg: '',
    borderColor: '',
    borderWidth: 0,
    radius: 0,
    shadow: false,
    greyscaleHover: false,
    edgeFade: false,
    edgeFadeWidth: 48,
    fullWidth: true,
    padTop: 24,
    padBottom: 24
  };
}

function defaultHeading() {
  return {
    eyebrow: '',
    title: '',
    intro: '',
    align: 'center',
    maxWidth: 720,
    gap: 16,
    eyebrowColor: '',
    titleColor: '',
    introColor: ''
  };
}

function defaultTile() {
  return {
    id: uid('tile'),
    name: 'New sponsor',
    image: '',
    imagePid: '',
    imageW: null,
    imageH: null,
    alt: '',
    linkLabel: '',
    enabled: true,
    linkEnabled: false,
    linkUrl: '',
    contentMode: 'image', // image | overlay | caption
    text: '',
    textColor: '',
    textSize: 14,
    textAlign: 'center',
    textBg: '',
    overlayTint: '',
    overlayOpacity: 0.35,
    textPad: 8,
    overlayV: 'bottom', // top | center | bottom
    overlayH: 'center', // left | center | right
    widthOverride: null,
    startAt: null,
    endAt: null,
    imageFit: '',
    imagePos: ''
  };
}

function defaultInstance(adminName) {
  return {
    id: uid('inst'),
    adminName: adminName || 'Sponsors',
    enabled: true,
    bannerLinksEnabled: true,
    heading: defaultHeading(),
    tiles: [],
    motion: defaultMotion(),
    layout: defaultLayout(),
    appearance: defaultAppearance()
  };
}

function defaultSection() {
  return {
    on: false,
    instances: [defaultInstance('Major Sponsors')]
  };
}

function clamp(n, lo, hi) {
  n = Number(n);
  if (!isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function isSafeHttpUrl(url) {
  if (url == null || url === '') return true;
  var s = String(url).trim();
  if (!s) return true;
  try {
    var u = new URL(s, 'https://example.invalid');
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (s.indexOf('javascript:') === 0 || s.indexOf('data:') === 0) return false;
    return true;
  } catch (_e) {
    return false;
  }
}

function parseScheduleTs(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && isFinite(v)) return v;
  var t = Date.parse(String(v));
  return isFinite(t) ? t : null;
}

/**
 * @param {object} tile
 * @param {number} [nowMs]
 * @returns {'hidden'|'scheduled'|'active'|'expired'}
 */
function tileScheduleStatus(tile, nowMs) {
  if (!tile || tile.enabled === false) return 'hidden';
  var now = nowMs != null ? nowMs : Date.now();
  var start = parseScheduleTs(tile.startAt);
  var end = parseScheduleTs(tile.endAt);
  if (start != null && now < start) return 'scheduled';
  if (end != null && now > end) return 'expired';
  return 'active';
}

function tileIsPubliclyActive(tile, nowMs) {
  return tileScheduleStatus(tile, nowMs) === 'active';
}

function normalizeTile(raw) {
  var d = defaultTile();
  raw = raw || {};
  var out = Object.assign({}, d, raw);
  if (!out.id) out.id = uid('tile');
  out.enabled = out.enabled !== false;
  out.linkEnabled = !!out.linkEnabled;
  out.linkUrl = String(out.linkUrl || '').trim();
  if (!isSafeHttpUrl(out.linkUrl)) out.linkUrl = '';
  out.contentMode = ['image', 'overlay', 'caption'].indexOf(out.contentMode) >= 0 ? out.contentMode : 'image';
  out.imageFit = out.imageFit || '';
  out.imagePos = out.imagePos || '';
  if (out.widthOverride != null && out.widthOverride !== '') {
    out.widthOverride = clamp(out.widthOverride, 40, 640);
  } else {
    out.widthOverride = null;
  }
  out.overlayOpacity = clamp(out.overlayOpacity, 0, 1);
  out.textSize = clamp(out.textSize, 10, 48);
  out.textPad = clamp(out.textPad, 0, 48);
  return out;
}

function normalizeInstance(raw) {
  var d = defaultInstance();
  raw = raw || {};
  var out = Object.assign({}, d, raw);
  if (!out.id) out.id = uid('inst');
  out.adminName = String(out.adminName || 'Sponsors').slice(0, 80);
  out.enabled = out.enabled !== false;
  out.bannerLinksEnabled = out.bannerLinksEnabled !== false;
  out.heading = Object.assign({}, defaultHeading(), raw.heading || {});
  out.motion = Object.assign({}, defaultMotion(), raw.motion || {});
  out.motion.speedPxPerSec = clamp(out.motion.speedPxPerSec, SPEED_MIN, SPEED_MAX);
  out.motion.direction = out.motion.direction === 'right' ? 'right' : 'left';
  out.layout = Object.assign({}, defaultLayout(), raw.layout || {});
  out.appearance = Object.assign({}, defaultAppearance(), raw.appearance || {});
  var tiles = Array.isArray(raw.tiles) ? raw.tiles : [];
  out.tiles = tiles.slice(0, MAX_TILES).map(normalizeTile);
  return out;
}

function normalizeSection(raw) {
  raw = raw || {};
  var out = { on: raw.on === true, instances: [] };
  var list = Array.isArray(raw.instances) ? raw.instances : [];
  if (!list.length && Array.isArray(raw.tiles)) {
    // Legacy flat shape → one instance
    var inst = defaultInstance(raw.adminName || 'Sponsors');
    inst.tiles = raw.tiles;
    inst.heading = raw.heading;
    inst.motion = raw.motion;
    inst.layout = raw.layout;
    inst.appearance = raw.appearance;
    list = [inst];
  }
  if (!list.length) list = [defaultInstance('Major Sponsors')];
  out.instances = list.slice(0, MAX_INSTANCES).map(normalizeInstance);
  return out;
}

function activeTilesForInstance(inst, nowMs) {
  inst = normalizeInstance(inst);
  if (!inst.enabled) return [];
  return inst.tiles.filter(function (t) {
    return tileIsPubliclyActive(t, nowMs);
  });
}

function duplicateTile(tile) {
  var copy = normalizeTile(tile);
  copy.id = uid('tile');
  copy.name = (copy.name || 'Sponsor') + ' (copy)';
  return copy;
}

module.exports = {
  SPEED_PRESETS: SPEED_PRESETS,
  SPEED_MIN: SPEED_MIN,
  SPEED_MAX: SPEED_MAX,
  MAX_TILES: MAX_TILES,
  MAX_INSTANCES: MAX_INSTANCES,
  uid: uid,
  defaultLayout: defaultLayout,
  defaultMotion: defaultMotion,
  defaultAppearance: defaultAppearance,
  defaultHeading: defaultHeading,
  defaultTile: defaultTile,
  defaultInstance: defaultInstance,
  defaultSection: defaultSection,
  clamp: clamp,
  isSafeHttpUrl: isSafeHttpUrl,
  parseScheduleTs: parseScheduleTs,
  tileScheduleStatus: tileScheduleStatus,
  tileIsPubliclyActive: tileIsPubliclyActive,
  normalizeTile: normalizeTile,
  normalizeInstance: normalizeInstance,
  normalizeSection: normalizeSection,
  activeTilesForInstance: activeTilesForInstance,
  duplicateTile: duplicateTile
};
