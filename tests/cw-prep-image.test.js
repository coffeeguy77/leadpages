'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(ROOT, 'manage.html'), 'utf8');
const apiManage = fs.readFileSync(path.join(ROOT, 'api/manage.html'), 'utf8');

describe('cwPrepImage — tighter upload prep', () => {
  it('uses Save-for-Web style defaults (2000px, q=0.8, ~800KB skip)', () => {
    assert.match(manage, /function cwPrepImage\(file,maxDim,quality\)/);
    assert.match(manage, /maxDim=maxDim\|\|2000/);
    assert.match(manage, /quality=\(quality==null\?0\.8:quality\)/);
    assert.match(manage, /var SKIP_BYTES=800000/);
    assert.doesNotMatch(manage, /maxDim=maxDim\|\|2200/);
    assert.doesNotMatch(manage, /file\.size<=2600000/);
  });

  it('converts large PNGs to JPEG and keeps small PNGs transparent', () => {
    assert.match(manage, /keepAlpha \(chroma logos\): always PNG/);
    assert.match(manage, /asJpeg=keepAlpha\?false:\(!\/\^image\\\/png\$\/i\.test\(file\.type\) \|\| file\.size>SKIP_BYTES\)/);
    assert.match(manage, /fillStyle='#ffffff'/);
  });

  it('keeps original when compression does not shrink the file', () => {
    assert.match(manage, /if\(b\.size>=file\.size && scale>=1\) return resolve\(file\)/);
  });

  it('api/manage.html stays in sync with manage.html prep defaults', () => {
    assert.match(apiManage, /maxDim=maxDim\|\|2000/);
    assert.match(apiManage, /var SKIP_BYTES=800000/);
    assert.match(apiManage, /quality=\(quality==null\?0\.8:quality\)/);
  });

  it('upload hint mentions compression threshold', () => {
    assert.match(manage, /images over ~800 KB are compressed on upload/);
  });

  it('supports keepAlpha so chroma logos stay PNG', () => {
    assert.match(manage, /var keepAlpha=!!opts\.keepAlpha/);
    assert.match(manage, /keepAlpha\?false:/);
    assert.match(manage, /cwPrepImage\(file, opts\)/);
  });
});
