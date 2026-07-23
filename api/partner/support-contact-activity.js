// api/partner/support-contact-activity.js — partner-facing feed of support badge clicks.
// Shows which client accounts clicked Message / Call on the support contact card.
//
// GET → { ok, items:[{ id, action, button, note, actor_email, business_name, site_slug, site_id, created_at }], counts }

'use strict';

const { createClient } = require('@supabase/supabase-js');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const r = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token }
    });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u || !u.id) return null;
    return { id: u.id, email: String(u.email || '').toLowerCase() };
  } catch (_e) {
    return null;
  }
}

async function isSuper(userId) {
  try {
    const r = await admin.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle();
    return !!(r.data && r.data.is_super_admin);
  } catch (_e) {
    return false;
  }
}

module.exports = async function supportContactActivity(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'GET only' }));
  }

  const user = await getUser(req);
  if (!user) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
  }

  try {
    let partnerId = null;
    try {
      const u = new URL(req.url, 'http://x');
      partnerId = u.searchParams.get('partner_id');
    } catch (_e) {}

    const superAdmin = await isSuper(user.id);
    if (partnerId && superAdmin) {
      // ok — admin act-as
    } else {
      const { data: partner } = await admin
        .from('partners')
        .select('id,status')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!partner || ['suspended', 'terminated'].includes(partner.status)) {
        // Also allow claim-by-email partners that have not stamped user_id yet? me.js stamps.
        if (!superAdmin) {
          res.statusCode = 403;
          return res.end(JSON.stringify({ ok: false, error: 'partners only' }));
        }
      } else {
        partnerId = partner.id;
      }
    }

    if (!partnerId) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: 'partner not found' }));
    }

    const { data: rows, error } = await admin
      .from('partner_audit_logs')
      .select('id,action,actor_email,site_id,detail,created_at')
      .eq('partner_id', partnerId)
      .in('action', ['support_contact_message', 'support_contact_call', 'support_contact_dismiss'])
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: error.message }));
    }

    const items = (rows || []).map(function (r) {
      const d = r.detail || {};
      return {
        id: r.id,
        action: r.action,
        button: d.button || String(r.action || '').replace(/^support_contact_/, ''),
        note: d.note || null,
        actor_email: r.actor_email || d.owner_email || null,
        business_name: d.business_name || null,
        site_slug: d.site_slug || null,
        site_id: r.site_id || null,
        created_at: r.created_at
      };
    });

    const counts = { message: 0, call: 0, dismiss: 0, total: items.length };
    items.forEach(function (it) {
      if (counts[it.button] != null) counts[it.button]++;
    });

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, partner_id: partnerId, items: items, counts: counts }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
  }
};
