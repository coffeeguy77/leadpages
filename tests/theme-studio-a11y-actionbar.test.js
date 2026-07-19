const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

describe('Website Studio a11y FAB vs action bar', () => {
  it('excludes studio/super-admin from marketing visitor a11y boot', () => {
    const js = fs.readFileSync(path.join(ROOT, 'assets/lp-logo.js'), 'utf8');
    assert.match(js, /lp-super-admin/);
    assert.match(js, /ws-body/);
    assert.match(js, /theme-studio-v2/);
  });

  it('hides #lpa-root on Website Studio body classes', () => {
    const css = fs.readFileSync(path.join(ROOT, 'assets/website-studio.css'), 'utf8');
    assert.match(css, /body\.ws-body\s+#lpa-root/);
    assert.match(css, /display:\s*none\s*!important/);
  });

  it('theme-studio-v2 uses ws-body + sticky Next action bar', () => {
    const html = fs.readFileSync(path.join(ROOT, 'theme-studio-v2.html'), 'utf8');
    assert.match(html, /class="[^"]*\bws-body\b/);
    assert.match(html, /id="ws-actionbar"/);
    assert.match(html, /id="btn-next"/);
  });
});
