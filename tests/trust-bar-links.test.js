/**
 * Trust Bar — optional per-item links (section / landing page / external).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

describe('Trust Bar link fields', () => {
  it('manage.html schema includes linkAction and conditional targets', () => {
    const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
    assert.match(manage, /linkAction/);
    assert.match(manage, /linkTarget/);
    assert.match(manage, /linkPage/);
    assert.match(manage, /linkUrl/);
    assert.match(manage, /wireTrustBarLinks/);
    assert.match(manage, /External URL \(new tab\)/);
  });

  it('demo-shared renders linked badges and tiles', () => {
    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
    assert.match(demo, /function _tbLinkHref/);
    assert.match(demo, /function _tbWrapLink/);
    assert.match(demo, /function _tbShellOpen/);
    assert.match(demo, /target="_blank" rel="noopener noreferrer"/);
    assert.match(demo, /data-tb-scroll/);
    assert.match(demo, /location:'trustBar'/);
  });

  it('demo-shared CSS styles clickable trust bar items', () => {
    const css = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.css'), 'utf8');
    assert.match(css, /a\.tb-badge\.tb-link/);
    assert.match(css, /a\.tb-tile\.tb-link/);
  });

  it('playground editor exposes link controls', () => {
    const editor = fs.readFileSync(path.join(root, 'assets/js/marketplace/trust-bar-editor.js'), 'utf8');
    assert.match(editor, /TB_LINK_ACTIONS/);
    assert.match(editor, /data-k="linkAction"/);
    assert.match(editor, /tb-ed-link-url/);
    assert.match(editor, /syncLinkFields/);
  });
});
