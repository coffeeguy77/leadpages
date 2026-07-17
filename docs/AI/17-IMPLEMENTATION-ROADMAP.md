# 17 — Implementation Roadmap

**Document:** `AI/17-IMPLEMENTATION-ROADMAP`  
**Status:** Proposed  
**Prerequisites:** Entire `docs/AI/*` set  

> No calendar estimates. Phases are approval-gated.

---

## Phase 0 — Documentation and approval (current)

| | |
|--|--|
| Objectives | Audit repo; publish Brain docs; owner approval |
| Deliverables | `docs/AI/*`, INDEX links |
| Excluded | Any production code / SDKs / migrations |
| Done when | Owners accept architecture + first migration choice |

---

## Phase 1 — Core foundation ✅

| | |
|--|--|
| Objectives | Internal interfaces, mock provider, errors, request IDs, config validation, tests |
| Deliverables | `lib/brain/*`, mock adapter, `tests/brain-phase1.test.js` |
| Dependencies | Phase 0 approval |
| Risks | Overengineering — keep thin |
| Gate | Tests green; no provider keys required in CI |
| Excluded | Real Anthropic calls; Control Centre UI |
| Status | **Complete** — `createBrain()` / `generate` / `generateStructured` with mock adapter |

---

## Phase 2 — First provider

| | |
|--|--|
| Objectives | Anthropic adapter (matches current production) |
| Deliverables | Normalised usage/errors; structured helper; health check |
| Dependencies | Phase 1 |
| Gate | Contract tests with recorded fixtures; staging key |
| Excluded | OpenAI/Gemini |

**Recommended first provider:** Anthropic — sole verified production provider today.

---

## Phase 3 — Prompt and context

| | |
|--|--|
| Objectives | Prompt registry + versions; business context resolver (minimal slices) |
| Deliverables | Prompt files/DB; resolver with permission checks |
| Gate | Snapshot tests; isolation tests |

---

## Phase 4 — Routing and resilience

| | |
|--|--|
| Objectives | Task router, timeouts, retries, fallbacks, flags, soft cost controls |
| Gate | Chaos tests with mock failures |

---

## Phase 5 — Additional providers

| | |
|--|--|
| Objectives | OpenAI and/or Gemini adapters; capability matrix |
| Gate | Comparative contract tests |

---

## Phase 6 — Control Centre

| | |
|--|--|
| Objectives | Superuser ops UI for routes/usage/flags/health |
| Gate | Security review on secret handling |

---

## Phase 7 — First migration

| | |
|--|--|
| Objectives | Migrate **landing page AI draft** behind flag |
| Deliverables | Server route; Brain task; manage.html calls server |
| Gate | QA parity; flag soak; rollback proven |
| Excluded | Pack/assist/suburb until after soak |

---

## Phase 8 — AI Theme Studio

Separate product specification. Uses Brain exclusively. Compatible with theme engine / renderer — not freeform HTML.

---

## Phase 9 — AI Marketing Hub

Separate product specification. Uses Brain exclusively. LeadPages-managed campaigns distinct from customer’s other site campaigns (e.g. WordPress). No mutate without approval.

---

## Related

- Risks: [18-RISKS-AND-DECISIONS](18-RISKS-AND-DECISIONS.md)
