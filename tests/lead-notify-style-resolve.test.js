/**
 * Lead notify style resolution — site preset → config mirror → global → builtin.
 */
const assert = require('assert');
const {
  resolveLeadNotifyStyle,
  normalizeStyle,
  DEFAULT_STYLE
} = require('../lib/lead-notify-style');

function mockSb(rowsByTable) {
  return {
    from(table) {
      const state = { filters: [], limitN: null };
      const api = {
        select() {
          return api;
        },
        eq(k, v) {
          state.filters.push(function (r) {
            return r[k] === v;
          });
          return api;
        },
        is(k, v) {
          state.filters.push(function (r) {
            return (r[k] == null) === (v == null);
          });
          return api;
        },
        order() {
          return api;
        },
        limit(n) {
          state.limitN = n;
          return api;
        },
        then(resolve, reject) {
          try {
            let rows = (rowsByTable[table] || []).slice();
            state.filters.forEach(function (fn) {
              rows = rows.filter(fn);
            });
            if (state.limitN != null) rows = rows.slice(0, state.limitN);
            resolve({ data: rows, error: null });
          } catch (e) {
            reject(e);
          }
        }
      };
      return api;
    }
  };
}

(async function () {
  const pink = normalizeStyle({
    buttonBackground: '#f472b6',
    headerGradientEnd: '#f472b6'
  });

  // Site active preset wins
  let r = await resolveLeadNotifyStyle(
    mockSb({
      lead_notify_email_styles: [
        {
          id: '1',
          site_id: 'live',
          name: 'Bean Culture Pink',
          is_active: true,
          is_global_default: false,
          style: pink
        },
        {
          id: 'g',
          site_id: null,
          name: 'Global default',
          is_active: false,
          is_global_default: true,
          style: DEFAULT_STYLE
        }
      ]
    }),
    'live',
    null
  );
  assert.strictEqual(r.source, 'site');
  assert.strictEqual(r.presetName, 'Bean Culture Pink');
  assert.strictEqual(r.style.buttonBackground, '#f472b6');

  // Config mirror used when no active table row
  r = await resolveLeadNotifyStyle(
    mockSb({ lead_notify_email_styles: [] }),
    'live',
    {
      leadNotifyEmail: {
        activePresetName: 'From config',
        style: pink
      }
    }
  );
  assert.strictEqual(r.source, 'site_config');
  assert.strictEqual(r.style.buttonBackground, '#f472b6');

  // Wrong site id → builtin green (does not leak other site's pink)
  r = await resolveLeadNotifyStyle(
    mockSb({
      lead_notify_email_styles: [
        {
          id: '1',
          site_id: 'demo',
          name: 'Bean Culture Pink',
          is_active: true,
          is_global_default: false,
          style: pink
        }
      ]
    }),
    'live-production',
    null
  );
  assert.strictEqual(r.source, 'builtin');
  assert.strictEqual(r.style.buttonBackground, DEFAULT_STYLE.buttonBackground);

  console.log('lead-notify-style-resolve.test.js: ok');
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
