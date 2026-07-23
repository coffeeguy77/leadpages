'use strict';

/**
 * First ten Next Best Action recipes — metadata only.
 * See docs/search-intelligence/06-RECOMMENDATION-RECIPES.md
 */

const RECIPES = Object.freeze([
  {
    id: 'high_impr_low_ctr',
    title: 'High impressions, low CTR',
    phase: 1,
    severityDefault: 'high',
    inputs: ['gsc.query_page', 'si_pages'],
    actions: ['open_editor_seo', 'preview', 'create_task'],
    autoFixAllowed: false,
    impactDimensions: ['ctr', 'clicks'],
    plainLanguage: 'Google shows your page often, but few people click. Stronger titles and descriptions usually help.'
  },
  {
    id: 'pos_4_20_relevance',
    title: 'Position 4–20 with strong relevance',
    phase: 1,
    severityDefault: 'high',
    inputs: ['si_rank_observations', 'si_pages'],
    actions: ['open_editor_seo', 'page_optimiser', 'create_task'],
    autoFixAllowed: false,
    impactDimensions: ['rank', 'clicks'],
    plainLanguage: 'You are close to page-one visibility for a service you offer. Improving the page can move you up.'
  },
  {
    id: 'keyword_no_page',
    title: 'Valuable keyword with no page',
    phase: 1,
    severityDefault: 'high',
    inputs: ['provider.keywordIdeas', 'si_pages'],
    actions: ['create_landing_draft', 'page_optimiser', 'create_task'],
    autoFixAllowed: false,
    impactDimensions: ['demand', 'leads'],
    plainLanguage: 'People search for this, but you have no matching page yet.'
  },
  {
    id: 'location_service_gap',
    title: 'Location / service gap',
    phase: 1,
    severityDefault: 'medium',
    inputs: ['provider.keywordIdeas', 'service_areas'],
    actions: ['create_landing_draft', 'page_optimiser', 'create_task'],
    autoFixAllowed: false,
    impactDimensions: ['local_visibility', 'leads'],
    plainLanguage: 'There is local demand in an area you serve, without a dedicated evidence-backed page.'
  },
  {
    id: 'cannibalisation',
    title: 'Multiple pages competing',
    phase: 1,
    severityDefault: 'medium',
    inputs: ['si_query_page_stats', 'si_pages'],
    actions: ['create_task', 'open_editor_seo'],
    autoFixAllowed: false,
    impactDimensions: ['rank', 'clarity'],
    plainLanguage: 'Several of your pages target the same search intent. Merge or differentiate them.'
  },
  {
    id: 'orphan_target',
    title: 'Orphan or weakly linked target page',
    phase: 1,
    severityDefault: 'medium',
    inputs: ['si_crawl_runs', 'si_pages'],
    actions: ['create_task', 'open_editor_seo'],
    autoFixAllowed: false,
    impactDimensions: ['indexability', 'rank'],
    plainLanguage: 'An important page has few internal links, so visitors and Google may overlook it.'
  },
  {
    id: 'not_indexed',
    title: 'Not indexed or canonical conflict',
    phase: 1,
    severityDefault: 'critical',
    inputs: ['si_issues', 'gsc'],
    actions: ['refresh_sitemap', 'schema_patch', 'open_editor_seo', 'create_task'],
    autoFixAllowed: false,
    impactDimensions: ['indexability'],
    plainLanguage: 'Google may not be indexing this page. Check canonicals, robots and sitemap coverage.'
  },
  {
    id: 'slow_page',
    title: 'Slow image or page',
    phase: 1,
    severityDefault: 'medium',
    inputs: ['lighthouse', 'si_pages'],
    actions: ['create_task', 'open_editor_seo'],
    autoFixAllowed: false,
    impactDimensions: ['cwv', 'conversions'],
    plainLanguage: 'Slow loads hurt rankings and mobile conversions. Compress images and simplify heavy sections.'
  },
  {
    id: 'traffic_no_convert',
    title: 'Traffic without conversions',
    phase: 1,
    severityDefault: 'high',
    inputs: ['ga4', 'lead_events', 'si_pages'],
    actions: ['open_editor_seo', 'create_task'],
    autoFixAllowed: false,
    impactDimensions: ['leads', 'cvr'],
    plainLanguage: 'People visit this page but do not call or submit the form. Improve the mobile CTA and offer clarity.'
  },
  {
    id: 'seo_ads_mismatch',
    title: 'Organic and Ads mismatch',
    phase: 1,
    severityDefault: 'low',
    inputs: ['google_ads', 'si_tracked_keywords'],
    actions: ['create_task'],
    autoFixAllowed: false,
    impactDimensions: ['cpl', 'alignment'],
    plainLanguage: 'Paid and organic keyword targeting diverge. Align landing pages and query coverage.'
  },
  // ── Recipes 11–20 (drafted for Phase 0 completeness; detectors land with connectors) ──
  {
    id: 'listings_nap_gap',
    title: 'NAP / listings consistency gap',
    phase: 3,
    severityDefault: 'high',
    inputs: ['site.config', 'gbp'],
    actions: ['open_editor_seo', 'create_task'],
    autoFixAllowed: false,
    impactDimensions: ['local_visibility', 'trust'],
    plainLanguage: 'Name, address or phone is missing or inconsistent across your site and listings.'
  },
  {
    id: 'maps_pack_absent',
    title: 'Missing from local pack',
    phase: 3,
    severityDefault: 'high',
    inputs: ['provider.serp', 'gbp'],
    actions: ['create_task', 'page_optimiser'],
    autoFixAllowed: false,
    impactDimensions: ['local_visibility', 'leads'],
    plainLanguage: 'Competitors appear in the Maps pack for a service you offer nearby.'
  },
  {
    id: 'review_velocity_low',
    title: 'Review velocity behind peers',
    phase: 3,
    severityDefault: 'medium',
    inputs: ['gbp'],
    actions: ['create_task'],
    autoFixAllowed: false,
    impactDimensions: ['trust', 'local_visibility'],
    plainLanguage: 'Recent Google reviews are sparse compared with nearby competitors.'
  },
  {
    id: 'service_area_page_thin',
    title: 'Thin suburb / service-area page',
    phase: 3,
    severityDefault: 'medium',
    inputs: ['si_pages', 'si_keyword_clusters'],
    actions: ['page_optimiser', 'create_landing_draft', 'create_task'],
    autoFixAllowed: false,
    impactDimensions: ['rank', 'local_visibility'],
    plainLanguage: 'A local page exists but lacks proof, FAQs or unique area detail.'
  },
  {
    id: 'duplicate_local_intent',
    title: 'Duplicate local landing intents',
    phase: 2,
    severityDefault: 'medium',
    inputs: ['si_pages', 'si_keyword_clusters'],
    actions: ['create_task', 'open_editor_seo'],
    autoFixAllowed: false,
    impactDimensions: ['clarity', 'rank'],
    plainLanguage: 'Two local pages chase the same suburb and service — consolidate or differentiate.'
  },
  {
    id: 'schema_missing_local',
    title: 'Local business schema missing',
    phase: 2,
    severityDefault: 'medium',
    inputs: ['site.config.seoJsonLd'],
    actions: ['schema_patch', 'create_task'],
    autoFixAllowed: false,
    impactDimensions: ['indexability', 'local_visibility'],
    plainLanguage: 'Structured data for your local business is missing or incomplete.'
  },
  {
    id: 'internal_link_local_gap',
    title: 'Weak links to local money pages',
    phase: 2,
    severityDefault: 'medium',
    inputs: ['si_pages', 'si_crawl_runs'],
    actions: ['create_task', 'open_editor_seo'],
    autoFixAllowed: false,
    impactDimensions: ['rank', 'indexability'],
    plainLanguage: 'Important suburb or service pages have few internal links from the homepage.'
  },
  {
    id: 'brand_serp_unowned',
    title: 'Brand SERP not fully owned',
    phase: 4,
    severityDefault: 'low',
    inputs: ['provider.serp'],
    actions: ['create_task', 'create_landing_draft'],
    autoFixAllowed: false,
    impactDimensions: ['brand', 'ctr'],
    plainLanguage: 'Directories or competitors outrank you for your own business name searches.'
  },
  {
    id: 'ai_overview_absent',
    title: 'Absent from AI overview citations',
    phase: 4,
    severityDefault: 'low',
    inputs: ['provider.serp', 'ai_visibility'],
    actions: ['create_task', 'page_optimiser'],
    autoFixAllowed: false,
    impactDimensions: ['visibility'],
    plainLanguage: 'AI answers cite competitors for questions you can answer with proof.'
  },
  {
    id: 'backlink_gap_local',
    title: 'Local authority / backlink gap',
    phase: 4,
    severityDefault: 'medium',
    inputs: ['provider.domainOverview'],
    actions: ['create_task'],
    autoFixAllowed: false,
    impactDimensions: ['authority', 'rank'],
    plainLanguage: 'Nearby competitors earn more referring domains for shared local terms.'
  }
]);

function listRecipes(phase) {
  if (phase == null) return RECIPES.slice();
  const p = Number(phase);
  return RECIPES.filter(function (r) { return r.phase <= p; });
}

function getRecipe(id) {
  return RECIPES.find(function (r) { return r.id === id; }) || null;
}

module.exports = {
  RECIPES: RECIPES,
  listRecipes: listRecipes,
  getRecipe: getRecipe
};
