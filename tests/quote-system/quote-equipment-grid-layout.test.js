/**
 * REAL layout test — headless Chrome measures equipment card positions.
 * Fails if Coffee Cart / Coffee Van style cards are stacked vertically.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');
const os = require('os');

const root = path.join(__dirname, '../..');
const css = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.css'), 'utf8');
const displaySrc = fs.readFileSync(path.join(root, 'assets/lp-quote-display.js'), 'utf8');

// Guard: the bug that squeezed .lp-oq-carts to ~140px must never return
assert.ok(
  !/\.oqb-preview-mock\s+\.lp-oq-layout-grid\s+\.lp-oq-stack\s*\{[^}]*minmax\(140px/.test(css.replace(/\s+/g, ' ')),
  'CSS must NOT apply chip minmax(140px) grid to .lp-oq-stack (that stacks equipment)'
);
assert.ok(
  !css.includes('.oqb-preview-mock .lp-oq-layout-grid .lp-oq-stack {\n  display: grid'),
  'layout-grid must not set display:grid on .lp-oq-stack'
);

// Extract injected layoutCss the same way the wizard does
function extractLayoutCss() {
  // Evaluate layoutCss via a tiny vm by loading the IIFE file in chrome instead
  return null;
}

const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
:root { --accent:#e8a0b0; --line:#444; --ink:#fff; --ink-soft:#ccc; --panel:#2e282a; }
${css}
</style>
<script src="file://${path.join(root, 'assets/lp-quote-display.js')}"></script>
</head><body>
<div class="oqb-preview-mock" style="width:1100px;padding:20px;background:#1a2230">
  <div class="lp-oq-card lp-oq-layout-grid" style="--lp-oq-panel-bg:#2e282a;padding:24px;border:1px solid #e8a0b0">
    <div class="lp-oq-stack" id="stack">
      <p class="lp-oq-intro">What equipment would you like to hire?</p>
      <div class="lp-oq-carts" id="carts">
        <div class="lp-oq-choices fp-grid lp-oq-fp-grid" id="grid">
          <div class="fp-card lp-oq-eq-card" id="card-a" style="min-height:180px;background:#3a3034;border:1px solid #e8a0b0;border-radius:12px;padding:12px">
            <strong style="color:#e8a0b0">COFFEE CART</strong>
            <p>Classic cart hire</p>
          </div>
          <div class="fp-card lp-oq-eq-card" id="card-b" style="min-height:180px;background:#3a3034;border:1px solid #e8a0b0;border-radius:12px;padding:12px">
            <strong style="color:#e8a0b0">COFFEE VAN</strong>
            <p>Fully self contained</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<script>
  // Also inject public layoutCss (same as live preview does)
  var cssText = (window.LPQuoteDisplay && LPQuoteDisplay.layoutCss)
    ? LPQuoteDisplay.layoutCss('var(--accent)')
    : '';
  if (cssText) {
    var s = document.createElement('style');
    s.textContent = cssText;
    document.head.appendChild(s);
  }

  function measure() {
    var a = document.getElementById('card-a').getBoundingClientRect();
    var b = document.getElementById('card-b').getBoundingClientRect();
    var grid = document.getElementById('grid').getBoundingClientRect();
    var stack = document.getElementById('stack');
    var stackCs = getComputedStyle(stack);
    var gridCs = getComputedStyle(document.getElementById('grid'));
    var sameRow = Math.abs(a.top - b.top) < 8;
    var sideBySide = sameRow && b.left > a.right - 2;
    return {
      ok: sideBySide && grid.width > 400,
      sameRow: sameRow,
      sideBySide: sideBySide,
      a: { top: a.top, left: a.left, width: a.width, right: a.right },
      b: { top: b.top, left: b.left, width: b.width, right: b.right },
      gridWidth: grid.width,
      stackDisplay: stackCs.display,
      stackGridCols: stackCs.gridTemplateColumns,
      gridDisplay: gridCs.display,
      gridCols: gridCs.gridTemplateColumns
    };
  }
  document.title = JSON.stringify(measure());
</script>
</body></html>`;

const tmpHtml = path.join(os.tmpdir(), 'oq-eq-grid-layout-test.html');
const tmpOut = path.join(os.tmpdir(), 'oq-eq-grid-layout-out.json');
fs.writeFileSync(tmpHtml, html);

const chrome = spawnSync('google-chrome', [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--allow-file-access-from-files',
  '--virtual-time-budget=3000',
  '--dump-dom',
  'file://' + tmpHtml
], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 30000 });

if (chrome.status !== 0) {
  console.error(chrome.stderr || chrome.stdout);
  process.exit(1);
}

const m = chrome.stdout.match(/<title>([^<]+)<\/title>/);
assert.ok(m, 'chrome dump-dom should include measured title JSON');
const result = JSON.parse(m[1].replace(/&quot;/g, '"'));

if (!result.ok) {
  console.error('LAYOUT FAIL — equipment cards are stacked or squeezed:\n', JSON.stringify(result, null, 2));
}
assert.ok(result.stackDisplay === 'block' || result.stackDisplay === 'flow-root',
  'stack must be block, not grid (got ' + result.stackDisplay + ')');
assert.ok(result.gridWidth > 400, 'equipment grid must be wide, got ' + result.gridWidth);
assert.ok(result.sameRow, 'cards must share the same row (top)');
assert.ok(result.sideBySide, 'cards must sit side-by-side, not stacked');

console.log('quote-equipment-grid-layout.test.js: ok', {
  gridWidth: Math.round(result.gridWidth),
  cardA: Math.round(result.a.width),
  cardB: Math.round(result.b.width),
  stackDisplay: result.stackDisplay
});
