'use strict';

/**
 * Page Optimiser — modelled on-page brief from a keyword cluster.
 * Never publishes; drafts only (human approve via editor or Brain landing draft).
 */

const { suggestInternalLinks } = require('./internal-links');

function titleCase(s) {
  return String(s || '')
    .split(/\s+/)
    .filter(Boolean)
    .map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

function truncate(s, n) {
  const t = String(s || '').trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1).trim() + '…';
}

/**
 * @param {object} site — sites row with config
 * @param {object} cluster — cluster shape from clusters.js
 * @param {{ pageUrl?: string }} [opts]
 */
function buildPageBrief(site, cluster, opts) {
  const o = opts || {};
  const cfg = (site && site.config) || {};
  const business = (site && site.business_name) || cfg.name || 'Your business';
  const region = cluster.location || cfg.region || 'your area';
  const primary = cluster.primaryKeyword || cluster.head || 'service';
  const secondary = cluster.secondaryKeywords || [];
  const phone = cfg.phoneText || cfg.phone || '';

  const h1 = titleCase(primary);
  const title = truncate(business + ' | ' + h1 + (region ? ' in ' + titleCase(region) : ''), 60);
  const meta = truncate(
    'Need ' +
      primary +
      (region ? ' in ' + region : '') +
      '? ' +
      business +
      ' helps local customers with clear pricing and fast response.' +
      (phone ? ' Call ' + phone + '.' : ''),
    155
  );

  const outline = [
    { heading: h1, purpose: 'Match search intent; confirm service + area in first screen.' },
    { heading: 'What we offer', purpose: 'List relevant services; avoid unrelated keywords.' },
    { heading: 'Why choose ' + business, purpose: 'Proof, licences, response time — no invented claims.' },
    { heading: 'Areas we serve', purpose: 'Mention ' + titleCase(region) + ' and nearby suburbs you actually cover.' },
    { heading: 'Common questions', purpose: 'FAQ for price, timing, and what to prepare.' },
    { heading: 'Get a quote', purpose: 'Primary CTA — form or call.' }
  ];

  const internalLinks = suggestInternalLinks(site, {
    primaryKeyword: primary,
    secondaryKeywords: secondary,
    location: region
  });

  const outlineLines = outline
    .map(function (row, i) {
      return i + 1 + '. ' + row.heading + ' — ' + row.purpose;
    })
    .join('\n');

  const linkLines = internalLinks
    .map(function (l) {
      return '- ' + l.label + ' (' + l.url + '): ' + l.reason;
    })
    .join('\n');

  const briefText =
    'Write a local service landing page for "' +
    primary +
    '"' +
    (region ? ' targeting ' + region : '') +
    '. Business: ' +
    business +
    '. Secondary terms: ' +
    (secondary.length ? secondary.join(', ') : 'none') +
    '. Do not invent certifications or suburbs. Include a clear quote CTA.\n\nSuggested outline:\n' +
    outlineLines +
    (linkLines ? '\n\nInternal links to consider:\n' + linkLines : '');

  const extraInfo =
    'Suggested title: ' +
    title +
    '\nSuggested H1: ' +
    h1 +
    '\nSuggested meta: ' +
    meta +
    (secondary.length ? '\nSecondary keywords: ' + secondary.join(', ') : '') +
    '\nFollow the outline and internal-link notes in the brief. Human will approve before publish.';

  return {
    ok: true,
    siteId: site && site.id,
    clusterId: cluster.id || null,
    clusterName: cluster.name || null,
    pageUrl: o.pageUrl || null,
    primaryKeyword: primary,
    secondaryKeywords: secondary,
    location: region,
    suggestedTitle: title,
    suggestedMeta: meta,
    suggestedH1: h1,
    outline: outline,
    internalLinks: internalLinks,
    cta: {
      label: 'Get a quote',
      phone: phone || null,
      editorSection: 'quote'
    },
    editorHints: {
      section: 'seoTokens',
      fields: ['seoTitle', 'seoDescription', 'h1']
    },
    landingDraftHandoff: {
      mode: 'seo',
      primaryKeyword: primary,
      location: typeof region === 'string' ? titleCase(region) : region,
      brief: briefText,
      extraInfo: extraInfo,
      negativeKeywords: [],
      secondaryKeywords: secondary,
      clusterId: cluster.id || null,
      suggestedTitle: title,
      suggestedMeta: meta,
      suggestedH1: h1
    },
    safeguards: {
      publishAllowed: false,
      autoFixAllowed: false,
      requiresHumanApproval: true,
      note: 'Brief only — apply in editor or Compose with Brain; never silent publish.'
    },
    labelClass: 'modelled',
    generatedAt: new Date().toISOString()
  };
}

async function recordBriefAnnotation(admin, siteId, brief, extra) {
  if (!admin || !siteId || !brief) return { ok: false };
  const x = extra || {};
  try {
    const { data, error } = await admin
      .from('si_annotations')
      .insert({
        site_id: siteId,
        annotation_type: x.annotationType || 'page_optimiser_brief',
        title: x.title || 'Page Optimiser brief — ' + (brief.primaryKeyword || 'keyword'),
        detail: {
          clusterId: brief.clusterId,
          primaryKeyword: brief.primaryKeyword,
          suggestedTitle: brief.suggestedTitle,
          labelClass: brief.labelClass,
          handoff: x.handoff || null
        },
        occurred_at: new Date().toISOString()
      })
      .select('id')
      .single();
    if (error) {
      if (/relation|does not exist/i.test(String(error.message || ''))) {
        return { ok: false, skipped: 'schema_pending' };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

module.exports = {
  buildPageBrief: buildPageBrief,
  recordBriefAnnotation: recordBriefAnnotation
};
