#!/usr/bin/env node
/**
 * Footer social links (sections.footer.social = [{on, network, url}], optional
 * sections.footer.socialTitle). Stroke icons from window.LP_ICONS. Additive and
 * idempotent; applied to demo-shared.js and the trade / landing-shell templates.
 *   node scripts/patch-footer-social.js [--check]
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const MARK = '/*LPSOC*/';
const END = '/*END-LPSOC*/';
const LIB = MARK + String.raw`
function _lpSocialRender(C){
  try{
    var F=(C&&C.sections&&C.sections.footer)||{}, ft=document.querySelector('footer[data-sec="footer"]');
    var old=document.querySelectorAll('.lp-social'); Array.prototype.forEach.call(old,function(n){ n.remove(); });
    if(!ft) return;
    var NAMES={facebook:'Facebook',instagram:'Instagram',linkedin:'LinkedIn',youtube:'YouTube',tiktok:'TikTok',x:'X',google:'Google reviews',website:'Website',email:'Email'};
    var ICON={facebook:'facebook',instagram:'instagram',linkedin:'linkedin',youtube:'youtube',tiktok:'tiktok',x:'x',google:'star',website:'globe',email:'mail'};
    var items=(Array.isArray(F.social)?F.social:[]).filter(function(s){ return s&&s.on!==false&&String(s.url||'').trim(); }).slice(0,10);
    if(!items.length||F.showSocial===false) return;
    var I=window.LP_ICONS||{};
    function href(s){ var u=String(s.url).trim(); if(s.network==='email'&&!/^mailto:/i.test(u)) return 'mailto:'+u; if(!/^(https?:|mailto:)/i.test(u)) u='https://'+u.replace(/^\/+/,''); return u; }
    function e(t){ return String(t==null?'':t).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
    if(!document.getElementById('lp-social-css')){ var st=document.createElement('style'); st.id='lp-social-css'; st.textContent='.lp-social{margin-top:18px}.lp-social-t{display:block;margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;opacity:.7}.lp-social-l{display:flex;flex-wrap:wrap;gap:10px;margin:0;padding:0;list-style:none}.lp-social a{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;border:1.5px solid color-mix(in srgb,currentColor 30%,transparent);color:inherit;transition:background .2s,border-color .2s,transform .2s}.lp-social a:hover{border-color:var(--pipe,currentColor);background:var(--pipe,rgba(255,255,255,.12));color:#fff;transform:translateY(-2px)}.lp-social svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}'; document.head.appendChild(st); }
    var box=document.createElement('div'); box.className='lp-social';
    box.innerHTML=(F.socialTitle!==''?'<span class="lp-social-t">'+e(F.socialTitle||'Follow us')+'</span>':'')+'<ul class="lp-social-l">'+items.map(function(s){
      var n=String(s.network||'website'), nm=NAMES[n]||'Link', ic=I[ICON[n]||'globe']||I.globe||'';
      return '<li><a href="'+e(href(s))+'" target="_blank" rel="noopener" aria-label="'+e(nm)+'" title="'+e(nm)+'"><svg viewBox="0 0 24 24" aria-hidden="true">'+ic+'</svg></a></li>';
    }).join('')+'</ul>';
    var host=ft.querySelector('.f-brand')||ft.querySelector('.footer-top')||ft.querySelector('.wrap-wide')||ft;
    host.appendChild(box);
  }catch(_e){}
}
`+END+"\n";
const FN = 'function applyCfg(C){';
const CALL_OLD = '\n    try{ applySectionAppearances(C); }catch(e){}\n';
const CALL_NEW = '\n    try{ applySectionAppearances(C); }catch(e){}\n    try{ _lpSocialRender(C); }catch(e){}\n';
function patch(src, label) {
  let out = src, ch = false;
  if (out.indexOf(MARK) < 0) { if (out.indexOf(FN) < 0) throw new Error(label + ': anchor'); out = out.replace(FN, LIB + FN); ch = true; }
  else { const a = out.indexOf(MARK), e = out.indexOf(END, a), b = e >= 0 ? e + END.length + 1 : out.indexOf(FN, a); if (out.slice(a, b) !== LIB) { out = out.slice(0, a) + LIB + out.slice(b); ch = true; } }
  if (out.indexOf(CALL_NEW) < 0) { if (out.indexOf(CALL_OLD) < 0) throw new Error(label + ': call anchor'); out = out.replace(CALL_OLD, CALL_NEW); ch = true; }
  return { out, ch };
}
const check = process.argv.includes('--check'); let bad = 0;
const jobs = [['marketplace/demos/demo-shared.js', false], ['trade.template.json', true], ['landing-shell-neutral-v1.template.json', true]];
for (const [rel, isJson] of jobs) {
  const f = path.join(ROOT, rel), raw = fs.readFileSync(f, 'utf8'), d = isJson ? JSON.parse(raw) : null, src = isJson ? d.html : raw;
  if (check) { if (src.indexOf(MARK) < 0 || src.indexOf(CALL_NEW) < 0) { bad++; console.log('UNPATCHED ' + rel); } continue; }
  const r = patch(src, rel);
  if (r.ch) { if (isJson) { d.html = r.out; fs.writeFileSync(f, JSON.stringify(d)); } else fs.writeFileSync(f, r.out); }
  console.log((r.ch ? 'patched ' : 'ok      ') + rel);
}
if (check) { if (bad) process.exit(1); console.log('all copies patched'); }
