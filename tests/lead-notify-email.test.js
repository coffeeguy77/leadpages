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
assert.ok(!mail.html.includes(LOGO_ANIMATED), 'animated GIF off by default');
assert.ok(mail.html.includes(LOGO_WORDMARK), 'uses LeadPages wordmark');
assert.ok(/height="84"/.test(mail.html), 'wordmark ~3× original (84px)');
assert.ok(mail.html.includes('Need two carts please'), 'message body in HTML');
assert.ok(mail.html.includes('Event hire'), 'problem/job in HTML');
assert.ok(!/Region|Canberra|ignored/i.test(mail.html.split('Need two')[0] + mail.html.split('carts please')[1] || ''), 'region not featured');
assert.ok(!mail.html.includes('ignored'), 'suburb value not in email');
assert.ok(mail.html.includes('Call Sam back'), 'call CTA');
assert.ok(mail.html.includes('mailto:sam@example.com'), 'email CTA');
assert.ok(mail.html.includes('/manage?site=beanculture'), 'manage deep link');
assert.ok(mail.text.includes('Message: Need two carts please'));

// Animated mark opt-in still works at large size
const withGif = buildLeadNotifyEmail({
  business: 'Bean Culture',
  lead: { name: 'Sam' },
  style: { showAnimatedLogo: true, logoMarkWidth: 132 }
});
assert.ok(withGif.html.includes(LOGO_ANIMATED), 'animated mark when enabled');
assert.ok(/width="132"/.test(withGif.html), 'animated mark 3× size');

// Style overrides (Bean Culture pink / custom header)
const pinkMail = buildLeadNotifyEmail({
  business: 'Bean Culture',
  slug: 'beanculture',
  lead: { name: 'Sam', phone: '0400000000', email: 'sam@example.com' },
  details: { job: 'Event hire', detail: 'Pink buttons test' },
  style: {
    buttonBackground: '#e071a2',
    buttonOutline: '#e071a2',
    headerGradientStart: '#5c4033',
    headerGradientMid: '#4a3328',
    headerGradientEnd: '#36313b',
    logoWordmark: 'https://example.com/custom-wordmark.png',
    showAnimatedLogo: false,
    logoWordmarkHeight: 84
  }
});
assert.ok(pinkMail.html.includes('background:#e071a2'), 'custom button fill in HTML');
assert.ok(pinkMail.html.includes('https://example.com/custom-wordmark.png'), 'custom wordmark URL');
assert.ok(!pinkMail.html.includes(LOGO_ANIMATED), 'pink style hides animated mark');
assert.ok(/height="84"/.test(pinkMail.html), 'pink style large wordmark');

const noLogo = buildLeadNotifyEmail({
  business: 'Test',
  lead: { name: 'A' },
  style: { showLogo: false }
});
assert.ok(!noLogo.html.includes(LOGO_ANIMATED), 'logo hidden when showLogo false');
assert.ok(!noLogo.html.includes(LOGO_WORDMARK), 'wordmark hidden when showLogo false');

assert.ok(leadsApi.includes("require('../lib/lead-notify-email')"), 'api/leads uses shared builder');
assert.ok(leadsApi.includes('buildLeadNotifyEmail'), 'api/leads builds branded mail');
assert.ok(leadsApi.includes('resolveLeadNotifyStyle'), 'api/leads resolves style presets');

console.log('lead-notify-email.test.js: ok');
