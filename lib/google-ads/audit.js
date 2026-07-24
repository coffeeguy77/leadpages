'use strict';

/**
 * Audit helper for Ads builder mutations.
 */

async function writeAudit(admin, row) {
  if (!admin) return null;
  try {
    const { data, error } = await admin
      .from('ads_audit_log')
      .insert({
        site_id: row.siteId,
        customer_id: row.customerId || null,
        campaign_id: row.campaignId || null,
        actor_user_id: row.actorUserId || null,
        action: row.action,
        before_json: row.before || null,
        after_json: row.after || null,
        result: row.result || null
      })
      .select('id')
      .maybeSingle();
    if (error) return null;
    return data;
  } catch (_e) {
    return null;
  }
}

module.exports = { writeAudit };
