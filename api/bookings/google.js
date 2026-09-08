'use strict';

/**
 * Google OAuth connect / callback / status / disconnect / sync-now for Bookings hire.
 */

const crypto = require('crypto');
const {
  requireUser,
  assertSiteAccess,
  getBookingSystemForSite,
  json,
  readBody,
  getAdmin
} = require('../../../lib/bookings/auth');
const google = require('../../../lib/bookings/hire/google');

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function fromB64url(s) {
  try {
    return JSON.parse(Buffer.from(String(s), 'base64url').toString('utf8'));
  } catch (_e) {
    return null;
  }
}

module.exports = async function (req, res) {
  const url = new URL(req.url, 'https://x');
  const action = url.searchParams.get('action') || (req.method === 'GET' ? 'status' : 'connect');

  if (action === 'callback' && req.method === 'GET') {
    const state = fromB64url(url.searchParams.get('state') || '');
    if (!state || !state.site_id) return json(res, 400, { ok: false, error: 'bad_state' });
    const code = url.searchParams.get('code');
    if (!code) return json(res, 400, { ok: false, error: 'missing_code' });
    try {
      const tokens = await google.exchangeCode(code);
      const admin = getAdmin();
      const system = await getBookingSystemForSite(state.site_id);
      if (!system) return json(res, 404, { ok: false, error: 'system_not_found' });
      const row = {
        booking_system_id: system.id,
        site_id: system.site_id,
        google_account_email: state.email || '',
        refresh_token_enc: tokens.refresh_token ? google.encryptSecret(tokens.refresh_token) : '',
        access_token_enc: google.encryptSecret(tokens.access_token),
        access_token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
        scopes: String(tokens.scope || '').split(/\s+/).filter(Boolean),
        calendar_enabled: true,
        contacts_enabled: !!state.contacts,
        calendar_authority: 'leadpages',
        contacts_direction: state.contacts ? 'leadpages_to_google' : 'disabled',
        sync_interval_minutes: 15,
        sync_health: 'healthy',
        last_error: '',
        connected_by: state.user_id || null,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await admin.from('booking_google_connections').upsert(row, { onConflict: 'booking_system_id' });
      res.statusCode = 302;
      res.setHeader('Location', '/bookings?site_id=' + encodeURIComponent(state.site_id) + '&google=connected');
      return res.end();
    } catch (e) {
      return json(res, 400, { ok: false, error: e.message || 'oauth_failed' });
    }
  }

  const user = await requireUser(req);
  if (!user) return json(res, 401, { ok: false, error: 'auth' });
  const body = req.method === 'GET' ? {} : await readBody(req);
  const siteId = url.searchParams.get('site_id') || body.site_id;
  const access = await assertSiteAccess(user, siteId);
  if (!access.ok) return json(res, access.code, { ok: false, error: access.error });
  const system = await getBookingSystemForSite(siteId);
  if (!system) return json(res, 404, { ok: false, error: 'system_not_found' });
  const admin = getAdmin();

  if (action === 'status' && req.method === 'GET') {
    const { data: conn } = await admin
      .from('booking_google_connections')
      .select('*')
      .eq('booking_system_id', system.id)
      .maybeSingle();
    return json(res, 200, {
      ok: true,
      connection: google.connectionPublicView(conn),
      configured: !!google.clientConfig().clientId,
      encryption_ready: google.encryptionConfigured()
    });
  }

  if (action === 'connect' && req.method === 'POST') {
    if (!google.encryptionConfigured()) {
      return json(res, 503, {
        ok: false,
        error: 'encryption_key_required',
        message: 'Set BOOKINGS_OAUTH_ENCRYPTION_KEY (or GOOGLE_ADS_OAUTH_ENCRYPTION_KEY) before connecting Google.'
      });
    }
    const state = b64url({
      site_id: siteId,
      user_id: user.id,
      contacts: !!body.contacts,
      n: crypto.randomBytes(8).toString('hex'),
      t: Date.now()
    });
    try {
      const authUrl = google.buildAuthUrl(state, { contacts: !!body.contacts });
      return json(res, 200, { ok: true, auth_url: authUrl });
    } catch (e) {
      return json(res, 503, { ok: false, error: e.code || e.message });
    }
  }

  if (action === 'disconnect' && req.method === 'POST') {
    await admin.from('booking_google_connections').delete().eq('booking_system_id', system.id);
    return json(res, 200, { ok: true, disconnected: true });
  }

  if (action === 'sync_now' && req.method === 'POST') {
    const { data: conn } = await admin
      .from('booking_google_connections')
      .select('*')
      .eq('booking_system_id', system.id)
      .maybeSingle();
    if (!conn) return json(res, 404, { ok: false, error: 'not_connected' });
    await admin
      .from('booking_google_connections')
      .update({
        last_attempted_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conn.id);

    const getToken = google.getValidAccessToken;
    const reconcile = google.reconcileManagedEvent;
    if (typeof getToken !== 'function' || typeof reconcile !== 'function') {
      return json(res, 200, { ok: true, queued: true, note: 'cron_will_sync' });
    }

    let checked = 0;
    let restored = 0;
    const errors = [];
    try {
      const access = await getToken(admin, conn);
      const calendarId = encodeURIComponent(conn.primary_calendar_id || 'primary');
      const { data: links } = await admin
        .from('booking_google_event_links')
        .select('*')
        .eq('booking_system_id', system.id)
        .eq('managed', true)
        .limit(100);
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
        const { data: resource } =
          hire && hire.resource_id
            ? await admin.from('booking_resources').select('*').eq('id', hire.resource_id).maybeSingle()
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
          {
            name: booking.customer_name,
            email: booking.customer_email,
            phone: booking.customer_phone
          }
        );
        checked += 1;
        if (outcome && (outcome.action === 'restored' || outcome.restored || (outcome.ok && outcome.event))) {
          restored += 1;
        }
      }
      await admin
        .from('booking_google_connections')
        .update({
          last_successful_sync_at: new Date().toISOString(),
          sync_health: 'healthy',
          last_error: '',
          updated_at: new Date().toISOString()
        })
        .eq('id', conn.id);
    } catch (e) {
      errors.push(e.message || 'sync_failed');
      await admin
        .from('booking_google_connections')
        .update({
          sync_health: 'error',
          last_error: e.message || 'sync_failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', conn.id);
    }
    return json(res, 200, {
      ok: errors.length === 0,
      summary: { checked: checked, restored: restored, errors: errors }
    });
  }

  return json(res, 400, { ok: false, error: 'unknown_action' });
};
