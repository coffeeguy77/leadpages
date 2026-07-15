const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  aggregateRawEvents,
  dailyToStatsEvents,
  retentionCutoffIso,
  sumEventCounts,
  eventWeight,
  dayKey
} = require('../lib/event-rollup');

describe('event rollup', () => {
  it('aggregates raw rows into daily buckets with call locations', () => {
    const map = aggregateRawEvents([
      { site_id: 's1', event: 'page_view', created_at: '2026-01-01T10:00:00Z' },
      { site_id: 's1', event: 'page_view', created_at: '2026-01-01T11:00:00Z' },
      { site_id: 's1', event: 'call_click', created_at: '2026-01-01T12:00:00Z', props: { location: 'heroCall' } },
      { site_id: 's1', event: 'call_click', created_at: '2026-01-01T13:00:00Z', props: { location: 'heroCall' } },
      { site_id: null, event: 'page_view', created_at: '2026-01-01T10:00:00Z' },
      { site_id: 's1', event: 'nope', created_at: '2026-01-01T10:00:00Z' }
    ]);
    const rows = Array.from(map.values()).sort(function (a, b) { return a.event.localeCompare(b.event); });
    assert.equal(rows.length, 2);
    const pv = rows.find(function (r) { return r.event === 'page_view'; });
    const cc = rows.find(function (r) { return r.event === 'call_click'; });
    assert.equal(pv.count, 2);
    assert.equal(cc.count, 2);
    assert.equal(cc.locations.heroCall, 2);
  });

  it('expands daily rows with count for stats clients', () => {
    const events = dailyToStatsEvents([
      { site_id: 's1', day: '2026-01-01', event: 'page_view', count: 12, locations: null }
    ]);
    assert.equal(events[0].count, 12);
    assert.equal(events[0].rolled, true);
    assert.equal(dayKey(events[0].created_at), '2026-01-01');
    assert.deepEqual(sumEventCounts(events), { page_view: 12, call_click: 0, lead_submit: 0 });
    assert.equal(eventWeight({ count: 5 }), 5);
    assert.equal(eventWeight({}), 1);
  });

  it('aligns retention cutoff to UTC midnight', () => {
    const iso = retentionCutoffIso(Date.parse('2026-04-15T15:30:00Z'), 90);
    assert.equal(iso, '2026-01-15T00:00:00.000Z');
  });
});
