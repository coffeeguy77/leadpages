/**
 * Online Quote — contrast colour pickers, theme typography, progress = nav button size.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '../..');
const online = fs.readFileSync(path.join(root, 'assets/lp-online-quote.js'), 'utf8');
const display = fs.readFileSync(path.join(root, 'assets/lp-quote-display.js'), 'utf8');
const builder = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.css'), 'utf8');
const render = fs.readFileSync(path.join(root, 'api/render.js'), 'utf8');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');

// New contrast colour keys
['labelColor', 'fieldText', 'fieldBg', 'choiceText', 'choiceDesc', 'bodyText'].forEach(function(k) {
  assert.ok(builder.includes("'" + k + "'") || builder.includes('"' + k + '"') || builder.includes("col('" + k + "'"), 'builder picker for ' + k);
  assert.ok(display.includes("'" + k + "'"), 'wizardUiVars maps ' + k);
});
assert.ok(display.includes('--lp-oq-label'), 'label CSS var');
assert.ok(display.includes('--lp-oq-choice-text'), 'choice text CSS var');
assert.ok(display.includes('--lp-oq-field-text'), 'field text CSS var');
assert.ok(builder.includes('Form &amp; choice text') || builder.includes('Form & choice text'), 'form & choice subsection');

// Live CSS consumes contrast vars (not bare --ink for choices/labels)
assert.ok(online.includes('var(--lp-oq-choice-text'), 'live choice text uses var');
assert.ok(online.includes('var(--lp-oq-choice-desc'), 'live choice desc uses var');
assert.ok(online.includes('var(--lp-oq-label'), 'live label uses var');
assert.ok(online.includes('var(--lp-oq-field-text'), 'live field text uses var');
assert.ok(online.includes('var(--lp-oq-body'), 'live body/radio uses var');

// Progress steps match nav button padding
assert.ok(/\.lp-oq-step\{[^}]*padding:10px 18px/.test(online), 'live progress padding matches btn');
assert.ok(/\.lp-oq-btn\{[^}]*padding:10px 18px/.test(online), 'live btn padding 10/18');
assert.ok(!/\.lp-oq-step\{[^}]*font-size:11px/.test(online), 'progress no longer 11px');
assert.ok(/\.oqb-preview-mock \.lp-oq-step \{[\s\S]*?padding:\s*9px 16px/.test(css), 'preview progress matches preview btn');
assert.ok(/\.oqb-preview-mock \.lp-oq-btn \{[\s\S]*?padding:\s*9px 16px/.test(css), 'preview btn padding');

// Section band matches trade theme typography
assert.ok(css.includes('font-size: 13px') && css.includes('letter-spacing: .16em'), 'eyebrow 13px / .16em');
assert.ok(css.includes('clamp(32px, 4.4vw, 52px)'), 'heading matches section-head h2');
assert.ok(/\.oqb-oq-intro \{[\s\S]*?font-size:\s*18px/.test(css), 'intro 18px like section-head p');
assert.ok(online.includes('.online-quote .eyebrow') && online.includes('letter-spacing:.16em'), 'live section eyebrow theme match');
assert.ok(online.includes('clamp(32px,4.4vw,52px)'), 'live section h2 theme size');
assert.ok(online.includes('font-size:18px') && online.includes('.online-quote .intro'), 'live intro 18px');

// Published markup uses section-head + eyebrow
assert.ok(render.includes('class="section-head"'), 'render wraps in section-head');
assert.ok(render.includes('class="eyebrow ey"') || render.includes("class=\"eyebrow ey\""), 'render uses eyebrow class');
assert.ok(render.includes('--oq-eyebrow'), 'section colour CSS vars');
assert.ok(render.includes('oq-bev-unified-1'), 'render cache-bust');
assert.ok(manage.includes('oq-bev-unified-1'), 'manage cache-bust');

// Choice cards horizontal for packages/addons
assert.ok(online.includes('.lp-oq-layout-cards .lp-oq-choices:not(.lp-oq-fp-grid)'), 'cards layout choice grid');
assert.ok(css.includes('.lp-oq-layout-cards .lp-oq-choices:not(.lp-oq-fp-grid)'), 'preview choice grid');

// Preview shell fills contrast defaults
assert.ok(builder.includes("fill(ui, 'labelColor'") || builder.includes('fill(ui, \'labelColor\''), 'preview fills labelColor');
assert.ok(builder.includes("fill(ui, 'choiceText'"), 'preview fills choiceText');

console.log('quote-wizard-contrast-type.test.js: ok');
