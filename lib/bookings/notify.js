'use strict';

/**
 * Bookings notification outbox.
 * Enqueues rows; delivery is best-effort via Resend/Twilio when configured.
 * Never throws into booking create paths — failures are logged.
 */

const { getAdmin } = require('./auth');

async function enqueueNotification(opts) {
  const admin = getAdmin();
  const row = {
    booking_system_id: opts.booking_system_id,
    site_id: opts.site_id,
    booking_id: opts.booking_id || null,
    channel: opts.channel || 'email',
    template_key: opts.template_key || 'generic',
    to_address: opts.to_address || '',
    subject: opts.subject || '',
    body_text: opts.body_text || '',
    payload: opts.payload || {},
    status: 'pending',
    scheduled_for: opts.scheduled_for || new Date().toISOString()
  };
  try {
    const { data, error } = await admin.from('booking_notifications').insert(row).select('*').single();
    if (error) {
      console.warn('bookings notify enqueue', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, notification: data };
  } catch (e) {
    console.warn('bookings notify enqueue', e && e.message);
    return { ok: false, error: String((e && e.message) || e) };
  }
}

async function enqueueBookingCreated(system, booking, service) {
  if (!system || !booking) return { ok: false };
  const jobs = [];
  if (system.send_confirmation !== false && booking.customer_email) {
    jobs.push(
      enqueueNotification({
        booking_system_id: system.id,
        site_id: system.site_id,
        booking_id: booking.id,
        channel: 'email',
        template_key: 'booking_confirmation',
        to_address: booking.customer_email,
        subject: 'Booking confirmed — ' + (booking.reference || ''),
        body_text:
          'Hi ' +
          (booking.customer_name || '') +
          ',\n\nYour booking ' +
          booking.reference +
          ' for ' +
          ((service && service.name) || 'service') +
          ' is ' +
          booking.status +
          '.\nStarts: ' +
          booking.starts_at +
          ' (' +
          booking.timezone +
          ')\n\nThanks,\n' +
          (system.business_name || 'Bookings'),
        payload: { reference: booking.reference, status: booking.status }
      })
    );
  }
  if (system.send_reminder_24h !== false && booking.customer_email) {
    const start = new Date(booking.starts_at).getTime();
    const remindAt = new Date(start - 24 * 3600 * 1000);
    if (remindAt > new Date()) {
      jobs.push(
        enqueueNotification({
          booking_system_id: system.id,
          site_id: system.site_id,
          booking_id: booking.id,
          channel: 'email',
          template_key: 'booking_reminder_24h',
          to_address: booking.customer_email,
          subject: 'Reminder — ' + (booking.reference || ''),
          body_text: 'Reminder: your booking ' + booking.reference + ' starts at ' + booking.starts_at,
          scheduled_for: remindAt.toISOString(),
          payload: { reference: booking.reference }
        })
      );
    }
  }
  const results = await Promise.all(jobs);
  return { ok: true, results: results };
}

module.exports = {
  enqueueNotification,
  enqueueBookingCreated
};
