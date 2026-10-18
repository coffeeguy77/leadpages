#!/usr/bin/env node
/**
 * Wires the LeadPages Gallery engine (assets/lp-gallery.js) into every copy of
 * the legacy Premium Gallery renderer.
 *
 * The legacy renderer stays in place as the fallback (if the engine script
 * fails to load, or window.__LPG_DISABLE = true). Idempotent — safe to re-run.
 *
 *   node scripts/patch-lp-gallery-shim.js           # patch
 *   node scripts/patch-lp-gallery-shim.js --check   # exit 1 if any copy is unpatched
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VERSION = 'lpg-1';
const MARK = '/*LPG-SHIM*/';

const SHIM = MARK + `
var _LPG_SRC='/assets/lp-gallery.js?v=${VERSION}', _LPG_CSS='/assets/lp-gallery.css?v=${VERSION}';
function _pgFlushEngine(){
  try{ document.querySelectorAll('[data-sec="premiumGallery"]').forEach(function(n){ var p=n.__lpgPending; if(p&&window.LPGallery){ n.__lpgPending=null; window.LPGallery.mount(n,p.PG,p.ctx); } }); }catch(_e){}
}
function _pgEngineFailed(){
  window.__LPG_FAILED=true;
  try{ document.querySelectorAll('[data-sec="premiumGallery"]').forEach(function(n){ var p=n.__lpgPending; if(p){ n.__lpgPending=null; _pgRenderPremiumGallery(p.PG, n); } }); }catch(_e){}
}
/* Returns true when the new engine handled (or will handle) this render. */
function _pgUseEngine(PG, node, C){
  try{
    if(window.__LPG_DISABLE||window.__LPG_FAILED) return false;
    var ctx={ phone:(C&&C.phone)||'' };
    if(!PG||PG.on!==true){ if(node.__lpg&&window.LPGallery) window.LPGallery.mount(node, PG, ctx); node.style.display='none'; return true; }
    if(window.LPGallery&&window.LPGallery.mount){ window.LPGallery.mount(node, PG, ctx); return true; }
    node.__lpgPending={ PG:PG, ctx:ctx };
    if(!document.querySelector('link[data-lpg-css]')){ var l=document.createElement('link'); l.rel='stylesheet'; l.href=_LPG_CSS; l.setAttribute('data-lpg-css','1'); document.head.appendChild(l); }
    var s=document.querySelector('script[data-lpg-js]');
    if(!s){ s=document.createElement('script'); s.src=_LPG_SRC; s.async=true; s.setAttribute('data-lpg-js','1'); document.head.appendChild(s); }
    if(!s.__lpgHooked){ s.__lpgHooked=true; s.addEventListener('load',_pgFlushEngine); s.addEventListener('error',_pgEngineFailed); }
    return true;
  }catch(e){ try{ console.error('lp-gallery', e); }catch(_e){} return false; }
}
`;

const FN_HEAD = 'function _pgRenderPremiumGallery(PG, node){\n  if(!node) return;';
const FN_HEAD_NEW = FN_HEAD + '\n  if(_pgUseEngine(PG, node, arguments[2])) return;';
const CALL = '_pgRenderPremiumGallery(PG, pgNode)';
const CALL_NEW = '_pgRenderPremiumGallery(PG, pgNode, C)';

function patchSource(src, label) {
  let out = src, changed = false;
  if (out.indexOf(MARK) < 0) {
    if (out.indexOf(FN_HEAD) < 0) throw new Error(label + ': legacy renderer anchor not found');
    out = out.replace(FN_HEAD, SHIM + FN_HEAD_NEW);
    changed = true;
  } else {
    // refresh shim body (version bumps) between MARK and the function head
    const a = out.indexOf(MARK), b = out.indexOf(FN_HEAD, a);
    const fresh = SHIM;
    if (out.slice(a, b) !== fresh) { out = out.slice(0, a) + fresh + out.slice(b); changed = true; }
  }
  if (out.indexOf(CALL) >= 0) { out = out.split(CALL).join(CALL_NEW); changed = true; }
  return { out, changed };
}

function isPatched(src) { return src.indexOf(MARK) >= 0 && src.indexOf(FN_HEAD_NEW) >= 0 && src.indexOf(CALL) < 0; }

const check = process.argv.includes('--check');
let bad = 0;

// 1) demo-shared.js (marketplace demos + editor playground)
{
  const f = path.join(ROOT, 'marketplace/demos/demo-shared.js');
  const src = fs.readFileSync(f, 'utf8');
  if (check) { if (!isPatched(src)) { console.log('UNPATCHED', f); bad++; } }
  else { const r = patchSource(src, f); if (r.changed) fs.writeFileSync(f, r.out); console.log((r.changed ? 'patched ' : 'ok      ') + path.relative(ROOT, f)); }
}
// 2) template JSON files (html string)
for (const rel of ['trade.template.json', 'landing-shell-neutral-v1.template.json']) {
  const f = path.join(ROOT, rel);
  const raw = fs.readFileSync(f, 'utf8');
  const d = JSON.parse(raw);
  if (check) { if (!isPatched(d.html)) { console.log('UNPATCHED', rel); bad++; } continue; }
  const r = patchSource(d.html, rel);
  if (r.changed) { d.html = r.out; fs.writeFileSync(f, JSON.stringify(d)); }
  console.log((r.changed ? 'patched ' : 'ok      ') + rel);
}
if (check) { if (bad) { console.error(bad + ' file(s) missing the gallery engine shim'); process.exit(1); } console.log('all copies patched'); }
