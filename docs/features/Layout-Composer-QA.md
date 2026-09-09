# Layout Composer — Phase 6 QA & rollout

## Feature flag

- Env: `LAYOUT_COMPOSER=1`
- Check: `GET /api/layout-composer/flags` → `{ enabled: true }`
- Entry: `/layout-composer` (also `?preview=1` for local UI review without env)
- Manage may show a soft **Layout Composer** button when enabled

## Manual checklist

1. **Flag off** — `/layout-composer` shows gate; manage New Site unchanged.
2. **Flag on** — entry opens; Presets require auth; Scratch works offline after catalogue load.
3. **DnD** — reorder sections; toggle off; Preview mode shows stack only.
4. **Confirm** — Fill step locked until confirm; Generate refuses `confirmed:false`.
5. **Generate** — returns `structureLocked: true`; section order unchanged.
6. **Research** — sources include confidence; disclaimer visible.
7. **Landings** — checkboxes; no automatic page create.
8. **Trade pack regression** — create missing trade → seed site **once** (no second AI confirm from false location usage).
9. **Themes** — existing Themes admin/apply still works; presets are copy-on-customise.
10. **Editor** — open manage after generate; session may hold last config in `sessionStorage.lp_layout_composer_last_config`.

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
