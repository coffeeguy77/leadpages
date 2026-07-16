// GET/POST /api/billing/maintenance — packages, enrolments, jobs (admin + active partners).
const { maintenanceSplitCents } = require('../../lib/billing/maintenance-split');
const { sb, getUser, isSuperAdmin, readBody, json } = require('./_admin-auth');

const PARTNER_SHARE = Number(process.env.MAINTENANCE_PARTNER_SHARE || 0.70);
const PLATFORM_SHARE = Number(process.env.MAINTENANCE_PLATFORM_SHARE || 0.30);

function clean(s, n) {
  return String(s == null ? '' : s).trim().slice(0, n || 400);
}

function splitAmount(amountCents) {
  const s = maintenanceSplitCents(amountCents, PARTNER_SHARE * 100);
  return { partner: s.partner, platform: s.platform, partnerPct: s.partnerPct, platformPct: s.platformPct };
}

async function resolveActor(req) {
  const user = await getUser(req);
  if (!user) return { error: { status: 401, body: { ok: false, error: 'unauthorized' } } };
  const superAdmin = await isSuperAdmin(user);
  if (superAdmin) return { user: user, superAdmin: true, partner: null };

  const pr = await sb.from('partners').select('id,status,display_name,email').eq('user_id', user.id).maybeSingle();
  if (!pr.data) return { error: { status: 403, body: { ok: false, error: 'forbidden' } } };
  if (pr.data.status !== 'active') {
    return { error: { status: 403, body: { ok: false, error: 'partner account is ' + pr.data.status } } };
  }
  return { user: user, superAdmin: false, partner: pr.data };
}

async function partnerOwnsSite(partnerId, siteId) {
  const r = await sb.from('sites')
    .select('id,servicing_partner_id,referring_partner_id,commission_partner_id')
    .eq('id', siteId)
    .maybeSingle();
  if (!r.data) return false;
  return r.data.servicing_partner_id === partnerId
    || r.data.referring_partner_id === partnerId
    || r.data.commission_partner_id === partnerId;
}

