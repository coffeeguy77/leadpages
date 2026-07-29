/**
 * Marketplace apps page — 1440 shell + stroke-icon design contract.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'marketplace.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/marketing-marketplace.css'), 'utf8');

test('marketplace uses 1440 shell and homepage colour tokens', () => {
  assert.match(css, /--max:\s*1440px/);
  assert.match(css, /--wide:\s*1440px/);
  assert.match(css, /--ink:\s*#0B1B2A/i);
  assert.match(css, /--orange:\s*#C85A2C/i);
  assert.match(css, /--cream:\s*#F4EBDE/i);
  assert.match(css, /--partner:\s*#9E4A23/i);
  assert.match(css, /Plus Jakarta Sans/);
  assert.match(html, /Plus\+Jakarta\+Sans/);
});

test('typography and controls are enlarged vs compact marketplace', () => {
  assert.match(css, /\.h1\s*\{[\s\S]*3\.875rem/);
  assert.match(css, /\.h2\s*\{[\s\S]*2\.875rem/);
  assert.match(css, /font:\s*700\s*17px/);
  assert.match(css, /\.pill[\s\S]*font:\s*700\s*16px/);
  assert.match(css, /\.mp-goal \.name\s*\{[\s\S]*font-size:\s*15px/);
  assert.match(css, /\.mp-app-desc\s*\{[\s\S]*font-size:\s*16px/);
});

test('icons are 2x stroke SVGs with no background boxes', () => {
  assert.match(css, /--ico-goal:\s*88px/);
  assert.match(css, /--ico-tile:\s*80px/);
  assert.match(css, /--ico-prem:\s*96px/);
  assert.match(css, /--ico-app:\s*80px/);
  assert.match(css, /\.mp-goal \.ico\s*\{[\s\S]*background:\s*none/);
  assert.match(css, /\.mp-tile \.ico\s*\{[\s\S]*background:\s*none/);
  assert.match(css, /\.mp-premium-block \.ico\s*\{[\s\S]*background:\s*none/);
  assert.match(css, /\.mp-app-icon\s*\{[\s\S]*background:\s*none/);
  assert.equal((html.match(/<svg viewBox="0 0 24 24"/g) || []).length >= 24, true);
  assert.doesNotMatch(html, /<span class="ico[^"]*">[^<\n]{1,4}<\/span>/);
  assert.match(html, /class="mp-app-icon"/);
});

test('industry band uses rust and section order matches mockup flow', () => {
  assert.match(css, /\.mp-industry\s*\{[\s\S]*background:\s*var\(--partner\)/);
  const ids = [...html.matchAll(/<section[^>]*id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, [
    'need',
    'popular',
    'match',
    'grow',
    'industry',
    'explore',
    'premium',
    'how',
    'proof',
    'faq',
    'partner'
  ]);
});
