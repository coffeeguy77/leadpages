/**
 * Homepage website examples: Yass / AAM1 / Duncan’s, images fit the card.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const home = fs.readFileSync(path.join(ROOT, 'home.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'assets/marketing-home.css'), 'utf8');
const block = home.split('id="website-examples"')[1].split('id="pricing"')[0];

test('examples section uses the three live client designs', () => {
  assert.match(block, /Yass Valley Landscapes/);
  assert.match(block, /example-yass-valley\.jpg/);
  assert.match(block, /yassvalleylandscaping\.com\.au/);
  assert.match(block, />AAM1</);
  assert.match(block, /example-aam1\.jpg/);
  assert.match(block, /aam1\.com\.au/);
  assert.match(block, /Duncan.s Plumbing/);
  assert.match(block, /example-duncans\.jpg/);
  assert.match(block, /duncansplumbing\.com\.au/);
  assert.doesNotMatch(block, /NEWTOWN ELECTRICAL|THE LITTLE GROVE|CLEAR DIRECTION/);
  assert.doesNotMatch(block, /example-trades\.jpg|example-hospitality\.jpg|example-services\.jpg/);
});

test('example images sit above a solid navy caption band', () => {
  assert.match(css, /\.ex-media img\s*\{[^}]*object-fit:\s*cover/s);
  assert.match(css, /\.ex-frame\s*\{[^}]*aspect-ratio:\s*900\s*\/\s*920/s);
  assert.match(css, /\.ex\s*\{[^}]*display:\s*flex/s);
  assert.match(css, /\.ex\s*\{[^}]*flex-direction:\s*column/s);
  assert.match(css, /\.ex-nav\s*\{\s*display:\s*none/);
  assert.doesNotMatch(css, /\.ex-body\s*\{[^}]*position:\s*absolute/s);
});

test('site name and CTA sit on a navy band with outline badges beside the button', () => {
  assert.match(block, /class="ex-body"/);
  assert.match(block, /class="ex-actions"/);
  assert.match(block, /<span class="tag">Landscaping<\/span>/);
  assert.match(block, /<span class="tag">Rendering<\/span>/);
  assert.match(block, /<span class="tag">Plumbing<\/span>/);
  assert.match(block, /View Live Site/);
  assert.doesNotMatch(block, /<div class="tag">/);
  assert.match(css, /\.ex-body\s*\{[^}]*background:\s*var\(--navy/s);
  assert.match(css, /\.ex-body\s*\{[^}]*position:\s*relative/s);
  assert.match(css, /\.ex-body \.tag\s*\{[^}]*background:\s*transparent/s);
  assert.match(css, /\.ex-body \.tag\s*\{[^}]*border:\s*1\.5px solid #fff/s);
  assert.match(css, /\.ex-body \.tag\s*\{[^}]*color:\s*#fff/s);
  assert.match(css, /\.ex-actions\s*\{[^}]*display:\s*flex/s);
});

test('example image assets exist', () => {
  for (const f of [
    'example-yass-valley.jpg',
    'example-aam1.jpg',
    'example-duncans.jpg'
  ]) {
    const p = path.join(ROOT, 'assets/marketing-home', f);
    assert.ok(fs.existsSync(p), f);
    assert.ok(fs.statSync(p).size > 20000, f + ' non-trivial');
  }
});
