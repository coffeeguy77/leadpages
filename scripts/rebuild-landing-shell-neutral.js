'use strict';

/**
 * Rebuild landing-shell-neutral-v1 from trade.template.json WITHOUT
 * stripping theme token substrings like "hivis" (that previously broke applyCfg).
 *
 * Live trade.template.json is never written.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TRADE = path.join(ROOT, 'trade.template.json');
const OUT = path.join(ROOT, 'landing-shell-neutral-v1.template.json');

const CONTENT_REPLACEMENTS = [
  // Hero residual (exact trade defaults)
  [/Blocked drain\?/gi, ''],
  [/We'll clear it today\.?/gi, ''],
  [/Fast, fixed-price[\s\S]*?before we start\./gi, ''],
  [/burst pipes/gi, ''],
  [/Burst pipes/gi, ''],
  [/Burst pipe at midnight\.?/gi, ''],
  [/hot water/gi, ''],
  [/Blocked drains?/gi, ''],
  [/Licensed Canberra plumber/gi, ''],
  [/24\/7 Emergency Plumber/gi, ''],
  [/Get a fast quote/gi, 'Get in touch'],
  // Common trade JSON-LD / copy leftovers that are safe to blank
  [/\bplumber\b/gi, ''],
  [/\bplumbing\b/gi, ''],
  // Only the human phrase "hi-vis" / "hi vis" — never the theme token "hivis"
  [/\bhi-vis\b/gi, ''],
  [/\bhi vis\b/gi, '']
];

function rebuild() {
  const trade = JSON.parse(fs.readFileSync(TRADE, 'utf8'));
  let html = String(trade.html || '');

  // Mark as Website Studio neutral shell
  html = html.replace(/<html([^>]*)>/i, '<html$1 data-ws-shell="landing-shell-neutral-v1">');
  if (!/data-ws-shell="landing-shell-neutral-v1"/.test(html)) {
    html = html.replace('<html', '<html data-ws-shell="landing-shell-neutral-v1"');
  }

  // Inject early boot that hides off sections using SITE_CONFIG (not window.__SITE_CONFIG__ only)
  const boot = `
<script id="ws-neutral-boot">
(function(){
  document.documentElement.setAttribute('data-ws-shell','landing-shell-neutral-v1');
})();
</script>
`;
  if (!html.includes('id="ws-neutral-boot"')) {
    html = html.includes('<body')
      ? html.replace(/<body([^>]*)>/i, '<body$1>' + boot)
      : boot + html;
  }

  if (!html.includes('name="ws-renderer-shell"')) {
    html = html.replace(
      '</head>',
      '<meta name="ws-renderer-shell" content="landing-shell-neutral-v1">\n</head>'
    );
  }

  for (const [re, to] of CONTENT_REPLACEMENTS) {
    html = html.replace(re, to);
  }

  // Guarantee theme token "hivis" remains intact in CSS/JS (regression from over-strip)
  if (!/th\.hivis/.test(html) || !/--hivis/.test(html)) {
    throw new Error('rebuild failed: hivis theme token missing after content scrub');
  }
  if (/setv\(th\.,'--'/.test(html) || /var\(---600/.test(html) || /var\(--\)/.test(html)) {
    throw new Error('rebuild failed: broken empty CSS/JS tokens present');
  }
  if (/We'll clear it today|burst pipes|Blocked drain/i.test(html)) {
    throw new Error('rebuild failed: plumbing residual still present');
  }

  const out = {
    html,
    shellId: 'landing-shell-neutral-v1',
    generatedFrom: 'trade.template.json',
    generatedAt: new Date().toISOString(),
    note:
      'Content-neutral Website Studio shell. Theme tokens (including hivis) preserved. Live trade.template.json is untouched.'
  };
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('Wrote', OUT, 'htmlBytes', html.length);
}

rebuild();
