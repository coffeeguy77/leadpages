/**
 * api/billing/take-ownership.js — Super-admin: convert a for-sale mockup /
 * partner-attributed site into a LeadPages-owned live site without a Stripe sale.
 *
 * POST { siteId, clearPartners?: true, clearSale?: true }
 *   - is_mockup → false, sale_price → null, show_on_showcase → false
 *   - Optionally clear referring / servicing / commission partner FKs
 *   - servicing_status → leadpages_direct
 *
 * Does not invent build commissions. Leaves owner_email / owner_user_id alone
 * (set Client login email + Link client separately if needed).
 */
const { sb, json } = require('./_stripe');
const { requireSuper, readBody } = require('./_admin-auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });
  const user = await requireSuper(req, res);
  if (!user) return;

  const body = await readBody(req);
  const siteId = body && body.siteId ? String(body.siteId).trim() : '';
  if (!siteId) return json(res, 400, { ok: false, error: 'siteId required' });

  const clearPartners = body.clearPartners !== false;
  const clearSale = body.clearSale !== false;

  const { data: site, error: loadErr } = await sb
    .from('sites')
    .select(
      'id,slug,business_name,is_mockup,sale_price,show_on_showcase,status,' +
        'referring_partner_id,servicing_partner_id,commission_partner_id,' +
        'recurring_commission_active,servicing_status,owner_email,owner_user_id'
    )
    .eq('id', siteId)
    .maybeSingle();

  if (loadErr) return json(res, 500, { ok: false, error: loadErr.message || 'load failed' });
  if (!site) return json(res, 404, { ok: false, error: 'site not found' });

  const before = {
    is_mockup: !!site.is_mockup,
    sale_price: site.sale_price,
    show_on_showcase: !!site.show_on_showcase,
    status: site.status || null,
    referring_partner_id: site.referring_partner_id || null,
    servicing_partner_id: site.servicing_partner_id || null,
    commission_partner_id: site.commission_partner_id || null,
    servicing_status: site.servicing_status || null
  };

  const patch = {
    updated_at: new Date().toISOString()
  };

  if (clearSale) {
    patch.is_mockup = false;
    patch.show_on_showcase = false;
    patch.sale_price = null;
    if (!site.status || /^(draft|demo|mockup)$/i.test(String(site.status))) {
      patch.status = 'live';
    }
  }

  if (clearPartners) {
    patch.referring_partner_id = null;
    patch.servicing_partner_id = null;
    patch.commission_partner_id = null;
    patch.recurring_commission_active = false;
    patch.servicing_status = 'leadpages_direct';
  }

  const { data: rows, error: upErr } = await sb
    .from('sites')
    .update(patch)
    .eq('id', siteId)
    .select(
      'id,slug,is_mockup,sale_price,show_on_showcase,status,' +
        'referring_partner_id,servicing_partner_id,commission_partner_id,' +
        'recurring_commission_active,servicing_status,owner_email,owner_user_id'
    );

  if (upErr) return json(res, 500, { ok: false, error: upErr.message || 'update failed' });
  if (!rows || rows.length !== 1) {
    return json(res, 500, { ok: false, error: 'Unexpected update result' });
  }
  const row = rows[0];

  try {
    await sb.from('client_transfer_events').insert({
      site_id: siteId,
      from_partner_id: before.servicing_partner_id || before.referring_partner_id || null,
      to_partner_id: null,
      reason: 'manual_ownership_no_sale',
      effective_date: new Date().toISOString().slice(0, 10),
      keep_commission_trail: false,
      continue_recurring: false,
      recurring_earner: 'none',
      notes:
        'Marked manually owned (no sale). Cleared mockup/sale' +
        (clearPartners ? ' and partner attribution.' : '.'),
      created_by: user.id || null,
      created_by_email: user.email || null
    });
  } catch (_e) { /* non-fatal */ }

  try {
    await sb.from('partner_audit_logs').insert({
      actor_id: user.id || null,
      actor_email: user.email || null,
      action: 'manual_ownership_no_sale',
      partner_id: null,
      site_id: siteId,
      detail: { before, after: row, clearPartners, clearSale }
    });
  } catch (_e) { /* non-fatal */ }

  return json(res, 200, {
    ok: true,
    site: row,
    before,
    hint: row.owner_email
      ? 'Site is LeadPages-owned. Link the client login in Billing if needed.'
      : 'Site is LeadPages-owned. Add a Client login email in Settings to attach an owner.'
  });
};
