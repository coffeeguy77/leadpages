const fs = require('fs');
const path = require('path');
const S = '1.25';
const CAP = ' stroke-linecap="round" stroke-linejoin="round"';

const ICONS = {
  /* Flow — Connected System */
  visitors: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="12" cy="13" r="4" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M6 28c0-4 2.5-7 6-7s6 3 6 7" fill="none" stroke="currentColor" stroke-width="' + S + '"/><circle cx="20" cy="11" r="3.5" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M15 26c0-3 2-5.5 5-5.5s5 2.5 5 5.5" fill="none" stroke="currentColor" stroke-width="' + S + '"/><circle cx="28" cy="13" r="4" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M22 28c0-4 2.5-7 6-7s6 3 6 7" fill="none" stroke="currentColor" stroke-width="' + S + '"/></svg>',
  website: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="5" y="8" width="30" height="22" rx="2" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M5 14h30M13 8v22M27 8v22" fill="none" stroke="currentColor" stroke-width="' + S + '"/><rect x="9" y="18" width="8" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="' + S + '"/><rect x="19" y="18" width="12" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="' + S + '"/></svg>',
  enquiries: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="10" y="6" width="20" height="28" rx="2" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M10 12h20" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M14 18h12M14 23h8" fill="none" stroke="currentColor" stroke-width="' + S + '" ' + CAP + '/><path d="M22 27l2 2 4-5" fill="none" stroke="currentColor" stroke-width="' + S + '" ' + CAP + '/></svg>',
  crm: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="18" cy="15" r="5" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M8 30c0-5 4-9 10-9s10 4 10 9" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M27 10a7 7 0 1 1-2 5" fill="none" stroke="currentColor" stroke-width="' + S + '" ' + CAP + '/><path d="M27 10v3h3" fill="none" stroke="currentColor" stroke-width="' + S + '" ' + CAP + '/></svg>',
  customers: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M13 20l5 5 10-11" fill="none" stroke="currentColor" stroke-width="1.75" ' + CAP + '/></svg>',

  /* What We Do */
  build: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="7" y="9" width="26" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="' + S + '" stroke-dasharray="3 3"/><rect x="9" y="11" width="22" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M14 33h12M20 27v6" fill="none" stroke="currentColor" stroke-width="' + S + '" ' + CAP + '/></svg>',
  convert: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="9" y="10" width="22" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="' + S + '"/><rect x="9" y="18" width="22" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="' + S + '"/><rect x="9" y="26" width="14" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="' + S + '"/></svg>',
  connect: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="11" cy="29" r="3.5" fill="none" stroke="currentColor" stroke-width="' + S + '"/><circle cx="29" cy="29" r="3.5" fill="none" stroke="currentColor" stroke-width="' + S + '"/><circle cx="20" cy="11" r="3.5" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M14 26l4-12M26 26l-4-12M14.5 29h11" fill="none" stroke="currentColor" stroke-width="' + S + '"/></svg>',
  grow: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 30h24" fill="none" stroke="currentColor" stroke-width="' + S + '"/><rect x="10" y="22" width="5" height="8" fill="none" stroke="currentColor" stroke-width="' + S + '"/><rect x="18" y="16" width="5" height="14" fill="none" stroke="currentColor" stroke-width="' + S + '"/><rect x="26" y="10" width="5" height="20" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M28 12l4-4 4 4" fill="none" stroke="currentColor" stroke-width="' + S + '" ' + CAP + '/></svg>',

  /* Proof column */
  pin: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 34s8-7 8-15a8 8 0 1 0-16 0c0 8 8 15 8 15z" fill="none" stroke="currentColor" stroke-width="' + S + '"/><circle cx="20" cy="17" r="2.5" fill="currentColor"/></svg>',
  monitor: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="6" y="9" width="28" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M14 33h12M20 27v6" fill="none" stroke="currentColor" stroke-width="' + S + '" ' + CAP + '/></svg>',
  cloud: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M12 28h20a6 6 0 0 0 .8-12 7.5 7.5 0 0 0-14.6-2A5.5 5.5 0 0 0 12 28z" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M17 24l3 3 6-7" fill="none" stroke="currentColor" stroke-width="' + S + '" ' + CAP + '/></svg>',

  /* Demo features */
  clipboard: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="11" y="8" width="18" height="26" rx="2" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M16 8h8a2 2 0 0 1 2 2v2h-12v-2a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M15 20l3 3 7-8" fill="none" stroke="currentColor" stroke-width="' + S + '" ' + CAP + '/></svg>',
  device: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="13" y="5" width="14" height="30" rx="3" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M17 31h6" fill="none" stroke="currentColor" stroke-width="' + S + '" ' + CAP + '/></svg>',
  gears: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="14" cy="24" r="5.5" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M14 16v2M14 30v2M8.5 24H6.5M21.5 24h2M9.8 19.2l-1.4-1.4M19.6 28.8l1.4 1.4M19.6 19.2l1.4-1.4M9.8 28.8l-1.4 1.4" fill="none" stroke="currentColor" stroke-width="' + S + '"/><circle cx="27" cy="14" r="4" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M27 8.5v1.5M27 19.5v1.5M23 14h-1.5M32.5 14H34M24.2 11.2l-1-1M29.8 16.8l1 1M29.8 11.2l1-1M24.2 16.8l-1 1" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M18.5 20.5l5-3.5" fill="none" stroke="currentColor" stroke-width="' + S + '"/></svg>',

  /* Process */
  talk: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 12h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-2l-4 4v-4H8a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3z" fill="none" stroke="currentColor" stroke-width="' + S + '"/><circle cx="12" cy="18" r=".8" fill="currentColor"/><circle cx="16" cy="18" r=".8" fill="currentColor"/><circle cx="20" cy="18" r=".8" fill="currentColor"/></svg>',
  plan: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="10" y="7" width="20" height="28" rx="2" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M14 8h12v4H14z" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M14 18h12M14 23h12M14 28h8" fill="none" stroke="currentColor" stroke-width="' + S + '" ' + CAP + '/></svg>',
  review: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 20c0-7 5.5-12 12-12s12 5 12 12-5.5 12-12 12" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M32 20c0 7-5.5 12-12 12" fill="none" stroke="currentColor" stroke-width="' + S + '"/><circle cx="20" cy="20" r="4" fill="none" stroke="currentColor" stroke-width="' + S + '"/><circle cx="20" cy="20" r="1.2" fill="currentColor"/></svg>',
  launch: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 6l2 8h8l-6.5 5 2.5 9-6-4.5L14 28l2.5-9L10 14h8z" fill="none" stroke="currentColor" stroke-width="' + S + '" ' + CAP + '/></svg>',
  rocket: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 5c6 7 9 14 8 22l-8-3-8 3c-1-8 2-15 8-22z" fill="none" stroke="currentColor" stroke-width="' + S + '" ' + CAP + '/><circle cx="20" cy="16" r="2" fill="currentColor"/><path d="M12 28l-3 6 6-2M28 28l3 6-6-2" fill="none" stroke="currentColor" stroke-width="' + S + '" ' + CAP + '/></svg>',

  /* UI */
  star: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2l2.2 5.2L18 8l-4 3.6 1.2 5.4L10 14.8 4.8 17 6 11.6 2 8l5.8-.8z" fill="currentColor"/></svg>',
  external: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4H4v12h12v-3M11 4h5v5M16 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.4" ' + CAP + '/></svg>',
  lock: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="7" width="9" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" fill="none" stroke="currentColor" stroke-width="1.2" ' + CAP + '/></svg>',
  square: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
  check: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M12 20l6 6 14-14" fill="none" stroke="currentColor" stroke-width="1.75" ' + CAP + '/></svg>',
  arrow: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12M12 5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.5" ' + CAP + '/></svg>',

  /* Legacy aliases */
  target: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="12" fill="none" stroke="currentColor" stroke-width="' + S + '"/><circle cx="20" cy="20" r="4" fill="none" stroke="currentColor" stroke-width="' + S + '"/></svg>',
  edit: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="14" cy="22" r="5" fill="none" stroke="currentColor" stroke-width="' + S + '"/><circle cx="26" cy="14" r="4" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M18 19l6-6" fill="none" stroke="currentColor" stroke-width="' + S + '"/></svg>',
  globe: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="12" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M8 20h24M20 8c3 3 3 21 0 24M20 8c-3 3-3 21 0 24" fill="none" stroke="currentColor" stroke-width="' + S + '"/></svg>',
  form: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="10" y="6" width="20" height="28" rx="2" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="M14 14h12M14 20h12M14 26h8" fill="none" stroke="currentColor" stroke-width="' + S + '" ' + CAP + '/></svg>',
  search: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="17" cy="17" r="9" fill="none" stroke="currentColor" stroke-width="' + S + '"/><path d="m24 24 8 8" fill="none" stroke="currentColor" stroke-width="' + S + '" ' + CAP + '/></svg>'
};

