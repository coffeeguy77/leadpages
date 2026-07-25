'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { formatSeoTextHtml, clientSource } = require('../lib/seo-text-format');

describe('seo-text-format', () => {
  it('turns blank lines into paragraphs and keeps single newlines as breaks', () => {
    const html = formatSeoTextHtml(
      'Line one\nLine two\n\nThis second block is a full paragraph with enough words to stay body copy.'
    );
    assert.match(html, /<p class="seotxt-p">Line one<br>\nLine two<\/p>/);
    assert.match(html, /<p class="seotxt-p">This second block is a full paragraph/);
  });

  it('promotes short title lines to equal bold section headings', () => {
    const html = formatSeoTextHtml(
      'Our Coffee Offerings\nWe boast a diverse range of specialty coffee for every event.\n\nCustom Branding Options\nAdd your logo to cups and banners.'
    );
    assert.match(html, /<h3 class="seotxt-subh">Our Coffee Offerings<\/h3>/);
    assert.match(html, /<p class="seotxt-p">We boast a diverse range/);
    assert.match(html, /<h3 class="seotxt-subh">Custom Branding Options<\/h3>/);
  });

  it('supports ## / ### and **bold** with equal heading weight', () => {
    const html = formatSeoTextHtml('## Why us\n\nWe are **local** experts.\n\n### More detail\n\nBody here.');
    assert.match(html, /<h3 class="seotxt-subh">Why us<\/h3>/);
    assert.match(html, /<strong class="seotxt-strong">local<\/strong>/);
    assert.match(html, /<h3 class="seotxt-subh">More detail<\/h3>/);
  });

  it('escapes HTML in user content', () => {
    const html = formatSeoTextHtml('<script>alert(1)</script>');
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
  });

  it('clientSource exposes __lpFormatSeoText', () => {
    assert.match(clientSource(), /function __lpFormatSeoText/);
  });
});
