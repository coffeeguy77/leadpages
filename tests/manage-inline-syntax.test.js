/**
 * Guard: /manage must ship parseable inline JS.
 * A single SyntaxError leaves the App Command Centre as a dead shell
 * (empty Effective label / Last updated, default nav only).
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');
const os = require('os');

const root = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');

const scripts = [];
const re = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m;
while ((m = re.exec(manage))) {
  const code = m[1];
  if (code && code.trim()) scripts.push(code);
}

assert.ok(scripts.length >= 1, 'manage.html has inline scripts');
const big = scripts.reduce(function (a, b) {
  return a.length >= b.length ? a : b;
}, '');
assert.ok(big.length > 100000, 'main manage bootstrap script present');

const tmp = path.join(os.tmpdir(), 'leadpages-manage-inline-check.js');
fs.writeFileSync(tmp, big);
const checked = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
assert.equal(
  checked.status,
  0,
  'manage.html inline JS must parse:\n' + (checked.stderr || checked.stdout || '')
);

// Regression: Text Box secCard must close before string concat (PR #455 slip).
assert.ok(
  /secCard\(c,'textBox','Text Box',true,\[[\s\S]*?\]\]\)\s*\n\s*\+'/.test(manage),
  'textBox secCard(...) must close with ]) before + HTML concat'
);

console.log('manage-inline-syntax.test.js: ok');
