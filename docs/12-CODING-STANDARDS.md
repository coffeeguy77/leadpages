# LeadPages Coding Standards

**Document:** `12-CODING-STANDARDS`  
**Status:** Definitive engineering standards for the LeadPages codebase  
**Audience:** All contributors and AI development agents  
**Prerequisites:** [00-VISION](00-VISION.md), [01-ARCHITECTURE](01-ARCHITECTURE.md)

> These standards preserve production stability for live customer sites while allowing fast iteration on a pragmatic serverless stack.

---

## Core Principles

| Principle | Rule |
|-----------|------|
| **Never break live sites** | `sites.config` merge-only; unknown keys survive |
| **Minimize scope** | Smallest correct diff; no drive-by refactors |
| **Match conventions** | Read surrounding code before adding patterns |
| **Serverless awareness** | Cold starts, bundle size, no long-running processes |
| **Fail safe on public endpoints** | Leads and events always return 200 |
| **No silent framework rewrites** | Vanilla HTML/JS unless explicitly approved |

---

## Repository Structure

| Area | Convention |
|------|------------|
| `api/*.js` | Vercel serverless functions — one file per route |
| `*.template.json` | Tenant HTML shells — `{ "html": "..." }` |
| `manage.html` | Control plane monolith — minimise unrelated edits |
| `lib/` | Shared modules (ESM for App Router, CJS for api where used) |
| `db/` / `db/migrations/` | SQL migrations |
| `docs/` | Engineering canon — update when behaviour changes |
| `app/` | Next.js App Router — suburb SEO, sitemap only |

---

## JavaScript Standards

### General

- Prefer **clear names** over abbreviations (except established globals: `sb`, `cfg`, `esc`)
- **Focused functions** — one responsibility
- **Document complex business logic** only where non-obvious
- Avoid hidden global side effects in new code
- When editing `manage.html`, **touch only related lines**

### Module patterns

| Context | Pattern |
|---------|---------|
| `api/*.js` | CommonJS `module.exports` |
| `app/`, `lib/seo/` | ESM `import`/`export` |
| Inline in HTML | IIFE wrapping editor code |

### HTML-in-JS

- Always **`esc()`** user content before HTML insertion
- Use `safeJson()` for config embedded in `<script>` tags
- Prefer `textContent` over `innerHTML` when possible

### Duplicates (technical debt)

Root `events.js` / `stats.js` duplicate `api/` versions — edit **`api/`** as canonical.

---

## API Standards

### Public endpoints (`leads`, `events`, render)

| Rule | Detail |
|------|--------|
| Always 200 to browser | Even on internal errors |
| Service role writes | Reliable insert without visitor auth |
| Tenant resolution | siteId → slug → business_name |
| Input validation | Sanitize strings; reject oversize payloads |
| No secret leakage | Generic errors to client; log server-side |

### Authenticated endpoints

| Rule | Detail |
|------|--------|
| Bearer JWT | `Authorization: Bearer <supabase_access_token>` |
| Role checks | `profiles.is_super_admin` for super routes |
| Partner gate | `partners.status === 'active'` |
| Strict tenant isolation | Filter by `site_id` / ownership |

### Response shape

```javascript
// Success
res.status(200).json({ ok: true, ... });

// Client error (authenticated routes)
res.status(400).json({ error: 'Human-readable message' });

// Never expose stack traces or env vars
```

### Shared helpers

Prefer existing patterns in neighbouring API files:
- `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`
- `esc()` for HTML
- `parseCookies()` in render.js

---

## Database Standards

| Rule | Detail |
|------|--------|
| Migrations in repo | `db/migrations/*.sql` — not console-only |
| Document new tables | Update [02-DATABASE](02-DATABASE.md) |
| RLS | Document policies; server uses service role where needed |
| JSONB config | Merge updates; never replace entire config blindly |
| New config fields | Defaults + documentation in 02/03/10 |

