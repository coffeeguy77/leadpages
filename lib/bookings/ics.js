'use strict';

/**
 * Build a minimal ICS calendar event for a booking.
 */

function pad(n) {
  return String(n).padStart(2, '0');
}

function toIcsUtc(d) {
  const x = new Date(d);
  return (
    x.getUTCFullYear() +
    pad(x.getUTCMonth() + 1) +
    pad(x.getUTCDate()) +
    'T' +
    pad(x.getUTCHours()) +
    pad(x.getUTCMinutes()) +
    pad(x.getUTCSeconds()) +
    'Z'
  );
}

function escapeIcs(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function foldLine(line) {
  if (line.length <= 75) return line;
  let out = '';
  let rest = line;
  out += rest.slice(0, 75);
  rest = rest.slice(75);
  while (rest.length) {
    out += '\r\n ' + rest.slice(0, 74);
    rest = rest.slice(74);
  }
  return out;
}

/**
 * @param {object} opts
 * @param {object} opts.booking
 * @param {object} [opts.service]
 * @param {object} [opts.system]
 * @param {string} [opts.uid]
 */
function buildBookingIcs(opts) {
  const booking = opts.booking || {};
  const service = opts.service || {};
  const system = opts.system || {};
  const uid = opts.uid || booking.id + '@leadpages-bookings';
  const summary = (service.name || 'Booking') + ' — ' + (booking.reference || '');
  const description = [
    'Reference: ' + (booking.reference || ''),
    booking.customer_name ? 'Customer: ' + booking.customer_name : '',
    booking.location_label ? 'Location: ' + booking.location_label : '',
    system.business_name ? 'Business: ' + system.business_name : '',
    system.phone ? 'Phone: ' + system.phone : ''
  ]
    .filter(Boolean)
    .join('\\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LeadPages//Bookings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + uid,
    'DTSTAMP:' + toIcsUtc(new Date()),
    'DTSTART:' + toIcsUtc(booking.starts_at),
    'DTEND:' + toIcsUtc(booking.ends_at),
    foldLine('SUMMARY:' + escapeIcs(summary)),
    foldLine('DESCRIPTION:' + escapeIcs(description.replace(/\\n/g, '\n'))),
    booking.location_label ? foldLine('LOCATION:' + escapeIcs(booking.location_label)) : null,
    'STATUS:' + (booking.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'),
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean);

  return lines.join('\r\n') + '\r\n';
}

module.exports = { buildBookingIcs, toIcsUtc, escapeIcs };
