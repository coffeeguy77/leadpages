'use strict';

/**
 * DataForSEO adapter stub — no live HTTP until credentials are configured.
 * See docs/search-intelligence/04-PROVIDER-GATEWAY.md
 */

function notConfigured(op) {
  return Promise.resolve({
    ok: false,
    provider: 'dataforseo',
    error: 'not_configured',
    operation: op,
    message: 'DataForSEO credentials are not configured. Complete Phase 0 bake-off and set provider env vars before enabling live calls.'
  });
}

module.exports = {
  id: 'dataforseo',
  keywordIdeas: function () { return notConfigured('keywordIdeas'); },
  serp: function () { return notConfigured('serp'); },
  domainOverview: function () { return notConfigured('domainOverview'); },
  rankCheck: function () { return notConfigured('rankCheck'); }
};
