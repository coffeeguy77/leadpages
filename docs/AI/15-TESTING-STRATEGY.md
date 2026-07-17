# 15 — Testing Strategy

**Document:** `AI/15-TESTING-STRATEGY`  
**Status:** Proposed  
**Prerequisites:** [01-ARCHITECTURE](../01-ARCHITECTURE.md) § testing, existing `tests/**/*.test.js` (`node:test`)

---

## Layers

| Layer | What |
|-------|------|
| Unit | Adapters (mock HTTP), router decisions, prompt render, schema validate, cost math, redaction |
| Integration | Brain + mock provider + fake Supabase context resolver |
| Contract | Provider response normalisation fixtures |
| Snapshot | Rendered prompts; structured outputs for golden packs |
| E2E | Feature flag path: landing draft / suburb intro via Brain staging |
| Eval | Offline datasets for quality regressions |
| Canary | % traffic + alert on schema failure rate |

---

## Required scenarios

- Provider outage → fallback / safe error  
- Invalid JSON → repair → fail  
- Rate limit 429 → backoff behaviour  
- Permission denied cross-site  
- Tenant isolation (site A context never used for site B)  
- Prompt injection fixtures  
- Streaming cancel/partial usage finalisation  
- Migration compatibility: old flag off = legacy path  

---

## Mock provider

Mandatory in Phase 1. Deterministic outputs for CI without network or keys.

---

## Related

- Roadmap gates: [17-IMPLEMENTATION-ROADMAP](17-IMPLEMENTATION-ROADMAP.md)
