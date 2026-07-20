/**
 * Homepage must not redirect-loop (/ ↔ /home.html).
 * marketing-html must serve bundled HTML — never bounce missing files to /home.html.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const marketing = fs.readFileSync(path.join(root, 'api/marketing-html.js'), 'utf8');
const render = fs.readFileSync(path.join(root, 'api/render.js'), 'utf8');

assert.ok(fs.existsSync(path.join(root, 'home.html')), 'home.html present');
assert.ok(
  vercel.functions &&
    vercel.functions['api/marketing-html.js'] &&
    String(vercel.functions['api/marketing-html.js'].includeFiles || '').includes('home'),
  'marketing-html bundles home.html'
);
assert.ok(marketing.includes('readBundledHtml'), 'reads bundled HTML from disk');
assert.ok(!/setHeader\('location',\s*'\/'\s*\+\s*file\)/.test(marketing), 'no redirect to /file on miss');
assert.ok(
  !render.includes("setHeader('location', '/home.html')"),
  'render must not bounce primary / to /home.html'
);
assert.ok(render.includes("home.html"), 'render can serve home.html as fallback');
assert.ok(
  vercel.functions &&
    vercel.functions['api/render.js'] &&
    String(vercel.functions['api/render.js'].includeFiles || '').includes('home.html'),
  'render bundles home.html'
);

// Simulate the bundled reader against the repo copy.
const home = fs.readFileSync(path.join(root, 'home.html'), 'utf8');
assert.ok(home.includes('<!DOCTYPE html>') || home.includes('<html'), 'home.html looks like HTML');
assert.ok(home.length > 1000, 'home.html has content');

console.log('homepage-redirect-loop.test.js: ok');
