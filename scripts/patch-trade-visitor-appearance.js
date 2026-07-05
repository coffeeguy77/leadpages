#!/usr/bin/env node
/**
 * One-shot patch: add applyVisitorAppearance to trade.template.json
 */
const fs = require('fs');
const path = require('path');

const APPLY_FN = `
  function applyVisitorAppearance(C){
    C=C||{}; var va=C.visitorAppearance||{}, de=document.documentElement;
    if(!va||typeof va!=='object') return;
    var st=va.siteTheme||'classic-light';
    if(!st||st==='classic-light'||st==='match-brand') de.removeAttribute('data-lp-site-theme');
    else de.setAttribute('data-lp-site-theme', st);
    var stored=null;
    try{ stored=JSON.parse(localStorage.getItem('leadpages_visitor_accessibility')||'null'); }catch(e){}
    if(!stored){
      de.dataset.lpVisitorText=(va.defaultTextSize==='large')?'large':'standard';
      de.dataset.lpVisitorContrast=(va.defaultContrast==='high')?'high':'standard';
      if(va.reducedMotionSupport!==false) de.dataset.lpVisitorMotion='standard';
    }
  }`;

const tplPath = path.join(__dirname, '../trade.template.json');
const tpl = JSON.parse(fs.readFileSync(tplPath, 'utf8'));
let html = tpl.html;

if (html.includes('function applyVisitorAppearance')) {
  console.log('trade.template.json already patched');
  process.exit(0);
}

const anchor = 'window.__applyTradeConfig=function(_c){ applyCfg(_c);';
if (!html.includes(anchor)) {
  console.error('Could not find __applyTradeConfig anchor');
  process.exit(1);
}

html = html.replace(
  anchor,
  APPLY_FN + '\n    ' + anchor.replace(
    'applyCfg(_c);',
    'applyCfg(_c); try{applyVisitorAppearance(_c);}catch(_e){}'
  )
);

if (!html.includes('<body>\n<a class="lpa-skip"')) {
  html = html.replace(
    '<body>',
    '<body>\n<a class="lpa-skip" href="#top">Skip to content</a>'
  );
}

tpl.html = html;
fs.writeFileSync(tplPath, JSON.stringify(tpl));
console.log('Patched trade.template.json');
