# 09 — Structured Outputs

**Document:** `AI/09-STRUCTURED-OUTPUTS`  
**Status:** Proposed  
**Prerequisites:** [01-CURRENT-STATE-AUDIT](01-CURRENT-STATE-AUDIT.md)

---

## Current baseline

Trade packs already enforce structured JSON via prompt + `parseAiJson` + `validatePack` in `lib/trade-pack-utils.js` (retries on truncate/parse). IG enrich uses regex JSON extract. Assist and suburb intros are free text.

Brain standardises **schema-first** responses for write-paths into `sites.config` / Ads / packs.

---

## Pipeline

1. Associate `outputSchemaRef` with prompt/task.  
2. Ask provider for JSON (mode/tools when available).  
3. Parse → JSON Schema validate.  
4. On failure: repair attempt (bounded) → fallback model → fail safe.  
5. Never write unvalidated AI content to production config.

---

## Retry rules (proposed defaults)

| Stage | Max attempts |
|-------|----------------|
| Parse/repair | 2 |
| Provider fallback | 1 additional model |
| Total wall time | Task timeout |

---

## Sample schemas (design examples only)

### Theme proposal (future)

```json
{
  "type": "object",
  "required": ["theme", "rationale"],
  "properties": {
    "theme": {
      "type": "object",
      "required": ["pipe", "hivis", "steel", "safety", "lightBg"],
      "properties": {
        "pipe": { "type": "string" },
        "hivis": { "type": "string" },
        "steel": { "type": "string" },
        "safety": { "type": "string" },
        "lightBg": { "type": "string" },
        "presetKey": { "type": "string" }
      }
    },
    "rationale": { "type": "string" }
  }
}
```

Must remain compatible with existing theme engine / renderer tokens ([features/Theme Engine](../features/Theme%20Engine.md)).

### Campaign plan (future)

```json
{
  "type": "object",
  "required": ["campaigns", "notes"],
  "properties": {
    "campaigns": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "objective", "adGroups"],
        "properties": {
          "name": { "type": "string" },
          "objective": { "type": "string" },
          "dailyBudgetAud": { "type": "number" },
          "adGroups": { "type": "array" }
        }
      }
    },
    "notes": { "type": "string" },
    "leadpagesManaged": { "const": true }
  }
}
```

### SEO recommendation / content draft / optimisation

Similar versioned schemas; content draft may be Markdown string inside `{ "title", "meta", "bodyMarkdown" }` for landing pages.

---

## User-facing errors

Return stable Brain codes (`invalid_output`, `schema_mismatch`) with safe messages. Log raw invalid payload redacted server-side.

---

## Related

- Trade pack validation is the migration template: [16-MIGRATION-PLAN](16-MIGRATION-PLAN.md)
