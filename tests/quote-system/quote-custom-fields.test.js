const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  resolveWizardSteps,
  ensureCustomStepInSteps,
  normalizeCustomFields,
  customFieldsFor
} = require('../../lib/quote-system/wizard');
const { normalizeQuoteConfig } = require('../../lib/quote-system/normalize-quote-config');
const { publicProductLabels } = require('../../lib/quote-system/serializers');
const { buildQuoteLeadContent } = require('../../lib/quote-system/crm');
const { calculateQuote } = require('../../lib/quote-system/calculator');
const { BEAN_CULTURE_QUOTE_CONFIG } = require('../../lib/quote-system/bean-culture-config');

const root = path.join(__dirname, '../..');

test('normalizeCustomFields — types, options, attachTo', function() {
  const fields = normalizeCustomFields([
    { label: 'Venue name', type: 'text', required: true, attachTo: 'event' },
    { label: 'Event type', type: 'select', options: 'Wedding\nCorporate', attachTo: 'custom' },
    { label: 'Parking notes', type: 'textarea', attachTo: 'bogus' },
    { label: 'Agree', type: 'checkbox', attachTo: 'contact' }
  ]);
  assert.equal(fields.length, 4);
  assert.equal(fields[0].attachTo, 'event');
  assert.equal(fields[0].required, true);
  assert.deepEqual(fields[1].options, ['Wedding', 'Corporate']);
  assert.equal(fields[2].attachTo, 'custom');
  assert.equal(fields[3].type, 'checkbox');
});

test('ensureCustomStepInSteps — inserts custom before contact', function() {
  const steps = ensureCustomStepInSteps(
    ['equipment', 'event', 'contact'],
    [{ id: 'f1', label: 'Venue', type: 'text', attachTo: 'custom' }]
  );
  assert.deepEqual(steps, ['equipment', 'event', 'custom', 'contact']);
});

test('ensureCustomStepInSteps — removes custom when no dedicated fields', function() {
  const steps = ensureCustomStepInSteps(
    ['equipment', 'custom', 'contact'],
    [{ id: 'f1', label: 'Venue', type: 'text', attachTo: 'event' }]
  );
  assert.deepEqual(steps, ['equipment', 'contact']);
});

test('resolveWizardSteps — custom step only when fields attach there', function() {
  const wizard = {
    steps: ['equipment', 'custom', 'contact'],
    customFields: [
      { id: 'venue', label: 'Venue', type: 'text', attachTo: 'event' }
    ]
  };
  assert.deepEqual(resolveWizardSteps(wizard, {}, 0), ['equipment', 'contact']);

  wizard.customFields.push({ id: 'notes', label: 'Notes', type: 'textarea', attachTo: 'custom' });
  assert.deepEqual(resolveWizardSteps(wizard, {}, 0), ['equipment', 'custom', 'contact']);
});

test('customFieldsFor — filters by attachTo', function() {
  const wizard = {
    customFields: [
      { id: 'a', label: 'A', type: 'text', attachTo: 'event' },
      { id: 'b', label: 'B', type: 'text', attachTo: 'custom' },
      { id: 'c', label: 'C', type: 'text', attachTo: 'contact' }
    ]
  };
  assert.equal(customFieldsFor(wizard, 'event').length, 1);
  assert.equal(customFieldsFor(wizard, 'custom')[0].id, 'b');
  assert.equal(customFieldsFor(wizard, 'contact')[0].id, 'c');
});

test('normalizeQuoteConfig — persists customFields and step', function() {
  const cfg = normalizeQuoteConfig({
    wizard: {
      steps: ['equipment', 'contact'],
      customFields: [{ label: 'Venue postcode', type: 'text', attachTo: 'custom', required: true }]
    }
  });
  assert.equal(cfg.wizard.customFields.length, 1);
  assert.ok(cfg.wizard.customFields[0].id);
  assert.ok(cfg.wizard.steps.indexOf('custom') >= 0);
  assert.equal(cfg.wizard.steps[cfg.wizard.steps.length - 1], 'contact');
});

test('publicProductLabels — exposes customFields on wizard shell', function() {
  const shell = publicProductLabels({
    products: [],
    beverages: [],
    addons: [],
    travel: { zones: [] },
    wizard: {
      steps: ['equipment', 'custom', 'contact'],
      customFields: [{
        id: 'venue',
        type: 'text',
        label: 'Venue name',
        required: true,
        attachTo: 'custom',
        placeholder: 'Street address'
      }]
    }
  });
  assert.equal(shell.wizard.customFields.length, 1);
  assert.equal(shell.wizard.customFields[0].label, 'Venue name');
  assert.equal(shell.wizard.customFields[0].required, true);
});

test('buildQuoteLeadContent — includes customAnswers in CRM details', function() {
  const calc = calculateQuote(BEAN_CULTURE_QUOTE_CONFIG, {
    productId: 'coffee-cart',
    hours: 3,
    guestCount: 80,
    beverageId: 'espresso-package',
    addonIds: [],
    travelZoneId: 'greater-sydney',
    customAnswers: { venue: 'Bondi Pavilion', parking: true }
  });
  const config = JSON.parse(JSON.stringify(BEAN_CULTURE_QUOTE_CONFIG));
  config.wizard = config.wizard || {};
  config.wizard.customFields = [
    { id: 'venue', label: 'Venue name', type: 'text', attachTo: 'event' },
    { id: 'parking', label: 'Parking available', type: 'checkbox', attachTo: 'custom' }
  ];
  const payload = buildQuoteLeadContent({
    id: 'sess-cf',
    contact_name: 'Test',
    email_verified_at: new Date().toISOString(),
    sms_verified_at: null
  }, calc, config);

  assert.match(payload.message, /Venue name: Bondi Pavilion/);
  assert.match(payload.message, /Parking available: Yes/);
  assert.equal(payload.details.customAnswers.venue, 'Bondi Pavilion');
  assert.ok(payload.details.customFieldsSummary.length >= 2);
});

test('builder + online quote assets include custom field form builder', function() {
  const builder = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.js'), 'utf8');
  const online = fs.readFileSync(path.join(root, 'assets/lp-online-quote.js'), 'utf8');
  const planning = fs.readFileSync(path.join(root, 'assets/lp-quote-planning.js'), 'utf8');
  const logic = fs.readFileSync(path.join(root, 'assets/lp-quote-wizard-logic.js'), 'utf8');
  assert.match(builder, /_renderQuestions/);
  assert.match(builder, /data-oqb-add="customFields"/);
  assert.match(builder, /\['questions', 'Questions'\]/);
  assert.match(online, /renderCustomFields/);
  assert.match(online, /data-custom-field/);
  assert.match(planning, /renderCustomFieldsHtml/);
  assert.match(planning, /customAnswers/);
  assert.match(logic, /customFieldsFor/);
  assert.match(logic, /id: 'custom'/);
});
