# 13 — Internal API Contracts

**Document:** `AI/13-INTERNAL-API-CONTRACTS`  
**Status:** Proposed  
**Prerequisites:** [03-TARGET-ARCHITECTURE](03-TARGET-ARCHITECTURE.md), [11-SECURITY-AND-PERMISSIONS](11-SECURITY-AND-PERMISSIONS.md)

---

## Style

Prefer **`lib/brain` (or `lib/ai`) functions** called from existing `api/*` routes over a wide public Brain HTTP surface. If HTTP is needed (browser features), expose thin feature-specific routes that call Brain internally.

---

## Operations

| Op | Purpose |
|----|---------|
| `generate` | Free-text generation |
| `generateStructured` | JSON + schema validation |
| `stream` | Streaming text (assist) |
| `resolveBusinessContext` | Preview context slices (debug/super) |
| `estimateCost` | Preflight estimate |
| `listModels` | Registry read |
| `getRoutingDecision` | Explain route (super) |
| `getUsage` | Query usage |
| `evaluateOutput` | Offline/online eval hook |
| `testProviderConnection` | Control Centre health |

---

## AuthN / AuthZ

- Browser → feature API: Supabase JWT (existing patterns).  
- Feature API → Brain lib: same request context object (`userId`, `role`, `siteId`, `partnerId`).  
- Cron → Brain: service principal + task allowlist.  
- Public suburb: policy `public.seo.suburb_intro` with rate limits.

---

## Request (conceptual)

```json
{
  "correlationId": "uuid",
  "taskId": "content.landing_draft",
  "promptId": "content.landing_draft",
  "siteId": "uuid",
  "input": { "brief": "..." },
  "contextSlices": ["site.identity", "site.services", "site.brand"],
  "idempotencyKey": "optional",
  "stream": false
}
```

## Response (conceptual)

```json
{
  "ok": true,
  "correlationId": "uuid",
  "taskId": "content.landing_draft",
  "output": { "bodyMarkdown": "..." },
  "model": { "provider": "anthropic", "model": "claude-sonnet-4-6" },
  "usage": { "inputTokens": 0, "outputTokens": 0, "costUsdEstimate": 0 },
  "prompt": { "promptId": "content.landing_draft", "version": 3 }
}
```

## Errors

Stable `error.code` values from [04-PROVIDER-ADAPTERS](04-PROVIDER-ADAPTERS.md); HTTP mapping at feature edge (400/401/403/429/502).

---

## Behaviour

| Topic | Proposal |
|-------|----------|
| Idempotency | Optional key for expensive tasks (packs) |
| Timeouts | Per-task; client gets `provider_timeout` |
| Retries | Safe GETs/idempotent only inside Brain |
| Versioning | Brain API version field when HTTP exists |

---

## Related

- Developer guide: [19-DEVELOPER-GUIDE](19-DEVELOPER-GUIDE.md)
