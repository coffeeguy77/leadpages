'use strict';

/**
 * Semrush adapter stub — failover candidate after Phase-0 bake-off.
 * Returns not_configured until SEMRUSH_API_KEY is set; live HTTP is Phase 4+.
 */

function configured() {
  return !!(
    String(process.env.SEMRUSH_API_KEY || process.env.SEMRUSH_KEY || '').trim()
  );
}

function notConfigured(op) {
  return {
    ok: false,
    provider: 'semrush',
    error: 'not_configured',
    operation: op,
    message:
      'Semrush adapter is reserved for failover. Set SEMRUSH_API_KEY after bake-off licensing review; live calls are not wired yet.'
  };
}

async function keywordIdeas() {
  return notConfigured('keywordIdeas');
}

async function serp() {
  return notConfigured('serp');
}

async function domainOverview() {
  return notConfigured('domainOverview');
}

async function rankCheck() {
  return notConfigured('rankCheck');
}

module.exports = {
  id: 'semrush',
  configured: configured,
  keywordIdeas: keywordIdeas,
  serp: serp,
  domainOverview: domainOverview,
  rankCheck: rankCheck
};
