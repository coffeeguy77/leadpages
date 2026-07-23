# Recommendation Recipes

**Document:** `search-intelligence/06-RECOMMENDATION-RECIPES`  
**Code registry:** [`../../lib/search-intelligence/recipes/registry.js`](../../lib/search-intelligence/recipes/registry.js)  
**Prerequisites:** [05-COMMAND-CENTRE.md](05-COMMAND-CENTRE.md), [07-SCORING.md](07-SCORING.md)

---

## Principles

- Deterministic detection rules where possible  
- AI explains and drafts; it does not invent metrics  
- Each recipe declares inputs, evidence, impact, confidence, and allowed actions  
- Prefer Leadpages-executable actions (editor, draft, sitemap)  

---

## First ten recipes (Phase 1 sellable set)

| Id | Name | Trigger | Primary action |
|----|------|---------|----------------|
| `high_impr_low_ctr` | High impressions, low CTR | GSC: high impressions, CTR below peer threshold | Edit title/meta; preview |
| `pos_4_20_relevance` | Position 4–20, strong relevance | Rank 4–20 + business offers service | Open page; Page Optimiser |
| `keyword_no_page` | Valuable keyword, no page | Opportunity Value high; no matching `si_pages` | Create landing draft |
| `location_service_gap` | Location/service gap | Local demand + service area confirmed; no page | Propose evidence-backed local page |
| `cannibalisation` | Multiple pages competing | Same primary intent across URLs | Consolidate / differentiate task |
| `orphan_target` | Orphan / weak internal links | Target page thin inbound links | Suggest internal links |
| `not_indexed` | Not indexed / canonical conflict | Crawl or GSC coverage signal | Technical fix + sitemap refresh |
| `slow_page` | Slow image/page | Lighthouse/PSI thresholds | Image/layout remediation task |
| `traffic_no_convert` | Traffic without conversions | Sessions/clicks without form/call | CTA/form improvement |
| `seo_ads_mismatch` | Organic and Ads mismatch | Shared keyword universe (Phase 4; light heuristic earlier) | Align LP / keyword |

---

## Recipe record shape

```js
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
}
```

---

## Action vocabulary (Phase 1)

| Action id | Maps to |
|-----------|---------|
| `open_editor_seo` | Manage editor SEO / landing fields |
| `preview` | Live preview |
| `refresh_sitemap` | `POST /api/site/sitemap` |
| `create_task` | Site Brain / partner task |
| `create_landing_draft` | `POST /api/brain/landing-draft` (human approve) |
| `dismiss` / `snooze` | Recommendation state |

Phase 2 adds `page_optimiser`, `composer_draft` (Brain landing handoff), `internal_link_patch`, `schema_patch`.  
Phase 5 adds scoped `auto_fix_safe`.

### Page Optimiser (Phase 2 scaffold)

`POST /api/search-intelligence/page-optimiser` builds a **modelled** brief (title, meta, H1, outline, internal links, landing-draft handoff). Safeguards: `publishAllowed: false`, `requiresHumanApproval: true`.

Manage → Clusters → Page Optimiser → **Compose with Brain** stores the handoff, annotates `brain_landing_handoff`, and opens Landing pages with SEO fields prefilled. Operator still clicks **Generate draft** and **Approve** — nothing silent-publishes.

### Schema patch

`GET|POST /api/search-intelligence/schema-patch` previews modelled LocalBusiness/FAQ JSON-LD. POST with `apply:true` writes `sites.config.seoJsonLd` (human only). `api/render.js` injects those blocks as `application/ld+json`.

### Annotations

`GET|POST /api/search-intelligence/annotations` — publish / draft_applied / schema_apply / handoff events. Landing page Save records publish/unpublish transitions.

---

## Validation (Phase 0 exit)

Partners review these ten recipes for understandability without SEO training. Expand to ~20 types before Phase 1 GA (see [PHASE-0-BAKEOFF.md](PHASE-0-BAKEOFF.md)).
