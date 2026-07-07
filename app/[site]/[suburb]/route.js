// app/[site]/[suburb]/route.js
// Server-rendered, localized landing page per suburb, e.g. /joes-plumbing/belconnen
//
// Builds on the Local SEO token layer: resolves {trade}/{suburb}/{business}/... server-side,
// gives each suburb a unique AI intro, sets a localized <title>/description/canonical, and
// 404s for any suburb NOT in the site's Service Areas (so this can't become a doorway-page
// generator for places the tradie doesn't actually serve).

import { getSiteConfig } from '../../../lib/seo/store.js';
import { findSuburb, buildTokens, mergeStr, deepMergeConfig, slugify } from '../../../lib/seo/tokens.js';
import { getOrCreateIntro } from '../../../lib/seo/suburbIntro.js';
import { loadTemplate, applyTenantTokens, applySeoHead, applyHero, injectBootstrap } from '../../../lib/seo/template.js';

export const dynamic = 'force-dynamic'; // we cache at the CDN via Cache-Control below

function notFound() {
  return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
}

export async function GET(request, ctx) {
  const params = await ctx.params;
  const site = params.site;
  const suburbSlug = params.suburb;

  const config = await getSiteConfig(site);
  if (!config) return notFound();

  // Only generate pages for REAL service areas.
  const suburb = findSuburb(config, suburbSlug);
  if (!suburb) return notFound();

  const url = new URL(request.url);
  const host = url.host;
  const origin = url.origin;

  const tok = buildTokens(config, suburb);
  const intro = await getOrCreateIntro(site, suburb, tok);
  const se = (config.sections && config.sections.seoTokens) || {};

  const title =
    (mergeStr(se.titleTemplate || '{trade} in {suburb} | {business}', tok)
      .replace(/\s*\|\s*$/, '')
      .replace(/^\s*\|\s*/, '')
      .replace(/\s{2,}/g, ' ')
      .trim()) || (suburb + (tok.business ? ' | ' + tok.business : ''));

  const description = (se.metaTemplate
    ? mergeStr(se.metaTemplate, tok)
    : (tok.trade ? tok.trade + ' ' : '') +
      'servicing ' + suburb + (tok.region ? ', ' + tok.region : '') + '. ' +
      (tok.business || '') + ' \u2014 licensed, fast, upfront pricing.' +
      (tok.phone ? ' Call ' + tok.phone + '.' : '')
  ).replace(/\s{2,}/g, ' ').trim();

  const canonical = origin + '/' + site + '/' + slugify(suburb);

  // Merged config for hydration; the unique intro becomes the hero subheading.
  const merged = deepMergeConfig(config, tok);
  merged.sections = merged.sections || {};
  merged.sections.hero = merged.sections.hero || {};
  merged.sections.hero.sub = intro;

  let html = await loadTemplate();
  html = applyTenantTokens(html, tok, host);
  const _gsvMethod = (config.googleVerificationMethod || 'meta');
  const _gsvToken = (config.googleSiteVerification || '').trim();
  html = applySeoHead(html, {
    title,
    description,
    canonical,
    robots: 'index,follow',
    googleVerification: (_gsvMethod === 'meta' && _gsvToken) ? _gsvToken : undefined,
  });
  html = applyHero(html, {
    title: merged.sections.hero.title || '',
    titleHl: merged.sections.hero.titleHl || '',
    intro,
  });
  html = injectBootstrap(html, merged);

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, s-maxage=86400, stale-while-revalidate=43200',
    },
  });
}