module.exports = async function(req, res) {
  const actor = await resolveActor(req);
  if (actor.error) return json(res, actor.error.status, actor.error.body);

  if (req.method === 'GET') {
    const packages = await sb.from('maintenance_packages').select('*').order('sort', { ascending: true });
    if (packages.error) {
      return json(res, 200, {
        ok: true,
        packages: [],
        site_maintenance: [],
        jobs: [],
        split: { partner_pct: PARTNER_SHARE * 100, platform_pct: PLATFORM_SHARE * 100 },
        warning: 'Run db/billing_accounting.sql to enable maintenance packages.'
      });
    }

    let maintQ = sb.from('site_maintenance').select('*').order('created_at', { ascending: false }).limit(500);
    let jobsQ = sb.from('maintenance_jobs').select('*').order('created_at', { ascending: false }).limit(500);
    if (!actor.superAdmin) {
      maintQ = maintQ.eq('partner_id', actor.partner.id);
      jobsQ = jobsQ.eq('partner_id', actor.partner.id);
    }
    const [maint, jobs] = await Promise.all([maintQ, jobsQ]);

    return json(res, 200, {
      ok: true,
      packages: (packages.data || []).filter(function(p) { return actor.superAdmin || p.active; }),
      site_maintenance: maint.data || [],
      jobs: jobs.data || [],
      split: { partner_pct: PARTNER_SHARE * 100, platform_pct: PLATFORM_SHARE * 100 }
    });
  }

  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'GET or POST only' });
  const b = await readBody(req);
  const action = clean(b.action, 40) || 'create_job';
  const now = new Date().toISOString();

  // ---- Admin: upsert package ----
  if (action === 'save_package') {
    if (!actor.superAdmin) return json(res, 403, { ok: false, error: 'admins only' });
    const key = clean(b.key, 60).toLowerCase().replace(/[^a-z0-9-]+/g, '-') || null;
    if (!key) return json(res, 400, { ok: false, error: 'Package key required.' });
    const row = {
      key: key,
      name: clean(b.name, 120) || key,
      description: clean(b.description, 600) || null,
      package_type: b.package_type === 'recurring' ? 'recurring' : 'one_off',
      price_cents: Math.max(0, Math.round(Number(b.price_cents) || 0)),
      currency: 'aud',
      interval: b.package_type === 'recurring' ? (b.interval === 'year' ? 'year' : 'month') : 'one_time',
      partner_share_pct: Number(b.partner_share_pct != null ? b.partner_share_pct : 70),
      platform_share_pct: Number(b.platform_share_pct != null ? b.platform_share_pct : 30),
      active: b.active !== false,
      sort: Number(b.sort) || 0,
      updated_at: now
    };
    if (b.id) {
      const up = await sb.from('maintenance_packages').update(row).eq('id', b.id).select('*').single();
      if (up.error) return json(res, 500, { ok: false, error: up.error.message });
      return json(res, 200, { ok: true, package: up.data });
    }
    row.created_at = now;
    const ins = await sb.from('maintenance_packages').insert(row).select('*').single();
    if (ins.error) return json(res, 500, { ok: false, error: ins.error.message });
    return json(res, 200, { ok: true, package: ins.data });
  }

  // ---- Enrol site in package ----
  if (action === 'enrol') {
    const siteId = clean(b.site_id || b.siteId, 40);
    const packageId = clean(b.package_id || b.packageId, 40);
    if (!siteId || !packageId) return json(res, 400, { ok: false, error: 'site_id and package_id required' });

    let partnerId = actor.partner ? actor.partner.id : clean(b.partner_id || b.partnerId, 40);
    if (actor.superAdmin && !partnerId) {
      const site = (await sb.from('sites').select('servicing_partner_id,referring_partner_id').eq('id', siteId).maybeSingle()).data;
      partnerId = (site && (site.servicing_partner_id || site.referring_partner_id)) || null;
    }
    if (!actor.superAdmin) {
      if (!(await partnerOwnsSite(actor.partner.id, siteId))) {
        return json(res, 403, { ok: false, error: 'Not your client site.' });
      }
      partnerId = actor.partner.id;
    }

    const pkg = (await sb.from('maintenance_packages').select('*').eq('id', packageId).maybeSingle()).data;
    if (!pkg || !pkg.active) return json(res, 404, { ok: false, error: 'Package not found.' });

    const row = {
      site_id: siteId,
      package_id: packageId,
      partner_id: partnerId,
      status: 'active',
      price_cents: b.price_cents != null ? Math.round(Number(b.price_cents)) : pkg.price_cents,
      billing_interval: pkg.interval || 'month',
      starts_at: now,
      notes: clean(b.notes, 400) || null,
      updated_at: now,
      created_at: now
    };
    const ins = await sb.from('site_maintenance').insert(row).select('*').single();
    if (ins.error) return json(res, 500, { ok: false, error: ins.error.message });
    return json(res, 200, { ok: true, enrolment: ins.data, split: splitAmount(row.price_cents) });
  }

  // ---- Create / update job ----
  if (action === 'create_job' || action === 'update_job') {
    const siteId = clean(b.site_id || b.siteId, 40);
    if (!siteId && action === 'create_job') return json(res, 400, { ok: false, error: 'site_id required' });

    let partnerId = actor.partner ? actor.partner.id : clean(b.partner_id || b.partnerId, 40);
    if (!actor.superAdmin) {
      if (!(await partnerOwnsSite(actor.partner.id, siteId || ''))) {
        // allow update by id for own jobs
        if (action === 'update_job' && b.id) {
          const existing = (await sb.from('maintenance_jobs').select('*').eq('id', b.id).maybeSingle()).data;
          if (!existing || existing.partner_id !== actor.partner.id) {
            return json(res, 403, { ok: false, error: 'Not your job.' });
          }
        } else {
          return json(res, 403, { ok: false, error: 'Not your client site.' });
        }
      }
      partnerId = actor.partner.id;
    }

    const amount = Math.max(0, Math.round(Number(b.amount_cents != null ? b.amount_cents : b.amountCents) || 0));
    const shares = splitAmount(amount);
    const packageId = clean(b.package_id || b.packageId, 40) || null;

    if (action === 'update_job' && b.id) {
      const patch = {
        title: clean(b.title, 160) || undefined,
        description: clean(b.description, 1200) || undefined,
        status: clean(b.status, 40) || undefined,
        amount_cents: amount || undefined,
        partner_share_cents: shares.partner,
        platform_share_cents: shares.platform,
        updated_at: now
      };
      Object.keys(patch).forEach(function(k) { if (patch[k] === undefined) delete patch[k]; });
      if (b.status === 'done' || b.status === 'paid') patch.completed_at = now;
      const up = await sb.from('maintenance_jobs').update(patch).eq('id', b.id).select('*').single();
      if (up.error) return json(res, 500, { ok: false, error: up.error.message });

      // When marked paid/invoiced, accrue partner commission (maintenance type).
      if ((b.status === 'paid' || b.status === 'invoiced') && up.data && up.data.partner_id && amount > 0) {
        try {
          await sb.from('partner_commissions').insert({
            partner_id: up.data.partner_id,
            site_id: up.data.site_id,
            type: 'maintenance',
            rate: PARTNER_SHARE,
            gross_amount: amount,
            commission_amount: shares.partner,
            status: 'pending',
            notes: 'Maintenance job: ' + (up.data.title || up.data.id),
            expected_payment_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
            created_at: now,
            updated_at: now
          });
        } catch (_e) { /* ignore dupes */ }
      }
      return json(res, 200, { ok: true, job: up.data, split: shares });
    }

    const title = clean(b.title, 160) || 'Update job';
    const row = {
      site_id: siteId,
      partner_id: partnerId,
      package_id: packageId,
      site_maintenance_id: clean(b.site_maintenance_id || '', 40) || null,
      title: title,
      description: clean(b.description, 1200) || null,
      job_type: b.job_type === 'recurring_cycle' ? 'recurring_cycle' : 'one_off',
      amount_cents: amount,
      partner_share_cents: shares.partner,
      platform_share_cents: shares.platform,
      status: clean(b.status, 40) || 'quoted',
      due_at: b.due_at || null,
      created_at: now,
      updated_at: now
    };
    const ins = await sb.from('maintenance_jobs').insert(row).select('*').single();
    if (ins.error) {
      return json(res, 500, {
        ok: false,
        error: ins.error.message || 'Could not create job. Run db/billing_accounting.sql first.'
      });
    }
    return json(res, 200, { ok: true, job: ins.data, split: shares });
  }

  if (action === 'cancel_enrolment' && b.id) {
    const existing = (await sb.from('site_maintenance').select('*').eq('id', b.id).maybeSingle()).data;
    if (!existing) return json(res, 404, { ok: false, error: 'Not found' });
    if (!actor.superAdmin && existing.partner_id !== actor.partner.id) {
      return json(res, 403, { ok: false, error: 'forbidden' });
    }
    const up = await sb.from('site_maintenance')
      .update({ status: 'cancelled', ends_at: now, updated_at: now })
      .eq('id', b.id)
      .select('*')
      .single();
    if (up.error) return json(res, 500, { ok: false, error: up.error.message });
    return json(res, 200, { ok: true, enrolment: up.data });
  }

  return json(res, 400, { ok: false, error: 'Unknown action' });
};
