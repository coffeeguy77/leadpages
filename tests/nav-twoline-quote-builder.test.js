/**
 * Command Centre adminnav — two-line labels + Quote Builder rename.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const mm = fs.readFileSync(path.join(root, 'assets/lp-mobile-menu-builder.js'), 'utf8');

assert.ok(manage.includes('class="anav-l1"') || manage.includes("class=\"anav-l1\""), 'two-line label spans present');
assert.ok(manage.includes('anav-l2'), 'second-line class present');
assert.ok(manage.includes('flex-direction:column'), 'anav-btn stacks lines');
assert.ok(manage.includes('aria-label="Quote Builder"'), 'Quote Builder aria-label');
assert.ok(manage.includes('>Quote</span>') && manage.includes('>Builder</span>'), 'Quote Builder two-line label');
assert.ok(!manage.includes('>Online quotes</button>'), 'Online quotes button label removed');
assert.ok(manage.includes('aria-label="App Marketplace"'), 'App Marketplace aria-label');
assert.ok(manage.includes('>App</span>') && manage.includes('>Marketplace</span>'), 'App Marketplace two-line');
assert.ok(manage.includes('aria-label="AI Website Team"'), 'AI Website Team aria-label');
assert.ok(manage.includes('>AI Website</span>') && manage.includes('>Team</span>'), 'AI Website Team two-line');
assert.ok(manage.includes('aria-label="Landing pages"'), 'Landing pages aria-label');
assert.ok(mm.includes("'nav-onlinequotes': 'Quote Builder'"), 'mobile catalog renamed');

console.log('nav-twoline-quote-builder.test.js: ok');
