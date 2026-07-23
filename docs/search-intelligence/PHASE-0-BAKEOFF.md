# Phase 0 — Provider Bake-off & Validation

**Document:** `search-intelligence/PHASE-0-BAKEOFF`  
**Prerequisites:** [04-PROVIDER-GATEWAY.md](04-PROVIDER-GATEWAY.md), [08-ROADMAP.md](08-ROADMAP.md)

---

## Goals

1. Select a default market-data provider (or confirm DataForSEO) without locking the gateway  
2. Understand **cost per active site** and margin under SEO Growth packaging  
3. Validate the top recommendation recipes with partners/clients  
4. Confirm OAuth/API access plan for GSC + GA4  
5. Lock measurement definitions (measured / estimated / modelled)  

---

## Providers under evaluation

| Provider | Why |
|----------|-----|
| **DataForSEO** | First adapter target; AU local SERP / Maps; flexible pricing — **live adapter shipped** (`lib/search-intelligence/providers/dataforseo.js`) |
| **Semrush API** | Breadth; alternate if licensing/resale fits (not wired yet) |
| Others | Only if bake-off reveals AU/local gaps |

Do not ship product code that assumes a single vendor schema. Ops: set `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` (or email/password aliases); leave `SI_PROVIDER` unset to auto-prefer, or force `SI_PROVIDER=mock` in lower envs.

---

## Bake-off rubric

Score each provider 1–5 on:

| Criterion | Notes |
|-----------|-------|
| Canberra + regional AU keyword volume quality | Compare known local terms |
| Geo-granular SERPs / Maps | Suburb/city device splits |
| Competitor organic coverage | Trade / local niches |
| Backlink freshness | Sample referring domains |
| Result latency | p50 / p95 |
| History availability | Rank/volume history depth |
| API licensing / resale rights | Critical for SaaS |
| Cost per active site + keyword | Model at 25 / 100 / 500 keywords |
| Rate limits & quotas | Burst vs sustained |
| Data retention rights | Cache policy |
| Uptime / support | Incident response |

Deliverable: short write-up in this folder or internal ops note (no client PII in repo) naming **default adapter** and **failover candidate**.

---

## Unit-economics skeleton

For each plan tier, estimate monthly:

- Provider keyword/SERP spend  
- Crawl compute  
- GSC/GA4 sync (mostly free quota; engineering cost)  
- Support load  
- Gross margin after attach rate  

Cache shared non-PII market data where licensing allows.

---

## Pilot sites (process)

Select **20–30** real Leadpages sites:

- Mix of trades / local services  
- At least one multi-suburb service-area site  
- Partner-managed and self-serve mix  
- Willing to connect GSC (and ideally GA4)  

**Do not commit client names, domains or credentials into the repository.** Keep the pilot roster in a private ops store; reference only anonymised site ids in engineering notes.

---

## Measurement glossary (lock in Phase 0)

| Term | Definition |
|------|------------|
| Organic click | GSC click (measured) |
| Impression | GSC impression (measured) |
| Position | GSC avg position or provider rank check (label source) |
| Organic lead | Form/call-click with modelled organic attribution confidence |
| Opportunity Value | See [07-SCORING.md](07-SCORING.md) (modelled) |

---

## OAuth / API access plan

| API | Action |
|-----|--------|
| Search Console | Cloud project; OAuth client on `app.leadpages.com.au`; scopes documented in [03-CONNECTORS.md](03-CONNECTORS.md) |
| GA4 Data API | Same app domain pattern |
| Ads | Already in progress — share keyword universe later |
| GBP | Start access application in Phase 0; product Phase 3 |

Security/privacy review: token encryption, retention, APP/GDPR deletion with site delete.

---

## Exit criteria

- [ ] Reliable default provider selected  
- [ ] Cost per client understood for included + SEO Growth  
- [ ] Top 20 recommendation types drafted; first 10 validated with non-SEO users  
- [ ] Dashboard IA prototype understandable without SEO training  
- [ ] GSC + GA4 OAuth plan approved  
- [ ] Pilot roster identified (private)  

Then proceed to Phase 1 build.
