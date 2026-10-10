'use strict';

/**
 * Hire booking emails (plain text, queued in booking_notifications and sent by
 * /api/cron/bookings-notify; we also flush straight away so they arrive quickly).
 *
 *   request_received  → customer: "We've got your request" (online bookings start pending)
 *   request_alert     → business: new request to approve
 *   hire_confirmed    → customer: booking confirmed
 *   hire_declined     → customer: couldn't confirm
 *   hire_cancelled    → customer: booking cancelled
 */

const { enqueueNotification, flushPendingNotifications } = require('../notify');
const { resolveTerminology } = require('./terminology');

const BASE = (process.env.PUBLIC_BASE_URL || 'https://leadpages.com.au').replace(/\/+$/, '');

function money(cents) {
  const n = (Number(cents) || 0) / 100;
  return '$' + (Math.round(n) === n ? n.toFixed(0) : n.toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function when(iso, tz) {
  try {
    return new Date(iso).toLocaleString('en-AU', {
      timeZone: tz || 'Australia/Sydney', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  } catch (_e) { return String(iso); }
}

function vehicleName(resource) {
  if (!resource) return '';
  const mm = [resource.make, resource.model].filter(Boolean).join(' ');
  return resource.public_name || resource.name || mm || '';
}

function summary(system, booking, hire, resource) {
  const tz = system.timezone || 'Australia/Sydney';
  const terms = resolveTerminology(system);
  const lines = [
    'Reference: ' + (booking.reference || ''),
    terms.singular + ': ' + (vehicleName(resource) || terms.singular),
    'Pick up: ' + when((hire && hire.pickup_at) || booking.starts_at, tz),
    'Return by: ' + when((hire && hire.return_at) || booking.ends_at, tz)
  ];
  if (booking.total_cents) lines.push('Hire total: ' + money(booking.total_cents) + (hire && hire.bond_cents ? ' (+ ' + money(hire.bond_cents) + ' bond)' : ''));
  return lines.join('\n');
}

function signoff(system) {
  const bits = [system.business_name || 'Thanks'];
  if (system.phone) bits.push(system.phone);
  if (system.email) bits.push(system.email);
  return bits.join('\n');
}

async function queue(system, booking, key, to, subject, body) {
  if (!to) return null;
  return enqueueNotification({
    booking_system_id: system.id,
    site_id: system.site_id,
    booking_id: booking.id,
    channel: 'email',
    template_key: key,
    to_address: to,
    subject: subject,
    body_text: body,
    payload: { reference: booking.reference, reply_to: system.email || undefined }
  });
}

async function flushSoon() {
  try { await flushPendingNotifications({ limit: 10 }); } catch (_e) { /* cron will send */ }
}

/** Online request received: email the customer and alert the business. */
async function requestReceived(system, booking, hire, resource, opts) {
  opts = opts || {};
  const manage = opts.portalUrl ? '\n\nManage your booking: ' + BASE + opts.portalUrl : '';
  await queue(system, booking, 'hire_request_received', booking.customer_email,
    'We’ve got your booking request — ' + booking.reference,
    'Hi ' + (booking.customer_name || 'there') + ',\n\nThanks for your booking request. We’ll check it and confirm by email shortly' +
      (opts.cardSaved ? '. Your card has been saved securely — nothing has been charged.' : '.') +
      '\n\n' + summary(system, booking, hire, resource) + manage + '\n\n' + signoff(system));
  const office = system.email;
  if (office) {
    await queue(system, booking, 'hire_request_alert', office,
      'New booking request ' + booking.reference + ' — ' + (booking.customer_name || ''),
      'A new online booking request is waiting for approval.\n\n' + summary(system, booking, hire, resource) +
        '\n\nCustomer: ' + (booking.customer_name || '') + '\nPhone: ' + (booking.customer_phone || '') + '\nEmail: ' + (booking.customer_email || '') +
        (booking.customer_notes ? '\nNotes: ' + booking.customer_notes : '') +
        '\nCard on file: ' + (opts.cardSaved ? 'yes' : 'no') +
        '\n\nApprove or decline it in LeadPages → Bookings → Requests.');
  }
  await flushSoon();
}

async function confirmed(system, booking, hire, resource, opts) {
  opts = opts || {};
  await queue(system, booking, 'hire_confirmed', booking.customer_email,
    'Booking confirmed — ' + booking.reference,
    'Hi ' + (booking.customer_name || 'there') + ',\n\nGood news — your booking is confirmed.\n\n' + summary(system, booking, hire, resource) +
      (opts.note ? '\n\n' + opts.note : '') +
      (opts.portalUrl ? '\n\nManage your booking: ' + BASE + opts.portalUrl : '') +
      '\n\nPlease bring your driver’s licence when you pick up.\n\n' + signoff(system));
  await flushSoon();
}

async function declined(system, booking, hire, resource, opts) {
  opts = opts || {};
  await queue(system, booking, 'hire_declined', booking.customer_email,
    'About your booking request — ' + booking.reference,
    'Hi ' + (booking.customer_name || 'there') + ',\n\nSorry, we can’t confirm your booking request for these dates.' +
      (opts.reason ? '\n\n' + opts.reason : '') + '\n\nNothing has been charged. Give us a call and we’ll find another time that works.\n\n' +
      summary(system, booking, hire, resource) + '\n\n' + signoff(system));
  await flushSoon();
}

async function cancelled(system, booking, hire, resource, opts) {
  opts = opts || {};
  await queue(system, booking, 'hire_cancelled', booking.customer_email,
    'Booking cancelled — ' + booking.reference,
    'Hi ' + (booking.customer_name || 'there') + ',\n\nYour booking has been cancelled.' + (opts.reason ? '\n\n' + opts.reason : '') +
      (opts.feeCents ? '\n\nCancellation fee: ' + money(opts.feeCents) : '') + '\n\n' + summary(system, booking, hire, resource) + '\n\n' + signoff(system));
  await flushSoon();
}

module.exports = { requestReceived, confirmed, declined, cancelled, vehicleName, money, when };
