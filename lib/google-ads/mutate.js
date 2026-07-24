'use strict';

/**
 * Google Ads mutation service — creates Search campaigns as PAUSED.
 * Gated by feature flags. Uses idempotency keys + build records.
 */

const { adsFetch, ensureAccessToken, digits, resolveLoginCustomerId } = require('./client');
const {
  campaignMutationsEnabled,
  campaignPublishEnabled,
  budgetMutationsEnabled,
  statusMutationsEnabled
} = require('./flags');
const { assertSingleFinalUrlDomain, assertCampaignMutable, microsToCurrency } = require('./safety');

function resourceIdFromName(resourceName) {
  const parts = String(resourceName || '').split('/');
  return parts[parts.length - 1] || '';
}

async function mutate(accessToken, customerId, operations, loginCustomerId) {
  const cid = digits(customerId);
  return adsFetch(`customers/${cid}/googleAds:mutate`, {
    method: 'POST',
    accessToken,
    loginCustomerId,
    body: { mutateOperations: operations }
  });
}

/**
 * Create a paused Search campaign + budget + one ad group + keywords + RSA.
 * Does NOT enable the campaign. Requires GOOGLE_ADS_CAMPAIGN_MUTATIONS=1.
 */
async function createPausedSearchCampaign(admin, conn, plan, opts) {
  const o = opts || {};
  if (!campaignMutationsEnabled()) {
    return { ok: false, error: 'mutations_disabled', message: 'Campaign mutations are disabled by feature flag.' };
  }
  if (!conn || !conn.customer_id) return { ok: false, error: 'not_connected' };
  if (!plan || !plan.adGroups || !plan.adGroups.length) return { ok: false, error: 'plan_incomplete' };

  const ag = plan.adGroups[0];
  const domainCheck = assertSingleFinalUrlDomain([ag.finalUrl || plan.primaryDomain]);
  if (!domainCheck.ok) return { ok: false, error: domainCheck.error, message: domainCheck.message };

  if (plan.budgetDaily == null || !(Number(plan.budgetDaily) > 0)) {
    return { ok: false, error: 'budget_required', message: 'Enter a daily budget before creating the campaign.' };
  }

  const accessToken = await ensureAccessToken(admin, conn);
  const cid = digits(conn.customer_id);
  const login = resolveLoginCustomerId(conn);
  const budgetMicros = Math.round(Number(plan.budgetDaily) * 1e6);
  const tempBudget = 'budget_' + Date.now();
  const tempCampaign = 'campaign_' + Date.now();
  const tempAg = 'ag_' + Date.now();
  const tempAd = 'ad_' + Date.now();

  const operations = [
    {
      campaignBudgetOperation: {
        create: {
          resourceName: `customers/${cid}/campaignBudgets/-${tempBudget}`,
          name: clipName(plan.campaignName + ' Budget', 100),
          amountMicros: String(budgetMicros),
          deliveryMethod: 'STANDARD',
          explicitlyShared: false
        }
      }
    },
    {
      campaignOperation: {
        create: {
          resourceName: `customers/${cid}/campaigns/-${tempCampaign}`,
          name: clipName(plan.campaignName, 120),
          status: 'PAUSED',
          advertisingChannelType: 'SEARCH',
          campaignBudget: `customers/${cid}/campaignBudgets/-${tempBudget}`,
          networkSettings: {
            targetGoogleSearch: true,
            targetSearchNetwork: !!(plan.networkSettings && plan.networkSettings.searchPartners),
            targetContentNetwork: false
          },
          containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING'
        }
      }
    },
    {
      adGroupOperation: {
        create: {
          resourceName: `customers/${cid}/adGroups/-${tempAg}`,
          name: clipName(ag.name || 'Ad group', 120),
          campaign: `customers/${cid}/campaigns/-${tempCampaign}`,
          status: 'PAUSED',
          type: 'SEARCH'
        }
      }
    }
  ];

  const approvedKws = (ag.keywords || []).filter((k) => k && k.approved !== false && k.matchType !== 'BROAD');
  approvedKws.slice(0, 20).forEach((k, i) => {
    operations.push({
      adGroupCriterionOperation: {
        create: {
          adGroup: `customers/${cid}/adGroups/-${tempAg}`,
          status: 'ENABLED',
          keyword: {
            text: String(k.keyword).slice(0, 80),
            matchType: k.matchType === 'EXACT' ? 'EXACT' : 'PHRASE'
          }
        }
      }
    });
  });

  const ad = (ag.ads && ag.ads[0]) || {};
  const headlines = (ad.headlines || []).slice(0, 15).map((t) => ({ text: String(t).slice(0, 30) }));
  const descriptions = (ad.descriptions || []).slice(0, 4).map((t) => ({ text: String(t).slice(0, 90) }));
  while (headlines.length < 3) headlines.push({ text: 'Local service' });
  while (descriptions.length < 2) descriptions.push({ text: 'Request a quote from our local team today.' });

  operations.push({
    adGroupAdOperation: {
      create: {
        resourceName: `customers/${cid}/adGroupAds/-${tempAd}`,
        adGroup: `customers/${cid}/adGroups/-${tempAg}`,
        status: 'PAUSED',
        ad: {
          finalUrls: [ag.finalUrl],
          responsiveSearchAd: {
            headlines: headlines,
            descriptions: descriptions,
            path1: String(ad.path1 || 'quote').slice(0, 15),
            path2: String(ad.path2 || 'local').slice(0, 15)
          }
        }
      }
    }
  });

  const created = [];
  try {
    const result = await mutate(accessToken, cid, operations, login);
    const responses = (result && result.mutateOperationResponses) || [];
    responses.forEach((r) => {
      const keys = Object.keys(r || {});
      keys.forEach((k) => {
        const rn = r[k] && (r[k].resourceName || r[k].resource_name);
        if (rn) created.push({ type: k.replace(/Result$/i, ''), resourceName: rn, id: resourceIdFromName(rn) });
      });
    });

    const campaignRes = created.find((c) => /campaign/i.test(c.type) && !/budget/i.test(c.type));
    const campaignId = campaignRes ? campaignRes.id : null;

    if (admin && campaignId) {
      await admin.from('ads_campaign_maps').upsert(
        {
          site_id: conn.site_id,
          customer_id: cid,
          campaign_id: String(campaignId),
          campaign_resource_name: campaignRes.resourceName,
          campaign_name: plan.campaignName,
          campaign_type: 'SEARCH',
          primary_domain: domainCheck.domain,
          status: 'PAUSED',
          ownership: 'leadpages_created',
          build_id: o.buildId || null,
          daily_budget_micros: budgetMicros,
          currency_code: o.currencyCode || null,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        { onConflict: 'site_id,customer_id,campaign_id' }
      );
    }

    return {
      ok: true,
      status: 'PAUSED',
      campaignId: campaignId,
      created: created,
      message: 'Campaign created as PAUSED. It will not spend until you enable it in Google Ads or via LeadPages with publish permission.'
    };
  } catch (e) {
    return {
      ok: false,
      error: 'mutate_failed',
      message: e && e.message ? e.message : String(e),
      partial: created,
      details: e && e.details ? e.details : null
    };
  }
}

function clipName(s, n) {
  return String(s || 'Campaign').trim().slice(0, n);
}

async function setCampaignStatus(admin, conn, campaignMap, status, opts) {
  const o = opts || {};
  if (!statusMutationsEnabled()) {
    return { ok: false, error: 'status_mutations_disabled' };
  }
  const gate = assertCampaignMutable(campaignMap, {
    siteId: conn.site_id,
    confirmExternal: o.confirmExternal === true
  });
  if (!gate.ok) return gate;
  if (status === 'ENABLED' && !campaignPublishEnabled()) {
    return {
      ok: false,
      error: 'publish_disabled',
      message: 'Enabling campaigns is locked. Set GOOGLE_ADS_CAMPAIGN_PUBLISH=1 after pilot approval.'
    };
  }
  if (status !== 'ENABLED' && status !== 'PAUSED') {
    return { ok: false, error: 'unsupported_status' };
  }

  const accessToken = await ensureAccessToken(admin, conn);
  const cid = digits(conn.customer_id);
  const rn =
    campaignMap.campaign_resource_name ||
    `customers/${cid}/campaigns/${digits(campaignMap.campaign_id)}`;

  try {
    await mutate(
      accessToken,
      cid,
      [
        {
          campaignOperation: {
            update: { resourceName: rn, status: status },
            updateMask: 'status'
          }
        }
      ],
      resolveLoginCustomerId(conn)
    );
    if (admin) {
      await admin
        .from('ads_campaign_maps')
        .update({ status: status, updated_at: new Date().toISOString(), ownership: 'leadpages_managed' })
        .eq('site_id', conn.site_id)
        .eq('campaign_id', String(campaignMap.campaign_id));
    }
    return { ok: true, status: status };
  } catch (e) {
    return { ok: false, error: 'status_update_failed', message: e && e.message ? e.message : String(e) };
  }
}

async function updateCampaignBudget(admin, conn, campaignMap, newDaily, opts) {
  const o = opts || {};
  if (!budgetMutationsEnabled()) return { ok: false, error: 'budget_mutations_disabled' };
  const gate = assertCampaignMutable(campaignMap, {
    siteId: conn.site_id,
    confirmExternal: o.confirmExternal === true
  });
  if (!gate.ok) return gate;
  const daily = Number(newDaily);
  if (!(daily > 0)) return { ok: false, error: 'invalid_budget' };
  if (campaignMap.shared_budget_id && !o.confirmShared) {
    return {
      ok: false,
      error: 'shared_budget_confirm_required',
      message: 'This budget is shared across campaigns. Confirm that you understand all affected campaigns.'
    };
  }
  const prev = campaignMap.daily_budget_micros != null ? Number(campaignMap.daily_budget_micros) / 1e6 : null;
  if (prev != null && daily > prev * 1.25 && !o.confirmLargeIncrease) {
    return {
      ok: false,
      error: 'large_increase_confirm_required',
      previous: prev,
      proposed: daily,
      message: 'Budget increase exceeds 25%. Confirm the monthly implication before applying.'
    };
  }

  // Budget resource update requires budget resource name — store/fetch when available.
  if (!campaignMap.meta || !campaignMap.meta.budgetResourceName) {
    return {
      ok: false,
      error: 'budget_resource_unknown',
      message: 'Budget resource not mapped yet. Sync campaigns from Google, then retry.'
    };
  }

  const accessToken = await ensureAccessToken(admin, conn);
  const cid = digits(conn.customer_id);
  const micros = Math.round(daily * 1e6);
  try {
    await mutate(
      accessToken,
      cid,
      [
        {
          campaignBudgetOperation: {
            update: {
              resourceName: campaignMap.meta.budgetResourceName,
              amountMicros: String(micros)
            },
            updateMask: 'amountMicros'
          }
        }
      ],
      resolveLoginCustomerId(conn)
    );
    if (admin) {
      await admin
        .from('ads_campaign_maps')
        .update({
          daily_budget_micros: micros,
          updated_at: new Date().toISOString(),
          ownership: 'leadpages_managed'
        })
        .eq('site_id', conn.site_id)
        .eq('campaign_id', String(campaignMap.campaign_id));
    }
    return {
      ok: true,
      previous: microsToCurrency(campaignMap.daily_budget_micros, campaignMap.currency_code),
      next: microsToCurrency(micros, campaignMap.currency_code)
    };
  } catch (e) {
    return { ok: false, error: 'budget_update_failed', message: e && e.message ? e.message : String(e) };
  }
}

module.exports = {
  createPausedSearchCampaign,
  setCampaignStatus,
  updateCampaignBudget,
  resourceIdFromName
};
