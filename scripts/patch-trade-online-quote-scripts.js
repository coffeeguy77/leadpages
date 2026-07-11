#!/usr/bin/env node
/**
 * Ensure trade.template.json loads all online quote wizard dependencies.
 */
const fs = require('fs');
const path = require('path');

const tplPath = path.join(__dirname, '../trade.template.json');
const tpl = JSON.parse(fs.readFileSync(tplPath, 'utf8'));
let html = tpl.html;

const scripts = [
  '/assets/lp-quote-wizard-logic.js',
  '/assets/lp-quote-display.js',
  '/assets/lp-quote-planning.js',
  '/assets/lp-online-quote.js'
];

scripts.forEach(function(src) {
  if (!html.includes(src)) {
    html = html.replace('</body>', '<script src="' + src + '" defer></script>\n</body>');
  }
});

tpl.html = html;
fs.writeFileSync(tplPath, JSON.stringify(tpl));
console.log('trade.template.json quote scripts:', scripts.filter(function(s) { return html.includes(s); }).join(', '));
