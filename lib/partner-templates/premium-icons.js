/**
 * Premium partner theme — inline SVG icon set (thin stroke, lime on dark).
 */
const STROKE = '1.5';

const ICONS = {
  build: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="18" width="32" height="22" rx="2" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><path d="M16 18V14l8-6 8 6v4" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><path d="M20 32h8" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/></svg>',
  convert: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="8" width="28" height="32" rx="3" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><path d="M16 18h16M16 24h16M16 30h10" fill="none" stroke="currentColor" stroke-width="' + STROKE + '" stroke-linecap="round"/></svg>',
  connect: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="14" cy="24" r="5" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><circle cx="34" cy="14" r="5" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><circle cx="34" cy="34" r="5" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><path d="M18.5 22l12-6M18.5 26l12 6" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/></svg>',
  grow: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 36h32" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><path d="M14 30l6-10 6 6 8-14" fill="none" stroke="currentColor" stroke-width="' + STROKE + '" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pin: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 42s10-8.5 10-18a10 10 0 1 0-20 0c0 9.5 10 18 10 18z" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><circle cx="24" cy="22" r="3" fill="currentColor"/></svg>',
  monitor: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="10" width="36" height="24" rx="3" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><path d="M16 40h16M24 34v6" fill="none" stroke="currentColor" stroke-width="' + STROKE + '" stroke-linecap="round"/></svg>',
  cloud: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 34h24a8 8 0 0 0 1-16 10 10 0 0 0-19.5 2.5A7 7 0 0 0 14 34z" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/></svg>',
  target: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><circle cx="24" cy="24" r="6" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><circle cx="24" cy="24" r="2" fill="currentColor"/></svg>',
  device: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="16" y="6" width="16" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><path d="M21 36h6" fill="none" stroke="currentColor" stroke-width="' + STROKE + '" stroke-linecap="round"/></svg>',
  edit: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 38h8l20-20-8-8L10 30v8z" fill="none" stroke="currentColor" stroke-width="' + STROKE + '" stroke-linejoin="round"/></svg>',
  search: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="21" cy="21" r="12" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><path d="m30 30 10 10" fill="none" stroke="currentColor" stroke-width="' + STROKE + '" stroke-linecap="round"/></svg>',
  globe: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><path d="M8 24h32M24 8c5 5 5 27 0 32M24 8c-5 5-5 27 0 32" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/></svg>',
  form: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="12" y="6" width="24" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><path d="M18 16h12M18 24h12M18 32h8" fill="none" stroke="currentColor" stroke-width="' + STROKE + '" stroke-linecap="round"/></svg>',
  crm: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="12" width="36" height="26" rx="3" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><path d="M14 22h10M14 30h20" fill="none" stroke="currentColor" stroke-width="' + STROKE + '" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="16" fill="currentColor" opacity="0.15"/><path d="M16 24l6 6 12-12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  talk: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 14h16a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H18l-8 6v-6a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><path d="M28 20h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-6l-4 4v-4" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/></svg>',
  plan: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="8" width="28" height="32" rx="3" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><path d="M16 18h16M16 24h16M16 30h10" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><path d="M32 16l4 4-4 4" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/></svg>',
  review: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 10c-8 0-14 6-14 12 0 8 14 18 14 18s14-10 14-18c0-6-6-12-14-12z" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><circle cx="24" cy="22" r="4" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/></svg>',
  launch: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 8l4 12h12l-10 8 4 12-10-8-10 8 4-12-10-8h12z" fill="none" stroke="currentColor" stroke-width="' + STROKE + '" stroke-linejoin="round"/></svg>',
  rocket: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6c8 8 12 18 10 28l-10-4-10 4C12 24 16 14 24 6z" fill="none" stroke="currentColor" stroke-width="' + STROKE + '" stroke-linejoin="round"/><circle cx="24" cy="20" r="3" fill="currentColor"/><path d="M14 34l-4 8 8-4M34 34l4 8-8-4" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/></svg>',
  visitors: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="18" cy="18" r="6" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><path d="M8 38c0-6 4-10 10-10s10 4 10 10" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><circle cx="34" cy="16" r="4" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><path d="M28 38c0-4 2.5-7 6-7s6 3 6 7" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/></svg>',
  website: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="10" width="36" height="26" rx="3" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><path d="M6 18h36M14 10v26M34 10v26" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/></svg>',
  enquiries: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="8" width="28" height="32" rx="3" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><path d="M18 20h12M18 26h8" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><circle cx="34" cy="34" r="8" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/><path d="M32 34l2 2 4-4" fill="none" stroke="currentColor" stroke-width="' + STROKE + '"/></svg>',
  customers: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="14" fill="currentColor" opacity="0.2"/><path d="M16 26l5 5 12-14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.8 6.5L22 10.5l-5 4.5 1.6 6.8L12 18.8 5.4 21.8 7 15 2 10.5l7.2-1z" fill="currentColor"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

/** Connected-system flow diagram SVG art */
function connectedFlowArt() {
  return '<svg class="prm-flow-art" viewBox="0 0 720 200" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">'
    + '<defs><marker id="wc-arr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">'
    + '<path d="M0 0l8 4-8 4z" fill="currentColor"/></marker></defs>'
    + '<path d="M60 100h100M200 100h100M340 100h100M480 100h80" fill="none" stroke="currentColor" stroke-width="2" marker-end="url(#wc-arr)" opacity="0.5"/>'
    + '<path d="M560 100v50" fill="none" stroke="currentColor" stroke-width="2" opacity="0.5"/>'
    + '<circle cx="560" cy="168" r="22" fill="currentColor" opacity="0.2"/>'
    + '</svg>';
}

/** Platform bridge connector art */
function platformBridgeArt() {
  return '<svg class="prm-bridge-art" viewBox="0 0 400 120" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M80 10v40M320 10v40M80 50 Q200 90 320 50" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="6 6" opacity="0.45"/>'
    + '</svg>';
}

/** Decorative hero blob */
function heroBlobArt() {
  return '<svg class="wc-hero-blob" viewBox="0 0 200 200" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">'
    + '<circle cx="100" cy="100" r="90" fill="currentColor" opacity="0.08"/>'
    + '<circle cx="130" cy="70" r="40" fill="currentColor" opacity="0.06"/>'
    + '</svg>';
}

function renderIcon(name, className) {
  const svg = ICONS[name] || ICONS.target;
  const cls = className ? ' class="' + className + '"' : '';
  return '<span class="prm-icon"' + cls + '>' + svg + '</span>';
}

module.exports = {
  ICONS,
  renderIcon,
  connectedFlowArt,
  platformBridgeArt,
  heroBlobArt
};
