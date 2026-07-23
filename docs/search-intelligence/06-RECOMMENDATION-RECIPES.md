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

## First twenty recipes

Phase 1 sellable detectors (1–10) plus Phase 2–4 drafted types (11–20). See `lib/search-intelligence/recipes/registry.js`.

### Live detectors (Phase 1)

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

### Live detectors (Phase 2–3 local)

| Id | Name | Trigger | Primary action |
|----|------|---------|----------------|
| `listings_nap_gap` | NAP / listings gap | Missing/mismatched name or phone on site | Edit SEO / create task |
| `maps_pack_absent` | Missing from Maps pack | Maps-grid sample: absent on ≥ half of points | Task + Page Optimiser |
| `service_area_page_thin` | Thin suburb page | Published page mentions area but weak SEO/body | Page Optimiser / draft |
| `duplicate_local_intent` | Duplicate local landings | ≥2 published pages share an area | Consolidate task |
| `schema_missing_local` | LocalBusiness schema missing | `seoJsonLd` lacks local type | Schema patch |
| `internal_link_local_gap` | Weak links to local pages | Suburb page not in home/nav | Editor / task |

### Needs GBP or deeper Phase 4

`review_velocity_low` (GBP reviews). `brand_serp_unowned` / `ai_overview_absent` / `backlink_gap_local` have probe helpers in `phase4-foundations.js` (SERP / backlinkSummary). AI citation ownership uses `ai-citations.js` (platform catalogue + owned vs competitor refs).

CRM multi-location findings (`crm_area_no_wins`) reuse `location_service_gap` when a service area has leads but zero wins.

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
Phase 3 adds evidence-gated `suburb_page_brief` via `POST /api/search-intelligence/local-pages` and Maps grid via `POST /api/search-intelligence/maps-grid`.  
Phase 5 adds scoped `auto_fix_safe` via `POST /api/search-intelligence/auto-fix` with `confirm:true` (allow-list: `refresh_sitemap`, `apply_schema_local` only).

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
