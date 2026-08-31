'use strict';

/**
 * GET/POST /api/bookings/system
 * Ensure/load booking system; patch settings; advance onboarding.
 */

const {
  requireUser,
  assertSiteAccess,
  ensureBookingSystem,
  getBookingSystemForSite,
  isMissingSchemaError,
  json,
  readBody,
  getAdmin
} = require('../../lib/bookings/auth');

function schemaMissing(res) {
  return json(res, 503, {
    ok: false,
    error: 'schema_missing',
    message:
      'Bookings database tables are not installed yet. A super-admin must POST /api/bookings/bootstrap with { "confirm": "APPLY_BOOKINGS_SCHEMA" }, or run db/bookings_schema.sql + db/bookings_rls.sql in Supabase.'
  });
}

module.exports = async function (req, res) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'PATCH') {
      return json(res, 405, { ok: false, error: 'method_not_allowed' });
    }
    const user = await requireUser(req);
    if (!user) return json(res, 401, { ok: false, error: 'auth' });

    const url = new URL(req.url, 'https://x');
    const body = req.method === 'GET' ? {} : await readBody(req);
    const siteId = url.searchParams.get('site_id') || body.site_id;
    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { ok: false, error: access.error });

    let system = await getBookingSystemForSite(siteId);
    if (!system) {
      system = await ensureBookingSystem(siteId, { site: access.site });
    }

    if (req.method === 'GET') {
      return json(res, 200, {
        ok: true,
        system: system,
        site: { id: access.site.id, slug: access.site.slug, business_name: access.site.business_name },
        role: access.role
      });
    }

    const patch = {};
    const allowed = [
      'enabled', 'onboarding_step', 'booking_types', 'timezone', 'currency', 'gst_mode', 'gst_rate_bps',
      'business_name', 'phone', 'email', 'abn', 'address_json', 'logo_url',
      'payment_rule', 'deposit_amount_cents', 'deposit_percent_bps',
      'min_notice_minutes', 'max_advance_days', 'hold_minutes', 'slot_interval_minutes',
      'cancellation_hours', 'reschedule_hours',
      'send_confirmation', 'send_reminder_24h', 'notify_assigned_staff', 'send_cancellation',
      'public_slug', 'settings'
    ];
    allowed.forEach(function (k) {
      if (body[k] !== undefined) patch[k] = body[k];
    });
    if (body.action === 'complete_onboarding') {
      patch.onboarding_step = 'done';
      patch.enabled = true;
    }
    if (body.action === 'seed_default_hours') {
      const admin = getAdmin();
      const rows = [];
      for (let d = 1; d <= 5; d++) {
        rows.push({
          booking_system_id: system.id,
          site_id: system.site_id,
          scope: 'business',
          weekday: d,
          start_time: '09:00',
          end_time: '17:00',
          is_break: false
        });
      }
      await admin.from('booking_availability_rules').delete().eq('booking_system_id', system.id).eq('scope', 'business');
      if (rows.length) await admin.from('booking_availability_rules').insert(rows);
    }

    patch.updated_at = new Date().toISOString();
    const admin = getAdmin();
    const { data, error } = await admin.from('booking_systems').update(patch).eq('id', system.id).select('*').single();
    if (error) return json(res, 400, { ok: false, error: error.message });

    await admin.from('booking_audit_events').insert({
      booking_system_id: system.id,
      site_id: system.site_id,
      actor_user_id: user.id,
      action: 'system.update',
      entity_type: 'booking_system',
      entity_id: system.id,
      summary: 'Updated booking system settings',
      meta: { keys: Object.keys(patch) }
    });

    return json(res, 200, { ok: true, system: data });
  } catch (e) {
    if (e && (e.code === 'schema_missing' || isMissingSchemaError(e))) {
      return schemaMissing(res);
    }
    console.error('bookings/system', e && e.message);
    return json(res, 500, { ok: false, error: 'system_failed', message: String((e && e.message) || e) });
  }
};
