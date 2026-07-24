'use strict';

/**
 * Sync campaign configuration into ads_campaign_maps (read-only enrichment).
 */

const { ensureAccessToken, searchStream, digits, resolveLoginCustomerId } = require('./client');

async function syncCampaignMaps(admin, conn) {
  if (!admin || !conn || !conn.customer_id || !conn.site_id) {
    return { ok: false, error: 'not_connected' };
  }
  const accessToken = await ensureAccessToken(admin, conn);
  const cid = digits(conn.customer_id);
  const login = resolveLoginCustomerId(conn);
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign_budget.amount_micros,
      campaign_budget.explicitly_shared,
      campaign_budget.resource_name
    FROM campaign
    WHERE campaign.status != 'REMOVED'
  `;
  const rows = await searchStream(accessToken, cid, query, login);
  const domain = String(conn.slug || '').trim();
  let upserted = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const camp = r.campaign || {};
    const budget = r.campaignBudget || r.campaign_budget || {};
    const campaignId = String(camp.id || '');
    if (!campaignId) continue;
    const { data: existing } = await admin
      .from('ads_campaign_maps')
      .select('ownership')
      .eq('site_id', conn.site_id)
      .eq('customer_id', cid)
      .eq('campaign_id', campaignId)
      .maybeSingle();
    const ownership = existing && existing.ownership ? existing.ownership : 'imported';
    await admin.from('ads_campaign_maps').upsert(
      {
        site_id: conn.site_id,
        customer_id: cid,
        campaign_id: campaignId,
        campaign_resource_name: 'customers/' + cid + '/campaigns/' + campaignId,
        campaign_name: camp.name || campaignId,
        campaign_type: camp.advertisingChannelType || camp.advertising_channel_type || 'SEARCH',
        status: camp.status || null,
        ownership: ownership,
        daily_budget_micros: budget.amountMicros != null ? Number(budget.amountMicros) : null,
        shared_budget_id: budget.explicitlyShared || budget.explicitly_shared ? budget.resourceName || budget.resource_name : null,
        meta: {
          budgetResourceName: budget.resourceName || budget.resource_name || null
        },
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      { onConflict: 'site_id,customer_id,campaign_id' }
    );
    upserted++;
  }

  await admin.from('ads_sync_state').upsert(
    {
      site_id: conn.site_id,
      customer_id: cid,
      last_config_sync_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'site_id,customer_id' }
  );

  return { ok: true, upserted: upserted, domainHint: domain };
}

module.exports = { syncCampaignMaps };
