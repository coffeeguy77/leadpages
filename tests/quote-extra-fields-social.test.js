'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');

test('quote extra-field, social and gallery shims are present in every copy', () => {
  for (const s of ['patch-quote-extra-fields.js', 'patch-footer-social.js', 'patch-lp-gallery-shim.js']) {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', s), '--check'], { stdio: 'pipe' });
  }
});

test('each injected library block appears exactly once (patches do not clobber each other)', () => {
  const marks = ['/*LPQX*/', '/*END-LPQX*/', '/*LPSOC*/', '/*END-LPSOC*/', '/*LPG-SHIM*/'];
  for (const f of ['trade.template.json', 'landing-shell-neutral-v1.template.json']) {
    const h = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')).html;
    marks.forEach((m) => assert.equal(h.split(m).length - 1, 1, f + ' ' + m));
  }
});

test('submitLead reads extra fields by their own data attributes (not shifted indexes)', () => {
  const h = JSON.parse(fs.readFileSync(path.join(ROOT, 'trade.template.json'), 'utf8')).html;
  assert.ok(h.includes("_lpQxCollect(g('quoteExtraFields'))"));
  assert.ok(h.includes('data-qx-label'));
  assert.ok(h.includes("window._lpQxCollect=_lpQxCollect"));
});

test('file uploads stay with the private Lead Files feature (no public extra-field upload type)', () => {
  const h = JSON.parse(fs.readFileSync(path.join(ROOT, 'trade.template.json'), 'utf8')).html;
  assert.ok(h.includes('LPLeadFiles.upload()'), 'Lead Files upload kept in submitLead');
  assert.ok(!h.includes('_lpQxUpload') && !h.includes('lead-upload-sign'));
  assert.ok(!fs.existsSync(path.join(ROOT, 'api/lead-upload-sign.js')));
});

test('editor schemas expose the new options', () => {
  const m = fs.readFileSync(path.join(ROOT, 'manage.html'), 'utf8');
  assert.ok(m.includes("['checkboxes','Tick boxes (pick any)']"));
  assert.ok(!m.includes("['file','Photo / file upload']"));
  assert.ok(m.includes("footerSocial:{secId:'footer',key:'social'"));
});
