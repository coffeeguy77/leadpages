'use strict';

/**
 * Landing-page ↔ Ads fit analyzer (Quality Score–style guidance).
 * Never invents Google Quality Score numbers — scores relevance factors
 * Ads managers use: keyword↔page match, RSA↔page message match, content depth, CTA.
 */

function clip(s, n) {
  return String(s == null ? '' : s).trim().slice(0, n);
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^a-z0-9\s&/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripMd(s) {
  return String(s || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pageTextBundle(page) {
  const title = clip(page && (page.title || page.seoTitle), 120);
  const h1 = clip(page && page.h1, 120);
  const meta = clip(page && (page.meta || page.metaDescription), 200);
  const body = stripMd(page && page.body);
  const primary = clip(page && page.primaryKeyword, 80);
  const hay = norm([title, h1, meta, body, primary].join(' '));
  const words = hay.split(/\s+/).filter(Boolean);
  return {
    title,
    h1,
    meta,
    body,
    primary,
    hay,
    wordCount: words.length,
    bodyLen: body.length
  };
}

function keywordOnPage(kw, bundle) {
  const k = norm(kw);
  if (!k || k.length < 2) return { inTitle: false, inH1: false, inMeta: false, inBody: false, score: 0 };
  const inTitle = norm(bundle.title).indexOf(k) >= 0;
  const inH1 = norm(bundle.h1).indexOf(k) >= 0;
  const inMeta = norm(bundle.meta).indexOf(k) >= 0;
  const inBody = norm(bundle.body).indexOf(k) >= 0;
  // Soft: all significant tokens present
  const tokens = k.split(/\s+/).filter((t) => t.length > 2);
  let tokenHits = 0;
  tokens.forEach((t) => {
    if (bundle.hay.indexOf(t) >= 0) tokenHits++;
  });
  const soft = tokens.length ? tokenHits / tokens.length : 0;
  let score = 0;
  if (inTitle) score += 35;
  if (inH1) score += 30;
  if (inMeta) score += 15;
  if (inBody) score += 20;
  else if (soft >= 0.7) score += 10;
  return { inTitle, inH1, inMeta, inBody, soft: Math.round(soft * 100), score: Math.min(100, score) };
}

function hasCta(bundle) {
  return /\b(call|quote|book|enquire|inquire|contact|get a quote|request|hire|order|buy|shop)\b/i.test(
    bundle.title + ' ' + bundle.h1 + ' ' + bundle.meta + ' ' + bundle.body.slice(0, 800)
  );
}

/**
 * Suggest improved page fields from keywords + existing content.
 */
function buildPageFixes(page, keywords, bundle) {
  const topKw =
    (keywords || [])
      .filter((k) => k && k.approved !== false)
      .map((k) => String(k.keyword || k).trim())
      .filter(Boolean)[0] ||
    bundle.primary ||
    bundle.title ||
    'local service';
  const brandBit = clip(bundle.title.split('|')[0] || bundle.title, 40);
  const fixes = [];

  if (!bundle.h1 || norm(bundle.h1).indexOf(norm(topKw).split(/\s+/)[0] || '') < 0) {
    fixes.push({
      id: 'h1',
      field: 'h1',
      severity: 'high',
      label: 'Rewrite H1 to include primary keyword',
      reason: 'Google rewards clear keyword–headline match; better message match usually means lower CPC.',
      current: bundle.h1 || '(missing)',
      suggested: clip(topKw.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 70), 70)
    });
  }
  if (!bundle.meta || bundle.meta.length < 50 || norm(bundle.meta).indexOf(norm(topKw).split(/\s+/).slice(0, 2).join(' ')) < 0) {
    fixes.push({
      id: 'meta',
      field: 'meta',
      severity: 'medium',
      label: 'Write meta description with offer + keyword',
      reason: 'Meta is not a direct Ads signal but aligns page message with ad copy and improves organic CTR.',
      current: bundle.meta || '(missing)',
      suggested: clip(
        'Hire ' + topKw + ' with ' + (brandBit || 'our team') + '. Fast quotes, reliable service — book today.',
        155
      )
    });
  }
  if (bundle.wordCount < 180) {
    const intro =
      'Looking for ' +
      topKw +
      '? We deliver a professional, reliable experience for local customers. ' +
      'Request a quote today and we will confirm availability, pricing and setup details.';
    fixes.push({
      id: 'intro',
      field: 'body',
      mode: 'prepend',
      severity: 'high',
      label: 'Add keyword-rich intro (thin page)',
      reason: 'Thin landing pages hurt expected CTR and landing experience — richer, relevant copy supports cheaper clicks.',
      current: bundle.wordCount + ' words',
      suggested: intro
    });
  }
  if (!hasCta(bundle)) {
    fixes.push({
      id: 'cta',
      field: 'body',
      mode: 'append',
      severity: 'medium',
      label: 'Add a clear call to action',
      reason: 'Ads that promise a quote/call need a matching CTA on the page.',
      current: '(no clear CTA found)',
      suggested: '\n\n## Get a quote\nCall us or submit the form on this page for a fast, no-obligation quote.'
    });
  }
  if (bundle.title && norm(bundle.title).indexOf(norm(topKw).split(/\s+/)[0] || '___') < 0) {
    fixes.push({
      id: 'title',
      field: 'title',
      severity: 'medium',
      label: 'Align page title with primary keyword',
      reason: 'Title is a strong relevance signal for both Ads and SEO.',
      current: bundle.title,
      suggested: clip(topKw.replace(/\b\w/g, (c) => c.toUpperCase()) + (brandBit ? ' | ' + brandBit : ''), 70)
    });
  }
  return fixes;
}

/**
 * Suggest RSA headlines/descriptions grounded in the landing page.
 */
function suggestRsaFromPage(page, keywords, geo, brand) {
  const bundle = pageTextBundle(page);
  const kws = (keywords || [])
    .filter((k) => k && k.approved !== false)
    .map((k) => clip(k.keyword || k, 30))
    .filter(Boolean)
    .slice(0, 8);
  const primary = kws[0] || bundle.primary || clip(bundle.h1 || bundle.title, 30);
  const g = clip(geo, 20);
  const b = clip(brand, 20);
  const headlines = [];
  function addH(t) {
    const x = clip(t, 30);
    if (x && headlines.indexOf(x) < 0) headlines.push(x);
  }
  addH(primary);
  if (g) addH(clip(primary + ' ' + g, 30));
  if (b) addH(clip(b + ' | ' + primary, 30));
  addH(clip('Book ' + primary, 30));
  addH('Get a Fast Quote');
  addH(clip(bundle.h1, 30) || 'Trusted Local Service');
  addH(clip('Call Today — ' + (g || b || 'Local'), 30));
  addH('Reliable & On Time');
  while (headlines.length < 8) addH(('Local service ' + (headlines.length + 1)).slice(0, 30));

  const descriptions = [
    clip(
      (bundle.meta ||
        'Need ' + primary + (g ? ' in ' + g : '') + '? ' + (b || 'Our team') + ' makes booking simple. Request a quote today.') ,
      90
    ),
    clip(
      'Clear pricing, local expertise' + (g ? ' across ' + g : '') + '. Talk to ' + (b || 'us') + ' about ' + primary + '.',
      90
    ),
    clip('From enquiry to on-site — we handle the detail so your event or job runs smoothly.', 90)
  ].filter(Boolean);

  const path1 = clip((bundle.slug || 'quote').replace(/[^a-z0-9-]/gi, '').slice(0, 15), 15) || 'quote';
  const path2 = clip(norm(g).replace(/\s+/g, '').slice(0, 15), 15) || 'local';

  return {
    headlines: headlines.slice(0, 15),
    descriptions: descriptions.slice(0, 4),
    path1,
    path2,
    finalUrlHint: null,
    notes: 'Generated from landing page + selected keywords (not invented CPC/volume).',
    provenance: { source: 'page_fit', edited: false }
  };
}

/**
 * Full analysis for a page + optional plan keywords/RSA.
 */
function analyzePageFit(page, planOrOpts) {
  const opts = planOrOpts || {};
  const plan = opts.adGroups ? opts : opts.plan || null;
  const ag = plan && plan.adGroups && plan.adGroups[0] ? plan.adGroups[0] : null;
  const keywords = (opts.keywords || (ag && ag.keywords) || []).slice(0, 30);
  const rsa = opts.rsa || (ag && ag.ads && ag.ads[0]) || null;
  const bundle = pageTextBundle(page || {});

  const issues = [];
  if (!page || !page.id) {
    return {
      ok: false,
      score: 0,
      grade: 'F',
      issues: [{ id: 'no_page', severity: 'critical', label: 'Select a published landing page', detail: 'Campaigns need a real page URL.' }],
      keywordScores: [],
      fixes: [],
      rsaHints: [],
      summary: 'No landing page selected.'
    };
  }
  if (!bundle.h1) {
    issues.push({ id: 'missing_h1', severity: 'high', label: 'Missing H1', detail: 'Add a clear headline that matches your primary keyword.' });
  }
  if (!bundle.meta || bundle.meta.length < 40) {
    issues.push({ id: 'thin_meta', severity: 'medium', label: 'Weak meta description', detail: 'Write 50–155 characters including the offer and location.' });
  }
  if (bundle.wordCount < 120) {
    issues.push({
      id: 'thin_content',
      severity: 'high',
      label: 'Thin landing page (' + bundle.wordCount + ' words)',
      detail: 'Richer, relevant content usually improves Quality Score factors and can lower CPC.'
    });
  } else if (bundle.wordCount < 250) {
    issues.push({
      id: 'short_content',
      severity: 'low',
      label: 'Short page (' + bundle.wordCount + ' words)',
      detail: 'Aim for 250+ useful words covering the offer, area, and CTA.'
    });
  }
  if (!hasCta(bundle)) {
    issues.push({ id: 'no_cta', severity: 'medium', label: 'No clear call to action', detail: 'Match ad promises (quote / call / book) on the page.' });
  }

  const keywordScores = keywords.map((k) => {
    const text = String((k && k.keyword) || k || '');
    const hit = keywordOnPage(text, bundle);
    let verdict = 'strong';
    if (hit.score < 40) verdict = 'weak';
    else if (hit.score < 70) verdict = 'ok';
    if (hit.score < 40) {
      issues.push({
        id: 'kw_' + norm(text).slice(0, 24),
        severity: hit.score < 20 ? 'high' : 'medium',
        label: 'Keyword weak on page: “' + text + '”',
        detail: 'Put this phrase (or close variant) in H1/title and body. Better match → better expected CTR.'
      });
    }
    return {
      keyword: text,
      matchType: (k && k.matchType) || null,
      approved: k && k.approved !== false,
      ...hit,
      verdict
    };
  });

  const rsaHints = [];
  if (rsa && Array.isArray(rsa.headlines)) {
    let matched = 0;
    rsa.headlines.slice(0, 15).forEach((h) => {
      const n = norm(h);
      const onPage = n && (bundle.hay.indexOf(n) >= 0 || n.split(/\s+/).filter((t) => t.length > 3 && bundle.hay.indexOf(t) >= 0).length >= 2);
      if (onPage) matched++;
      else if (n) {
        rsaHints.push({
          type: 'headline_mismatch',
          text: h,
          detail: 'Headline not reflected on the landing page — rewrite the page or the ad so they match.'
        });
      }
    });
    if (rsa.headlines.length && matched / Math.min(rsa.headlines.length, 8) < 0.35) {
      issues.push({
        id: 'rsa_mismatch',
        severity: 'high',
        label: 'Ad copy poorly matches the page',
        detail: 'Only ' + matched + ' headlines align with page content. Mismatch hurts Ad Strength and Quality Score.'
      });
    }
  }

  const kwAvg =
    keywordScores.length > 0
      ? keywordScores.reduce((s, r) => s + r.score, 0) / keywordScores.length
      : bundle.wordCount > 200
        ? 50
        : 30;
  const depthScore = Math.min(100, Math.round((bundle.wordCount / 350) * 100));
  const structureScore = (bundle.h1 ? 25 : 0) + (bundle.meta && bundle.meta.length >= 50 ? 25 : 0) + (hasCta(bundle) ? 25 : 0) + (bundle.title ? 25 : 0);
  const score = Math.round(kwAvg * 0.5 + depthScore * 0.25 + structureScore * 0.25);
  let grade = 'F';
  if (score >= 85) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 55) grade = 'C';
  else if (score >= 40) grade = 'D';

  const fixes = buildPageFixes(page, keywords, bundle);
  const summary =
    score >= 70
      ? 'Page is in good shape for Ads — minor polish only.'
      : score >= 50
        ? 'Usable, but fix the items below before spending — better relevance usually means cheaper clicks.'
        : 'Not ready for paid traffic — apply fixes (or Ask LeadPages to fix) before creating the campaign.';

  return {
    ok: true,
    score,
    grade,
    summary,
    pageId: page.id || null,
    pageTitle: bundle.title || page.title || null,
    slug: page.slug || null,
    metrics: {
      wordCount: bundle.wordCount,
      hasH1: !!bundle.h1,
      hasMeta: !!(bundle.meta && bundle.meta.length >= 40),
      hasCta: hasCta(bundle)
    },
    issues,
    keywordScores,
    rsaHints: rsaHints.slice(0, 8),
    fixes,
    suggestedRsa: suggestRsaFromPage(page, keywords, opts.geo || null, opts.brand || null)
  };
}

/**
 * Apply selected fixes onto a page object (mutates a copy).
 * @param {object} page
 * @param {string[]} fixIds
 * @param {object} [ctx] — { plan, keywords, geo, brand } for keyword-aware suggestions
 */
function applyFixesToPage(page, fixIds, ctx) {
  const ids = Array.isArray(fixIds) ? fixIds : [];
  const analysis = analyzePageFit(page, ctx || {});
  const next = Object.assign({}, page);
  const applied = [];
  analysis.fixes.forEach((fix) => {
    if (ids.length && ids.indexOf(fix.id) < 0) return;
    if (fix.field === 'body' && fix.mode === 'prepend') {
      next.body = clip(fix.suggested + '\n\n' + (next.body || ''), 20000);
      applied.push(fix.id);
    } else if (fix.field === 'body' && fix.mode === 'append') {
      next.body = clip((next.body || '') + fix.suggested, 20000);
      applied.push(fix.id);
    } else if (fix.field && fix.suggested != null) {
      next[fix.field] = fix.suggested;
      applied.push(fix.id);
    }
  });
  return { page: next, applied, analysis: analyzePageFit(next, ctx || {}) };
}

/**
 * Extra keyword ideas from page H1/title/body (deterministic).
 */
function keywordsFromPage(page, geo, brand) {
  const bundle = pageTextBundle(page);
  const out = [];
  function add(kw, intent, matchType, why) {
    const t = clip(kw, 80).toLowerCase();
    if (!t || out.some((x) => x.keyword === t)) return;
    out.push({
      keyword: t,
      intent: intent,
      matchType: matchType,
      approved: matchType !== 'BROAD',
      why: why
    });
  }
  const g = clip(geo, 40).toLowerCase();
  const seed = bundle.primary || bundle.h1 || bundle.title;
  if (seed) {
    add(seed, 'commercial', 'PHRASE', 'From landing page H1/title');
    if (g && norm(seed).indexOf(norm(g)) < 0) add(seed + ' ' + g, 'commercial', 'PHRASE', 'Page offer + geo');
    add(seed, 'commercial', 'EXACT', 'Exact from page');
  }
  // Pull noun-ish phrases from first body sentence
  const first = bundle.body.split(/[.!?]/)[0] || '';
  const m = first.match(/\b([a-z][a-z]+(?:\s+[a-z][a-z]+){1,3})\b/i);
  if (m && m[1] && norm(m[1]).length > 8) {
    add(m[1], 'commercial', 'PHRASE', 'Phrase from page intro');
  }
  if (brand) add(String(brand).toLowerCase(), 'brand', 'EXACT', 'Brand term');
  return out;
}

module.exports = {
  pageTextBundle,
  keywordOnPage,
  analyzePageFit,
  suggestRsaFromPage,
  applyFixesToPage,
  keywordsFromPage,
  buildPageFixes
};
