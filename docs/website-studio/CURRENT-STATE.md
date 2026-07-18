# Website Studio — Current State Report

**Updated:** 2026-07-18 (Phase 5 — controlled application)  
**Scope:** Website Studio + Composer + Image Service + Application layer.

---

## 1. What currently works

### Website Studio (`/theme-studio-v2`)

| Capability | Status |
|------------|--------|
| Brief → 3 concepts → compare → preview → refine → approve | Works (Phase 4) |
| Neutral-shell preview | Works |
| Create website from approved design | Works behind flags (Phase 5) |
| Replacement draft (live unchanged) | Works behind flags |
| Private template save | Works behind flags |
| Live publish / live overwrite | Not enabled by Phase 5 |

### Application layer (`lib/website-studio-application/`)

| Capability | Status |
|------------|--------|
| Pre-application validation | Works |
| Application plan + human diff | Works |
| Safe config assembler | Works |
| Image finalisation (import plan / mock) | Works |
| Audit + idempotency (memory + API) | Works |
| Feature flags default OFF | Works |

### AI Colour Assistant (`/theme-studio`)

Independent colour tool — **no** Website Studio application permissions.

---

## 2. Flags (default)

| Flag | Default |
|------|---------|
| `WEBSITE_STUDIO_APPLICATION` | OFF |
| `WEBSITE_STUDIO_CREATE_SITE` | OFF |
| `WEBSITE_STUDIO_REPLACEMENT_DRAFT` | OFF |
| `WEBSITE_STUDIO_PRIVATE_TEMPLATE` | OFF |
| `THEME_STUDIO_ALLOW_LIVE_APPLY` | OFF |

---

## 3. Explicitly not done

- Automatic publish of generated sites  
- Automatic replacement of live sites  
- Public Marketplace template publishing  
- Global rollout enablement  
- Partner/client AI image generation  

---

## 4. Tests

| Suite | Result |
|-------|--------|
| Full `npm test` | 334 pass / 0 fail (Phase 5 landing) |