/** Dashed lime connectors between flow nodes + CRM → Website branch */
function connectedFlowArt() {
  return '<svg class="prm-flow-connectors" viewBox="0 0 400 96" preserveAspectRatio="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M52 36 H348" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 4"/>'
    + '<path d="M348 36 L342 33 M348 36 L342 39" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
    + '<path d="M148 36 L142 33 M148 36 L142 39" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
    + '<path d="M248 36 L242 33 M248 36 L242 39" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
    + '</svg>';
}

function platformBridgeArt() {
  return '<svg class="prm-bridge-art" viewBox="0 0 480 80" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M100 4 v28 M380 4 v28 M100 32 C240 68 340 68 380 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 4" opacity="0.5"/>'
    + '</svg>';
}

function processConnectorArt() {
  return '<svg class="prm-timeline-connectors" viewBox="0 0 500 24" preserveAspectRatio="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M50 12 H450" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.45"/>'
    + '</svg>';
}

/** Web Culture brand cloud mark (SVG asset) */
let webcultureCloudSvgCache = null;
function webcultureCloudSvg() {
  if (!webcultureCloudSvgCache) {
    webcultureCloudSvgCache = fs.readFileSync(
      path.join(__dirname, '../../assets/partner-templates/webculture-cloud.svg'),
      'utf8'
    ).replace(/<\?xml[^>]*>\s*/i, '').trim();
  }
  return webcultureCloudSvgCache;
}

function webcultureCloudMark() {
  return '<span class="wc-footer-cloud-mark" aria-hidden="true">'
    + webcultureCloudSvg().replace('<svg ', '<svg class="wc-footer-cloud-svg" ')
    + '</span>';
}

function renderIcon(name, className) {
  const svg = ICONS[name] || ICONS.square;
  const cls = className ? ' class="' + className + '"' : '';
  return '<span class="prm-icon"' + cls + '>' + svg + '</span>';
}

module.exports = {
  ICONS,
  renderIcon,
  connectedFlowArt,
  platformBridgeArt,
  processConnectorArt,
  webcultureCloudMark
};
