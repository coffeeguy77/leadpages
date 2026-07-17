const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  pickAttribution,
  deriveTrafficSource,
  mergeAttributionIntoProps,
  attributionForLeadInsert
} = require('../lib/attribution');
const { matchFinalUrl, normalizePath } = require('../lib/google-ads/match-url');

describe('attribution', () => {
  it('derives google_ads from gclid', () => {
    assert.equal(deriveTrafficSource({ gclid: 'abc' }), 'google_ads');
  });

  it('picks camelCase and snake_case fields', () => {
    const a = pickAttribution({
      sessionId: 'session_1',
      visitor_id: 'visitor_1',
      gclid: 'g',
      utmSource: 'google',
      utm_medium: 'cpc'
    });
    assert.equal(a.session_id, 'session_1');
    assert.equal(a.visitor_id, 'visitor_1');
    assert.equal(a.utm_source, 'google');
    assert.equal(a.utm_medium, 'cpc');
    assert.equal(a.traffic_source, 'google_ads');
  });

  it('merges attribution into event props', () => {
    const props = mergeAttributionIntoProps({ location: 'heroCall' }, {
      session_id: 's1',
      gclid: 'x'
    });
    assert.equal(props.location, 'heroCall');
    assert.equal(props.session_id, 's1');
    assert.equal(props.gclid, 'x');
  });

  it('maps lead insert columns', () => {
    const row = attributionForLeadInsert({
      session_id: 's',
      gclid: 'g',
      traffic_source: 'google_ads'
    });
    assert.equal(row.session_id, 's');
    assert.equal(row.gclid, 'g');
    assert.equal(row.traffic_source, 'google_ads');
  });
});

describe('match-url', () => {
  const site = {
    slug: 'yass-valley',
    business_name: 'Yass Valley',
    config: {
      pages: [
        {
          id: 'page_abc',
          slug: 'heavy-vehicle-repairs',
          title: 'Heavy Vehicle Repairs',
          status: 'published',
          previousUrls: ['/diesel-mechanic-canberra']
        }
      ]
    }
  };

  it('normalizes paths', () => {
    assert.equal(normalizePath('https://example.com/Foo/Bar/'), '/foo/bar');
  });

  it('matches current slug and previous urls', () => {
    assert.equal(matchFinalUrl(site, 'https://yass.com/heavy-vehicle-repairs').pageId, 'page_abc');
    assert.equal(matchFinalUrl(site, 'https://leadpages.com.au/yass-valley/heavy-vehicle-repairs').pageId, 'page_abc');
    assert.equal(matchFinalUrl(site, 'https://yass.com/diesel-mechanic-canberra').pageId, 'page_abc');
  });

  it('matches homepage', () => {
    const m = matchFinalUrl(site, 'https://yass.com/');
    assert.equal(m.pageType, 'main');
    assert.equal(m.pageId, null);
  });
});
