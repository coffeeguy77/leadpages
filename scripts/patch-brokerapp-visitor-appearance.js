#!/usr/bin/env node
/**
 * One-shot patch: add applyVisitorAppearance to brokerapp.template.json
 */
const fs = require('fs');
const path = require('path');

const APPLY_BLOCK = `
(function(){
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
  }
  window.__applyBrokerAppConfig=function(cfg){
    cfg=cfg||window.BROKERAPP_CONFIG||{};
    try{applyVisitorAppearance(cfg);}catch(_e){}
    if(cfg.appearance&&window.__applyAppearance) window.__applyAppearance(cfg.appearance);
  };
  function boot(){ try{applyVisitorAppearance(window.BROKERAPP_CONFIG||{});}catch(_e){} }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();`;

const tplPath = path.join(__dirname, '../brokerapp.template.json');
const tpl = JSON.parse(fs.readFileSync(tplPath, 'utf8'));
let html = tpl.html;

if (html.includes('window.__applyBrokerAppConfig')) {
  console.log('brokerapp.template.json already patched');
  process.exit(0);
}

const anchor = 'var CFG = window.BROKERAPP_CONFIG || {};';
if (!html.includes(anchor)) {
  console.error('Could not find BROKERAPP_CONFIG anchor');
  process.exit(1);
}

html = html.replace(anchor, APPLY_BLOCK + '\n' + anchor);

if (!html.includes('class="lpa-skip"')) {
  html = html.replace(
    '<body>',
    '<body>\n<a class="lpa-skip" href="#top">Skip to content</a>\n<div id="top"></div>'
  );
}

tpl.html = html;
fs.writeFileSync(tplPath, JSON.stringify(tpl));
console.log('Patched brokerapp.template.json');
