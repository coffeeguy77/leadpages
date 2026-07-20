/**
 * Quote Builder — preview UX: section band, colour swatches, layout order.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '../..');
const builder = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.css'), 'utf8');
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

// Layout style must come after equipment + wizard colour blocks in _renderWizard
const wizFn = builder.slice(builder.indexOf('_renderWizard = function'), builder.indexOf('_itemCard = function'));
assert.ok(wizFn.indexOf('Equipment card styling') < wizFn.indexOf('_renderWizardUiColors'), 'equipment before wizard colours call');
assert.ok(wizFn.indexOf('_renderWizardUiColors') < wizFn.indexOf('Layout style'), 'layout style below wizard colours');
assert.ok(builder.indexOf("h4>Wizard colours</h4>") >= 0 || builder.includes("'Wizard colours'"), 'wizard colours section exists');


assert.ok(!builder.includes("if (self.tab === 'wizard') self.previewFocusCard = true"), 'wizard tab does not force single-card focus');
assert.ok(!/equipmentCards\) === 0\) self\.previewFocusCard = true/.test(builder), 'colour edits do not force single-card focus');

assert.ok(css.includes('.oqb-color-swatch'), 'swatch CSS');
assert.ok(css.includes('.oqb-oq-band'), 'section band CSS');
assert.ok(css.includes('lp-oq-preview-focus-single'), 'focus class matches planning.js');

assert.ok(manage.includes('oq-builder-head-root'), 'head host above preview');
assert.ok(manage.includes('oq-section-style-root'), 'section style host');
assert.ok(
  /oq-builder-head-root[\s\S]*?oq-preview-root[\s\S]*?oq-section-style-root[\s\S]*?oq-builder-root/.test(manage),
  'order: head → preview → section style → builder'
);
assert.ok(manage.includes('themeAccent'), 'passes site theme accent into builder');
assert.ok(manage.includes('lp-quote-builder.css?v=oq-preview-style-1'), 'cache-busted css');
assert.ok(render.includes('oq-preview-style-1'), 'public render cache-bust');

console.log('quote-preview-style-ux.test.js: ok');
