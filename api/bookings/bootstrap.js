'use strict';

/**
 * POST /api/bookings/bootstrap
 * Super-admin only: apply Bookings SQL schema + RLS + register marketplace app.
 * Uses POSTGRES_URL (available on Vercel at runtime via Supabase integration).
 *
 * Body: { confirm: "APPLY_BOOKINGS_SCHEMA" }
 */

const fs = require('fs');
const path = require('path');
const {
  requireUser,
  json,
  readBody,
  getAdmin,
  isSuperAdmin
} = require('../../lib/bookings/auth');

function pgUrl() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL ||
    ''
  );
}

function readSql(name) {
  const p = path.join(process.cwd(), 'db', name);
  return fs.readFileSync(p, 'utf8');
}

async function schemaPresent(admin) {
  const { error } = await admin.from('booking_systems').select('id').limit(1);
  if (!error) return true;
  const msg = String(error.message || '');
  if (/Could not find the table|PGRST205|does not exist/i.test(msg)) return false;
  // Other errors (RLS etc.) still mean table exists
  return true;
}

async function registerApp(admin) {
  const row = {
    slug: 'bookings',
    name: 'Bookings',
    section_key: 'bookingStorefront',
    tagline: 'Appointments, classes and visits',
    description: 'Appointments, classes, on-site visits and resource hire — native LeadPages scheduling.',
    tier: 'free',
    price_monthly_aud: 0,
    price_annual_aud: 0,
    default_position: 'mid',
    marketplace_status: 'live',
    builder_visible: true,
    can_reposition: true,
    hero_exclusive: false,
    sort_order: 88,
    updated_at: new Date().toISOString()
  };
  const { data: existing } = await admin.from('app_registry').select('id').eq('slug', 'bookings').maybeSingle();
  if (existing) {
    const { error } = await admin.from('app_registry').update(row).eq('id', existing.id);
    if (error) return { ok: false, error: error.message };
    return { updated: true, id: existing.id };
  }
  const { data, error } = await admin.from('app_registry').insert(row).select('id').single();
  if (error) return { ok: false, error: error.message };
  return { inserted: true, id: data && data.id };
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  const user = await requireUser(req);
  if (!user) return json(res, 401, { ok: false, error: 'auth' });
  if (!(await isSuperAdmin(user.id))) {
    return json(res, 403, { ok: false, error: 'super_admin_required' });
  }

  const body = await readBody(req);
  if (body.confirm !== 'APPLY_BOOKINGS_SCHEMA') {
    return json(res, 400, {
      ok: false,
      error: 'confirm_required',
      message: 'POST { "confirm": "APPLY_BOOKINGS_SCHEMA" } as a super-admin to create booking_* tables.'
    });
  }

  const admin = getAdmin();
  const already = await schemaPresent(admin);
  if (already && !body.force) {
    const reg = await registerApp(admin).catch(function (e) {
      return { ok: false, error: e.message };
    });
    return json(res, 200, {
      ok: true,
      skipped: true,
      message: 'booking_systems already present',
      app_registry: reg
    });
  }

  const url = pgUrl();
  if (!url) {
    return json(res, 503, {
      ok: false,
      error: 'postgres_url_missing',
      message:
        'POSTGRES_URL is not set on this deployment. Run db/bookings_schema.sql and db/bookings_rls.sql in the Supabase SQL editor, then retry with force to register the app only.'
    });
  }

  let Client;
  try {
    Client = require('pg').Client;
  } catch (_e) {
    return json(res, 503, {
      ok: false,
      error: 'pg_module_missing',
      message: 'pg dependency not installed'
    });
  }

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  });

  const applied = [];
  try {
    await client.connect();
    for (const file of ['bookings_schema.sql', 'bookings_rls.sql', 'bookings_phase2.sql']) {
      const sql = readSql(file);
      await client.query(sql);
      applied.push(file);
    }
  } catch (e) {
    console.error('bookings bootstrap', e && e.message);
    try {
      await client.end();
    } catch (_e) {}
    return json(res, 500, {
      ok: false,
      error: 'migration_failed',
      message: String((e && e.message) || e),
      applied: applied
    });
  }

  try {
    await client.end();
  } catch (_e) {}

  const present = await schemaPresent(admin);
  const reg = await registerApp(admin).catch(function (e) {
    return { ok: false, error: e.message };
  });

  return json(res, 200, {
    ok: true,
    applied: applied,
    schema_present: present,
    app_registry: reg
  });
};
