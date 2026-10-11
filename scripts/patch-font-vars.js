#!/usr/bin/env node
/**
 * Make the trade template and app stylesheets font-set ready (assets/lp-fonts.js):
 *   "Barlow Condensed" → var(--lp-font-head,"Barlow Condensed")
 *   "Barlow"           → var(--lp-font-body,"Barlow")
 * inside CSS font / font-family declarations only. With the variables unset the page
 * renders exactly as before. Safe to run more than once.
 * Run: node scripts/patch-font-vars.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CSS_FILES = [
  'assets/lp-layouts.css', 'assets/lp-about-us.css', 'assets/lp-booking-hire.css',
  'assets/lp-quote-builder.css', 'marketplace/demos/demo-shared.css'
];
const TEMPLATES = ['trade.template.json'];

/** Rewrite quoted Barlow families inside font / font-family declarations. */
function patchCss(css) {
  return css
    .replace(/(font(?:-family)?\s*:[^;{}]*?)(?<!--lp-font-head,)"Barlow Condensed"/g, '$1var(--lp-font-head,"Barlow Condensed")')
    .replace(/(font(?:-family)?\s*:[^;{}]*?)(?<!--lp-font-body,)"Barlow"/g, '$1var(--lp-font-body,"Barlow")');
}

let changed = 0;
for (const rel of CSS_FILES) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, 'utf8');
  let out = src, prev;
  do { prev = out; out = patchCss(out); } while (out !== prev);
  if (out !== src) { fs.writeFileSync(p, out); changed++; console.log('patched', rel); }
}
for (const rel of TEMPLATES) {
  const p = path.join(ROOT, rel);
  const tpl = JSON.parse(fs.readFileSync(p, 'utf8'));
  let out = tpl.html, prev;
  do { prev = out; out = patchCss(out); } while (out !== prev);
  if (out !== tpl.html) { tpl.html = out; fs.writeFileSync(p, JSON.stringify(tpl)); changed++; console.log('patched', rel); }
}
console.log(changed ? 'done' : 'nothing to change');
