'use strict';

/**
 * Landing pages: apps the user removes (e.g. Quote form, FAQ) must not come back when the
 * page is opened again or an AI draft is applied.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');

test('opening a page only seeds apps it already has', () => {
  assert.match(manage, /lpEnsureDefaultLandingApps\(lpCur, \{addMissing:false\}\)/);
  assert.match(manage, /if\(!app&&\(!addMissing\|\|lpWasRemoved\(p,key\)\)\) return;/);
});

test('removing an app is remembered; adding it again forgets that', () => {
  const rm = manage.slice(manage.indexOf('function lpPageAppRemove('), manage.indexOf('function lpPageAppSetMode('));
  assert.match(rm, /removedApps\.push\(secKey\)/);
  const add = manage.slice(manage.indexOf('function lpPageAppAdd('), manage.indexOf('function lpPageAppRemove('));
  assert.match(add, /lpForgetRemoved\(lpCur, secKey\)/);
});

test('AI draft FAQs respect a removed FAQ app', () => {
  const f = manage.slice(manage.indexOf('function lpApplyDraftFaqs('), manage.indexOf('function lpEnsureOrdCss('));
  assert.match(f, /if\(lpWasRemoved\(lpCur,'faq'\)\) return 0;/);
});

test('landing-page Save waits for the cloud save and refreshes the live cache', () => {
  const s = manage.slice(manage.indexOf("$('lp-save').addEventListener"), manage.indexOf("$('lp-close').addEventListener"));
  assert.match(s, /await lpSaveDB\(\)/);
  assert.match(s, /lpPurgeLiveCache\(\)/);
});
