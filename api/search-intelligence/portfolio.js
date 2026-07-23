'use strict';

/**
 * GET /api/search-intelligence/portfolio
 * Partner (or super) portfolio of sites with Search Intelligence health.
 */

const http = require('../../lib/brain/http');
const { createClient } = require('@supabase/supabase-js');
const { loadPartnerPortfolio } = require('../../lib/search-intelligence/portfolio');

function admin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') return http.json(res, 405, { error: 'method_not_allowed' });
    const user = await http.requireUser(req);
    if (!user) return http.json(res, 401, { error: 'unauthorized' });

    const db = admin();
    if (!db) return http.json(res, 503, { error: 'database_unavailable' });

    const q = req.query || {};
    const superOk = await http.isSuperAdmin(user.id);
    const ownPartnerId = await http.partnerIdForUser(user.id);

    let partnerId = null;
    if (superOk && (q.partnerId || q.partner_id)) {
      partnerId = String(q.partnerId || q.partner_id).trim();
    } else if (ownPartnerId) {
      partnerId = ownPartnerId;
    } else if (superOk) {
      return http.json(res, 200, {
        ok: true,
        role: 'super',
        partnerId: null,
        summary: { total: 0, good: 0, partial: 0, needsSetup: 0 },
        sites: [],
        hint: 'Pass partnerId= to inspect a partner portfolio.'
      });
    } else {
      return http.json(res, 403, {
        error: 'partner_required',
        message: 'Portfolio is available to partners (and super admins).'
      });
    }

    const portfolio = await loadPartnerPortfolio(db, partnerId);
    portfolio.role = superOk ? 'super' : 'partner';
    return http.json(res, 200, portfolio);
  } catch (e) {
    return http.json(res, 500, {
      error: 'server_error',
      message: String((e && e.message) || e)
    });
  }
};
