# Layout Composer — Phase 6 QA & rollout

## Feature flag

- Env: `LAYOUT_COMPOSER=1`
- Check: `GET /api/layout-composer/flags` → `{ enabled: true }`
- Entry: `/layout-composer` (also `?preview=1` for local UI review without env)
- Manage may show a soft **Layout Composer** button when enabled

## Manual checklist

1. **Flag off** — `/layout-composer` shows gate; manage New Site unchanged.
2. **Flag on** — entry opens; Presets require auth; Scratch works offline after catalogue load.
3. **DnD** — reorder in Layout list **and** Preview (drop line shows insert point); also ↑ ↓ arrows; toggle off.
4. **Preview hierarchy** — proportional stack with spacing between blocks; short chrome bars (≈80px upload) use a compact readable row (no overlapping labels); no “% of hero height” copy. Stock example images only.
5. **Confirm** — Fill step locked until confirm; Generate refuses `confirmed:false`.
6. **Generate** — returns `structureLocked: true`; section order unchanged.
7. **Research** — sources include confidence; disclaimer visible.
8. **Landings** — checkboxes; no automatic page create.
9. **Trade pack regression** — create missing trade → seed site **once** (no second AI confirm from false location usage).
10. **Themes** — existing Themes admin/apply still works; presets are copy-on-customise.
11. **Editor** — open manage after generate; session may hold last config in `sessionStorage.lp_layout_composer_last_config`.

## Stock preview images (where to add them)

Preview uses **one stock example image per app/section** (not live client content).

1. Export / crop at the size shown on the preview block (also in catalogue `preview.uploadSizeLabel`).
   - Hero / hero slider / split hero: **1200×600px** (15 units)
   - Trust Bar with images: **1200×200px** (5 units ≈ 1/3 hero height)
   - Trust Bar text-only: **1200×120px** (3 units ≈ 1/5 hero height)
   - Other apps: `1200 × (units × 40)` px — see `lib/layout-composer/preview-stock.js`
2. Upload to Cloudinary folder **`leadpages/layout-composer/stock/`** (one file per app).
3. Paste the secure URL into `STOCK_IMAGE_URLS` in `lib/layout-composer/preview-stock.js`
   - Keys match section keys (`hero`, `heroSlider`, …)
   - Trust Bar variants: `trustBar__images` and `trustBar__text`
4. Redeploy. Until a URL is set, the composer shows a labelled SVG placeholder at the correct proportion.

Trust Bar variant (images vs text) is toggled on the section row in Layout mode — preview height updates immediately.

## Rollback

1. Set `LAYOUT_COMPOSER=0` (or unset) and redeploy.
2. Leave SQL tables in place (additive / unused is safe).
3. Do not delete Themes or trade-pack APIs.

## Automated tests

```bash
node --test tests/trade-pack-acquire-policy.test.js tests/layout-composer-phase2.test.js tests/layout-composer-phases-3-5.test.js
```


## End-to-end smoke (preview)

No env flag required for UI review:

1. Open `/layout-composer?preview=1`
2. **Start from scratch** → drag sections → Confirm layout
3. Enter business / trade / location → Generate content
4. Click **Continue in editor** → `/manage?layoutComposer=1`
5. Open a site → accept apply prompt → section copy merges into config

With flag:

- Set `LAYOUT_COMPOSER=1` so manage shows the Layout Composer button and `/layout-composer` opens without `?preview=1`.

Auth notes:

- Generate / research / landings work without sign-in (deterministic stubs).
- Preset Designs load live Themes (`positioning_layouts`, enabled partners+public) without requiring sign-in — same source as Themes Builder / demos. Customise is always a copy.
