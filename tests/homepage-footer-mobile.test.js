/**
 * Homepage footer: mobile columns, stroke support icons, Australia mark, support box.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const home = fs.readFileSync(path.join(ROOT, 'home.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'assets/marketing-home.css'), 'utf8');

test('support block uses FreeSVG Australia outline + phone + email icons', () => {
  assert.match(home, /f-ico-au/);
  assert.match(home, /freesvg\.org\/australia-map-outline-vector-illustration/);
  assert.match(home, /class="f-support support"/);
  assert.match(home, /href="tel:\+61262232200"/);
  assert.match(home, /02 6223 2200/);
  assert.match(home, /href="mailto:hello@leadpages\.com\.au"/);
  assert.doesNotMatch(home, /1300 532 114/);
  assert.doesNotMatch(home, /📞/);
  assert.doesNotMatch(home, /✉/);
  assert.match(home, /viewBox="0 0 674\.71 628\.37"/);
  assert.equal(
    fs.existsSync(path.join(ROOT, 'assets/marketing-home/australia-outline.svg')),
    true
  );
});

test('support icons are stroke SVGs sized for readability', () => {
  assert.match(home, /f-ico-au[\s\S]*stroke="currentColor"/);
  assert.match(home, /vector-effect="non-scaling-stroke"/);
  assert.match(home, /class="fphone"[\s\S]*stroke-width="2"/);
  assert.match(home, /class="email"[\s\S]*stroke-width="2"/);
  assert.match(css, /\.f-support\s+\.f-ico[\s\S]*width:\s*22px/);
});

test('Australia map sits large on the right of the support box', () => {
  assert.match(home, /f-support-copy/);
  assert.match(home, /f-support-map/);
  assert.match(home, /<h4>Australian support<\/h4>/);
  assert.doesNotMatch(home, /<h4>[\s\S]*f-ico-au[\s\S]*Australian support/);
  assert.match(css, /\.f-support\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/);
  assert.match(css, /\.f-support-map\s*\{/);
  assert.match(css, /\.f-support\s+\.f-ico-au[\s\S]*max-width:\s*124px/);
});

test('Australian support sits in a stroked box on desktop and mobile', () => {
  assert.match(css, /\.f-support\s*\{[^}]*border:\s*1px solid/);
  assert.match(css, /\.f-support\s*\{[^}]*border-radius:\s*14px/);
  // Desktop rule is not media-query scoped
  const desktopRule = css.match(/\.f-support\s*\{[^}]+\}/)?.[0] || '';
  assert.match(desktopRule, /border:\s*1px solid/);
  assert.doesNotMatch(desktopRule, /@media/);
});

test('mobile footer uses two columns with brand and support full-width', () => {
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.footer-grid\s*\{[\s\S]*grid-template-columns:\s*1fr 1fr/);
  assert.match(css, /\.footer-grid\s*>\s*\.f-brand/);
  assert.match(css, /\.footer-grid\s*>\s*\.f-support/);
  assert.match(css, /grid-column:\s*1\s*\/\s*-1/);
  assert.doesNotMatch(css, /\.cap-grid,\s*\.partner-grid,\s*\.footer-grid,\s*\.reassure/);
});
