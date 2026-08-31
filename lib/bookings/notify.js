'use strict';

/**
 * Bookings notification outbox.
 * Enqueues rows; cron flushes via Resend/Twilio when configured.
 * Never throws into booking create paths — failures are logged.
 */

const { getAdmin } = require('./auth');

async function sendEmail(to, subject, text) {
  if (!process.env.RESEND_API_KEY || !to) {
    return { ok: false, skipped: true, reason: 'email_not_configured' };
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.BOOKINGS_FROM || process.env.LEADS_FROM || 'LeadPages <noreply@leadpages.com.au>',
      to: [to],
      subject: subject || 'Booking update',
      text: text || ''
    })
  });
  let j = null;
  try {
    j = await r.json();
  } catch (_e) {
    j = null;
  }
  return { ok: r.ok, status: r.status, id: j && j.id, raw: j };
}

async function sendSms(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from =
    process.env.TWILIO_FROM_NUMBER ||
    process.env.TWILIO_FROM ||
    process.env.TWILIO_SMS_FROM;
  if (!sid || !token || !from || !to) {
    return { ok: false, skipped: true, reason: 'sms_not_configured' };
  }
  const auth = Buffer.from(sid + ':' + token).toString('base64');
  const params = new URLSearchParams();
  params.set('To', String(to).replace(/\s+/g, ''));
  params.set('From', from);
  params.set('Body', String(body || '').slice(0, 1500));
  const r = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + auth,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });
  let j = null;
  try {
    j = await r.json();
  } catch (_e) {
    j = null;
  }
  return { ok: r.ok, status: r.status, id: j && j.sid, raw: j };
}

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

/**
 * Flush due pending notifications. Returns counts.
 */
async function flushPendingNotifications(opts) {
  opts = opts || {};
  const admin = getAdmin();
  const limit = Math.min(100, Number(opts.limit) || 40);
  const now = opts.now || new Date();

  const { data: rows, error } = await admin
    .from('booking_notifications')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', now.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(limit);
  if (error) throw error;

  const sent = [];
  const skipped = [];
  const failed = [];

  for (const row of rows || []) {
    let result;
    if (row.channel === 'sms') {
      result = await sendSms(row.to_address, row.body_text);
    } else {
      result = await sendEmail(row.to_address, row.subject, row.body_text);
    }

    if (result.skipped) {
      skipped.push({ id: row.id, reason: result.reason });
      // Leave pending so a later cron with credentials can send —
      // but avoid tight loops when not configured: mark failed after age?
      // Prefer: mark cancelled with reason when provider missing for >1h of due.
      const dueAge = now.getTime() - new Date(row.scheduled_for).getTime();
      if (dueAge > 3600000) {
        await admin
          .from('booking_notifications')
          .update({
            status: 'cancelled',
            error_message: result.reason || 'provider_not_configured',
            sent_at: now.toISOString()
          })
          .eq('id', row.id);
      }
      continue;
    }

    if (result.ok) {
      await admin
        .from('booking_notifications')
        .update({
          status: 'sent',
          sent_at: now.toISOString(),
          payload: Object.assign({}, row.payload || {}, { provider_id: result.id || null })
        })
        .eq('id', row.id);
      sent.push({ id: row.id, provider_id: result.id });
    } else {
      await admin
        .from('booking_notifications')
        .update({
          status: 'failed',
          error_message: String((result.raw && (result.raw.message || result.raw.error)) || 'send_failed').slice(0, 500),
          sent_at: now.toISOString()
        })
        .eq('id', row.id);
      failed.push({ id: row.id });
    }
  }

  return {
    ok: true,
    due: (rows || []).length,
    sent: sent.length,
    skipped: skipped.length,
    failed: failed.length,
    details: { sent: sent, skipped: skipped, failed: failed }
  };
}

module.exports = {
  enqueueNotification,
  enqueueBookingCreated,
  flushPendingNotifications,
  sendEmail,
  sendSms
};
