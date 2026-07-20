/**
 * Mobile menu builder — builder-tab catalog includes AI Website Team + newer tabs.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const mm = fs.readFileSync(path.join(root, 'assets/lp-mobile-menu-builder.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'api/admin-command-menu.js'), 'utf8');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');

assert.ok(mm.includes("'nav-ai-team': 'AI Website Team'"), 'AI Website Team in NAV_TAB_CATALOG');
assert.ok(mm.includes("'nav-advertising': 'Advertising'"), 'Advertising in catalog');
assert.ok(mm.includes("'nav-onlinequotes': 'Online quotes'"), 'Online quotes in catalog');
assert.ok(mm.includes("'nav-mailer': 'Newsletter'"), 'Newsletter in catalog');
assert.ok(mm.includes("'nav-messages': 'Support'"), 'Support in catalog');
assert.ok(mm.includes("{ id: 'nav-ai-team'"), 'AI Website Team in DEFAULT_BUILDER_ITEMS');
assert.ok(mm.includes("{ id: 'nav-onlinequotes'"), 'Online quotes in DEFAULT_BUILDER_ITEMS');
assert.ok(mm.includes("{ id: 'nav-advertising'"), 'Advertising in DEFAULT_BUILDER_ITEMS');

assert.ok(api.includes("'nav-ai-team'"), 'API default manage menu includes AI Website Team');
assert.ok(api.includes("'nav-onlinequotes'"), 'API default includes Online quotes');
assert.ok(api.includes("'nav-advertising'"), 'API default includes Advertising');
assert.ok(api.includes("'nav-mailer'"), 'API default includes Newsletter');

assert.ok(manage.includes('lp-mobile-menu-builder.js?v='), 'mobile menu script cache-busted');
assert.ok(manage.includes('id="nav-ai-team"'), 'manage.html has AI Website Team tab button');

console.log('mobile-menu-ai-team-nav.test.js: ok');
