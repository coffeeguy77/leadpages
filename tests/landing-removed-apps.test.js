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

test('landing-page Save waits for the draft save and does not touch the live site', () => {
  const s = manage.slice(manage.indexOf("$('lp-save').addEventListener"), manage.indexOf("$('lp-close').addEventListener"));
  assert.match(s, /await lpSaveDB\(\)/);
  // Saving is a draft now: only Publish makes it live (and purges the live cache).
  assert.doesNotMatch(s, /lpPurgeLiveCache\(\)/);
});

test('landing-page app editor: later edits save to the page and refresh its preview', () => {
  const pa = manage.slice(manage.indexOf('function previewApply(a){'), manage.indexOf('window.previewApply = previewApply;'));
  assert.match(pa, /lp-app-edit/);
  assert.match(pa, /lpAutosave\(\)/);
  assert.match(pa, /lpPagePreviewReload\(\)/);
});

test('landing-page preview never reloads itself in a loop', () => {
  const pa = manage.slice(manage.indexOf('function previewApply(a){'), manage.indexOf('window.previewApply = previewApply;'));
  // Only edits (no arguments), not the preview's own onload, and only right after user input.
  assert.match(pa, /arguments\.length===0/);
  assert.match(pa, /!_lpInPrevLoad/);
  assert.match(pa, /Date\.now\(\)-_lpLastUserAct<2000/);
  assert.match(manage, /previewLayout\(\); _lpInPrevLoad=true; try\{ previewApply\(curAppr\(\)\); \}finally\{ _lpInPrevLoad=false; \}/);
});

test('preview header names the page a link inside the preview opened, with a way back', () => {
  assert.match(manage, /function lpPreviewShowPage\(\)/);
  assert.match(manage, /lpPrevReady=true; try\{ lpPreviewShowPage\(\); \}catch\(_sp\)\{\}/);
  assert.match(manage, /id="lp-prev-home"/);
});
