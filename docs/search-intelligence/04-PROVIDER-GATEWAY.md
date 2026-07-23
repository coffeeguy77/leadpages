# Search Intelligence — Provider Gateway

**Document:** `search-intelligence/04-PROVIDER-GATEWAY`  
**Status:** Normalised market-data contract  
**Code:** [`../../lib/search-intelligence/providers/`](../../lib/search-intelligence/providers/)  
**Bake-off:** [PHASE-0-BAKEOFF.md](PHASE-0-BAKEOFF.md)

---

## Principle

Do **not** couple product code to one vendor response schema. All keyword, SERP, rank, competitor and backlink calls go through the gateway.

```mermaid
flowchart LR
  UI[CommandCentre] --> GW[ProviderGateway]
  Jobs[Scheduler] --> GW
  GW --> Cache[CacheAndBudget]
  Cache --> DFS[DataForSEO]
  Cache --> SM[SemrushAPI]
  Cache --> Mock[MockFixtures]
```

---

## First adapter target

| Provider | Role |
|----------|------|
| **DataForSEO** | First adapter target (AU local SERP / Maps support) |
| Semrush API | Documented alternate after bake-off |
| Mock | Tests and docs examples |

Phase 0 bake-off selects the **default** provider; gateway retains multi-adapter support.

---

## Normalised DTOs (`lib/search-intelligence/providers/types.js`)

| Type | Fields (summary) |
|------|------------------|
| `KeywordIdea` | keyword, location, language, volume, cpc, competition, difficulty, intent, localIntent, trend |
| `SerpSnapshot` | keyword, location, device, fetchedAt, features[], results[] |
| `SerpResult` | rank, url, domain, title, snippet, type (organic/maps/…) |
| `RankObservation` | keywordId, url, position, device, geo, fetchedAt, features |
| `CompetitorDomain` | domain, visibilityEstimate, overlapCount |
| `BacklinkSummary` | referringDomains, newLost, topAnchors (Phase 4) |

Every response includes `provider`, `fetchedAt`, `labelClass` (`measured` \| `estimated` \| `modelled`).

---

## Gateway responsibilities

1. Route operation → adapter  
2. Enforce tenant **budget** (`si_provider_usage`)  
3. Cache shared market data where licensing permits  
4. Plan-based refresh frequency (not unlimited user triggers)  
5. Fail soft with structured errors (`not_configured`, `budget_exceeded`, `provider_error`)  
6. Optional failover when a second adapter is configured  

---

## Operations (Phase 1 surface)

| Op | Description |
|----|-------------|
| `keywordIdeas` | Seed → related keywords + volume/CPC |
| `serp` | Live SERP for keyword × geo × device |
| `domainOverview` | Light competitor/domain snapshot |
| `rankCheck` | Position for tracked keywords |

Phase 4 adds `backlinks`, `backlinkGap`. AI visibility may be a separate hybrid provider.

---

## Stub behaviour (this pass)

- `dataforseo.js` returns `{ ok: false, error: 'not_configured' }` until credentials exist  
- `mock.js` returns deterministic fixtures for unit tests  
- No live HTTP from stubs  

---

## Cost controls

Meter: keyword ideas, SERP locations, grid points, competitor domains, backlink rows, AI prompts.  
Cache TTLs and plan caps documented in [08-ROADMAP.md](08-ROADMAP.md).
