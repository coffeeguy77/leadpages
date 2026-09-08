'use strict';

/**
 * Cron: Google Calendar reconciliation for hire bookings.
 * Leadpages-authoritative restore of managed events.
 * Schedule: every 15 minutes.
 */

const { getAdmin } = require('../../lib/bookings/auth');
const google = require('../../lib/bookings/hire/google');

function authorized(req) {
  const secret = process.env.CRON_SECRET || process.env.BOOKINGS_CRON_SECRET || '';
  if (!secret) return process.env.NODE_ENV !== 'production';
  const hdr = req.headers.authorization || '';
  if (hdr === 'Bearer ' + secret) return true;
  if (req.headers['x-cron-secret'] === secret) return true;
  return false;
}

module.exports = async function (req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('method_not_allowed');
  }
  if (!authorized(req)) {
    res.statusCode = 401;
    return res.end('unauthorized');
  }

  const admin = getAdmin();
  const { data: connections, error } = await admin
    .from('booking_google_connections')
    .select('*')
    .eq('calendar_enabled', true)
    .limit(50);
  if (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: error.message }));
  }

  const getToken = google.getValidAccessToken || google.getValidAccessToken;
  const reconcile = google.reconcileManagedEvent || google.reconcileManagedEvent;

  const results = [];
  for (const conn of connections || []) {
    try {
      const interval = Number(conn.sync_interval_minutes) || 15;
      if (conn.last_successful_sync_at) {
        const age = Date.now() - new Date(conn.last_successful_sync_at).getTime();
        if (age < (interval - 1) * 60 * 1000) {
          results.push({ id: conn.id, skipped: true, reason: 'interval' });
          continue;
        }
      }

      if (typeof getToken !== 'function' || typeof reconcile !== 'function') {
        results.push({ id: conn.id, ok: false, error: 'google_sync_helpers_missing' });
        continue;
      }

      const access = await getToken(admin, conn);
      const calendarId = encodeURIComponent(conn.primary_calendar_id || 'primary');
      const { data: links } = await admin
        .from('booking_google_event_links')
        .select('*')
        .eq('booking_system_id', conn.booking_system_id)
        .eq('managed', true)
        .limit(200);

      let restored = 0;
      let checked = 0;
      for (const link of links || []) {
        const { data: booking } = await admin.from('bookings').select('*').eq('id', link.booking_id).maybeSingle();
        if (!booking || booking.status === 'cancelled') continue;
        const { data: hire } = await admin
          .from('booking_hire_details')
          .select('*')
          .eq('booking_id', booking.id)
          .maybeSingle();
        const remoteRes = await fetch(
          'https://www.googleapis.com/calendar/v3/calendars/' +
            calendarId +
            '/events/' +
            encodeURIComponent(link.google_event_id),
          { headers: { Authorization: 'Bearer ' + access } }
        );
        const remote = remoteRes.status === 404 ? { status: 'cancelled' } : await remoteRes.json();
        const { data: system } = await admin
          .from('booking_systems')
          .select('*')
          .eq('id', conn.booking_system_id)
          .maybeSingle();
        const { data: resource } =
          hire && hire.resource_id
            ? await admin.from('booking_resources').select('*').eq('id', hire.resource_id).maybeSingle()
            : { data: null };
        const { data: customer } = booking.customer_id
          ? await admin.from('booking_customers').select('*').eq('id', booking.customer_id).maybeSingle()
          : { data: null };

        const outcome = await reconcile(
          admin,
          conn,
          system,
          link,
          remote,
          booking,
          hire || {},
          resource || {},
          customer || {
            name: booking.customer_name,
            phone: booking.customer_phone,
            email: booking.customer_email
          }
        );
        checked += 1;
        if (outcome && (outcome.action === 'restored' || outcome.restored)) restored += 1;
      }

      await admin
        .from('booking_google_connections')
        .update({
          last_successful_sync_at: new Date().toISOString(),
          last_attempted_sync_at: new Date().toISOString(),
          sync_health: 'healthy',
          last_error: '',
          updated_at: new Date().toISOString()
        })
        .eq('id', conn.id);

      results.push({ id: conn.id, ok: true, restored: restored, checked: checked });
    } catch (e) {
      await admin
        .from('booking_google_connections')
        .update({
          last_attempted_sync_at: new Date().toISOString(),
          sync_health: 'error',
          last_error: e.message || 'sync_failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', conn.id);
      results.push({ id: conn.id, ok: false, error: e.message || 'sync_failed' });
    }
  }

  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, results: results }));
};
