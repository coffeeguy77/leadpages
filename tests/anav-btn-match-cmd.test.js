/**
 * Command Centre adminnav — match Publish/View button look; full-width equal flex.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const themes = fs.readFileSync(path.join(root, 'assets/lp-themes.css'), 'utf8');

assert.ok(manage.includes('.btn{') && manage.includes('font-size:13.5px'), 'command .btn uses 13.5px');
assert.ok(/\.anav-btn\{[^}]*font-size:13\.5px/.test(manage), 'anav matches btn font size');
assert.ok(/\.anav-btn\{[^}]*border:1px solid var\(--button-border/.test(manage), 'anav has button border');
assert.ok(/\.anav-btn\{[^}]*background:var\(--panel\)/.test(manage), 'anav ghost-like panel fill');
assert.ok(/\.anav-btn\{[^}]*border-radius:var\(--radius-sm/.test(manage), 'anav uses button radius');
assert.ok(manage.includes('.adminnav .anav-btn{flex:1 1 0'), 'anav buttons share row width');
assert.ok(/\.adminnav\{[^}]*width:100%/.test(manage) || manage.includes('width:100%;\n  gap:8px'), 'adminnav full width');
assert.ok(!/\.anav-btn\[aria-selected="true"\]\{[^}]*border-bottom:2px solid/.test(manage), 'selected is not underline tab');
assert.ok(themes.includes('background: var(--button-bg, var(--accent)) !important'), 'theme selected uses solid button fill');

console.log('anav-btn-match-cmd.test.js: ok');
