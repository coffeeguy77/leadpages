# 12 — Data Model

**Document:** `AI/12-DATA-MODEL`  
**Status:** Proposed — **no migrations in this phase**  
**Prerequisites:** [02-DATABASE](../02-DATABASE.md), [01-CURRENT-STATE-AUDIT](01-CURRENT-STATE-AUDIT.md)

---

## Existing tables to reuse

| Table | Reuse |
|-------|-------|
| `sites`, `profiles`, `partners` | Tenant identity |
| `suburb_intros` | Task cache for suburb intros |
| `service_packs`, `pack_location_usage` | Pack outputs / dedupe |
| `wiki_articles` | Assist retrieval corpus |

Do not duplicate these as “AI copies.”

---

## Proposed new entities

| Entity | Purpose | Tenant | V1? | Notes |
|--------|---------|--------|-----|-------|
| `ai_providers` | Enabled providers, status | Global | Optional (config file OK in V1) | No secret plaintext display |
| `ai_models` | Model registry + capabilities + prices | Global | Yes (or JSON config) | |
| `ai_routing_policies` | Task → model/fallback | Global | Yes (code/JSON OK first) | |
| `ai_prompts` | Prompt metadata | Global | Yes | Bodies in DB or versioned files |
| `ai_prompt_versions` | Immutable versions | Global | Yes | |
| `ai_requests` | Per-call audit/usage | site/partner/user | Yes | Hot path insert |
| `ai_usage_daily` | Rollup | site/partner | Later | Like `event_daily` |
| `ai_feature_flags` | Migrate flags | Global/site | Yes | |
| `ai_budgets` | Allowances | partner/site | Later | |
| `ai_memories` | Cautious memory | site/user | Later | |
| `ai_evaluations` | Eval run results | Global | Later | |
| `ai_settings` | Control Centre knobs | Global | Phase 6 | |

### Important `ai_requests` fields (proposed)

`id`, `correlation_id`, `created_at`, `actor_user_id`, `partner_id`, `site_id`, `feature`, `task_id`, `prompt_id`, `prompt_version`, `provider`, `model`, `input_tokens`, `output_tokens`, `cost_usd_estimate`, `latency_ms`, `success`, `error_code`, `fallback_used`, `schema_valid`.

**Indexes:** `(site_id, created_at)`, `(partner_id, created_at)`, `(task_id, created_at)`, `correlation_id` unique.

**Encryption:** none for aggregates; optional encrypted prompt/response blobs at rest if stored.

**Retention:** metadata longer than bodies.

---

## Related

- Observability: [10-OBSERVABILITY-AND-COSTS](10-OBSERVABILITY-AND-COSTS.md)  
- Roadmap: [17-IMPLEMENTATION-ROADMAP](17-IMPLEMENTATION-ROADMAP.md)
