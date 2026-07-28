/**
 * Homepage hero metrics: 2-up on mobile, theme-token colours.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'assets/marketing-home.css'), 'utf8');
const home = fs.readFileSync(path.join(ROOT, 'home.html'), 'utf8');

test('homepage ships the four metric cards', () => {
  assert.match(home, /class="metrics"/);
  assert.match(home, /metric-calls/);
  assert.match(home, /metric-enq/);
  assert.match(home, /metric-reviews/);
  assert.match(home, /metric-ads/);
});

test('metrics stay two columns on small screens', () => {
  assert.match(
    css,
    /@media \(max-width: 900px\)[\s\S]*\.metrics\s*\{[\s\S]*grid-template-columns:\s*1fr 1fr/
  );
  assert.match(
    css,
    /@media \(max-width: 640px\)[\s\S]*\.metrics\s*\{[\s\S]*grid-template-columns:\s*1fr 1fr/
  );
  assert.doesNotMatch(
    css,
    /\.cap-grid,\s*\.partner-grid,\s*\.reassure,\s*\.connected-mobile,\s*\.metrics/
  );
});

test('metric card colours track homepage theme tokens', () => {
  assert.match(css, /\.metric-calls[\s\S]*var\(--green/);
  assert.match(css, /\.metric-enq[\s\S]*var\(--orange\)/);
  assert.match(css, /\.metric-reviews[\s\S]*var\(--gold\)/);
  assert.match(css, /\.metric-ads[\s\S]*var\(--navy\)/);
  assert.match(css, /\.si-green\s*\{\s*color:\s*var\(--green-check\)/);
  assert.match(css, /\.si-orange\s*\{\s*color:\s*var\(--orange\)/);
  assert.match(css, /\.si-gold\s*\{\s*color:\s*var\(--gold\)/);
  assert.match(css, /\.metric \.stars[\s\S]*var\(--gold\)/);
});
