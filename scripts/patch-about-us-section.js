#!/usr/bin/env node
/**
 * Add aboutUs section markup + CSS link + applyCfg wiring to site templates.
 * Run: node scripts/patch-about-us-section.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const targets = process.argv.slice(2).filter(function (a) { return !a.startsWith('-'); });
const files = targets.length
  ? targets.map(function (f) { return path.resolve(f); })
  : [
      path.join(__dirname, '../trade.template.json'),
      path.join(__dirname, '../landing-shell-neutral-v1.template.json')
    ];

const SECTION_HTML =
  '\n  <!-- ABOUT US APP -->\n'
  + '  <section data-sec="aboutUs" class="section au-section" id="aboutUs" style="display:none">\n'
  + '    <div class="wrap au-story">\n'
  + '      <div class="au-grid">\n'
  + '        <div class="au-col au-col-lead">\n'
  + '          <span class="au-eyebrow"></span>\n'
  + '          <h2 class="au-heading"></h2>\n'
  + '          <div class="au-rule" aria-hidden="true"></div>\n'
  + '          <p class="au-intro"></p>\n'
  + '        </div>\n'
  + '        <div class="au-col au-col-body">\n'
  + '          <div class="au-body"></div>\n'
  + '          <a class="au-cta" href="#quote"><span class="au-cta-label"></span><span class="au-cta-arrow" aria-hidden="true">\u2192</span></a>\n'
  + '        </div>\n'
  + '        <div class="au-col au-col-media">\n'
  + '          <div class="au-media-wrap">\n'
  + '            <img class="au-img" alt="" loading="lazy">\n'
  + '            <blockquote class="au-quote">\n'
  + '              <p class="au-quote-text"></p>\n'
  + '              <cite class="au-quote-attr"></cite>\n'
  + '            </blockquote>\n'
  + '          </div>\n'
  + '        </div>\n'
  + '      </div>\n'
  + '    </div>\n'
  + '    <div class="au-band" hidden>\n'
  + '      <div class="au-band-decor" aria-hidden="true"></div>\n'
  + '      <div class="wrap au-band-inner">\n'
  + '        <div class="au-band-copy">\n'
  + '          <h3 class="au-band-heading"></h3>\n'
  + '          <p class="au-band-sub"></p>\n'
  + '        </div>\n'
  + '        <a class="au-band-cta" href="#quote"><span class="au-band-cta-label"></span><span class="au-cta-arrow" aria-hidden="true">\u2192</span></a>\n'
  + '        <div class="au-band-tag">\n'
  + '          <span class="au-band-tagline"></span>\n'
  + '        </div>\n'
  + '      </div>\n'
  + '    </div>\n'
  + '  </section>\n\n';

const APPLY_HOOK =
  "\n    try{ if(typeof lpApplyAboutUs==='function'){ var __AU=(C.sections&&C.sections.aboutUs)||{};"
  + " lpApplyAboutUs(__AU, document.querySelector('[data-sec=\"aboutUs\"]'),"
  + " {business:(C.business||C.name||C.business_name||C.businessName||''), theme:(C.theme||{})}); }"
  + " }catch(e){}\n";

function patchFile(tplPath) {
  if (!fs.existsSync(tplPath)) {
    console.warn('Skip missing', tplPath);
    return;
  }
  const tpl = JSON.parse(fs.readFileSync(tplPath, 'utf8'));
  let html = tpl.html;
  let changed = false;
  const label = path.basename(tplPath);

  if (!html.includes('data-sec="aboutUs"')) {
    const anchors = [
      '  <!-- CUSTOM HTML APP -->\n  <section data-sec="customHtml"',
      '<section data-sec="customHtml"',
      '<section data-sec="textBox"',
      '  <!-- ONLINE QUOTE WIZARD -->\n  <section data-sec="onlineQuote"',
      '  <!-- QUOTE FORM -->\n  <section data-sec="quote"'
    ];
    let placed = false;
    for (const anchor of anchors) {
      if (html.includes(anchor)) {
        html = html.replace(anchor, SECTION_HTML + anchor);
        placed = true;
        break;
      }
    }
    if (!placed) {
      console.error(label + ': Could not find insertion anchor');
      process.exit(1);
    }
    changed = true;
    console.log(label + ': Added aboutUs section markup');
  } else {
    console.log(label + ': aboutUs section already present');
  }

  if (!html.includes('lp-about-us.css')) {
    if (html.includes('lp-custom-html.js')) {
      html = html.replace(
        '<script src="/assets/lp-custom-html.js"',
        '<link rel="stylesheet" href="/assets/lp-about-us.css">\n<script src="/assets/lp-about-us.js" defer></script>\n<script src="/assets/lp-custom-html.js"'
      );
    } else {
      html = html.replace(
        '</body>',
        '<link rel="stylesheet" href="/assets/lp-about-us.css">\n<script src="/assets/lp-about-us.js" defer></script>\n</body>'
      );
    }
    changed = true;
    console.log(label + ': Added about-us CSS/JS');
  }

  // Visibility toggle lists
  const listNeedles = [
    "'textBox','seoText','searchCanvas','onlineQuote','orderStorefront','bookingStorefront','customHtml'",
    "'textBox','seoText','searchCanvas','customHtml'",
    "'textBox','seoText','onlineQuote','customHtml'",
    "'textBox','seoText','customHtml'",
    "'customerReactions','textBox','seoText'"
  ];
  listNeedles.forEach(function (needle) {
    if (html.includes(needle) && !needle.includes('aboutUs') && html.includes(needle)) {
      const next = needle.replace("'textBox'", "'textBox','aboutUs'");
      if (next !== needle && html.includes(needle) && !html.includes("'aboutUs'")) {
        // handled below more carefully
      }
    }
  });

  // Prefer explicit replacements that keep aboutUs next to textBox
  if (!html.includes("'aboutUs'")) {
    html = html.replace(
      /('customerReactions','textBox')/g,
      "'customerReactions','textBox','aboutUs'"
    );
    html = html.replace(
      /('textBox','seoText')/g,
      "'textBox','aboutUs','seoText'"
    );
    changed = true;
    console.log(label + ': Added aboutUs to optional visibility lists');
  } else if (!html.includes("'textBox','aboutUs'") && html.includes("'textBox','seoText'")) {
    html = html.replace(/('textBox','seoText')/g, "'textBox','aboutUs','seoText'");
    changed = true;
  }

  if (!html.includes('lpApplyAboutUs')) {
    const markers = [
      '/* Text Box content */',
      "document.querySelector('[data-sec=\"textBox\"]')",
      "document.querySelector('[data-sec=\"customHtml\"]')",
      'lpApplyCustomHtml'
    ];
    let inserted = false;
    for (let mi = 0; mi < markers.length; mi++) {
      const idx = html.indexOf(markers[mi]);
      if (idx < 0) continue;
      // Insert after the next }catch(e){} following this marker
      const catchIdx = html.indexOf('}catch(e){}', idx);
      if (catchIdx < 0) continue;
      html = html.slice(0, catchIdx + 11) + APPLY_HOOK + html.slice(catchIdx + 11);
      inserted = true;
      changed = true;
      console.log(label + ': Wired applyCfg aboutUs hook');
      break;
    }
    if (!inserted) {
      console.warn(label + ': Could not wire applyCfg hook');
    }
  }

  if (html.includes("textBox:'Text Box'") && !html.includes("aboutUs:'About Us'")) {
    html = html.replace("textBox:'Text Box'", "textBox:'Text Box',aboutUs:'About Us'");
    changed = true;
  }

  tpl.html = html;
  if (changed) {
    fs.writeFileSync(tplPath, JSON.stringify(tpl));
    console.log(label + ': Patched');
  } else {
    console.log(label + ': No changes needed');
  }
}

files.forEach(patchFile);
