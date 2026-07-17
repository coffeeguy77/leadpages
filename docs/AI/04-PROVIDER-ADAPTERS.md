# 04 — Provider Adapters

**Document:** `AI/04-PROVIDER-ADAPTERS`  
**Status:** Implemented — mock + Anthropic + OpenAI + Gemini in `lib/brain/adapters/`  
**Prerequisites:** [03-TARGET-ARCHITECTURE](03-TARGET-ARCHITECTURE.md)

---

## Goal

A common adapter interface so Brain can call Anthropic (today), then OpenAI, Gemini, and future/local models without feature changes.

---

## Capability matrix (design)

| Capability | Anthropic | OpenAI | Gemini | Local/private | Notes |
|------------|-----------|--------|--------|---------------|-------|
| Text generation | Yes | Yes | Yes | Varies | |
| Structured JSON | Prompt+parse today; prefer tool/schema where available | JSON mode / tools | Varies | Varies | Validator always required |
| Streaming | Yes | Yes | Yes | Varies | Assist candidate |
| Tool calling | Yes | Yes | Varies | Varies | Marketing Hub later |
| Vision | Yes | Yes | Yes | Varies | Theme Studio logo analysis |
| Embeddings | Via other APIs later | Yes | Yes | Varies | Not in repo today |
| Image generation | Separate products | DALL·E etc. | Imagen etc. | Varies | Image Studio later |
| Token usage reporting | Yes (API usage fields) | Yes | Yes | Varies | Must normalise |
| Timeouts / retries | Adapter responsibility | Same | Same | Same | |

Do **not** assume identical feature support. Router uses capability detection.

---

## Proposed interface (TypeScript sketch — not a repo file)

```ts
type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'mock' | string;

interface ModelRef {
  provider: ProviderId;
  model: string;
}

interface GenerateRequest {
  correlationId: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model: ModelRef;
  maxTokens?: number;
  temperature?: number;
  responseSchema?: object; // JSON Schema when structured
  tools?: unknown[];
  timeoutMs?: number;
  stream?: boolean;
}

interface GenerateResult {
  text?: string;
  json?: unknown;
  usage: { inputTokens?: number; outputTokens?: number; cachedTokens?: number };
  providerRequestId?: string;
  latencyMs: number;
  model: ModelRef;
}

interface ProviderAdapter {
  id: ProviderId;
  capabilities(): Set<string>;
  generate(req: GenerateRequest): Promise<GenerateResult>;
  // stream?(req): AsyncIterable<...>  // later
  healthCheck(): Promise<{ ok: boolean; detail?: string }>;
}
```

---

## Error normalisation

| Provider signal | Brain error code |
|-----------------|------------------|
| 401/403 | `provider_auth` |
| 429 | `provider_rate_limit` |
| 5xx / network | `provider_unavailable` |
| timeout | `provider_timeout` |
| invalid JSON / schema | `invalid_output` |
| content filter | `provider_content_filter` |

---

## V1 vs later

| Item | V1 |
|------|-----|
| `mock` adapter | Required for tests |
| `anthropic` adapter | Required (matches current stack) |
| openai / gemini | Phase 5 |
| Vision / embeddings / image gen | When a consumer needs them |
| Official SDKs vs raw fetch | Implementation choice; keep behind adapter |

---

## Related

- Router: [05-TASK-ROUTER](05-TASK-ROUTER.md)  
- Structured outputs: [09-STRUCTURED-OUTPUTS](09-STRUCTURED-OUTPUTS.md)