### Before changing database logic

Explain (in PR or commit):
1. Existing table usage
2. Access pattern (browser / serverless / service role)
3. Required migration
4. Rollback plan

---

## Config (`sites.config`) Standards

```javascript
// GOOD — merge
const next = { ...existing.config, newField: value };

// BAD — wipe
const next = { onlyNewFields };
```

- Add **defaults** for new keys in editor seed functions
- **Strip editor-only keys** on publish (`siteConfigForSave`)
- **Preserve unknown fields** from older sites
- Document shape in [02-DATABASE](02-DATABASE.md)

---

## Template Standards

See [03-TEMPLATE-SYSTEM](03-TEMPLATE-SYSTEM.md) § Rules for Template Changes.

- New `data-sec` sections need HTML shell + `applyCfg` branch + editor subtab
- No client-specific hardcoding in shared templates
- Test preview (`?preview=1`) and live render after changes

---

## Git Workflow

| Practice | Detail |
|----------|--------|
| Branch naming | `cursor/<descriptive-name>-99a9` for agent work |
| Commit messages | Complete sentences; explain why |
| One concern per commit | Avoid mixing refactor + feature |
| Documentation PRs | One doc file per PR |
| Do not merge without review | User approves PRs |

### Cloud agent documentation series

- One document per branch per PR
- Ready for Review (not draft)
- Never modify application code in doc-only PRs

---

## Environment Variables

| Rule | Detail |
|------|--------|
| Never commit secrets | Use Vercel env / local `.env` |
| Document in architecture | [01-ARCHITECTURE](01-ARCHITECTURE.md) env tables |
| Provide defaults where safe | `PRIMARY_HOSTS`, balance reserves |
| Fail loudly in dev | Throw if required key missing for privileged ops |

**Future:** `.env.example` (see [13-ROADMAP](13-ROADMAP.md)).

---

## Testing Standards

| Priority | Target |
|----------|--------|
| High | `api/render.js` gates, `api/leads.js`, `api/events.js` |
| Medium | Publish round-trip, trade pack seeding |
| Lower | Visual regression on templates |

**Useful tests only** — assert real behaviour, not trivial getters.

Current gap: limited automated tests — manual verify preview + live after changes.

---

## Security Standards

| Area | Rule |
|------|------|
| XSS | `esc()` on all interpolated HTML |
| Script breakout | `safeJson()` in templates |
| Auth on privileged APIs | No unprotected admin routes (fix known gaps) |
| Service role | Server only — never in browser |
| CORS / origin | Gate sensitive public POSTs where applicable |
| Rate limiting | Domain availability endpoint |

Known gaps: `api-partner-templates.js`, `api-site-apps.js` — add Bearer checks.

---

## AI Agent Rules

When working on LeadPages as an AI agent:

1. Read [00-VISION](00-VISION.md) and relevant topic doc first
2. **Never wipe `sites.config`**
3. **Do not change partner ownership logic** without explicit approval
4. **Do not convert to React SPA** without approval
5. Explain database changes before implementing
6. Documentation-only tasks: **never modify application code**
7. Prefer editing canonical files (`api/`, not root duplicates)

---

## Code Review Checklist

- [ ] Live sites won't break (config merge, template backwards compat)
- [ ] Public endpoints fail safe (200 + no visitor block)
- [ ] Tenant isolation enforced
- [ ] Secrets not logged or returned
- [ ] Scope minimal — no unrelated formatting
- [ ] Docs updated if behaviour changed
- [ ] Editor-only keys stripped on publish if touching broker-app

---

## Related Documentation

| Doc | Topic |
|-----|-------|
| [01-ARCHITECTURE](01-ARCHITECTURE.md) | System design |
| [02-DATABASE](02-DATABASE.md) | Schema rules |
| [13-ROADMAP](13-ROADMAP.md) | Planned improvements |

---

*Document maintained as part of the LeadPages engineering canon.*
