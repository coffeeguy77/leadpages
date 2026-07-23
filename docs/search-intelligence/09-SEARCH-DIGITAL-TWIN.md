# Search Digital Twin

**Document:** `search-intelligence/09-SEARCH-DIGITAL-TWIN`  
**Status:** Target Site Brain extension + agent boundaries  
**Prerequisites:** [../ai-team/SITE-BRAIN.md](../ai-team/SITE-BRAIN.md), [01-ARCHITECTURE.md](01-ARCHITECTURE.md)

---

## Purpose

Each site already has Website Studio / Site Brain configuration. Extend it with a per-site **search intelligence** file so all SEO agents share one coherent state and avoid contradictory advice.

**Does not replace** `sites.config` (renderer SoT) or `si_*` warehouse tables. Twin holds **strategy and approved truth**; warehouse holds **observations**.

---

## Target shape: `snapshot.searchIntelligence`

Future addition to `lib/site-brain/schema.js` `emptySnapshot()` (not applied in this docs-first pass beyond documentation).

```js
searchIntelligence: {
  schemaVersion: '1.0',
  businessTruth: {
    // pointers / fact refs into snapshot.business, offers, locations
  },
  services: [],           // service ids / names the business actually offers
  serviceAreas: [],       // confirmed suburbs/regions (must align with serviceAreas.areas)
  audiences: [],
  targetQueries: [],      // primary intents
  clusters: [],           // { id, primaryKeyword, secondary[], pageRef? }
  queryPageMap: [],       // { query, pageId, url, confidence, source }
  competitors: [],        // { domain, type: 'business'|'search', notes }
  approvedClaims: [],     // claims safe for AI copy
  exclusions: [],         // topics/locations forbidden
  complianceConstraints: [],
  seoDecisions: [],       // durable choices (canonical strategy, etc.)
  experiments: [],        // annotations / A-B meta tests
  contentRoadmap: [],     // planned pages with status
  performanceSummary: {   // rolled-up pointers into si_* (ids/dates only)
    lastGscSync: null,
    lastCrawlId: null
  }
}
```

Provenance: use existing `makeFact()` / fact sources (`search_console`, `google_ads`, `analytics`, …).

---

## Agent boundaries

| Agent | Role with Search Intelligence |
|-------|-------------------------------|
| **Scout** | SEO strategy specialist: **recommend only** — write recommendations/tasks into Brain; never mutate `sites.config` or publish |
| **Atlas** | Orchestrates; may surface NBA; does not silent-publish |
| **Forge** | Executes **approved** Execution Plans (Recommendation → Plan → Preview → Apply) for page/SEO field changes |
| **Guardian** | Brand/factual/compliance checks on drafts |
| **Pulse** | Performance signals (analytics) feeding scores |

Mutation rule: **Forge-only** for config changes, after human (or explicit partner policy) approval. Scout/Atlas propose.

See also [../ai-team/SEO-INTEGRATION.md](../ai-team/SEO-INTEGRATION.md).

---

## Sync rules

| Direction | Behaviour |
|-----------|-----------|
| Config → Twin | Bootstrap services, areas, pages inventory (existing `sync.js` pattern) |
| GSC → Twin | Update `queryPageMap` / performanceSummary refs after sync |
| Twin → Config | Only via approved Forge plan (title/meta/page create) |
| Twin ↔ `si_*` | Twin stores refs and decisions; warehouse stores time-series |

---

## Safeguards

- Forbid invented experience, guarantees, stats, locations, accreditations  
- Local pages require confirmed service area + unique proof  
- Duplicate/cannibalisation checks before create  
- Regulated topics flagged for approval  

---

## Implementation note (this pass)

Document only. Runtime `schema.js` still uses `seo: {}` without `searchIntelligence`. Phase 1 Brain work adds the key behind a schemaVersion bump when Command Centre ships.
