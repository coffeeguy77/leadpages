'use strict';

/**
 * Quote form → File uploads (lib/lead-files.js, api/lead-files/*, api/leads.js,
 * lib/lead-notify-email.js, assets/lp-lead-files.js, trade.template.json, manage.html).
 */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const LF = require('../lib/lead-files');
const { buildLeadNotifyEmail, detailLines } = require('../lib/lead-notify-email');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const SITE = '6e480358-b364-4576-8a3c-3a1b04d7b7f1';
const ON = { on: true, maxFiles: 3 };

test('uploads are off unless switched on; max files 1–5, default 3', () => {
  assert.deepEqual(LF.uploadSettings({}), { on: false, maxFiles: 3 });
  assert.deepEqual(LF.uploadSettings({ sections: { quote: { uploadsOn: true, uploadsMax: '9' } } }), { on: true, maxFiles: 5 });
  assert.equal(LF.uploadSettings({ sections: { quote: { uploadsOn: 'yes' } } }).on, false);
});

test('planUpload checks site, count, type, size and storage caps', () => {
  const f = (name, type, size) => ({ name, type, size });
  assert.equal(LF.planUpload('nope', [f('a.jpg', 'image/jpeg', 10)], ON).error, 'bad_site');
  assert.equal(LF.planUpload(SITE, [f('a.jpg', 'image/jpeg', 10)], { on: false, maxFiles: 3 }).error, 'off');
  assert.equal(LF.planUpload(SITE, [1, 2, 3, 4].map(() => f('a.jpg', 'image/jpeg', 10)), ON).error, 'too_many');
  assert.equal(LF.planUpload(SITE, [f('a.exe', 'application/x-msdownload', 10)], ON).error, 'type');
  assert.equal(LF.planUpload(SITE, [f('a.pdf', 'application/pdf', 11 * 1048576)], ON).error, 'too_big');
  assert.equal(LF.planUpload(SITE, [f('a.pdf', 'application/pdf', 0)], ON).error, 'size');
  assert.equal(LF.planUpload(SITE, [f('a.pdf', 'application/pdf', 5 * 1048576)], ON, { site_month_bytes: 98 * 1048576 }).error, 'quota');
  assert.equal(LF.planUpload(SITE, [f('a.pdf', 'application/pdf', 5 * 1048576)], ON, { total_bytes: 498 * 1048576 }).error, 'quota');

  const ok = LF.planUpload(SITE, [f('Kitchen Plan (v2).PDF', '', 1000), f('IMG_0001.HEIC', 'image/heic', 2000)], ON, {}, { uploadId: 'abcdef0123456789abcdef01', month: '202610' });
  assert.equal(ok.ok, true);
  assert.equal(ok.month, '202610');
  assert.deepEqual(ok.files.map((x) => x.path), [
    SITE + '/202610/abcdef0123456789abcdef01/1-Kitchen-Plan-v2.pdf',
    SITE + '/202610/abcdef0123456789abcdef01/2-IMG_0001.heic'
  ]);
  assert.equal(ok.files[0].type, 'application/pdf');
});

test('verifyLeadFiles only keeps files really in this site’s upload folder', async () => {
  const folder = SITE + '/202610/abcdef0123456789abcdef01';
  const admin = { storage: { from: () => ({ list: async (p) => {
    assert.equal(p, folder);
    return { data: [{ name: '1-plan.pdf', metadata: { size: 1234, mimetype: 'application/pdf' } }], error: null };
  } }) } };
  const got = await LF.verifyLeadFiles(admin, SITE, {
    uploadId: 'abcdef0123456789abcdef01', month: '202610',
    items: [
      { path: folder + '/1-plan.pdf', name: 'plan.pdf', size: 1 },
      { path: folder + '/2-missing.jpg', name: 'missing.jpg' },
      { path: 'other-site/202610/abcdef0123456789abcdef01/1-plan.pdf', name: 'x' }
    ]
  });
  assert.deepEqual(got, [{ name: 'plan.pdf', path: folder + '/1-plan.pdf', size: 1234, type: 'application/pdf' }]);
  assert.deepEqual(await LF.verifyLeadFiles(admin, SITE, { uploadId: '../x', month: '202610', items: [] }), []);
});

