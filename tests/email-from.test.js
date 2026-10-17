'use strict';

/** Every email the platform sends comes from leadpages.com.au (never webculture.au). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const path = require('path');

test('no email sender falls back to a webculture.au address', () => {
  const root = path.join(__dirname, '..');
  const hits = execSync("git grep -n 'noreply@[a-z.]*webculture' -- api lib || true", { cwd: root }).toString().trim();
  assert.equal(hits, '', hits);
  const ok = execSync("git grep -c 'LeadPages <noreply@leadpages.com.au>' -- api lib || true", { cwd: root }).toString();
  assert.ok(ok.split('\n').filter(Boolean).length >= 11);
});
