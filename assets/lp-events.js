/**
 * LeadPages semantic event layer — one site-wide helper.
 * Components call LPEvents.emit('phone_click', { componentType, … }).
 * Forwards to legacy trackEvent when present, dataLayer when enabled, and /api/events.
 */
(function (global) {
  'use strict';

  var ALIASES = {
    mail_click: 'email_click',
    message_click: 'email_click',
    call_click: 'phone_click',
    lead_submit: 'form_submit',
    quote_open: 'quote_start',
    estimate_complete: 'quote_complete'
  };

  function eid() {
    return 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  function norm(name) {
    var n = String(name || '').trim();
    return ALIASES[n] || n;
  }

  function emit(name, props) {
    var event = norm(name);
    if (!event) return;
    var p = props && typeof props === 'object' ? props : {};
    if (!p.eventId) p.eventId = eid();
    p.occurredAt = p.occurredAt || new Date().toISOString();

    try {
      if (typeof global.trackEvent === 'function') {
        // dual-write legacy names for stats continuity
        var legacy =
          event === 'phone_click'
            ? 'call_click'
            : event === 'form_submit'
              ? 'lead_submit'
              : event === 'quote_start'
                ? 'quote_open'
                : event;
        global.trackEvent(legacy, p);
        if (legacy !== event) global.trackEvent(event, p);
      }
    } catch (_e) {}

    try {
      global.dataLayer = global.dataLayer || [];
      if (global.__LP_GTM_DATALAYER__ !== false) {
        global.dataLayer.push(Object.assign({ event: event }, p));
      }
    } catch (_e2) {}
  }

  global.LPEvents = { emit: emit, normalize: norm, newEventId: eid };
})(typeof window !== 'undefined' ? window : globalThis);
