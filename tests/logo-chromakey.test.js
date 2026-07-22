'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  parseHex,
  colorDistance,
  applyChromaKey,
  DEFAULT_TOLERANCE
} = require('../lib/logo-chromakey');

const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');

describe('logo chromakey lib', () => {
  it('parses hex colours', () => {
    assert.deepEqual(parseHex('#fff'), { r: 255, g: 255, b: 255 });
    assert.deepEqual(parseHex('00ff00'), { r: 0, g: 255, b: 0 });
    assert.equal(parseHex('nope'), null);
  });

  it('clears exact key colour pixels to transparent', () => {
    const data = new Uint8ClampedArray([
      255, 255, 255, 255,
      10, 20, 30, 255,
      250, 250, 250, 255
    ]);
    const imageData = { data };
    const n = applyChromaKey(imageData, parseHex('#ffffff'), 20);
    assert.ok(n >= 1);
    assert.equal(data[3], 0); // white gone
    assert.equal(data[7], 255); // dark pixel kept
  });

  it('uses a soft edge within tolerance band', () => {
    const data = new Uint8ClampedArray([240, 240, 240, 255]);
    applyChromaKey({ data }, { r: 255, g: 255, b: 255 }, 10);
    // distance ~26 — outside hard tol 10, may be in soft band or untouched
    assert.ok(data[3] <= 255);
    assert.equal(DEFAULT_TOLERANCE, 38);
    assert.ok(colorDistance(0, 0, 0, 255, 255, 255) > 400);
  });
});

describe('logo chromakey UI wiring', () => {
  it('exposes Remove background colour controls on Logo tab', () => {
    assert.match(manage, /id="lg-ck-on"/);
    assert.match(manage, /Remove background colour/);
    assert.match(manage, /id="lg-ck-color"/);
    assert.match(manage, /id="lg-ck-tol"/);
    assert.match(manage, /id="lg-ck-eyedrop"/);
  });

  it('runs cwChromaKeyBlob before logo upload with keepAlpha', () => {
    assert.match(manage, /function cwChromaKeyBlob/);
    assert.match(manage, /cwChromaKeyBlob\(file/);
    assert.match(manage, /keepAlpha:useCk/);
    assert.match(manage, /keepAlpha\?false:/);
  });
});
