# LeadPages Brain — Feature Manual

**Document:** `features/LeadPages Brain`  
**Status:** Runtime Phases 1–7 shipped (2026-07)  
**Audience:** Engineers and AI development agents  
**Canonical status:** [AI/00-STATUS](../AI/00-STATUS.md) — **read that first**  
**Prerequisites:** [AI/README](../AI/README.md), [INDEX](../INDEX.md)

---

## Executive summary

LeadPages Brain is the **provider-agnostic AI gateway**. Features should call Brain; Brain selects mock / Anthropic / OpenAI / Gemini. As of Phase 7, only the **landing page AI draft** path is migrated (behind `BRAIN_LANDING_DRAFT=1`). Assist, suburb intros, trade packs, and IG enrich still call Anthropic directly.

Landing draft prompt **v3** returns a full SEO package (~900–1100 words): `primaryKeyword`, `title`, `slug`, `meta`, `h1`, `bodyMarkdown`, `secondaryKeywords`, `faqs[]`, `ctaHeadline`, `ctaBody`. On **Use this draft**, the editor fills title, slug, meta, H1 and body, and attaches a **Marketplace FAQ app (Unique)** prefilled from `faqs[]` (`items[].q` / `items[].a`). FAQ copy stays out of the markdown body so it is not duplicated.

---

## Surfaces

| Surface | URL / entry | Who |
|---------|-------------|-----|
| Control Centre | `/brain-admin` (Ops Command → **AI Brain**) | Super-admin |
| Control API | `GET/POST /api/brain/control` | Super-admin Bearer |
| Landing draft API | `POST /api/brain/landing-draft` | Site owner / partner / super |
| Editor | `manage.html` Landing pages → Generate draft | Editor roles |
| Library | `lib/brain/`, `lib/brain/platform.js` | Server code |

---

## Flags

- `BRAIN_PROVIDER=mock|anthropic|openai|gemini` (default `mock`)
- `BRAIN_LANDING_DRAFT=1` to enable server drafts (default off)
- Keys: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`

## Usage / cost tracking

- Apply `db/ai_requests.sql` in Supabase once.
- Every Brain call records tokens + **estimated USD** (`lib/brain/pricing.js` × actual tokens) into `ai_requests`.
- Control Centre (`/brain-admin`) shows durable totals by provider when the table exists; otherwise the process-local buffer.
- Estimates are an ops forecast — provider invoices remain the billing source of truth.

---

## Related feature manuals

| Feature | AI usage today |
|---------|----------------|
| [Pages](Pages.md) | Landing drafts via Brain API |
| [SEO](SEO.md) | Suburb intros still direct Anthropic |
| [Editor](Editor.md) | Hosts Landing pages tab |
| [Service Packs](Service%20Packs.md) | Pack generation still direct Anthropic |
| [Instagram](Instagram.md) / [Project Feed](Project%20Feed.md) | IG enrich still direct Anthropic |

---

## Do not

- Call provider APIs from the browser  
- Migrate remaining features without an approved phase  
- Echo API keys in Control Centre or logs  
- Assume usage history is durable across serverless isolates  
