const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const platformSeo = require('../api/platform-seo');

describe('marketing SEO head helpers', () => {
  it('maps marketing files to clean public paths', () => {
    assert.equal(platformSeo.marketingPublicPath('home.html'), '/');
    assert.equal(platformSeo.marketingPublicPath('start-your-business.html'), '/start-your-business');
    assert.equal(
      platformSeo.marketingPublicPath('resource-winning-your-first-website-client.html'),
      '/resources/winning-your-first-website-client'
    );
    assert.equal(
      platformSeo.marketingPublicPath('marketplace-feature.html', '/marketplace/instagram-gallery'),
      '/marketplace/instagram-gallery'
    );
  });

  it('builds www canonical URLs', () => {
    assert.equal(platformSeo.marketingCanonicalUrl('home.html'), 'https://www.leadpages.com.au/');
    assert.equal(
      platformSeo.marketingCanonicalUrl('partners.html'),
      'https://www.leadpages.com.au/partners'
    );
  });

  it('injects canonical + og:url and replaces existing tags', () => {
    const html =
      '<!DOCTYPE html><html><head><title>t</title>' +
      '<link rel="canonical" href="https://old.example/">' +
      '<meta property="og:url" content="https://old.example/">' +
      '</head><body></body></html>';
    const out = platformSeo.injectMarketingHead(html, {}, { file: 'home.html' });
    assert.match(out, /rel="canonical" href="https:\/\/www\.leadpages\.com\.au\/"/);
    assert.match(out, /property="og:url" content="https:\/\/www\.leadpages\.com\.au\/"/);
    assert.doesNotMatch(out, /old\.example/);
  });

  it('injects google verification when method is meta', () => {
    const html = '<!DOCTYPE html><html><head><title>t</title></head><body></body></html>';
    const out = platformSeo.injectMarketingHead(
      html,
      { googleVerificationMethod: 'meta', googleSiteVerification: 'abc123' },
      { file: 'showcase.html' }
    );
    assert.match(out, /name="google-site-verification" content="abc123"/);
    assert.match(out, /href="https:\/\/www\.leadpages\.com\.au\/showcase"/);
  });
});
