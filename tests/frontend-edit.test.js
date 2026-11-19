// On-site editing: api/site/page-content.js, assets/lp-frontend-edit.js, api/render.js (?edit), manage.html button.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('save service writes only the page body, owner or super admin only, refuses stale edits', () => {
  const api = R('api/site/page-content.js');
  assert.match(api, /cfg\.pages\[hit\.index\]\.body = newBody;/);
  assert.doesNotMatch(api, /servicing_partner_id|referring_partner_id/);
  assert.match(api, /site\.owner_user_id && site\.owner_user_id === user\.id/);
  assert.match(api, /hashOf\(hit\.page\.body \|\| ''\) !== expectHash\) return \{ code: 409, error: 'changed_elsewhere' \}/);
  assert.match(api, /\.eq\('updated_at', cur\.updated_at\)/, 'optimistic lock on the site row');
  assert.match(api, /from\('site_backups'\)\.insert/, 'backs up before writing');
});

test('render: ?edit loads the editor, is never cached, and custom domains hand over to leadpages.com.au', () => {
  const r = R('api/render.js');
  assert.match(r, /Object\.prototype\.hasOwnProperty\.call\(req\.query, 'edit'\)/);
  assert.match(r, /'https:\/\/www\.leadpages\.com\.au\/' \+ encodeURIComponent\(site\.slug\)/);
  assert.match(r, /html = injectFrontEditor\(html, site, page\);\n\s+return sendHtml\(res, embedGuard\(req, html\), false,/);
  assert.match(r, /lp-frontend-edit\.js\?v=\d+/);
  assert.doesNotMatch(r.slice(r.indexOf('function injectFrontEditor'), r.indexOf('function injectFrontEditor') + 900), /SERVICE_ROLE|SUPABASE_ANON_KEY/);
});

test('front-end editor uses the public anon key only and the visual editor engine', () => {
  const fe = R('assets/lp-frontend-edit.js');
  const m = /var SB_ANON = '([^']+)'/.exec(fe); assert.ok(m);
  const payload = JSON.parse(Buffer.from(m[1].split('.')[1], 'base64').toString('utf8'));
  assert.strictEqual(payload.role, 'anon');
  assert.match(fe, /forceVisual: true/);
  assert.match(fe, /window\.LPVisual\.pageOpened\(\)/);
  assert.doesNotMatch(fe, /\bconfirm\(|\balert\(|\bprompt\(/, 'no browser pop-ups');
});

test('manage.html offers "Edit on the live page" for published landing pages', () => {
  const h = R('manage.html');
  assert.match(h, /id="lpv-onsite"/);
  assert.match(h, /onsiteUrl:function\(\)\{ if\(!lpCur\|\|!lpCur\.slug\|\|lpCur\.status!=='published'/);
});
