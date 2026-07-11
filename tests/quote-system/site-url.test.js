const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sitePublicUrl, quoteWizardReturnUrl } = require('../../lib/quote-system/site-url');

test('sitePublicUrl — path-based tenant', function() {
  assert.equal(
    sitePublicUrl({ slug: 'beanculture' }),
    'https://leadpages.com.au/beanculture'
  );
});

test('sitePublicUrl — custom domain', function() {
  assert.equal(
    sitePublicUrl({ slug: 'beanculture', custom_domain: 'www.bean-culture.com.au' }),
    'https://bean-culture.com.au/'
  );
});

test('quoteWizardReturnUrl — anchors online quote section', function() {
  assert.equal(
    quoteWizardReturnUrl({ slug: 'beanculture' }),
    'https://leadpages.com.au/beanculture#onlineQuote'
  );
});
