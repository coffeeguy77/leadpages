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

test('example images fit the card without cover-crop', () => {
  assert.match(css, /\.ex-media img\s*\{[^}]*object-fit:\s*contain/s);
  assert.match(css, /\.ex\s*\{[^}]*aspect-ratio:\s*900\s*\/\s*1050/s);
  assert.match(css, /\.ex-nav\s*\{\s*display:\s*none/);
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