test('email download tokens: round trip, tamper and expiry', () => {
  const lead = '11111111-2222-3333-4444-555555555555';
  const t = LF.signToken(lead, 2, Date.now() + 60000);
  assert.deepEqual(LF.readToken(t), { leadId: lead, index: 2 });
  const parts = t.split('.');
  assert.equal(LF.readToken(parts[0] + '.' + parts[1].replace(/^./, (c) => (c === 'A' ? 'B' : 'A'))), null);
  assert.equal(LF.readToken(LF.signToken(lead, 0, Date.now() - 1000)), null);
  assert.equal(LF.readToken('junk'), null);
  const links = LF.emailLinks(lead, [{ name: 'a.pdf', size: 5 }]);
  assert.match(links[0].url, /\/api\/lead-files\/open\?t=/);
});

test('lead email lists the files with links; a failed upload shows as a note', () => {
  const m = buildLeadNotifyEmail({ business: 'B', lead: { name: 'Jo', phone: '04' }, dets: [], files: [{ name: 'plan.pdf', size: 2097152, url: 'https://x/api/lead-files/open?t=abc' }] });
  assert.match(m.html, /href="https:\/\/x\/api\/lead-files\/open\?t=abc"[^>]*>plan\.pdf<\/a>/);
  assert.match(m.html, /\(2\.0 MB\)/);
  assert.match(m.text, /Files \(links work for 90 days\):\n- plan\.pdf: https:\/\/x/);
  const plain = buildLeadNotifyEmail({ business: 'B', lead: {}, dets: [] });
  assert.doesNotMatch(plain.html, />Files</);
  const rows = detailLines({ filesNote: 'Upload failed', files: [{ path: 'p' }], filesExpireAt: '2027-01-01' });
  assert.deepEqual(rows, [['File upload', 'Upload failed']]);
});

test('api/leads.js attaches only verified files and emails their links', () => {
  const src = read('api/leads.js');
  assert.match(src, /LeadFiles\.uploadSettings\(siteRow\.config\)\.on/);
  assert.match(src, /details\.files = leadFiles;/);
  assert.match(src, /LeadFiles\.emailLinks\(leadId, leadFiles\)/);
});

test('form script, template hook, editor option, CRM links and cron are wired', () => {
  const js = read('assets/lp-lead-files.js');
  assert.match(js, /if \(q\.uploadsOn !== true\)/);
  assert.match(js, /var MAX_SIDE = 2000;/);
  assert.match(js, /fetch\('\/api\/lead-files\/sign'/);
  assert.match(js, /method: 'PUT', headers: \{ 'x-upsert': 'false' \}/);
  const tpl = JSON.parse(read('trade.template.json')).html;
  assert.match(tpl, /_lpFiles=await LPLeadFiles\.upload\(\)/);
  assert.match(tpl, /files: _lpFiles\|\|undefined,/);
  assert.match(tpl, /<script src="\/assets\/lp-lead-files\.js\?v=1" defer><\/script>/);
  const manage = read('manage.html');
  assert.match(manage, /quote:\{title:'File uploads'/);
  assert.match(manage, /\{t:'chk',k:'uploadsOn',label:'Let customers attach files',def:false\}/);
  assert.match(manage, /function lpLeadFilesHtml\(l\)/);
  assert.match(manage, /if\(act==='files'\)\{ lpLeadFilesOpen/);
  const v = JSON.parse(read('vercel.json'));
  assert.ok(v.crons.some((c) => c.path === '/api/cron/lead-files-cleanup'));
  const sql = read('db/lead_files.sql');
  assert.match(sql, /'lead-files', 'lead-files', false, 10485760/);
  assert.match(sql, /revoke all on function public\.lead_files_usage\(text\) from public, anon, authenticated;/);
});
