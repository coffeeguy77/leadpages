/**
 * /manage adminnav — mobile must not clip tabs; drawer owns nav under 1024px.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/lp-admin-responsive.css'), 'utf8');

assert.ok(manage.includes('overflow-x:auto'), 'adminnav can scroll horizontally when visible');
assert.ok(manage.includes('flex-wrap:nowrap') || manage.includes('flex-wrap: nowrap'), 'adminnav nowrap for scroll');
assert.ok(manage.includes('.adminnav .anav-btn{flex:1 1 0') || manage.includes('flex:1 1 0'), 'tabs share full width');
assert.ok(manage.includes('lp-admin-responsive.css?v='), 'responsive CSS cache-busted');

assert.ok(css.includes('display: none !important'), 'mobile hide forced with !important');
assert.ok(css.includes('body.lp-compact-chrome #lp-nav-slot') || css.includes('#lp-nav-slot'), 'hides nav slot on compact chrome');
assert.ok(css.includes('.lp-drawer-body .lp-mm-layout-tabs .adminnav'), 'tabs layout display scoped to drawer');
assert.ok(css.includes('.lp-drawer-body .lp-mm-style-nav .adminnav'), 'nav style display scoped to drawer');
assert.ok(!/^[^/]*\.lp-mm-layout-tabs \.adminnav[\s\S]*display:\s*flex\s*!important/m.test(
  css.replace(/\.lp-drawer-body \.lp-mm-layout-tabs \.adminnav[\s\S]*?visibility:\s*visible\s*!important;/g, '')
) || css.indexOf('.lp-drawer-body .lp-mm-layout-tabs .adminnav') >= 0, 'no unscoped layout-tabs adminnav flex');

console.log('manage-nav-mobile.test.js: ok');
