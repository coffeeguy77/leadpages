/**
 * Page editor apps lock: LOCK / Hide Inactive Apps / Show All Apps.
 * Locked = edit-only chips (no accidental off). Show All Apps unlocks.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'lp-themes.css'), 'utf8');

assert.ok(manage.includes('var secAppsLocked=true'), 'secAppsLocked defaults to locked');
assert.ok(manage.includes('Hide Inactive Apps'), 'renamed Hide Inactive Apps label');
assert.ok(manage.includes('Show All Apps'), 'renamed Show All Apps label');
assert.ok(manage.includes("data-mode=\"lock\""), 'LOCK button in modeseg');
assert.ok(manage.includes("secAppsLocked?'LOCKED':'LOCK'"), 'LOCK / LOCKED button label');
assert.ok(
  manage.includes('secHideInactive=false;\n              secAppsLocked=false;')
    || manage.includes('secHideInactive=false;\n              secAppsLocked=false'),
  'Show All Apps unlocks apps'
);
assert.ok(manage.includes('if(secAppsLocked){'), 'locked path uses edit-only chips');
assert.ok(
  manage.includes("class=\"sec-editonly lp-sec-editonly\"")
    && manage.includes('// Locked: edit-only chip'),
  'locked sections render edit-only chips'
);
assert.ok(!/data-mode="hide"[^>]*>Hide Inactive</.test(manage.replace(/\s+/g, ' ')), 'old Hide Inactive label gone from modeseg');
assert.ok(!manage.includes('>Show Features</button>'), 'old Show Features label gone');
assert.ok(css.includes('#sec-modeseg.sec-modeseg'), 'modeseg wrap styles for longer labels');
assert.ok(css.includes('.lp-sec-editonly[data-on="1"]'), 'edit-only on-state styling');

console.log('apps-lock-toggle.test.js: ok');
