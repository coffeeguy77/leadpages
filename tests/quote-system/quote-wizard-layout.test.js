const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const online = fs.readFileSync(path.join(root, 'assets/lp-online-quote.js'), 'utf8');
const planning = fs.readFileSync(path.join(root, 'assets/lp-quote-planning.js'), 'utf8');
const builder = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.css'), 'utf8');
const render = fs.readFileSync(path.join(root, 'api/render.js'), 'utf8');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');

test('contact step uses two-column layout with quote slot', function() {
  assert.match(online, /lp-oq-cols-contact/);
  assert.match(online, /lp-oq-col-contact/);
  assert.match(online, /lp-oq-col-aside/);
  assert.match(online, /partitionCustomFields/);
  // Quote verification UI must stay on Your Details only (not every step).
  assert.doesNotMatch(online, /stepKey !== 'contact'/);
  assert.match(online, /contactSelf\.renderQuotePanel\(\)/);
  assert.match(builder, /lp-oq-cols-contact/);
  assert.match(builder, /lp-oq-col-aside/);
});

test('event step splits schedule and staffing columns', function() {
  assert.match(online, /lp-oq-cols-event/);
  assert.match(online, /Event schedule/);
  assert.match(online, /Barista staffing/);
  assert.match(builder, /lp-oq-cols-event/);
});

test('wizard card locks body height so Continue stays put', function() {
  assert.match(online, /--lp-oq-card-min:640px/);
  assert.match(online, /min-height:var\(--lp-oq-card-min\)/);
  assert.match(online, /overflow:visible/);
  // Shared min-height only — no fixed height that forces an inner scroller.
  assert.doesNotMatch(online, /;height:var\(--lp-oq-card-min\)/);
  assert.match(online, /margin-top:auto/);
  assert.match(css, /min-height: 640px/);
  assert.doesNotMatch(css, /^\s*height:\s*640px/m);
});

test('theme calendar is a compact popup date picker', function() {
  assert.match(planning, /renderEventCalendar/);
  assert.match(planning, /data-lp-oq-cal/);
  assert.match(planning, /wireEventCalendar/);
  assert.match(planning, /lp-oq-datepick-trigger/);
  assert.match(planning, /lp-oq-cal-pop/);
  assert.match(planning, /lp-oq-shift-row/);
  assert.doesNotMatch(online, /max-height:calc\(3 \*/);
  assert.match(online, /lp-oq-cal-day/);
  assert.match(online, /--lp-oq-cal-icon/);
  assert.match(online, /lp-oq-datepick/);
  assert.match(css, /lp-oq-cal-day/);
  assert.match(builder, /calendarIconColor/);

  const windowObj = { LPQuoteDisplay: null, LPQuoteWizardLogic: {} };
  windowObj.window = windowObj;
  const sandbox = { window: windowObj, console: console, document: { addEventListener: function() {} } };
  vm.createContext(sandbox);
  vm.runInContext(planning, sandbox);
  const P = sandbox.window.LPQuotePlanning;
  const closed = P.renderEventCalendar({ eventDate: '2026-07-21', _calView: '2026-07' });
  assert.match(closed, /data-lp-oq-cal/);
  assert.match(closed, /data-field="eventDate"/);
  assert.match(closed, /lp-oq-datepick-trigger/);
  assert.doesNotMatch(closed, /lp-oq-cal-pop/);
  const open = P.renderEventCalendar({ eventDate: '2026-07-21', _calView: '2026-07', _calOpen: 'event' });
  assert.match(open, /lp-oq-cal-pop/);
  assert.match(open, /data-cal-day="2026-07-21"/);
  assert.match(open, /is-selected/);
  const parts = P.partitionCustomFields([
    { id: 'loc', type: 'text', label: 'Event location' },
    { id: 'info', type: 'textarea', label: 'Event information' }
  ]);
  assert.equal(parts.left.length, 1);
  assert.equal(parts.right.length, 1);
});

test('cache bust for layout + calendar', function() {
  assert.match(manage, /oq-no-scroll-1/);
  assert.match(render, /lp-online-quote\.js\?v=oq-no-scroll-1/);
});
