/**
 * Quote Builder — preview UX: section band, colour swatches, layout order,
 * equipment grid horizontal, section controls under Wizard colours.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '../..');
const builder = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.css'), 'utf8');
const display = fs.readFileSync(path.join(root, 'assets/lp-quote-display.js'), 'utf8');
const planning = fs.readFileSync(path.join(root, 'assets/lp-quote-planning.js'), 'utf8');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const render = fs.readFileSync(path.join(root, 'api/render.js'), 'utf8');

assert.ok(builder.includes('headRoot'), 'builder accepts headRoot');
assert.ok(builder.includes('_sectionBandHtml'), 'preview includes section title band');
assert.ok(builder.includes('_renderSectionStyle'), 'section container style panel');
assert.ok(builder.includes('_colorField'), 'swatch + hex colour field helper');
assert.ok(builder.includes('_previewShell'), 'preview fills design-default colours');
assert.ok(builder.includes('oqb-color-hex'), 'editable hex input class');
assert.ok(builder.includes('data-oqb-color-def'), 'Default clears colour override');
assert.ok(builder.includes('Section container style'), 'section appearance label');

// Wizard tab order: equipment → wizard colours → page section → layout style
const wizFn = builder.slice(builder.indexOf('_renderWizard = function'), builder.indexOf('_itemCard = function'));
assert.ok(wizFn.indexOf('Equipment card styling') < wizFn.indexOf('_renderWizardUiColors'), 'equipment before wizard colours call');
assert.ok(wizFn.indexOf('_renderWizardUiColors') < wizFn.indexOf('_renderSectionStyle'), 'page section below wizard colours');
assert.ok(wizFn.indexOf('_renderSectionStyle') < wizFn.indexOf('Layout style'), 'layout style below page section');
assert.ok(builder.indexOf("h4>Wizard colours</h4>") >= 0 || builder.includes("'Wizard colours'"), 'wizard colours section exists');
assert.ok(builder.includes("Page section (above the wizard)"), 'page section label');

// Section style is embedded in wizard, not injected into sectionRoot
assert.ok(builder.includes('this.sectionRoot.innerHTML = \'\''), 'sectionRoot cleared (controls moved into wizard)');
assert.ok(!/sectionRoot\.innerHTML = this\._renderSectionStyle/.test(builder), 'section style not rendered into sectionRoot');

assert.ok(!builder.includes("if (self.tab === 'wizard') self.previewFocusCard = true"), 'wizard tab does not force single-card focus');
assert.ok(!/equipmentCards\) === 0\) self\.previewFocusCard = true/.test(builder), 'colour edits do not force single-card focus');

assert.ok(css.includes('.oqb-color-swatch'), 'swatch CSS');
assert.ok(css.includes('.oqb-oq-band'), 'section band CSS');
assert.ok(css.includes('lp-oq-preview-focus-single'), 'focus class matches planning.js');
assert.ok(css.includes('.oqb-preview-mock .lp-oq-fp-grid.fp-grid'), 'preview forces equipment horizontal grid');
assert.ok(css.includes('.lp-oq-choices:not(.lp-oq-fp-grid)'), 'chip grid rule excludes equipment cards');

// Equipment always gets fp-grid class; cards layout must not force column stack
assert.ok(planning.includes("gridCls = 'lp-oq-choices fp-grid lp-oq-fp-grid'"), 'equipment always uses fp-grid');
assert.ok(!display.includes(".lp-oq-layout-cards .lp-oq-fp-grid{display:flex;flex-direction:column"), 'cards layout no longer stacks equipment');
assert.ok(display.includes('auto-fit,minmax(200px,1fr)'), 'equipment row uses auto-fit columns');
assert.ok(!/layout-grid \.lp-oq-stack[\s\S]{0,160}minmax\(140px/.test(css), 'stack must never get chip 140px grid');

assert.ok(manage.includes('oq-builder-head-root'), 'head host above preview');
assert.ok(manage.includes('oq-section-style-root'), 'section style host (kept empty)');
assert.ok(
  /oq-builder-head-root[\s\S]*?oq-preview-root[\s\S]*?oq-section-style-root[\s\S]*?oq-builder-root/.test(manage),
  'order: head → preview → section style → builder'
);
assert.ok(manage.includes('themeAccent'), 'passes site theme accent into builder');
assert.ok(manage.includes('lp-quote-builder.css?v=oq-email-otp-fix-1'), 'cache-busted css');
assert.ok(render.includes('oq-email-otp-fix-1'), 'public render cache-bust');

console.log('quote-preview-style-ux.test.js: ok');
