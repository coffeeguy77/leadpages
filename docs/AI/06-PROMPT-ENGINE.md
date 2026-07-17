# 06 — Prompt Engine

**Document:** `AI/06-PROMPT-ENGINE`  
**Status:** Proposed  
**Prerequisites:** [01-CURRENT-STATE-AUDIT](01-CURRENT-STATE-AUDIT.md)

---

## Problem

Prompts are inline today in:

- `lib/seo/suburbIntro.js`
- `api/assist.js`
- `lib/trade-pack-utils.js` (`buildPrompt`)
- `lib/ig/enrich.mjs`
- `manage.html` (`aiGenerate`, presets)
- stale `api/manage.html` (`__buildTradePrompt`)

This blocks versioning, evaluation, and safe rollback.

---

## Design

Central **prompt registry** keyed by `promptId` + `version`.

| Field | Purpose |
|-------|---------|
| `promptId` | Stable ID, e.g. `seo.suburb_intro` |
| `version` | Semver or monotonic int |
| `taskId` | Router task |
| `system` | System instruction template |
| `user` | User template |
| `variables` | Declared interpolations |
| `outputSchemaRef` | Structured schema ID |
| `modelHints` | Optional overrides (not hard locks) |
| `status` | `draft` / `active` / `deprecated` |
| `changelog` | Why changed |
| `owner` | Team/person |

### Rules

- Features reference `promptId` (optionally pin version); default = active.  
- Interpolation is explicit; unknown variables fail closed.  
- Business context injected via named slots from [07-BUSINESS-CONTEXT](07-BUSINESS-CONTEXT.md).  
- Rollback = reactivate previous version.  
- No prompts in client UI for production paths (landing draft must move server-side).

---

## Example metadata (illustrative)

```json
{
  "promptId": "seo.suburb_intro",
  "version": 1,
  "taskId": "seo.suburb_intro",
  "status": "active",
  "system": "You write unique local SEO intros for Australian trade websites.",
  "user": "Business: {{businessName}}. Trade: {{trade}}. Suburb: {{suburb}}. Return ONLY one paragraph.",
  "outputSchemaRef": null,
  "variables": ["businessName", "trade", "suburb"]
}
```

---

## Testing & eval

- Snapshot render tests (variables → fully rendered prompt)  
- Golden input/output sets per prompt version  
- Canary: % of traffic on `vNext` behind flag  

---

## Related

- Structured outputs: [09-STRUCTURED-OUTPUTS](09-STRUCTURED-OUTPUTS.md)  
- Migration: [16-MIGRATION-PLAN](16-MIGRATION-PLAN.md)
