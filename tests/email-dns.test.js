// lib/email-dns.js — MX / SPF / DKIM / DMARC planning for Vercel-nameserver domains.
const test = require('node:test');
const assert = require('node:assert');
const E = require('../lib/email-dns');

const D = 'example.com.au';
const KEY = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvI693S/AuxXTcaELphrDr5QtefMYLTAaex/AmlWcK2VMrIc1JJbZSaeCNP+3A0zkU9aO7hIqqCvKYpkbUXLTXyEuaVE1QTYRDHiOiCuWQMYO5CPsTCu1H';

// Shape of Vercel's /v5/domains/{d}/records
const rec = (id, type, name, value, extra) => Object.assign({ id, type, name, value, creator: 'user' }, extra || {});
const BASE = [
  rec('a1', 'ALIAS', '', 'cname.vercel-dns.com', { creator: 'system' }),
  rec('t1', 'TXT', '', 'google-site-verification=abc'),
  rec('k1', 'TXT', 'resend._domainkey', 'p=MIGfMA0'),
  rec('c1', 'CNAME', 'send', 'send.forge.rmta.net.'),
];

test('Google on a domain with no email: one MX, SPF, DKIM, DMARC; nothing else touched', () => {
  const d = E.desired({ provider: 'google', spf: true, dkim: true, dmarc: true, dkimRecords: [{ selector: 'google', type: 'TXT', value: 'v=DKIM1; k=rsa; p=' + KEY }] }, D);
  assert.ok(d.want, JSON.stringify(d.errors));
  const p = E.plan(BASE, D, d.want);
  assert.deepStrictEqual(p.remove, []);
  assert.deepStrictEqual(p.add, [
    { type: 'MX', name: '', value: 'smtp.google.com', mxPriority: 1 },
    { type: 'TXT', name: '', value: 'v=spf1 include:_spf.google.com ~all' },
    { type: 'TXT', name: 'google._domainkey', value: 'v=DKIM1; k=rsa; p=' + KEY },
    { type: 'TXT', name: '_dmarc', value: 'v=DMARC1; p=none' },
  ]);
});

test('Running Google twice changes nothing (trailing dots and quotes ignored)', () => {
  const recs = BASE.concat([
    rec('m1', 'MX', '', 'smtp.google.com.', { mxPriority: 1 }),
    rec('s1', 'TXT', '', '"v=spf1 include:_spf.google.com ~all"'),
    rec('d1', 'TXT', '_dmarc', 'v=DMARC1; p=quarantine; rua=mailto:x@y.z'),
  ]);
  const d = E.desired({ provider: 'google', spf: true, dmarc: true }, D);
  const p = E.plan(recs, D, d.want);
  assert.deepStrictEqual(p.add, []);
  assert.deepStrictEqual(p.remove, []);
  assert.ok(p.notes.some((n) => /DMARC already set/.test(n)), 'existing DMARC policy is left alone');
});

test('Switching Google → Outlook swaps MX and the SPF include, keeps other SPF senders', () => {
  const recs = BASE.concat([
    rec('m1', 'MX', '', 'smtp.google.com', { mxPriority: 1 }),
    rec('s1', 'TXT', '', 'v=spf1 include:_spf.google.com include:notifications._spf.ds.network -all'),
  ]);
  const d = E.desired({ provider: 'outlook', spf: true, outlookMx: 'example-com-au.mail.protection.outlook.com' }, D);
  assert.ok(d.want, JSON.stringify(d.errors));
  const p = E.plan(recs, D, d.want);
  assert.deepStrictEqual(p.remove.map((r) => r.id).sort(), ['m1', 's1']);
  assert.deepStrictEqual(p.add, [
    { type: 'MX', name: '', value: 'example-com-au.mail.protection.outlook.com', mxPriority: 0 },
    { type: 'TXT', name: '', value: 'v=spf1 include:notifications._spf.ds.network include:spf.protection.outlook.com -all' },
    { type: 'CNAME', name: 'autodiscover', value: 'autodiscover.outlook.com' },
  ]);
});

