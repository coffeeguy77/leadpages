# Website Studio — On Ice

**Status:** Experimental / On Ice  
**Updated:** 2026-07-19  
**Audience:** Superuser pilot only

---

## Decision

Website Studio (Theme Studio V2) is **paused**. LeadPages is not shipping partner or client access to full-site generation.

The active product direction is:

**LeadPages Brain → Site Brain → Specialist AI Team → existing LeadPages editor**

See [`docs/ai-team/`](../ai-team/README.md).

---

## What is preserved

Do **not** delete:

- Routes (`/theme-studio-v2`, `/api/theme-studio/*`)
- Database tables (`theme_studio_*`, application audit tables)
- Drafts, versions, documentation, feature flags
- Website Composer code and compatibility identifiers

---

## Access

| Role | Access |
|------|--------|
| Superuser | Allowed when `THEME_STUDIO_V2` is on |
| Partner | **Denied** |
| Client | **Denied** |

Server gate: `lib/theme-studio/access.js` (`ROLE_POLICY.partner = false`).  
Client gate: `assets/website-studio.js` `canUseThemeStudio()` — superuser only.

Application / live apply flags remain **OFF** by default:

- `WEBSITE_STUDIO_APPLICATION`
- `WEBSITE_STUDIO_CREATE_SITE`
- `WEBSITE_STUDIO_REPLACEMENT_DRAFT`
- `WEBSITE_STUDIO_PRIVATE_TEMPLATE`
- `THEME_STUDIO_ALLOW_LIVE_APPLY`

---

## Rules

- No new Website Studio generation / Composer feature work without explicit product approval.
- Do not expose Studio to partners or clients.
- Do not rename Theme Studio APIs or database tables.
- AI Colour Assistant (`/theme-studio`, `BRAIN_THEME_STUDIO`) remains a separate product surface.

---

## Re-enablement

Requires explicit product approval, ROLE_POLICY change, client UX alignment, and a new pilot checklist. Until then, treat Studio as frozen experimental code.
