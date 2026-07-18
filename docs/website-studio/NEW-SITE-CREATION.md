# New-site creation from Website Studio

**Mode:** `create_site`  
**Flag:** `WEBSITE_STUDIO_CREATE_SITE=1` (requires `WEBSITE_STUDIO_APPLICATION=1`)

## Workflow

1. Concept marked `approved-for-application` via **Save approval state** (not just “ready-for-review”)
2. User chooses **Create new website (draft)**
3. Confirm site name, slug, owner/account
4. Confirm **valid** business email + lead recipient + phone (e.g. `hello@business.com`)
5. Review application plan (apps, images, SEO) — read any blocking issues listed
6. Acknowledge warnings if any
7. `confirmPlan: true` → create site

Button meanings: [SAVE-OPTIONS.md](SAVE-OPTIONS.md).

## Site record

- New site ID + unique slug (conflict detection + edit before create)
- `status: 'draft'` — not publicly live
- Config from safe assembler (theme, typography, navigation, sections, forms, SEO)
- Provenance: `__websiteStudioSource`
- Appears in normal site lists / editor once created
- `seo.noindex: true` until normal publish

## Forms

Lead recipient must be explicitly confirmed. Partner email is not used as the default recipient unless `allowPartnerAsRecipient: true`.

## Not done automatically

- Publish / go live
- Domain attachment
- Analytics wiring
- Marketplace public listing
