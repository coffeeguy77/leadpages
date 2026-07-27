/**
 * Dual-tint LeadPages lockup renderer.
 */
const assert = require('assert');
const { buildDualTintSvg, renderDualTintPng, dualTintLogoUrl } = require('../lib/lead-notify-logo');

(async function () {
  const svg = buildDualTintSvg('#f472b6', '#5c4033');
  assert.ok(svg.includes('#f472b6'), 'accent fill');
  assert.ok(svg.includes('#5c4033'), 'ink fill');
  assert.ok(!/var\(--lp-logo-/.test(svg), 'no css vars left');

  const png = await renderDualTintPng({ accent: '#ffffff', ink: '#5c4033', height: 84 });
  assert.ok(Buffer.isBuffer(png) && png.length > 500, 'png buffer');
  assert.strictEqual(png[0], 0x89);
  assert.strictEqual(png[1], 0x50);

  const url = dualTintLogoUrl('https://www.leadpages.com.au', {
    logoTint: '#ffffff',
    logoTint2: '#5c4033',
    logoWordmarkHeight: 84
  });
  assert.ok(url.includes('/api/lead-notify-logo?'));
  assert.ok(url.includes('accent=%23ffffff'));
  assert.ok(url.includes('ink=%235c4033'));
  assert.ok(url.includes('h=84'));

  console.log('lead-notify-logo.test.js: ok');
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
