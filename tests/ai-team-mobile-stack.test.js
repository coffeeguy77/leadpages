/**
 * AI Website Team layout stacks on mobile (plans/tasks under recommendations).
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'assets/ai-website-team.js'), 'utf8');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');

assert.ok(ui.includes('ai-team-layout'), 'layout class present');
assert.ok(ui.includes('ai-team-layout-main'), 'main column class');
assert.ok(ui.includes('ai-team-layout-side'), 'side column class');
assert.ok(ui.includes('grid-template-columns:1fr'), 'mobile single column');
assert.ok(ui.includes('@media(min-width:900px)'), 'desktop two-column breakpoint');
assert.ok(ui.includes('class="ai-team-layout"'), 'paint uses layout class');
assert.ok(!ui.includes('style="display:grid;grid-template-columns:1.2fr .8fr'), 'no fixed dual-column inline style');
assert.ok(manage.includes('ai-website-team.js?v='), 'script cache-busted');

console.log('ai-team-mobile-stack.test.js: ok');
