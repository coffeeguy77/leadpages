'use strict';

/**
 * Deterministic ads recommendations + plain-language copy.
 * Never auto-applies spend changes.
 */

function rec(code, title, plain, evidence, opts) {
  const o = opts || {};
  return {
    code: code,
    title: title,
    plainLanguage: plain,
    evidence: evidence || {},
    dateRange: o.dateRange || 'last_30_days',
    expectedEffect: o.expectedEffect || '',
    confidence: o.confidence || 'medium',
    proposedChange: o.proposedChange || {},
    affectsSpend: !!o.affectsSpend,
    status: 'open'
  };
}

/**
 * @param {{ campaigns?: array, stats?: object, readiness?: object }} input
 */
function buildRecommendations(input) {
  const campaigns = (input && input.campaigns) || [];
  const stats = (input && input.stats) || {};
  const readiness = input && input.readiness;
  const out = [];

  campaigns.forEach((c) => {
    const spend = Number(c.spend || 0);
    const conversions = Number(c.conversions || c.uniqueConversions || 0);
    if (spend > 20 && conversions === 0) {
      out.push(
        rec(
          'spend_no_conversions',
          'Spend without tracked conversions',
          c.campaignName +
            ' has spent money but LeadPages has not recorded conversions. Check form/call tracking and conversion actions before raising budget.',
          { campaignId: c.campaignId, spend: spend, conversions: conversions },
          {
            affectsSpend: false,
            expectedEffect: 'Avoid wasted spend; fix tracking first',
            proposedChange: { type: 'review_tracking', campaignId: c.campaignId }
          }
        )
      );
    }
    if (String(c.status || '').toUpperCase() === 'PAUSED') {
      out.push(
        rec(
          'campaign_paused',
          'Campaign is paused',
          c.campaignName + ' is paused and will not spend until you resume it with confirmation.',
          { campaignId: c.campaignId, status: c.status },
          { affectsSpend: true, proposedChange: { type: 'resume', campaignId: c.campaignId } }
        )
      );
    }
  });

  if (Number(stats.lead_submit || 0) > 0 && Number(stats.call_click || 0) === 0) {
    out.push(
      rec(
        'forms_ok_calls_quiet',
        'Forms work; calls are quiet',
        'Form submissions are arriving but few call clicks are recorded. Confirm phone CTAs are visible on mobile.',
        { forms: stats.lead_submit, calls: stats.call_click },
        { expectedEffect: 'Capture phone-intent traffic' }
      )
    );
  }

  if (readiness && readiness.overall === 'fail') {
    out.push(
      rec(
        'readiness_fail',
        'Tracking readiness failed',
        readiness.message || 'Fix critical tracking checks before enabling ads.',
        { overall: readiness.overall },
        { confidence: 'high', proposedChange: { type: 'open_readiness' } }
      )
    );
  }

  return out;
}

module.exports = { buildRecommendations, rec };
