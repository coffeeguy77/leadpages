# Search Intelligence — Data Model

**Document:** `search-intelligence/02-DATA-MODEL`  
**Status:** Entity catalogue + SQL draft  
**Authoritative SQL:** [`../../db/search_intelligence_schema.sql`](../../db/search_intelligence_schema.sql)  
**Prerequisites:** [01-ARCHITECTURE.md](01-ARCHITECTURE.md), [../02-DATABASE.md](../02-DATABASE.md)

> **Do not apply this migration in production until Phase 1 build.** Header comments in the SQL file mark Phase 1 subset vs later phases.

---

## Entity overview

| Entity | Purpose | Phase |
|--------|---------|-------|
| Organisation / partner / user | Existing Leadpages tenancy | — |
| Site / project | Existing `sites` | — |
| Connection | GSC, GA4, GBP, … | 1 / 3 |
| Keyword / cluster | Research + tracking graph | 1–2 |
| Tracked keyword | Rank schedule | 1 |
| SERP snapshot / results | Licensed SERP | 1 |
| Rank observation | Time-series positions | 1 |
| Page | URL ↔ homepage / landing / suburb | 1 |
| Query–page stats | GSC aggregates | 1 |
| Crawl run / issue | Technical audit | 1 |
| Competitor (+ keywords) | Light Phase 1; deep later | 1 / 4 |
| Recommendation / action / approval | Next Best Actions | 1 |
| Annotation | Publish/change events | 2 |
| Report snapshot | Scheduled reports | 1 |
| Provider usage | Metering / budgets | 1 |
| Backlink / referring domain | Licensed | 4 |
| GBP location / review / post | Local | 3 |
| AI prompt / mention / citation | AI visibility | 4 |
| Lead / conversion / value | Attribution | 1 / 5 |

---

## Table catalogue (`si_*`)

### Connections & usage

| Table | Role |
|-------|------|
| `si_connections` | Per-site provider OAuth + property ids + sync health |
| `si_oauth_states` | Nonce replay for OAuth |
| `si_provider_usage` | Metered operations (keywords, SERPs, crawls, AI prompts) |

### Graph & warehouse

| Table | Role |
|-------|------|
| `si_keywords` | Normalised keyword records |
| `si_keyword_clusters` | Intent clusters |
| `si_tracked_keywords` | Site tracking membership + cadence |
| `si_serp_snapshots` | SERP pull metadata |
| `si_serp_results` | Individual SERP rows |
| `si_rank_observations` | Position by device/geo/date |
| `si_pages` | Canonical page identity for a site |
| `si_query_page_stats` | GSC query × page aggregates |
| `si_ga4_landing_stats` | GA4 landing-page sessions / conversions |
| `si_crawl_runs` | Crawl job records |
| `si_issues` | Audit issues with severity + fix metadata |
| `si_competitors` | Competitor domains |
| `si_competitor_keywords` | Competitor keyword overlap |
| `si_recommendations` | Next Best Actions |
| `si_recommendation_actions` | Action attempts / outcomes |
| `si_approvals` | Partner/client approval trail |
| `si_annotations` | Site change annotations |
| `si_report_snapshots` | Monthly/weekly report payloads |

---

## Source-of-truth boundaries

| Concern | SoT |
|---------|-----|
| Live HTML / titles / publish | `sites.config` + renderer |
| AI business knowledge | Site Brain snapshot |
| Search Intelligence warehouse | `si_*` tables |
| Search Digital Twin preferences | Site Brain `snapshot.searchIntelligence` |

Never wipe `sites.config`. Warehouse and Brain **mirror** facts; publish remains config-driven.

---

## Metric provenance

Every stored metric row should carry:

- `source` (gsc, ga4, provider, crawler, modelled, …)
- `fetched_at` / `period_start` / `period_end`
- `confidence` where modelled
- `label_class`: `measured` | `estimated` | `modelled`
