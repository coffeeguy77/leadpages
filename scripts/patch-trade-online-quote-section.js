#!/usr/bin/env node
/**
 * Add onlineQuote section markup to trade.template.json (before quote form).
 * Run: node scripts/patch-trade-online-quote-section.js
 */
const fs = require('fs');
const path = require('path');

const tplPath = path.join(__dirname, '../trade.template.json');
const tpl = JSON.parse(fs.readFileSync(tplPath, 'utf8'));
let html = tpl.html;

if (html.includes('data-sec="onlineQuote"')) {
  console.log('trade.template.json already has onlineQuote section');
  process.exit(0);
}

const block =
  '\n  <!-- ONLINE QUOTE WIZARD -->\n'
  + '  <section data-sec="onlineQuote" class="sec online-quote" id="onlineQuote" style="display:none">\n'
  + '    <div class="in wrap">\n'
  + '      <p class="ey"></p>\n'
  + '      <h2></h2>\n'
  + '      <p class="intro"></p>\n'
      + '      <div id="lp-online-quote" data-slug="{{slug}}"></div>\n'
  + '    </div>\n'
  + '  </section>\n\n';

const anchor = '  <!-- QUOTE FORM -->\n  <section data-sec="quote"';
if (!html.includes(anchor)) {
  console.error('Could not find quote section anchor in trade.template.json');
  process.exit(1);
}
html = html.replace(anchor, block + anchor);

if (!html.includes('lp-online-quote.js')) {
  const scriptTag = '<script src="/assets/lp-online-quote.js" defer></script>\n';
  html = html.replace('</body>', scriptTag + '</body>');
}

tpl.html = html;
fs.writeFileSync(tplPath, JSON.stringify(tpl));
console.log('Patched trade.template.json with onlineQuote section');
