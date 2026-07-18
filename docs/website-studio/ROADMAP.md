# Website Studio — Implementation Roadmap

**Rule:** Feature coding waits for approval after each phase stop.

---

## Phases 1–4 ✅

Architecture reset → Composer → Marketplace + Image Service → Generation UX + neutral renderer + approval.

---

## Phase 5 — Controlled application + safe rollout ✅

| Work | Detail |
|------|--------|
| Modes | create_site, replacement_draft, private_template |
| Validation | Pre-application deterministic checks |
| Plan / diff | Human-readable application plan |
| Assembler | Strip diagnostics; confirm contacts; finalise images |
| Flags | All application modes default OFF |
| Security | Cross-tenant, forged approval, publish rejection |
| Tests | Phase 5 suite + full regression |

**Stop:** No global rollout, no public Marketplace publishing, no automatic live replacement.

---

## Phase 6+ (not started)

| Work | Detail |
|------|--------|
| Live cutover | Controlled switch from replacement draft → live with backup |
| Durable audit table | Persist application audits beyond memory fallback |
| Marketplace publishing | Public template review pipeline |
| Audience rollout | Enable flags per stage |

---

## Explicit non-goals until approved

- Global `WEBSITE_STUDIO_APPLICATION=1` in production  
- Automatic live-site replacement  
- Partner/client AI images  
- Renaming `theme_studio_*` tables for cosmetics  
