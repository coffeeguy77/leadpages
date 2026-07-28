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

test('Australian support heading matches phone number font size', () => {
  assert.match(css, /\.f-support h4\s*\{[^}]*font-size:\s*17px/);
  assert.match(css, /\.f-support \.fphone[\s\S]*font-size:\s*17px/);
  assert.match(
    css,
    /@media \(max-width: 640px\)[\s\S]*\.f-support h4\s*\{[\s\S]*font-size:\s*18px/
  );
  assert.match(
    css,
    /@media \(max-width: 640px\)[\s\S]*\.f-support \.fphone[\s\S]*font-size:\s*18px/
  );
});

test('Australia map sits large on the right of the support box', () => {
  assert.match(home, /f-support-copy/);
  assert.match(home, /f-support-map/);
  assert.match(home, /<h4>Australian support<\/h4>/);
  assert.doesNotMatch(home, /<h4>[\s\S]*f-ico-au[\s\S]*Australian support/);
  assert.match(css, /\.f-support\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/);
  assert.match(css, /\.f-support-map\s*\{/);
  assert.match(css, /\.f-support\s+\.f-ico-au[\s\S]*max-width:\s*156px/);
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

test('desktop footer gives Australian support 2x menu column width', () => {
  assert.match(
    css,
    /\.footer-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(150px,\s*1\.25fr\)\s+repeat\(4,\s*minmax\(0,\s*1fr\)\)\s+minmax\(260px,\s*2fr\)/
  );
  assert.match(css, /\.footer-grid\s*\{[\s\S]*column-gap:\s*clamp\(28px/);
  assert.match(home, /class="f-col"/);
  assert.match(
    css,
    /@media \(max-width: 1100px\)[\s\S]*\.footer-grid\s*>\s*\.f-support\s*\{\s*grid-column:\s*span 2/
  );
});

test('footer bottom is compact with tagline, ABN, and right-aligned legal links', () => {
  assert.match(home, /class="f-tagline"/);
  assert.match(home, /The One website\./);
  assert.match(home, /Everything/);
  assert.match(home, /connected\./);
  assert.match(home, /class="f-abn"[^>]*>[\s\S]*class="f-abn-label">ABN<\/span>[\s\S]*class="f-abn-num">33&nbsp;600&nbsp;754&nbsp;676/);
  assert.match(home, /class="f-bottom-meta"/);
  assert.match(css, /\.f-tagline\s*\{/);
  assert.match(css, /\.f-bottom-meta\s*\{[\s\S]*justify-content:\s*space-between/);
  assert.match(css, /\.f-abn\s*\{[\s\S]*display:\s*inline-flex[\s\S]*flex-wrap:\s*nowrap/);
  assert.match(css, /\.f-abn-label,\s*\n\.f-abn-num\s*\{[\s\S]*white-space:\s*nowrap/);
  assert.match(css, /\.f-links\s*\{[\s\S]*margin-left:\s*auto/);
  assert.match(
    css,
    /@media \(max-width: 640px\)[\s\S]*\.f-tagline span\s*\{\s*display:\s*block/
  );
  assert.match(
    css,
    /@media \(max-width: 640px\)[\s\S]*\.f-legal\s*\{[\s\S]*min-width:\s*min-content/
  );
});

test('connected tools stay two-up and elevated on mobile', () => {
  assert.match(css, /\.connected-mobile\s*\{[\s\S]*grid-template-columns:\s*1fr 1fr/);
  assert.doesNotMatch(
    css,
    /\.cap-grid,\s*\.partner-grid,\s*\.reassure,\s*\.connected-mobile/
  );
  assert.match(css, /\.connected-mobile \.cnode\s*\{[\s\S]*border-radius:\s*16px/);
});
