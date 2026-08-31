# AI Domain Finder

**Status:** Shipped (Phase 1)  
**Route:** `/domain-finder` → `domain-finder.html`  
**APIs:** `api/domain-finder/*`  
**Lib:** `lib/domain-finder/`  
**SQL:** `db/domain_finder.sql` (apply in Supabase)

## Purpose

Find a strong business/brand name **with a domain you can actually register**.

Flow: **Generate → Check Dreamscape availability → Reject taken → Regenerate → Rank available only → Show customer.**

AI never claims availability. OpenAI is used via LeadPages Brain (`domain_finder.generate` / `domain_finder.rank`).

## Product rules

- TLDs for this feature: **`.com.au` / `.au` / `.net.au` only**
- Reuses Dreamscape availability + `/domains` purchase handoff
- Register always does a **fresh** availability check first
- **Stepped APIs** (generate → check → rank) so no single request can hit Vercel’s 60s gateway timeout
- Monolithic `/api/domain-finder/search` remains as a short fallback only

## Flags / env

| Env | Default | Notes |
|-----|---------|--------|
| `BRAIN_DOMAIN_FINDER` | `1` (on) | Set `0` to disable APIs |
| `OPENAI_API_KEY` | — | Preferred provider for naming/ranking |
| `DOMAIN_FINDER_TARGET` | `12` | Target available name families |
| `DOMAIN_FINDER_MAX_ROUNDS` | `2` | Max AI generation rounds |
| `DOMAIN_FINDER_MAX_CHECKS` | `54` | Cap Dreamscape checks per search |
| `DOMAIN_FINDER_DEADLINE_MS` | `48000` | Soft wall-clock budget (avoid Vercel 504) |

## Entry points

- Manage → Site tools → **Domain Finder**
- `/domains` and Manage Domains → **Find Me A Name**
- Direct: `/domain-finder?site=<site_id>`

## Admin / ops

1. Run `db/domain_finder.sql` in Supabase (sessions + candidates + cache).
2. Ensure `OPENAI_API_KEY` is set in Vercel (falls back to mock naming if missing).
3. Dreamscape credentials already used by `api/domains/*`.

## Not in Phase 1

- SSE streaming progress (progress returned after completion)
- Admin analytics dashboard
- Multi-domain cart “Register Both”
- Non-AU TLDs / business-name ASIC checks
