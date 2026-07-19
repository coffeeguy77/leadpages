'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { searchMock } = require('../lib/image-service/providers/mock');
const { safePlaceholder } = require('../lib/image-service/ranking');
const {
  sandboxConfig,
  renderDraftPreviewHtml,
  isDeadMockImageUrl
} = require('../lib/theme-studio/render-preview');

describe('Website Studio — preview spinner / mock images', () => {
  it('mock provider uses inline data URIs instead of images.example.com', () => {
    const out = searchMock({ query: 'rc car track', orientation: 'landscape', perPage: 3 });
    assert.equal(out.ok, true);
    assert.ok(out.results.length >= 1);
    for (const r of out.results) {
      assert.match(r.sourceImageUrl, /^data:image\/svg\+xml/);
      assert.equal(isDeadMockImageUrl(r.sourceImageUrl), false);
    }
  });

  it('safe placeholders are inline data URIs', () => {
    const p = safePlaceholder({ subject: 'hero', imageBriefId: 'h1', altTextIntent: 'RC hero' });
    assert.match(p.selectedVariantUrl, /^data:image\/svg\+xml/);
    assert.match(p.sourceImageUrl, /^data:image\/svg\+xml/);
  });

  it('sandboxConfig rewrites legacy example.com image URLs before preview', () => {
    const cfg = sandboxConfig({
      name: 'RC Car Shop',
      sections: {
        hero: {
          on: true,
          title: 'RC Car Shop',
          image: 'https://images.example.com/rc-car/landscape-0.jpg',
          imageUrl: 'https://images.example.com/rc-car/landscape-0.jpg'
        }
      }
    });
    assert.match(cfg.sections.hero.image, /^data:image\/svg\+xml/);
    assert.match(cfg.sections.hero.imageUrl, /^data:image\/svg\+xml/);
  });

  it('rendered preview HTML never references images.example.com', () => {
    const html = renderDraftPreviewHtml({
      name: 'RC Car Shop',
      business: 'RC Car Shop',
      sectionOrder: ['hero', 'footer'],
      sections: {
        hero: {
          on: true,
          title: 'RC Car Shop',
          sub: 'Hobby retail',
          image: 'https://images.example.com/old-mock.jpg',
          imageUrl: 'https://images.example.com/old-mock.jpg'
        },
        footer: { on: true }
      },
      __websiteComposer: { contentInheritance: 'none' }
    });
    assert.doesNotMatch(html, /images\.example\.com/i);
    assert.doesNotMatch(html, /Refusing to render/i);
  });

  it('studio iframe starts at about:blank', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'theme-studio-v2.html'), 'utf8');
    assert.match(html, /id="preview"[^>]*src="about:blank"/);
  });
});