test('Two SPF records are merged into one', () => {
  const recs = BASE.concat([
    rec('s1', 'TXT', '', 'v=spf1 include:_spf.google.com ~all'),
    rec('s2', 'TXT', '', 'v=spf1 include:notifications._spf.ds.network ~all'),
  ]);
  const p = E.plan(recs, D, E.desired({ provider: 'google', spf: true }, D).want);
  assert.deepStrictEqual(p.remove.map((r) => r.id).sort(), ['s1', 's2']);
  assert.deepStrictEqual(p.add.filter((a) => a.type === 'TXT'), [{ type: 'TXT', name: '', value: 'v=spf1 include:_spf.google.com include:notifications._spf.ds.network ~all' }]);
  assert.ok(p.notes.some((n) => /Merged 2 SPF/.test(n)));
  assert.strictEqual(E.inspect(recs, D).problems.length, 1);
});

test('Outlook: the new mx.microsoft address is accepted, a made-up one is not', () => {
  assert.ok(E.desired({ provider: 'outlook', outlookMx: 'example-com-au.o-v1.mx.microsoft' }, D).want);
  assert.match(E.desired({ provider: 'outlook', outlookMx: 'mail.example.com.au' }, D).errors[0], /Microsoft 365 mail server/);
  assert.match(E.desired({ provider: 'outlook', outlookMx: '' }, D).errors[0], /Paste the MX/);
});

test('Outlook DKIM needs both selector CNAMEs', () => {
  const one = E.desired({ provider: 'outlook', outlookMx: 'x-com.mail.protection.outlook.com', dkim: true, dkimRecords: [{ selector: 'selector1', type: 'CNAME', value: 'selector1-x-com._domainkey.x.n-v1.dkim.mail.microsoft' }] }, D);
  assert.match(one.errors[0], /both DKIM/);
  const two = E.desired({ provider: 'outlook', outlookMx: 'x-com.mail.protection.outlook.com', dkim: true, dkimRecords: [
    { selector: 'selector1._domainkey', type: 'CNAME', value: 'selector1-x-com._domainkey.x.n-v1.dkim.mail.microsoft.' },
    { selector: 'selector2', type: 'CNAME', value: 'selector2-x-com._domainkey.x.onmicrosoft.com' },
  ] }, D);
  assert.ok(two.want, JSON.stringify(two.errors));
  assert.deepStrictEqual(two.want.dkim.map((d) => d.name), ['selector1._domainkey', 'selector2._domainkey']);
});

test('Remote: custom MX list and SPF; switching away removes the old MX only', () => {
  const recs = BASE.concat([rec('m1', 'MX', '', 'smtp.google.com', { mxPriority: 1 })]);
  const d = E.desired({ provider: 'remote', spf: true, remoteSpf: 'v=spf1 include:_spf.mailhost.net ip4:1.2.3.4 ~all', remoteMx: [{ host: 'mx1.mailhost.net', priority: 10 }, { host: 'mx2.mailhost.net', priority: 20 }, { host: '', priority: '' }] }, D);
  assert.ok(d.want, JSON.stringify(d.errors));
  const p = E.plan(recs, D, d.want);
  assert.deepStrictEqual(p.remove.map((r) => r.id), ['m1']);
  assert.deepStrictEqual(p.add.map((a) => a.value), ['mx1.mailhost.net', 'mx2.mailhost.net', 'v=spf1 include:_spf.mailhost.net ip4:1.2.3.4 ~all']);
});

test('Remote validation', () => {
  assert.match(E.desired({ provider: 'remote', remoteMx: [] }, D).errors[0], /at least one mail server/);
  assert.match(E.desired({ provider: 'remote', remoteMx: [{ host: 'not a host', priority: 10 }] }, D).errors[0], /valid host/);
  assert.match(E.desired({ provider: 'remote', remoteMx: [{ host: 'mx.a.com', priority: 10 }], spf: true, remoteSpf: 'hello' }, D).errors[0], /SPF value/);
  assert.match(E.desired({ provider: 'nope' }, D).errors[0], /Choose Google/);
});

test('DKIM TXT must be the full key; replacing a selector removes only that selector', () => {
  assert.match(E.desired({ provider: 'google', dkim: true, dkimRecords: [{ selector: 'google', type: 'TXT', value: 'p=short' }] }, D).errors[0], /whole DKIM value/);
  const recs = BASE.concat([rec('g1', 'TXT', 'google._domainkey', 'v=DKIM1; k=rsa; p=OLD')]);
  const p = E.plan(recs, D, E.desired({ provider: 'google', dkim: true, dkimRecords: [{ selector: 'google', type: 'TXT', value: '"v=DKIM1; k=rsa; " "p=' + KEY + '"' }] }, D).want);
  assert.deepStrictEqual(p.remove.map((r) => r.id).filter((id) => id !== 'm1'), ['g1']);
  assert.ok(p.add.some((a) => a.name === 'google._domainkey' && a.value === 'v=DKIM1; k=rsa; p=' + KEY), 'split TXT chunks are joined');
  assert.ok(!p.remove.some((r) => r.id === 'k1'), 'resend DKIM is untouched');
});

