/**
 * Website enquiry notification email — message field + branded template.
 */
const assert = require('assert');
const {
  detailLines,
  buildLeadNotifyEmail,
  LOGO_ANIMATED,
  LOGO_WORDMARK
} = require('../lib/lead-notify-email');
const leadsApi = require('fs').readFileSync(require('path').join(__dirname, '../api/leads.js'), 'utf8');

// Message / job were previously dropped — must appear
const rows = detailLines({
  job: 'Coffee cart hire',
  suburb: 'Canberra',
  detail: 'Looking for a cart for Saturday morning markets.'
});
const labels = rows.map((r) => r[0]);
assert.ok(labels.includes('Problem'), 'includes Problem (job)');
assert.ok(labels.includes('Message'), 'includes Message (detail)');
assert.ok(!labels.includes('Region'), 'skips region/suburb');
assert.deepStrictEqual(
  rows.find((r) => r[0] === 'Message')[1],
  'Looking for a cart for Saturday morning markets.'
);

// Partner-style message key still works
assert.ok(detailLines({ message: 'Hello from form' }).some((r) => r[0] === 'Message' && r[1] === 'Hello from form'));

const mail = buildLeadNotifyEmail({
  business: 'Bean Culture',
  slug: 'beanculture',
  lead: { name: 'Sam', phone: '0400000000', email: 'sam@example.com' },
  details: {
    job: 'Event hire',
    suburb: 'ignored',
    detail: 'Need two carts please'
  }
});

assert.ok(mail.subject.includes('Bean Culture'));
assert.ok(mail.subject.includes('Sam'));
assert.ok(mail.html.includes(LOGO_ANIMATED), 'uses animated LeadPages mark GIF');
assert.ok(mail.html.includes(LOGO_WORDMARK), 'uses LeadPages wordmark');
assert.ok(mail.html.includes('height="84"'), 'LeadPages wordmark ~3× larger');
assert.ok(!/linear-gradient\(135deg,#0f1f1a/i.test(mail.html), 'no dark green header gradient');
assert.ok(mail.html.includes('Need two carts please'), 'message body in HTML');
assert.ok(mail.html.includes('Event hire'), 'problem/job in HTML');
assert.ok(mail.html.includes('background:#f7f8f7'), 'form fields use soft stacked blocks');
assert.ok(!/Region|Canberra|ignored/i.test(mail.html.split('Need two')[0] + mail.html.split('carts please')[1] || ''), 'region not featured');
assert.ok(!mail.html.includes('ignored'), 'suburb value not in email');
assert.ok(mail.html.includes('Call Sam back'), 'call CTA');
assert.ok(mail.html.includes('mailto:sam@example.com'), 'email CTA');
assert.ok(mail.html.includes('/manage?site=beanculture'), 'manage deep link');
assert.ok(mail.text.includes('Message: Need two carts please'));
assert.ok(LOGO_ANIMATED.includes('leadpages-mark-email.gif'), 'email uses compact animated mark');

assert.ok(leadsApi.includes("require('../lib/lead-notify-email')"), 'api/leads uses shared builder');
assert.ok(leadsApi.includes('buildLeadNotifyEmail'), 'api/leads builds branded mail');

console.log('lead-notify-email.test.js: ok');
