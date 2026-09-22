'use strict';

/**
 * Trust Bar — side image cards mode (photo left, icon, title, info, optional arrow).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

describe('Trust Bar side image cards', () => {
  it('manage.html exposes sideCards style and controls', () => {
    const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
    assert.match(manage, /option value="sideCards">Side image cards</);
    assert.match(manage, /id="tb-side-opts"/);
    assert.match(manage, /id="tb-ch"/);
    assert.match(manage, /id="tb-gap"/);
    assert.match(manage, /id="tb-cardbg"/);
    assert.match(manage, /id="tb-arrowon"/);
    assert.match(manage, /ens\(\)\.cardHeight/);
    assert.match(manage, /ens\(\)\.cardGap/);
    assert.match(manage, /ens\(\)\.showArrow/);
    assert.match(manage, /k:'text',label:'Info text \(side cards\)'/);
    assert.match(manage, /App \/ section on this page/);
  });

  it('trade template renders tb-sideCards markup and CSS', () => {
    const tpl = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8'));
    const html = tpl.html;
    assert.match(html, /tb-sideCards/);
    assert.match(html, /tb-scard/);
    assert.match(html, /tb-scard-title/);
    assert.match(html, /tb-scard-info/);
    assert.match(html, /tb-scard-arrow/);
    assert.match(html, /_tbMode==='sideCards'/);
    assert.match(html, /--tb-card-gap/);
    assert.match(html, /--tb-card-h/);
    assert.match(html, /showArrow/);
  });

  it('demo-shared mirrors sideCards render + link styles', () => {
    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
    assert.match(demo, /_tbMode==='sideCards'/);
    assert.match(demo, /tb-scard/);
    const css = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.css'), 'utf8');
    assert.match(css, /tb-sideCards/);
    assert.match(css, /a\.tb-scard\.tb-link/);
  });

  it('playground editor supports sideCards', () => {
    const editor = fs.readFileSync(path.join(root, 'assets/js/marketplace/trust-bar-editor.js'), 'utf8');
    assert.match(editor, /function tbModeOf/);
    assert.match(editor, /Side image cards/);
    assert.match(editor, /tb-side-opts/);
    assert.match(editor, /data-k="text"/);
    assert.match(editor, /App \/ section on this page/);
  });
});
