#!/usr/bin/env node
/**
 * Add customHtml section markup + applyCfg wiring to site templates.
 * Run: node scripts/patch-trade-custom-html-section.js
 * Optional paths: node scripts/patch-trade-custom-html-section.js trade.template.json
 */
const fs = require('fs');
const path = require('path');

const targets = process.argv.slice(2).filter(function (a) { return !a.startsWith('-'); });
const files = targets.length
  ? targets.map(function (f) { return path.resolve(f); })
  : [
      path.join(__dirname, '../trade.template.json'),
      path.join(__dirname, '../landing-shell-neutral-v1.template.json')
    ];

function patchFile(tplPath) {
  if (!fs.existsSync(tplPath)) {
    console.warn('Skip missing', tplPath);
    return;
  }
  const tpl = JSON.parse(fs.readFileSync(tplPath, 'utf8'));
  let html = tpl.html;
  let changed = false;
  const label = path.basename(tplPath);

  const sectionBlock =
    '\n  <!-- CUSTOM HTML APP -->\n'
    + '  <section data-sec="customHtml" class="sec lp-custom-html-sec" id="customHtml" style="display:none">\n'
    + '    <div class="in wrap lp-ch-wrap">\n'
    + '      <h2 class="lp-ch-title" style="display:none"></h2>\n'
    + '      <div class="lp-custom-html-mount" data-lp-custom-html></div>\n'
    + '    </div>\n'
    + '  </section>\n\n';

  if (!html.includes('data-sec="customHtml"')) {
    const anchors = [
      '  <!-- ONLINE QUOTE WIZARD -->\n  <section data-sec="onlineQuote"',
      '  <!-- QUOTE FORM -->\n  <section data-sec="quote"',
      '<section data-sec="textBox"'
    ];
    let placed = false;
    for (const anchor of anchors) {
      if (html.includes(anchor)) {
        html = html.replace(anchor, sectionBlock + anchor);
        placed = true;
        break;
      }
    }
    if (!placed) {
      console.error(label + ': Could not find insertion anchor');
      process.exit(1);
    }
    changed = true;
    console.log(label + ': Added customHtml section markup');
  } else {
    console.log(label + ': customHtml section already present');
  }

  const cssSnippet =
    'section[data-sec="customHtml"]{display:none;width:100%;max-width:100%}'
    + 'section[data-sec="customHtml"].lp-ch-fullbleed .lp-ch-wrap{max-width:none;padding-left:0;padding-right:0}'
    + 'section[data-sec="customHtml"] .lp-ch-wrap{min-width:0;max-width:100%}'
    + 'section[data-sec="customHtml"] .lp-custom-html-mount{width:100%;min-width:0;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}'
    + 'section[data-sec="customHtml"] .lp-ch-title{margin:0 0 18px;font-size:clamp(22px,3vw,32px)}';

  if (!html.includes('section[data-sec="customHtml"]')) {
    const cssAnchor = 'section[data-sec="textBox"]{display:none}';
    if (html.includes(cssAnchor)) {
      html = html.replace(cssAnchor, cssSnippet + cssAnchor);
      changed = true;
      console.log(label + ': Added customHtml CSS');
    } else {
      console.warn(label + ': CSS anchor missing — skipping style inject');
    }
  }

  // Visibility toggle lists in applyCfg
  const lists = [
    "['navMenu','beforeAfter','responseCards','projectStats','serviceAreas','reviewHighlights','featuredProjects','premiumGallery','featureStrip','specialOffer','heroBeforeAfter','heroSlider','splitHero','activityCounter','proofStream','projectFeed','jobsFeed','beforeAfterFeed','videoReels','activityTimeline','customerReactions','textBox','seoText','onlineQuote']",
    "['navMenu','beforeAfter','responseCards','projectStats','serviceAreas','reviewHighlights','featuredProjects','premiumGallery','featureStrip','specialOffer','heroBeforeAfter','heroSlider','splitHero','activityCounter','proofStream','projectFeed','jobsFeed','beforeAfterFeed','videoReels','activityTimeline','customerReactions','textBox','seoText']"
  ];
  lists.forEach(function (list) {
    if (html.includes(list) && !list.includes('customHtml')) {
      const next = list.replace("'onlineQuote']", "'onlineQuote','customHtml']")
        .replace("'seoText']", "'seoText','customHtml']");
      if (next !== list && html.includes(list)) {
        html = html.split(list).join(next);
        changed = true;
      }
    }
  });
  if (!html.includes("'customHtml']") && html.includes("'onlineQuote'].forEach")) {
    html = html.replace("'onlineQuote'].forEach", "'onlineQuote','customHtml'].forEach");
    changed = true;
  }
  html = html.replace(
    /('textBox','seoText','onlineQuote')(\])/g,
    "'textBox','seoText','onlineQuote','customHtml'$2"
  );
  // Only rewrite seoText-ending lists when customHtml is still absent entirely
  if (!html.includes("'customHtml'")) {
    html = html.replace(
      /('textBox','seoText')(\])/g,
      "'textBox','seoText','customHtml'$2"
    );
  }

  const applyHook =
    "\n    try{ if(typeof lpApplyCustomHtml==='function'){ lpApplyCustomHtml((C.sections&&C.sections.customHtml)||{}); }"
    + " else if(window.lpRefreshCustomHtml){ window.lpRefreshCustomHtml(C); } }catch(e){}\n";

  if (!html.includes('lpApplyCustomHtml')) {
    const oq = html.indexOf("document.querySelector('[data-sec=\"onlineQuote\"]')");
    if (oq >= 0) {
      const after = html.indexOf('})();', oq);
      if (after >= 0) {
        html = html.slice(0, after + 5) + applyHook + html.slice(after + 5);
        changed = true;
        console.log(label + ': Wired applyCfg customHtml hook');
      }
    }
  }

  if (!html.includes('lp-custom-html.js')) {
    html = html.replace(
      '</body>',
      '<script src="/assets/lp-custom-html.js" defer></script>\n</body>'
    );
    changed = true;
    console.log(label + ': Added lp-custom-html.js script');
  }

  if (html.includes("textBox:'Text Box'") && !html.includes("customHtml:'Custom HTML'")) {
    html = html.replace("textBox:'Text Box'", "textBox:'Text Box',customHtml:'Custom HTML'");
    changed = true;
  }
  if (html.includes("onlineQuote:'Online Quote'") && !html.includes("customHtml:'Custom HTML'")) {
    html = html.replace("onlineQuote:'Online Quote'", "onlineQuote:'Online Quote',customHtml:'Custom HTML'");
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
