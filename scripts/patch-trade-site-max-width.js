#!/usr/bin/env node
/**
 * Sync site max-width CSS + applySiteMaxWidth() into trade templates.
 * Run: node scripts/patch-trade-site-max-width.js
 */
const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '../trade.template.json'),
  path.join(__dirname, '../landing-shell-neutral-v1.template.json')
];

const cssSnippet =
  '/* Site max width — caps hero slider + trust bar images and overall content */'
  + 'html.site-width-capped section[data-sec="heroSlider"] .hsl{max-width:var(--site-maxw,1920px);margin-left:auto;margin-right:auto;width:100%;height:auto;aspect-ratio:16/9;max-height:var(--hsl-mh-d,680px)}'
  + '@media(max-width:760px){html.site-width-capped section[data-sec="heroSlider"] .hsl{max-height:var(--hsl-mh-m,560px)}}'
  + 'html.site-width-capped [data-sec="trustBar"].tb-images .tb-band{max-width:var(--site-maxw,1920px);margin-left:auto;margin-right:auto;width:100%}'
  + 'html.site-width-capped [data-sec="trustBar"].tb-images .tb-band>.wrap{max-width:100%}'
  + 'html.site-width-full .wrap{max-width:none}';

const cssAnchor = '@media(max-width:760px){.hsl{height:var(--hsl-mh-m,560px)}.hsl-arrow{width:38px;height:38px;font-size:22px}.hsl-prev{left:10px}.hsl-next{right:10px}}';

const fnSnippet =
  'function applySiteMaxWidth(cfg){'
  + 'cfg=cfg||{};var de=document.documentElement,rs=de.style,raw=cfg.maxSiteWidth,'
  + 'mode=String(raw==null||raw===\'\'?\'1920\':raw).trim().toLowerCase();'
  + 'if(mode===\'full\'||mode===\'none\'||mode===\'100%\'){'
  + 'var clsF=(de.className||\'\').split(\' \').filter(function(x){return x&&x.indexOf(\'site-width-\')!==0&&x.indexOf(\'site-max-\')!==0;});'
  + 'clsF.push(\'site-width-full\');de.className=clsF.join(\' \');rs.removeProperty(\'--site-maxw\');rs.setProperty(\'--maxw\',\'none\');return;}'
  + 'var px=parseInt(mode,10);if(!isFinite(px)||px<1)px=1920;'
  + 'var clsC=(de.className||\'\').split(\' \').filter(function(x){return x&&x.indexOf(\'site-width-\')!==0&&x.indexOf(\'site-max-\')!==0;});'
  + 'clsC.push(\'site-width-capped\');if(px<=1440)clsC.push(\'site-max-1440\');'
  + 'de.className=clsC.join(\' \');rs.setProperty(\'--site-maxw\',px+\'px\');rs.setProperty(\'--maxw\',px+\'px\');}';

files.forEach(function (tplPath) {
  if (!fs.existsSync(tplPath)) {
    console.warn('Skip missing', tplPath);
    return;
  }
  const tpl = JSON.parse(fs.readFileSync(tplPath, 'utf8'));
  let html = tpl.html;
  let changed = false;
  const label = path.basename(tplPath);

  if (!html.includes('html.site-width-capped section[data-sec="heroSlider"]')) {
    if (!html.includes(cssAnchor)) {
      console.error(label + ': CSS anchor missing');
      process.exit(1);
    }
    html = html.replace(cssAnchor, cssAnchor + cssSnippet);
    changed = true;
    console.log(label + ': Added site max-width CSS');
  } else {
    console.log(label + ': site max-width CSS already present');
  }

  if (!html.includes('function applySiteMaxWidth(')) {
    const anchor = 'function applyThemeVars(th){';
    if (!html.includes(anchor)) {
      console.error(label + ': applyThemeVars anchor missing');
      process.exit(1);
    }
    html = html.replace(
      /function applyThemeVars\(th\)\{[\s\S]*?setv\(th\.lightBg,'--light',null,0\);\s*\}/,
      function (m) { return m + fnSnippet; }
    );
    changed = true;
    console.log(label + ': Added applySiteMaxWidth()');
  } else {
    console.log(label + ': applySiteMaxWidth() already present');
  }

  if (!html.includes('applySiteMaxWidth(C)')) {
    if (html.includes('applyThemeVars(th);\n    if(Array.isArray(C.services)')) {
      html = html.replace(
        'applyThemeVars(th);\n    if(Array.isArray(C.services)',
        'applyThemeVars(th);\n    try{ applySiteMaxWidth(C); }catch(_eSmw){}\n    if(Array.isArray(C.services)'
      );
      changed = true;
      console.log(label + ': Wired applySiteMaxWidth in applyCfg');
    } else if (html.includes('applyThemeVars(th);if(Array.isArray(C.services)')) {
      html = html.replace(
        'applyThemeVars(th);if(Array.isArray(C.services)',
        'applyThemeVars(th);try{ applySiteMaxWidth(C); }catch(_eSmw){}if(Array.isArray(C.services)'
      );
      changed = true;
      console.log(label + ': Wired applySiteMaxWidth in applyCfg (compact)');
    } else {
      console.warn(label + ': applyCfg hook not found');
    }
  }

  if (!html.includes('applySiteMaxWidth(SITE_CONFIG)')) {
    const bootAnchor = 'if(typeof SITE_CONFIG!==\'undefined\'&&SITE_CONFIG&&SITE_CONFIG.theme){ try{ applyThemeVars(SITE_CONFIG.theme); }catch(e){} }';
    if (html.includes(bootAnchor)) {
      html = html.replace(
        bootAnchor,
        bootAnchor + ' if(typeof SITE_CONFIG!==\'undefined\'&&SITE_CONFIG){ try{ applySiteMaxWidth(SITE_CONFIG); }catch(_eSmw0){} }'
      );
      changed = true;
      console.log(label + ': Wired boot applySiteMaxWidth');
    } else {
      console.warn(label + ': boot hook not found');
    }
  }

  if (changed) {
    tpl.html = html;
    fs.writeFileSync(tplPath, JSON.stringify(tpl));
    console.log(label + ': Saved');
  }
});
