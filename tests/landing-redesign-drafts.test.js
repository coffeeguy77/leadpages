'use strict';

/**
 * Landing pages redesign: page list + positions, every app is the page's own copy,
 * preview clicks never open the homepage editor, and Save keeps a draft (not live).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
const render = fs.readFileSync(path.join(__dirname, '..', 'api', 'render.js'), 'utf8');
const between = (a, b) => manage.slice(manage.indexOf(a), manage.indexOf(b, manage.indexOf(a) + a.length));

test('landing view: page list beside the editor, collapsible and switchable to a top row', () => {
  assert.match(manage, /<aside class="lpx-nav card" id="lpx-nav"/);
  assert.match(manage, /id="lpx-search"/);
  assert.match(manage, /id="lpx-collapse"/);
  assert.match(manage, /id="lpx-mode"/);
  assert.match(manage, /var LPX_NAV_KEY='lp_landing_nav_v1';/);
  assert.match(manage, /\.lpx--slim\{/);
  assert.match(manage, /\.lpx--top\{/);
  // Existing buttons and list are kept (same ids).
  assert.match(manage, /id="lp-new-apps"/);
  assert.match(manage, /id="lp-new"/);
  assert.match(manage, /id="lp-list"/);
});

test('positions: rows open the app editor; Back returns to the positions', () => {
  assert.match(manage, /function lpOpenPosition\(id\)/);
  assert.match(manage, /lpOpenPosition\(row\.getAttribute\('data-id'\)\)/);
  assert.match(manage, /id="lp-app-edit-close">&larr; Back to positions</);
  assert.match(manage, /function lpBackToPositions\(\)/);
  assert.match(manage, /#lp-panel-apps\.lpx-editing #lp-layout-order/);
  assert.match(manage, /id="lpx-add-sec"/);
});

test('every landing-page app is the page\'s own copy of the homepage content', () => {
  const add = between('function lpPageAppAdd(', 'function lpPageAppRemove(');
  assert.match(add, /mode:'unique', homeCopied:true/);
  assert.match(add, /lpCopyPageAppFromHome\(secKey, \{silent:true, skipRender:true\}\)/);
  assert.doesNotMatch(add, /mode:'shared'/);
  // Opening a page converts shared apps.
  assert.match(manage, /if\(currentSiteTemplate==='trade'\) lpMakeAppsUnique\(lpCur\);/);
  // Per-app Undo / Redo / Reset to homepage / Start blank.
  for (const id of ['lpx-app-undo', 'lpx-app-redo', 'lpx-app-reset', 'lpx-app-blank', 'lpx-app-rm']) {
    assert.match(manage, new RegExp('id="' + id + '"'));
  }
  assert.match(manage, /function lpAppHistStep\(dir\)/);
});

test('a click in the preview while on Landing pages never opens the homepage editor', () => {
  const h = between('function lpAutoSelectBind(d){', 'window.lpPreviewMarkActive=lpPreviewMarkActive;');
  const landing = h.indexOf("activeView==='landing'");
  const toDetails = h.indexOf("showView('details')");
  assert.ok(landing > 0 && toDetails > landing, 'landing check comes before the homepage jump');
  assert.match(h, /lpOpenPosition\(key\)/);
  assert.match(h.slice(landing, toDetails), /return;/);
});

test('Save keeps a server draft; only Publish makes it live', () => {
  const save = between('async function lpSaveDB(){', 'var _lpQuietConvert');
  assert.match(save, /lpDraftSave\(\{ quiet:true \}\)/);
  assert.doesNotMatch(save, /from\('sites'\)\.update/);
  assert.match(manage, /var LP_DRAFT_LABEL='Draft \(not published\)';/);
  assert.match(manage, /source:'auto', label:LP_DRAFT_LABEL, force:true/);
  // Publish clears the draft.
  const pub = between('async function publishToDB(){', 'async function signOutLP(){');
  assert.match(pub, /lpDraftClear\(\)/);
  // Opening the site offers a newer draft.
  assert.match(manage, /function lpDraftCheck\(site\)/);
  assert.match(manage, /Continue draft/);
  assert.match(manage, /Discard draft/);
  // Save draft button next to Publish, and a leave-page warning.
  assert.match(manage, /sd\.id='btn-save-draft'/);
  assert.match(manage, /addEventListener\('beforeunload'/);
  // SEO tools that must stay live keep writing live.
  assert.match(manage, /async function lpSaveLiveDB\(\)/);
});

test('preview shows the draft page: in-place redraw and draft position order', () => {
  assert.match(manage, /function lpPreviewOnCurPage\(\)/);
  assert.match(manage, /function lpPreviewSyncPageOrder\(\)/);
  const r = between('function lpPagePreviewReload(){', 'function lpPreviewSyncPageOrder(){');
  assert.match(r, /if\(lpPreviewOnCurPage\(\)\)/);
  // A page only in a draft still previews (server serves the shell, editor supplies the page).
  assert.match(render, /if \(!isPreview\) return notFound\(res\);\n\s*page = '';/);
});
