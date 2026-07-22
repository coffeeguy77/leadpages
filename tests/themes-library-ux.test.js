'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(ROOT, 'manage.html'), 'utf8');
const mobile = fs.readFileSync(path.join(ROOT, 'assets/lp-mobile-menu-builder.js'), 'utf8');
const api = fs.readFileSync(path.join(ROOT, 'api/api-positioning-layouts.js'), 'utf8');

describe('Themes library UX', () => {
  it('nav label is Themes (not Positioning themes)', () => {
    assert.match(manage, /id="nav-themes"[^>]*>Themes</);
    assert.equal(manage.includes('Positioning themes'), false);
    assert.match(mobile, /'nav-themes': 'Themes'/);
  });

  it('uploads theme images to leadpages/themes/', () => {
    assert.match(manage, /function cwUploadThemesFolder/);
    assert.match(manage, /leadpages\/themes/);
    assert.match(manage, /id="pt-theme-up"/);
    assert.match(manage, /id="pt-layout-up"/);
  });

  it('super-only delete uses trash control and double confirm', () => {
    assert.match(manage, /function _ptConfirmDelete/);
    assert.match(manage, /Confirm delete/);
    assert.match(manage, /class="pt-del"/);
    assert.match(manage, /_ptTrashSvg/);
    assert.match(api, /action === 'delete'/);
    assert.match(api, /super_only/);
  });

  it('exposes structure, fill empty, visual, and full demo install', () => {
    assert.match(manage, /data-pt-apply="structure"/);
    assert.match(manage, /data-pt-apply="fill_empty"/);
    assert.match(manage, /data-pt-apply="visual"/);
    assert.match(manage, /data-pt-apply="demo_replace"/);
    assert.match(manage, /Full demo install/);
    assert.match(manage, /Images &amp; style/);
    assert.match(api, /mode === 'visual'/);
  });

  it('Look and Position images open a zoom lightbox', () => {
    assert.match(manage, /function _ptOpenLightbox/);
    assert.match(manage, /function _ptWireZoom/);
    assert.match(manage, /data-pt-zoom="/);
    assert.match(manage, /class="pt-zoom"/);
    assert.match(manage, /id='pt-lightbox'|id="pt-lightbox"/);
    assert.match(manage, /cursor:zoom-in/);
  });
});
