'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

describe('header logo, section stroke, buy-bar gap', () => {
  it('trade + neutral shells centre logos without auto-hang and support stroke CSS', () => {
    for (const file of ['trade.template.json', 'landing-shell-neutral-v1.template.json']) {
      const html = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')).html;
      assert.equal(html.includes('headerHang==null&&_barH>0'), false, file + ' auto-hang');
      assert.match(html, /headerBarPadding/);
      assert.match(html, /L\.offsetX/);
      assert.match(html, /var\(--why-sec-stroke/);
      assert.match(html, /why-sec-stroke-off/);
      assert.match(html, /sp-sec-stroke-on/);
      assert.equal(
        html.includes('header.site{overflow:visible;isolation:isolate}'),
        false,
        file + ' isolation clip'
      );
    }
  });

  it('manage exposes bar padding, logo offsets, and How It Works section stroke', () => {
    const html = fs.readFileSync(path.join(ROOT, 'manage.html'), 'utf8');
    assert.match(html, /id="lg-hbar-pad"/);
    assert.match(html, /id="lg-valign"/);
    assert.match(html, /id="lg-offx"/);
    assert.match(html, /id="lg-offy"/);
    assert.match(html, /headerBarPadding/);
    assert.match(html, /id="sp-sec-stroke-on"/);
    assert.match(html, /Section stroke colour/);
  });

  it('buy bar CSS closes the light gap under the LeadPages footer', () => {
    const js = fs.readFileSync(path.join(ROOT, 'api/render.js'), 'utf8');
    assert.match(js, /margin-bottom:-76px/);
    assert.match(js, /#lpFooter\.lp-foot,#lpFooter/);
    assert.match(js, /padding-bottom:calc\(28px \+ 96px\)/);
  });
});
