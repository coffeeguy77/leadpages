'use strict';

const assert = require('assert');
const {
  digits,
  purgeStaleAdsMetrics,
  clearCustomerMetricsInRange
} = require('../lib/google-ads/metrics-scope');

assert.equal(digits('386-242-0047'), '3862420047');
assert.equal(digits('8375352023'), '8375352023');
assert.equal(digits(null), '');

/**
 * Minimal thenable query builder that applies chained filters on await.
 */
function makeAdmin(tables) {
  return {
    from(name) {
      const state = { filters: [], op: null };
      const runDelete = () => {
        const rows = tables[name] || [];
        tables[name] = rows.filter((row) => {
          // Keep rows that do NOT match all filters (delete = remove matches)
          const matches = state.filters.every((f) => {
            if (f.op === 'eq') return row[f.col] === f.val;
            if (f.op === 'neq') return row[f.col] != null && row[f.col] !== f.val;
            if (f.op === 'is') return row[f.col] == null;
            if (f.op === 'gte') return String(row[f.col]) >= String(f.val);
            if (f.op === 'lte') return String(row[f.col]) <= String(f.val);
            return false;
          });
          return !matches;
        });
        return { error: null };
      };
      const chain = {};
      const add = (op) => (col, val) => {
        state.filters.push({ op, col, val });
        return chain;
      };
      chain.eq = add('eq');
      chain.neq = add('neq');
      chain.is = add('is');
      chain.gte = add('gte');
      chain.lte = add('lte');
      chain.then = (resolve, reject) => Promise.resolve(runDelete()).then(resolve, reject);
      return {
        delete() {
          state.filters = [];
          return chain;
        }
      };
    }
  };
}

(async () => {
  const tables = {
    ads_metrics_daily: [
      { site_id: 's1', customer_id: '111', day: '2026-07-01', campaign_name: 'Coffee Sales' },
      { site_id: 's1', customer_id: '222', day: '2026-07-01', campaign_name: 'New Empty' },
      { site_id: 's1', customer_id: null, day: '2026-07-01', campaign_name: 'Legacy Null' }
    ],
    ads_keyword_daily: [
      { site_id: 's1', customer_id: '111', day: '2026-07-01' }
    ],
    ads_campaign_maps: [],
    ads_unmatched_urls: []
  };
  const r = await purgeStaleAdsMetrics(makeAdmin(tables), 's1', '222');
  assert.equal(r.ok, true);
  assert.equal(r.keep, '222');
  assert.deepEqual(
    tables.ads_metrics_daily.map((x) => x.campaign_name),
    ['New Empty']
  );
  assert.equal(tables.ads_keyword_daily.length, 0);

  const tables2 = {
    ads_metrics_daily: [
      { site_id: 's1', customer_id: '222', day: '2026-07-10', campaign_name: 'Coffee Sales' },
      { site_id: 's1', customer_id: '222', day: '2026-06-01', campaign_name: 'Old Keep' }
    ],
    ads_keyword_daily: [
      { site_id: 's1', customer_id: '222', day: '2026-07-10' }
    ]
  };
  const c = await clearCustomerMetricsInRange(makeAdmin(tables2), 's1', '222', '2026-07-01', '2026-07-31');
  assert.equal(c.ok, true);
  assert.equal(tables2.ads_metrics_daily.length, 1);
  assert.equal(tables2.ads_metrics_daily[0].campaign_name, 'Old Keep');
  assert.equal(tables2.ads_keyword_daily.length, 0);

  const wiped = { ads_metrics_daily: [{ site_id: 's1', customer_id: '111' }], ads_keyword_daily: [], ads_campaign_maps: [], ads_unmatched_urls: [{ site_id: 's1' }] };
  const all = await purgeStaleAdsMetrics(makeAdmin(wiped), 's1', null);
  assert.equal(all.mode, 'all');
  assert.equal(wiped.ads_metrics_daily.length, 0);

  console.log('ads-metrics-scope.test.js: ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
