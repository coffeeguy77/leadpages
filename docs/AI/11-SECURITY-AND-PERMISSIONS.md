# 11 — Security and Permissions

**Document:** `AI/11-SECURITY-AND-PERMISSIONS`  
**Status:** Proposed  
**Prerequisites:** [features/Authentication](../features/Authentication.md), [01-CURRENT-STATE-AUDIT](01-CURRENT-STATE-AUDIT.md)

---

## Non-negotiable

Provider secrets (`ANTHROPIC_API_KEY`, future OpenAI/Gemini keys) **must never**:

- Ship to browsers  
- Appear in `sites.config` or public HTML  
- Be logged in full  
- Be returned by Control Centre after entry  

Server-side Brain / feature routes only.

---

## Roles (aligned with platform)

| Role | AI powers (proposed) |
|------|----------------------|
| Super-admin | Control Centre; all tasks; impersonation audited |
| Partner | Tasks on owned/linked client sites; pack acquire |
| Client / site owner | Tasks on own sites only |
| Public | Allowlisted tasks only (e.g. suburb intro) with rate/budget |
| Cron | Service identity + `CRON_SECRET` |

Tighten today’s weaker `api-trade-generate` (any JWT) during migration.

---

## Threat model (summary)

| Threat | Mitigation |
|--------|------------|
| API key theft from client | Ban client provider calls (fix landing `aiGenerate`) |
| Prompt injection via site copy / IG captions | Delimit untrusted content; tool allowlists; no unrestricted tools in V1 |
| Cross-tenant context leak | Resolver ownership checks; tests |
| Cost abuse / loops | Rate limits, budgets, confirmation gates (keep pack confirm) |
| Data exfiltration via model | Redact secrets from context; disable web tools unless approved |
| Malicious model output written to config | Schema validation; human publish |
| Provider retention | Prefer zero/enterprise retention settings where offered; document |
| Dev/prod bleed | Separate keys/projects; mock provider in tests |

---

## Rate limiting & abuse

Extend patterns from `api/_rate-limit.js` to Brain gateway and public AI tasks. Per-IP + per-user + per-site dimensions.

---

## Prompt injection specifics

Untrusted inputs: visitor content, IG captions, pasted URLs, CRM notes. Treat as data, not instructions. System prompts must state that user/site content is untrusted.

---

## Related

- API contracts: [13-INTERNAL-API-CONTRACTS](13-INTERNAL-API-CONTRACTS.md)  
- Risks: [18-RISKS-AND-DECISIONS](18-RISKS-AND-DECISIONS.md)
