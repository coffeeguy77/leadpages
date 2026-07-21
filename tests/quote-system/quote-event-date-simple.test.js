const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { buildQuoteLeadContent } = require('../../lib/quote-system/crm');
const { calculateQuote } = require('../../lib/quote-system/calculator');
const { BEAN_CULTURE_QUOTE_CONFIG } = require('../../lib/quote-system/bean-culture-config');

const root = path.join(__dirname, '../..');

test('planning renders event date for simple hours mode', function() {
  const planning = fs.readFileSync(path.join(root, 'assets/lp-quote-planning.js'), 'utf8');
  assert.match(planning, /function renderEventDateField/);
  assert.match(planning, /data-field="eventDate"/);
  assert.match(planning, /syncEventFieldsFromDom/);
  assert.match(planning, /eventDate: state\.eventDate/);
  // Simple hours branch includes the date field
  assert.match(planning, /mode === 'hours'[\s\S]*renderEventDateField/);
});

test('live wizard validates event date on Continue', function() {
  const online = fs.readFileSync(path.join(root, 'assets/lp-online-quote.js'), 'utf8');
  assert.match(online, /eventDate: ''/);
  assert.match(online, /validateEventStep/);
  assert.match(online, /Please choose an event date/);
  assert.match(online, /syncEventFieldsFromDom/);
});

test('CRM includes eventDate for simple hours quotes', function() {
  const calc = calculateQuote(BEAN_CULTURE_QUOTE_CONFIG, {
    productId: 'coffee-cart',
    hours: 4,
    eventDate: '2026-08-15',
    labourPlanning: 'hours',
    guestCount: 80,
    beverageId: 'espresso-package',
    addonIds: [],
    travelZoneId: 'greater-sydney'
  });
  const payload = buildQuoteLeadContent({
    id: 'sess-date',
    contact_name: 'Test',
    email_verified_at: new Date().toISOString(),
    sms_verified_at: null
  }, calc, BEAN_CULTURE_QUOTE_CONFIG);

  assert.match(payload.message, /Event date: 2026-08-15/);
  assert.equal(payload.details.eventDate, '2026-08-15');
});

test('cache bust includes event date revision', function() {
  const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
  const render = fs.readFileSync(path.join(root, 'api/render.js'), 'utf8');
  assert.match(manage, /oq-builder-panel-1/);
  assert.match(render, /oq-builder-panel-1/);
});
