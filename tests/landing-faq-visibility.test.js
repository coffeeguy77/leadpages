'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { hideInactiveSections, hideSec } = require('../lib/trade-render-guard');

const demoShared = fs.readFileSync(
  path.join(__dirname, '../marketplace/demos/demo-shared.js'),
  'utf8'
);
const tradeHtml = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../trade.template.json'), 'utf8')
).html;

describe('landing page FAQ visibility', () => {
  it('SSR hides homepage FAQ when sections.faq.on is false', () => {
    const html =
      '<main id="top"><section data-sec="faq" class="sec"><div class="faq"></div></section></main>';
    const out = hideInactiveSections(html, { sections: { faq: { on: false, items: [] } } });
    assert.match(out, /data-sec="faq"[^>]*\bhidden\b/i);
    assert.match(out, /display\s*:\s*none\s*!important/i);
  });

  it('applyCfg clears hidden when a section is turned back on', () => {
    assert.match(
      demoShared,
      /if\(s\.on===false\)\{[^}]*setAttribute\('hidden'/
    );
    assert.match(
      demoShared,
      /node\.removeAttribute\('hidden'\);\s*node\.style\.removeProperty\('display'\)/
    );
    assert.match(tradeHtml, /node\.removeAttribute\('hidden'\);\s*node\.style\.removeProperty\('display'\)/);
  });

  it('hybrid page render strips hidden from cloned page-app mounts', () => {
    assert.match(
      demoShared,
      /if\(node\)\{\s*node\.removeAttribute\('hidden'\);\s*node\.style\.removeProperty\('display'\);\s*html\+=node\.outerHTML;\s*\}/
    );
  });

  it('simulates browser reveal after SSR hide + applyCfg show', () => {
    // Minimal stand-in for the fixed visibility branch.
    function reveal(node, on) {
      if (on === false) {
        node.setAttribute('hidden', '');
        node.style.setProperty('display', 'none', 'important');
        return;
      }
      node.removeAttribute('hidden');
      node.style.removeProperty('display');
    }

    let html = '<section data-sec="faq" class="sec"><div class="faq"></div></section>';
    html = hideSec(html, 'faq');
    assert.match(html, /\bhidden\b/);

    // Rough DOM stub
    const node = {
      attrs: {},
      styleProps: {},
      setAttribute(k, v) {
        this.attrs[k] = v == null ? '' : String(v);
      },
      removeAttribute(k) {
        delete this.attrs[k];
      },
      hasAttribute(k) {
        return Object.prototype.hasOwnProperty.call(this.attrs, k);
      },
      style: {
        setProperty: (k, v) => {
          node.styleProps[k] = v;
        },
        removeProperty: (k) => {
          delete node.styleProps[k];
        }
      }
    };
    node.setAttribute('hidden', '');
    node.style.setProperty('display', 'none');

    reveal(node, true); // landing Unique FAQ on
    assert.equal(node.hasAttribute('hidden'), false);
    assert.equal(node.styleProps.display, undefined);
  });
});
