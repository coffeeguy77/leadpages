'use strict';

/**
 * LeadPages semantic event contract + alias map for native tracking.
 */

const STANDARD_EVENTS = [
  'page_view',
  'scroll_depth',
  'cta_click',
  'phone_click',
  'email_click',
  'directions_click',
  'form_start',
  'form_submit',
  'generate_lead',
  'quote_start',
  'quote_complete',
  'booking_start',
  'booking_complete',
  'purchase',
  'call_connected',
  'qualified_call',
  'lead_qualified',
  'sale_completed',
  // legacy retained
  'call_click',
  'lead_submit',
  'quote_open',
  'gallery_impression',
  'gallery_filter',
  'gallery_category',
  'gallery_album',
  'gallery_image_click',
  'gallery_lightbox',
  'gallery_zoom',
  'gallery_nav',
  'gallery_load_more',
  'gallery_slideshow',
  'gallery_download',
  'gallery_share'
];

const ALIASES = {
  mail_click: 'email_click',
  message_click: 'email_click',
  call_click: 'phone_click',
  lead_submit: 'form_submit',
  quote_open: 'quote_start',
  estimate_complete: 'quote_complete',
  ig_click: 'cta_click'
};

function normalizeEventName(name) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  if (ALIASES[raw]) return ALIASES[raw];
  return raw;
}

function isAllowedEvent(name) {
  const n = normalizeEventName(name);
  return STANDARD_EVENTS.indexOf(n) >= 0 || STANDARD_EVENTS.indexOf(name) >= 0;
}

function newEventId() {
  return 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

module.exports = {
  STANDARD_EVENTS,
  ALIASES,
  normalizeEventName,
  isAllowedEvent,
  newEventId
};
