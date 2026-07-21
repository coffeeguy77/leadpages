/**
 * Hero slider colour swatches must mirror site theme defaults
 * (not a hardcoded #1a2230 for every field).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');

test('list editor colour helpers resolve site theme defaults', function() {
  assert.match(manage, /function listColorDefault\(/);
  assert.match(manage, /function listColorSwatchValue\(/);
  assert.match(manage, /function siteThemeColors\(/);
  assert.match(manage, /listColorSwatchValue\(_tv,_k,c\)/);
  assert.doesNotMatch(
    manage,
    /\.le-color[\s\S]{0,120}ci\.value=\([^)]*\)\?_tv:'#1a2230'/
  );
});

test('hero slide colour defaults map to theme roles', function() {
  // Extract listColorDefault body mapping
  const m = manage.match(/function listColorDefault\(key, c\)\{([\s\S]*?)\n  \}/);
  assert.ok(m, 'listColorDefault present');
  const body = m[1];
  assert.match(body, /highlightColor:t\.hivis/);
  assert.match(body, /featureTextColor:t\.white/);
  assert.match(body, /primaryCtaBg:t\.hivis/);
  assert.match(body, /primaryCtaFg:t\.white/);
  assert.match(body, /secondaryCtaBg:t\.white/);
  assert.match(body, /secondaryCtaFg:t\.ink/);
  assert.match(body, /bgColour:t\.steel/);
});

test('colour placeholder shows site default not hardcoded steel', function() {
  assert.match(manage, /placeholder="'\+_cdef\+'\s*\(site\)"/);
});