test('System (Vercel-managed) records are never removed', () => {
  const recs = BASE.concat([rec('sys', 'MX', '', 'old.mx.host', { mxPriority: 5, creator: 'system' })]);
  const p = E.plan(recs, D, E.desired({ provider: 'google' }, D).want);
  assert.ok(!p.remove.some((r) => r.id === 'sys'));
  assert.strictEqual(p.blocked, 1);
});

test('inspect reports the current setup', () => {
  const recs = BASE.concat([
    rec('m1', 'MX', 'example.com.au', 'x-com.mail.protection.outlook.com.', { mxPriority: 0 }),
    rec('s1', 'TXT', '@', 'v=spf1 include:spf.protection.outlook.com -all'),
  ]);
  const i = E.inspect(recs, D);
  assert.strictEqual(i.provider, 'outlook');
  assert.deepStrictEqual(i.mx, [{ host: 'x-com.mail.protection.outlook.com', priority: 0 }]);
  assert.deepStrictEqual(i.dkim, [{ selector: 'resend', type: 'TXT', value: 'p=MIGfMA0' }]);
  assert.strictEqual(E.inspect(BASE, D).provider, 'none');
  assert.strictEqual(E.detectProvider([{ value: 'mx1.mailhost.net' }]), 'remote');
});

test('recreateBody restores a removed record for undo', () => {
  assert.deepStrictEqual(E.recreateBody({ type: 'MX', name: '', value: 'smtp.google.com', priority: 1 }), { type: 'MX', name: '', value: 'smtp.google.com', ttl: 3600, mxPriority: 1 });
});

test('Leaving an old mail host drops its SPF include but keeps other senders', () => {
  const recs = BASE.concat([
    rec('m1', 'MX', '', 'mx10.antispam.mailspamprotection.com', { mxPriority: 10 }),
    rec('s1', 'TXT', '', 'v=spf1 include:_spf.mailspamprotection.com include:notifications._spf.ds.network ~all'),
  ]);
  const p = E.plan(recs, D, E.desired({ provider: 'google', spf: true }, D).want);
  assert.deepStrictEqual(p.add.filter((a) => a.type === 'TXT').map((a) => a.value), ['v=spf1 include:notifications._spf.ds.network include:_spf.google.com ~all']);
  assert.strictEqual(E.baseDomain('a.b.example.com.au'), 'example.com.au');
  assert.strictEqual(E.baseDomain('mx1.mailhost.net.'), 'mailhost.net');
});

test('Empty DKIM boxes give the clear "paste" message', () => {
  const d = E.desired({ provider: 'outlook', outlookMx: 'x-com.mail.protection.outlook.com', dkim: true, dkimRecords: [{ selector: 'selector1', type: 'CNAME', value: '' }, { selector: 'selector2', type: 'CNAME', value: '' }] }, D);
  assert.match(d.errors[0], /Paste both DKIM/);
});

test('API: only the site owner or a super admin can change email DNS; manage.html mounts the panel', () => {
  const fs = require('fs');
  const path = require('path');
  const api = fs.readFileSync(path.join(__dirname, '../api/site/email-dns.js'), 'utf8');
  assert.match(api, /site\.owner_user_id && site\.owner_user_id === user\.id/);
  assert.doesNotMatch(api, /servicing_partner_id|referring_partner_id/, 'partners are not given access');
  assert.doesNotMatch(api, /if \(!site\.owner_user_id\) return \{ ok: true/, 'ownerless sites are not open to everyone');
  assert.match(api, /for \(const a of p\.add\)[\s\S]*for \(const r of p\.remove\)/, 'adds happen before removals');
  const vc = fs.readFileSync(path.join(__dirname, '../api/vercel/_client.js'), 'utf8');
  assert.match(vc, /async function deleteDnsRecord\(domain, recordId\)/);
  const html = fs.readFileSync(path.join(__dirname, '../manage.html'), 'utf8');
  assert.match(html, /<script src="\/assets\/lp-email-dns\.js\?v=\d+"><\/script>/);
  assert.match(html, /id="lpe-mount"/);
  assert.match(html, /LPEmailDns\.mount\(_lpeEl,\{ siteId:currentSiteId, token:cwToken \}\)/);
});
