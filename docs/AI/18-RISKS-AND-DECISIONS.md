# 18 — Risks and Decisions

**Document:** `AI/18-RISKS-AND-DECISIONS`  
**Status:** Living  
**Prerequisites:** [01-CURRENT-STATE-AUDIT](01-CURRENT-STATE-AUDIT.md)

---

## Risk register

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| R1 | Provider lock-in | High | Brain adapters + router |
| R2 | Unexpected AI cost | High | Usage ledger, budgets, rate limits; fix public suburb spend |
| R3 | Cross-tenant leakage | Critical | Resolver checks + tests |
| R4 | Invalid structured output | High | Schema + repair + no write |
| R5 | Prompt injection | High | Delimit untrusted content; no open tools V1 |
| R6 | Excessive context size | Med | Slice budgets |
| R7 | Model deprecation | Med | Model registry; env overrides already used |
| R8 | Provider outages | Med | Fallbacks |
| R9 | Silent quality degradation | Med | Evals/canaries |
| R10 | Autonomous Ads changes | High | Human approval rule |
| R11 | Existing feature regressions | High | Flags; migrate smallest first |
| R12 | Overengineering V1 | Med | Phase gates; mock-first |
| R13 | Weak auth on trade generate | Med | Tighten on migration |
| R14 | Client-side key temptation | High | Ban; server-only landing draft |

---

## Open questions (owner approval)

1. First provider beyond Anthropic priority (OpenAI vs Gemini)?  
2. Store prompts in DB vs versioned repo files?  
3. Hard budget enforcement in V1 or soft only?  
4. Public suburb intro: keep on-demand generation or precompute-only?  
5. Bring-your-own-key ever offered to partners?  
6. Is `api/manage.html` still deployed?  
7. Should “AI credits” become real billing entitlements?  

---

## Architecture decisions (proposed ADRs)

| ADR | Decision |
|-----|----------|
| ADR-AI-001 | Single Brain gateway; no feature→provider imports |
| ADR-AI-002 | Anthropic first adapter (evidence-based) |
| ADR-AI-003 | First migrate landing `aiGenerate` |
| ADR-AI-004 | Structured validation before config writes |
| ADR-AI-005 | Control Centre super-only; no secret readout |
| ADR-AI-006 | AI suggests / user publishes |

---

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Keep per-feature Anthropic fetch forever | Blocks multi-provider + cost control |
| Client-side provider SDK | Secret exposure |
| Generate arbitrary HTML Theme Studio | Breaks renderer/theme contracts |
| Auto-apply Ads changes in v1 Marketing Hub | Policy / trust |

---

## Related

- Roadmap: [17-IMPLEMENTATION-ROADMAP](17-IMPLEMENTATION-ROADMAP.md)
