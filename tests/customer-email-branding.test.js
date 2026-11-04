'use strict';

/**
 * Customer-facing emails carry the business's name (owner emails stay LeadPages), the quote
 * code can be texted instead of emailed, and unconfirmed quotes are still saved as leads.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const CE = require('../lib/customer-email');

test('customer sender: business name, LeadPages address, safe header', () => {
  assert.equal(CE.customerFrom('Bean Culture'), '"Bean Culture" <noreply@leadpages.com.au>');
  assert.equal(CE.customerFrom('Evil "Name" <x@y.com>\r\nBcc: a@b.c'), '"Evil Name x@y.com Bcc: a@b.c" <noreply@leadpages.com.au>');
  assert.equal(CE.customerFrom(''), CE.BASE_FROM);
});

test('reply-to: quote alert address, then site email, then owner email', () => {
  assert.equal(CE.replyToForSite({ owner_email: 'o@x.com', config: { email: 'site@x.com', sections: { quote: { notifyMode: 'custom', notifyEmail: 'q@x.com' } } } }), 'q@x.com');
  assert.equal(CE.replyToForSite({ owner_email: 'o@x.com', config: { email: 'site@x.com' } }), 'site@x.com');
  assert.equal(CE.replyToForSite({ owner_email: 'o@x.com', config: { email: 'not an email' } }), 'o@x.com');
  assert.equal(CE.replyToForSite({}), '');
});

test('brandCustomerEmail: from, reply_to, footer once', () => {
  const p = CE.brandCustomerEmail({ from: 'LeadPages <noreply@leadpages.com.au>', to: ['c@x.com'], html: '<p>Hi</p>', text: 'Hi' },
    { from: CE.customerFrom('Acme'), replyTo: 'acme@x.com' });
  assert.equal(p.from, '"Acme" <noreply@leadpages.com.au>');
  assert.equal(p.reply_to, 'acme@x.com');
  assert.match(p.html, /Powered by <a href="https:\/\/www\.leadpages\.com\.au"/);
  assert.match(p.text, /Powered by LeadPages · https:\/\/www\.leadpages\.com\.au$/);
  const again = CE.brandCustomerEmail(p, {});
  assert.equal(again.html.split('Powered by').length, 2);
  assert.equal(CE.withFooterHtml('<html><body><p>x</p></body></html>').indexOf('Powered by') < CE.withFooterHtml('<html><body><p>x</p></body></html>').indexOf('</body>'), true);
});

test('customer emails use the branding; owner alerts stay LeadPages', () => {
  assert.match(read('lib/quote-system/verify.js'), /brandCustomerEmail\(\{/);
  const pe = read('lib/quote-system/portal-email.js');
  assert.equal((pe.match(/brandCustomerEmail\(/g) || []).length, 3);   // portal link, total, access
  assert.match(pe, /async function sendAcceptanceNotifyEmail[\s\S]*?from: FROM,/);   // owner alert
  assert.match(read('lib/bookings/notify.js'), /from_name: system\.business_name/);
  assert.match(read('lib/order/messaging.js'), /senderForSiteId\(admin, opts\.site_id\)/);
  assert.match(read('api/send-campaign.js'), /process\.env\.CAMPAIGN_FROM \|\| sender\.from \|\| FROM/);
  assert.match(read('api/leads.js'), /from: FROM,/);   // owner enquiry alert unchanged
});

test('SMS code: business name, falls back when Twilio refuses it', async () => {
  const V = require('../lib/quote-system/verify');
  assert.equal(V.smsFriendlyName('Bean Culture <script>'), 'Bean Culture script');
  assert.equal(V.smsFriendlyName('x'.repeat(40)).length, 30);
  process.env.TWILIO_ACCOUNT_SID = 'AC1'; process.env.TWILIO_AUTH_TOKEN = 't'; process.env.TWILIO_VERIFY_SERVICE_SID = 'VA1';
  const calls = [];
  const real = global.fetch;
  try {
    global.fetch = async (url, opts) => { calls.push(String(opts.body)); return calls.length === 1 ? new Response('{"code":60200}', { status: 400 }) : new Response('{}', { status: 201 }); };
    const r = await V.sendSmsCode('+61400000000', null, 'Bean Culture');
    assert.equal(r.sent, true); assert.equal(r.named, false);
    assert.match(calls[0], /CustomFriendlyName=Bean\+Culture/);
    assert.doesNotMatch(calls[1], /CustomFriendlyName/);
    calls.length = 0;
    global.fetch = async (url, opts) => { calls.push(String(opts.body)); return new Response('{}', { status: 201 }); };
    const r2 = await V.sendSmsCode('+61400000000', null, 'Bean Culture');
    assert.equal(r2.named, true); assert.equal(calls.length, 1);
  } finally {
    global.fetch = real;
    delete process.env.TWILIO_ACCOUNT_SID; delete process.env.TWILIO_AUTH_TOKEN; delete process.env.TWILIO_VERIFY_SERVICE_SID;
  }
});

test('quote builder: unconfirmed quotes become leads; SMS instead of email', () => {
  const calc = read('api/quote-system/calculate.js');
  assert.match(calc, /if \(!updatedSession\.lead_id && updatedSession\.contact_email\) \{/);
  assert.match(calc, /notifyOwnerUnconfirmedQuote\(siteRow, updatedSession, calc, configVersion\.config\)/);
  assert.match(calc, /updateQuoteLeadVerification\(updatedSession\.lead_id, updatedSession\)/);
  const crm = require('../lib/quote-system/crm');
  const content = crm.buildQuoteLeadContent({ id: 's1' }, { inputs: {}, totalCents: 12345, breakdown: [] }, {});
  assert.match(content.message, /^Online quote — \$123\.45 \(email not confirmed yet\)/);
  assert.equal(content.details.unconfirmed, true);
  const sms = read('api/quote-system/verify-sms.js');
  assert.match(sms, /const instead = body\.instead === true && !!session\.contact_email && session\.status === 'submitted';/);
  assert.match(sms, /if \(session\.contact_email && session\.email_verified_at\) \{/);   // never trust an unverified email
  const ui = read('assets/lp-online-quote.js');
  assert.match(ui, /data-act="sms-instead">text the code to my mobile instead<\/button>/);
  assert.match(ui, /else if \(act === 'confirm-sms-instead'\) self\.confirmSms\(\{ instead: true \}\);/);
});
