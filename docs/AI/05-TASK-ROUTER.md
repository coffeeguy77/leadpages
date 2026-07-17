# 05 — Task Router

**Document:** `AI/05-TASK-ROUTER`  
**Status:** Partial — policy table + retries/flags/budgets in `lib/brain` (Phase 4); Control Centre overrides later  
**Prerequisites:** [03-TARGET-ARCHITECTURE](03-TARGET-ARCHITECTURE.md), [04-PROVIDER-ADAPTERS](04-PROVIDER-ADAPTERS.md)

---

## Purpose

Select provider + model (+ fallback chain) per **task type** using configurable policies — not hardcoded folklore (“Claude always codes”).

---

## Task types (initial catalogue)

| Task ID | Example consumer | Typical needs |
|---------|------------------|---------------|
| `help.answer` | `/api/assist` | Fast, cheap, streaming later |
| `seo.suburb_intro` | Suburb pages | Short text, cacheable |
| `content.landing_draft` | Landing AI draft | Medium text, Markdown |
| `pack.trade_generate` | Trade packs | Large structured JSON, high max tokens |
| `ig.caption_enrich` | IG enrich | Tiny structured JSON |
| `theme.generate` | Theme Studio (future) | Structured theme tokens + vision |
| `theme.refine` | Theme Studio (future) | Structured patch |
| `ads.campaign_plan` | Marketing Hub (future) | Structured plan; high scrutiny |
| `ads.rsa_copy` | Marketing Hub (future) | Structured ad copy |
| `seo.recommend` | AI SEO (future) | Structured recommendations |
| `crm.qualify_lead` | CRM (future) | Structured score + reasons |
| `quote.assist` | Quote builder (future) | Structured suggestions |
| `report.summarise` | Reporting (future) | Summaries; may stream |
| `generic.fast` | Utilities | Lowest cost |
| `generic.reason` | Hard reasoning | Higher quality models |
| `generic.large_context` | Big site dumps | Large context window |

---

## Routing inputs

- Task type / required capabilities  
- Quality vs cost vs latency preferences  
- Context-window estimate  
- Structured-output reliability history (later)  
- Provider availability / health  
- Feature flags / experiments  
- Customer or partner plan limits  
- Superuser Control Centre overrides  
- Fallback order  
- Privacy / data-residency constraints (**open** if ever required)  

---

## Policy shape (conceptual)

```yaml
task: pack.trade_generate
requires: [text, structured_json]
primary: { provider: anthropic, model: env:TRADE_PACK_MODEL }
fallback:
  - { provider: anthropic, model: claude-sonnet-4-6 }
limits: { maxTokens: 12288, timeoutMs: 120000 }
structured: true
schemaRef: schemas/trade_pack.v1
```

V1 may store policies in code/config JSON; Control Centre edits come in Phase 6.

---

## Decision log

Every route decision should be recorded on the usage row: selected model, rejected alternatives, reason codes (`flag`, `capability`, `budget`, `health`).

---

## Related

- Prompts: [06-PROMPT-ENGINE](06-PROMPT-ENGINE.md)  
- Control Centre: [14-AI-CONTROL-CENTRE](14-AI-CONTROL-CENTRE.md)
