# Replacement drafts

**Mode:** `replacement_draft`  
**Flag:** `WEBSITE_STUDIO_REPLACEMENT_DRAFT=1`

## Safety model

```text
Existing live site
  → immutable snapshot (config + operational pointers)
  → replacement draft workspace with Website Studio config
  → human-readable diff
  → preview / compare
  → discard or keep
```

The live `sites.config` row is **never updated** by this mode in Phase 5.

## Preserved on the live site

- Site ID, domains, published deployment
- Analytics / tracking IDs
- Form history, leads, CRM
- Billing, partner ownership
- Marketplace purchases

Replacement drafts carry **design and content configuration only**, not cloned lead data.

## UX outcomes

- Current site preview (live)
- Replacement draft preview
- Side-by-side change summary (`plan.diff` groups)
- Discard replacement → live unchanged
- Switching live to replacement is **out of scope** for Phase 5
