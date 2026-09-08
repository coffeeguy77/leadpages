'use strict';

/**
 * Xero OAuth connect / callback / status / disconnect / invoice actions.
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
const xero = require('../../../lib/bookings/hire/xero');
const { encryptSecret, encryptionConfigured } = require('../../../lib/bookings/hire/tokens');

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
      const tokens = await xero.exchangeCode(code);
      const tenants = await xero.listTenants(tokens.access_token);
      const tenant = (tenants && tenants[0]) || {};
      const admin = getAdmin();
      const system = await getBookingSystemForSite(state.site_id);
      if (!system) return json(res, 404, { ok: false, error: 'system_not_found' });
      await admin.from('booking_xero_connections').upsert(
        {
          booking_system_id: system.id,
          site_id: system.site_id,
          tenant_id: tenant.tenantId || '',
          tenant_name: tenant.tenantName || '',
          refresh_token_enc: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : '',
          access_token_enc: encryptSecret(tokens.access_token),
          access_token_expires_at: new Date(Date.now() + (tokens.expires_in || 1800) * 1000).toISOString(),
          scopes: String(tokens.scope || '').split(/\s+/).filter(Boolean),
          auto_create_on: 'confirmed',
          sync_health: 'healthy',
          connected_by: state.user_id || null,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        { onConflict: 'booking_system_id' }
      );
      res.statusCode = 302;
      res.setHeader('Location', '/bookings?site_id=' + encodeURIComponent(state.site_id) + '&xero=connected');
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
      .from('booking_xero_connections')
      .select('*')
      .eq('booking_system_id', system.id)
      .maybeSingle();
    return json(res, 200, {
      ok: true,
      connection: xero.connectionPublicView(conn),
      configured: !!xero.clientConfig().clientId,
      encryption_ready: encryptionConfigured()
    });
  }

  if (action === 'connect' && req.method === 'POST') {
    if (!encryptionConfigured()) {
      return json(res, 503, {
        ok: false,
        error: 'encryption_key_required',
        message: 'Set BOOKINGS_OAUTH_ENCRYPTION_KEY before connecting Xero.'
      });
    }
    try {
      const state = b64url({ site_id: siteId, user_id: user.id, n: crypto.randomBytes(8).toString('hex'), t: Date.now() });
      return json(res, 200, { ok: true, auth_url: xero.buildAuthUrl(state) });
    } catch (e) {
      return json(res, 503, { ok: false, error: e.code || e.message });
    }
  }

  if (action === 'disconnect' && req.method === 'POST') {
    await admin.from('booking_xero_connections').delete().eq('booking_system_id', system.id);
    return json(res, 200, { ok: true, disconnected: true });
  }

  if (action === 'save_mapping' && req.method === 'POST') {
    const patch = {};
    [
      'revenue_account_code',
      'deposit_account_code',
      'bond_account_code',
      'cancellation_account_code',
      'cleaning_account_code',
      'payment_account_code',
      'tax_type',
      'default_invoice_status',
      'branding_theme_id',
      'invoice_due_days',
      'auto_create_on',
      'auto_send',
      'attach_agreement',
      'contact_conflict_mode'
    ].forEach(function (k) {
      if (body[k] !== undefined) patch[k] = body[k];
    });
    // Back-compat: older clients sent auto_email
    if (body.auto_email !== undefined && body.auto_send === undefined) {
      patch.auto_send = !!body.auto_email;
    }
    patch.updated_at = new Date().toISOString();
    const { data, error } = await admin
      .from('booking_xero_connections')
      .update(patch)
      .eq('booking_system_id', system.id)
      .select('*')
      .single();
    if (error) return json(res, 400, { ok: false, error: error.message });
    return json(res, 200, { ok: true, connection: xero.connectionPublicView(data) });
  }

  if (action === 'create_invoice' && req.method === 'POST') {
    const { data: conn } = await admin
      .from('booking_xero_connections')
      .select('*')
      .eq('booking_system_id', system.id)
      .maybeSingle();
    if (!conn) return json(res, 404, { ok: false, error: 'not_connected' });
    const { data: booking } = await admin
      .from('bookings')
      .select('*')
      .eq('id', body.booking_id)
      .eq('booking_system_id', system.id)
      .maybeSingle();
    const { data: hire } = await admin
      .from('booking_hire_details')
      .select('*')
      .eq('booking_id', body.booking_id)
      .maybeSingle();
    const { data: customer } = await admin
      .from('booking_customers')
      .select('*')
      .eq('id', booking && booking.customer_id)
      .maybeSingle();
    if (!booking || !hire) return json(res, 404, { ok: false, error: 'booking_not_found' });
    const quote = hire.pricing_snapshot_json || {
      line_items: [{ description: 'Hire', quantity: 1, unit_price_cents: booking.total_cents }],
      total_cents: booking.total_cents,
      bond_cents: hire.bond_cents
    };
    const result = await xero.createInvoiceForBooking(
      admin,
      conn,
      system,
      booking,
      customer || { id: booking.customer_id, name: booking.customer_name, email: booking.customer_email, phone: booking.customer_phone },
      quote,
      { send: !!body.send }
    );
    if (!result.ok) return json(res, 400, result);
    return json(res, 200, result);
  }

  return json(res, 400, { ok: false, error: 'unknown_action' });
};
