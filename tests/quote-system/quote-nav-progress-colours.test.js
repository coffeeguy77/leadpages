/**
 * Online Quote — non-pill progress/nav buttons + wizard/section colour pickers.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '../..');
const online = fs.readFileSync(path.join(root, 'assets/lp-online-quote.js'), 'utf8');
const display = fs.readFileSync(path.join(root, 'assets/lp-quote-display.js'), 'utf8');
const builder = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.css'), 'utf8');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const serializers = fs.readFileSync(path.join(root, 'lib/quote-system/serializers.js'), 'utf8');
const normalize = fs.readFileSync(path.join(root, 'lib/quote-system/normalize-quote-config.js'), 'utf8');
const render = fs.readFileSync(path.join(root, 'api/render.js'), 'utf8');

assert.ok(!/\.lp-oq-step\{[^}]*border-radius:999px/.test(online), 'live progress chips must not be pills');
assert.ok(online.includes('border-radius:8px') && online.includes('.lp-oq-step{'), 'progress chips use 8px radius');
assert.ok(/\.lp-oq-step\{[^}]*padding:10px 18px/.test(online), 'progress padding matches Continue');
assert.ok(online.includes('--lp-oq-step-active-bg'), 'progress active colour var');
assert.ok(online.includes('--lp-oq-btn-bg'), 'continue button colour var');
assert.ok(online.includes('--lp-oq-label'), 'label contrast var');
assert.ok(online.includes('wizardUiVars'), 'applies wizardUiVars on card');

assert.ok(display.includes('function wizardUiVars'), 'wizardUiVars helper');
assert.ok(display.includes('--lp-oq-btn-ghost-border'), 'ghost button border var');
assert.ok(display.includes('--lp-oq-choice-text'), 'choice text var mapped');

assert.ok(builder.includes('_renderWizardUiColors'), 'builder wizard colour section');
assert.ok(builder.includes('progressActiveBg'), 'progress active colour picker');
assert.ok(builder.includes('btnBg'), 'continue colour picker');
assert.ok(builder.includes('labelColor'), 'label colour picker');
assert.ok(builder.includes('choiceText'), 'choice text colour picker');
assert.ok(builder.includes('wizard.ui'), 'wizard.ui paths');

assert.ok(!/\.oqb-preview-mock \.lp-oq-step \{[^}]*border-radius:\s*999px/.test(css), 'preview progress not pills');
assert.ok(/\.oqb-preview-mock \.lp-oq-step \{[^}]*border-radius:\s*8px/.test(css), 'preview progress uses 8px radius');
assert.ok(css.includes('--lp-oq-step-active-bg'), 'preview CSS uses step vars');
assert.ok(css.includes('--lp-oq-btn-bg'), 'preview CSS uses btn vars');
assert.ok(css.includes('--lp-oq-label'), 'preview uses label var');

assert.ok(manage.includes('onlineQuoteStyleCard'), 'section colour card');
assert.ok(manage.includes('wireOnlineQuoteStyle'), 'section colour wiring');
assert.ok(manage.includes('oq-eyebrow'), 'eyebrow colour picker');
assert.ok(manage.includes('oq-heading'), 'heading colour picker');

assert.ok(serializers.includes('ui: wizard.ui'), 'public shell includes ui');
assert.ok(normalize.includes('cfg.wizard.ui'), 'normalize ensures ui object');
assert.ok(render.includes('oq-bev-2up-1'), 'render cache-bust');
assert.ok(render.includes('eyebrowColor'), 'render applies section eyebrow colour');
assert.ok(render.includes('section-head'), 'render uses section-head for theme typography');

console.log('quote-nav-progress-colours.test.js: ok');
