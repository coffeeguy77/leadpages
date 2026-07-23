# Phase 0 — Provider Bake-off & Validation

**Document:** `search-intelligence/PHASE-0-BAKEOFF`  
**Prerequisites:** [04-PROVIDER-GATEWAY.md](04-PROVIDER-GATEWAY.md), [08-ROADMAP.md](08-ROADMAP.md)  
**Status:** Closed — **DataForSEO** is the default (and only) live market-data provider.

---

## Decision (locked)

| Decision | Outcome |
|----------|---------|
| Default market provider | **DataForSEO** (live adapter shipped) |
| Failover / Semrush | **Never** — Semrush licensing is permanently out of scope |
| Gateway | Keeps mock + DataForSEO only; normalised DTOs remain vendor-agnostic |
| Cost model | Modelled bands below; live samples stay in private ops (no client PII in repo) |

Ops: set `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` (or email/password aliases); leave `SI_PROVIDER` unset to auto-prefer, or force `SI_PROVIDER=mock` in lower envs.

---

## Unit-economics skeleton (modelled)

| Workload | Assumed usage / site / month | Modelled provider $ |
|----------|------------------------------|---------------------|
| Included (25 tracked, weekly SERP) | ~100 SERP + 50 keyword-idea calls | ~$2–6 |
| SEO Growth (100 tracked, daily SERP) | ~3k SERP + 200 keyword ideas | ~$25–80 |
| Local Growth (Maps grid) | Grid points via DataForSEO `mapsGrid` | Shipped — Manage → Local |

Metered usage is available at `GET /api/search-intelligence/usage` and on Manage → Local.

---

## Measurement glossary (locked)

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
| Search Console | Shipped — OAuth + property + sync |
| GA4 Data API | Shipped — OAuth + property + sync |
| Ads | Existing Advertising tab — shared keyword universe Phase 4 |
| GBP | OAuth scaffold shipped; live sync when Google access approved |

---

## Exit criteria

- [x] Reliable default provider selected — **DataForSEO**  
- [x] Cost per client understood for included + SEO Growth — **modelled bands + usage API**  
- [x] Top 20 recommendation types drafted; first 10 live detectors — **registry has 20**  
- [x] Dashboard IA prototype understandable without SEO training — **SEO Command Centre**  
- [x] GSC + GA4 OAuth plan approved / implemented  
- [x] Pilot roster process documented (private ops; no PII in repo)  

Phase 1–4 build is complete on this programme track (GBP live sync still gated on Google access). Semrush remains permanently out of scope.
