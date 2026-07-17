'use strict';

/**
 * Marketing Hub — campaign plans + RSA copy (suggest only; no Ads mutate).
 */

const ADS_CAMPAIGN_PLAN_SCHEMA = {
  type: 'object',
  required: ['campaignName', 'objective', 'geoFocus', 'budgetNotes', 'adGroups', 'keywords', 'negatives', 'landingPageHints'],
  properties: {
    campaignName: { type: 'string' },
    objective: { type: 'string' },
    geoFocus: { type: 'string' },
    budgetNotes: { type: 'string' },
    adGroups: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'theme'],
        properties: {
          name: { type: 'string' },
          theme: { type: 'string' }
        }
      }
    },
    keywords: { type: 'array', items: { type: 'string' } },
    negatives: { type: 'array', items: { type: 'string' } },
    landingPageHints: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' }
  }
};

const ADS_RSA_COPY_SCHEMA = {
  type: 'object',
  required: ['headlines', 'descriptions', 'path1', 'path2'],
  properties: {
    headlines: { type: 'array', items: { type: 'string' } },
    descriptions: { type: 'array', items: { type: 'string' } },
    path1: { type: 'string' },
    path2: { type: 'string' },
    finalUrlHint: { type: 'string' },
    notes: { type: 'string' }
  }
};

function clip(s, max) {
  return String(s == null ? '' : s).trim().slice(0, max);
}

function clipList(arr, maxItems, maxLen) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => clip(x, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

/**
 * @param {unknown} raw
 */
function normalizeCampaignPlan(raw) {
  const o = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
  const groups = Array.isArray(o.adGroups) ? o.adGroups : [];
  return {
    campaignName: clip(o.campaignName, 90) || 'LeadPages local leads',
    objective: clip(o.objective, 200) || 'Drive calls and quote requests',
    geoFocus: clip(o.geoFocus, 120) || 'Local service area',
    budgetNotes: clip(o.budgetNotes, 400),
    adGroups: groups.slice(0, 8).map((g) => {
      const row = g && typeof g === 'object' ? g : {};
      return {
        name: clip(row.name, 60) || 'Ad group',
        theme: clip(row.theme, 160) || ''
      };
    }),
    keywords: clipList(o.keywords, 40, 80),
    negatives: clipList(o.negatives, 40, 80),
    landingPageHints: clipList(o.landingPageHints, 12, 120),
    notes: clip(o.notes, 600)
  };
}

/**
 * Google RSA limits: headlines ≤30, descriptions ≤90, path ≤15.
 * @param {unknown} raw
 */
function normalizeRsaCopy(raw) {
  const o = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
  let headlines = clipList(o.headlines, 15, 30);
  let descriptions = clipList(o.descriptions, 4, 90);
  while (headlines.length < 3) headlines.push(('Local service ' + (headlines.length + 1)).slice(0, 30));
  while (descriptions.length < 2) {
    descriptions.push('Call today for a free quote from a trusted local team.'.slice(0, 90));
  }
  return {
    headlines,
    descriptions,
    path1: clip(o.path1, 15) || 'quote',
    path2: clip(o.path2, 15) || 'local',
    finalUrlHint: clip(o.finalUrlHint, 200),
    notes: clip(o.notes, 400)
  };
}

/**
 * Build a redacted ads summary for prompts (never tokens).
 * @param {object|null} conn — google_ads_connections row
 * @param {object} [metrics]
 */
function buildAdsSummary(conn, metrics) {
  const m = metrics || {};
  return {
    connected: !!(conn && (conn.customer_id || conn.refresh_token_enc || conn.status === 'connected')),
    customerId: conn && conn.customer_id ? String(conn.customer_id).replace(/.(?=.{4})/g, '•') : null,
    accountName: (conn && (conn.account_name || conn.descriptive_name)) || null,
    status: (conn && conn.status) || (conn ? 'linked' : 'disconnected'),
    lastSyncAt: (conn && (conn.last_sync_at || conn.updated_at)) || null,
    metrics30d: {
      spendAud: m.spendAud != null ? Number(m.spendAud) : null,
      clicks: m.clicks != null ? Number(m.clicks) : null,
      impressions: m.impressions != null ? Number(m.impressions) : null,
      conversions: m.conversions != null ? Number(m.conversions) : null
    }
  };
}

module.exports = {
  ADS_CAMPAIGN_PLAN_SCHEMA,
  ADS_RSA_COPY_SCHEMA,
  normalizeCampaignPlan,
  normalizeRsaCopy,
  buildAdsSummary
};
