#!/usr/bin/env node
/**
 * Quote form "extra fields" upgrade, applied to every copy of the shared quote code
 * (marketplace/demos/demo-shared.js + trade / landing-shell templates).
 *
 * sections.quote.extraFields[] items gain optional keys (all additive):
 *   type:     'text' (default) | 'textarea' | 'select' | 'checkboxes' | 'radio'
 *   options:  "One per line" (select / checkboxes / radio)
 *   required: true | false
 * File uploads are NOT an extra-field type: they are the Quote form's own
 * "File uploads" setting (sections.quote.uploadsOn …, private storage — see
 * docs/features/Lead-Files.md, assets/lp-lead-files.js).
 *
 * Also fixes: the renderer numbered fields by their position among *visible* fields
 * while submitLead read them by their position in the *whole* list, so a hidden field
 * shifted every later answer onto the wrong label.
 *
 *   node scripts/patch-quote-extra-fields.js          # patch (idempotent)
 *   node scripts/patch-quote-extra-fields.js --check
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const MARK = '/*LPQX*/';
const END = '/*END-LPQX*/';

const LIB = MARK + String.raw`
function _lpQxEsc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function _lpQxOpts(v){ return (Array.isArray(v)?v:String(v||'').split(/\n|,/)).map(function(s){ return String(s).trim(); }).filter(Boolean).slice(0,40); }
function _lpQxCss(){
  if(document.getElementById('lp-qx-css')) return;
  var st=document.createElement('style'); st.id='lp-qx-css';
  st.textContent='.lp-qx-group{border:0;margin:0 0 14px;padding:0;min-width:0}.lp-qx-group legend{padding:0;margin:0;width:100%}.lp-qx-group .lp-qx-legend{margin-bottom:8px}'+
  '.lp-qx-opts{display:flex;flex-wrap:wrap;gap:8px}.lp-qx-opt{position:relative;display:inline-flex;align-items:center;gap:8px;margin:0;padding:10px 14px;border:1.5px solid rgba(20,26,36,.16);border-radius:999px;background:#fff;color:#141a24;font-weight:600;font-size:14px;cursor:pointer;line-height:1.2;transition:border-color .15s,background .15s;text-transform:none;letter-spacing:normal}'+
  '.lp-qx-opt input{position:absolute;opacity:0;width:1px;height:1px}.lp-qx-opt span::before{content:"";display:inline-block;width:14px;height:14px;margin-right:8px;vertical-align:-2px;border:1.5px solid rgba(20,26,36,.35);border-radius:4px;background:#fff}'+
  '.lp-qx-opt input[type=radio]+span::before{border-radius:50%}.lp-qx-opt input:checked+span::before{background:var(--pipe,#1f7bb8) url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27white%27 stroke-width=%274%27%3E%3Cpath d=%27M5 12l5 5L20 7%27/%3E%3C/svg%3E") center/11px no-repeat;border-color:var(--pipe,#1f7bb8)}'+
  '.lp-qx-opt:has(input:checked){border-color:var(--pipe,#1f7bb8);background:color-mix(in srgb,var(--pipe,#1f7bb8) 8%,#fff)}.lp-qx-opt:has(input:focus-visible){outline:2px solid var(--pipe,#1f7bb8);outline-offset:2px}'+
  '.lp-qx-req{color:#d92d20}';
  document.head.appendChild(st);
}
function _lpQxRender(host,Q){
  if(!host) return;
  _lpQxCss();
  var list=(Array.isArray(Q&&Q.extraFields)?Q.extraFields:[]).map(function(x,i){ return {x:x,i:i}; }).filter(function(o){ return o.x&&o.x.on!==false&&String(o.x.label||'').trim(); });
  host.innerHTML=list.map(function(o){
    var x=o.x, i=o.i, id='q-extra-'+i, lab=_lpQxEsc(String(x.label).trim()), ph=_lpQxEsc(String(x.placeholder||'').trim());
    var t=String(x.type||'text'), req=(x.required===true||x.required==='true');
    var star=req?' <span class="lp-qx-req" aria-hidden="true">*</span>':'';
    var at=' data-qf-extra="'+i+'" data-qx-type="'+_lpQxEsc(t)+'" data-qx-label="'+lab+'"'+(req?' data-qx-req="1"':'');
    if(t==='checkboxes'||t==='radio'){
      var opts=_lpQxOpts(x.options);
      return '<fieldset class="ff lp-qx-group"'+at+'><legend><label class="lp-qx-legend">'+lab+star+'</label></legend><div class="lp-qx-opts">'+opts.map(function(op){ return '<label class="lp-qx-opt"><input type="'+(t==='radio'?'radio':'checkbox')+'" name="'+id+'" value="'+_lpQxEsc(op)+'"><span>'+_lpQxEsc(op)+'</span></label>'; }).join('')+'</div></fieldset>';
    }
    if(t==='select'){
      return '<div class="ff"'+at+'><label for="'+id+'">'+lab+star+'</label><select id="'+id+'"'+(req?' required':'')+'><option value="">'+(ph||'Choose…')+'</option>'+_lpQxOpts(x.options).map(function(op){ return '<option>'+_lpQxEsc(op)+'</option>'; }).join('')+'</select></div>';
    }
    if(t==='textarea') return '<div class="ff"'+at+'><label for="'+id+'">'+lab+star+'</label><textarea id="'+id+'" placeholder="'+ph+'"'+(req?' required':'')+'></textarea></div>';
    return '<div class="ff"'+at+'><label for="'+id+'">'+lab+star+'</label><input id="'+id+'" type="text" placeholder="'+ph+'" autocomplete="off"'+(req?' required':'')+'></div>';
  }).join('');
}
/* Read every visible extra field: answers and missing required labels. */
function _lpQxCollect(host){
  var res={ extras:[], missing:[] };
  if(!host) return res;
  Array.prototype.forEach.call(host.querySelectorAll('[data-qf-extra]'),function(el){
    if(el.offsetParent===null&&el.getClientRects().length===0) return;
    var t=el.getAttribute('data-qx-type')||'text', lab=el.getAttribute('data-qx-label')||'', req=el.hasAttribute('data-qx-req');
    var tmp=document.createElement('textarea'); tmp.innerHTML=lab; lab=tmp.value;
    var v='';
    if(t==='checkboxes'||t==='radio'){ v=Array.prototype.map.call(el.querySelectorAll('input:checked'),function(i){ return i.value; }).join(', '); }
    else { var f=el.querySelector('input,select,textarea'); v=f?String(f.value||'').trim():''; }
    if(v) res.extras.push({ label:lab, value:v });
    else if(req) res.missing.push(lab);
  });
  return res;
}
/* submitLead lives in a separate <script>; make the helpers reachable from it. */
try{ window._lpQxRender=_lpQxRender; window._lpQxCollect=_lpQxCollect; }catch(_e){}
`+END+"\n";

const OLD_RENDER = "var _xh=qs.querySelector('#quoteExtraFields'); if(_xh){ var _xf=(Array.isArray(Q.extraFields)?Q.extraFields:[]).filter(function(x){return x&&x.on!==false&&String(x.label||'').trim();}); _xh.innerHTML=_xf.map(function(x,i){ var lab=esc(String(x.label).trim()); var ph=esc(String(x.placeholder||'').trim()); return '<div class=\"ff\" data-qf-extra=\"'+i+'\"><label for=\"q-extra-'+i+'\">'+lab+'</label><input id=\"q-extra-'+i+'\" type=\"text\" placeholder=\"'+ph+'\" autocomplete=\"off\"></div>'; }).join(''); }";
const NEW_RENDER = "var _xh=qs.querySelector('#quoteExtraFields'); if(_xh){ _lpQxRender(_xh, Q); }";
const FN = 'function applyCfg(C){';

const OLD_SUBMIT = `  var _extras=[];
  (Array.isArray(_Q.extraFields)?_Q.extraFields:[]).forEach(function(f,i){
    if(!f||f.on===false) return;
    var lab=String(f.label||'').trim(); if(!lab) return;
    var el=g('q-extra-'+i); var v=el?String(el.value||'').trim():'';
    if(v) _extras.push({label:lab,value:v});
  });`;
const PREV_SUBMIT = `  var _extras=[], _xc=(typeof _lpQxCollect==='function')?_lpQxCollect(g('quoteExtraFields')):null;
  if(_xc){
    if(_xc.missing.length){ alert("Please add "+_xc.missing.join(", ")+" so we can help you."); return; }
    _extras=_xc.extras;
    if(_xc.files.length){
      var _btn=document.querySelector('#quoteForm .btn-call'), _btnTxt=_btn?_btn.textContent:'';
      if(_btn){ _btn.disabled=true; _btn.textContent='Uploading files…'; }
      var _ups=await _lpQxUpload(_xc.files,function(d,t){ if(_btn) _btn.textContent='Uploading files… '+d+'/'+t; });
      _ups.forEach(function(u){ if(u.urls.length||u.failed) _extras.push({ label:u.label, value:u.urls.join('\\n')+(u.failed?(u.urls.length?'\\n':'')+'('+u.failed+' file'+(u.failed===1?'':'s')+' could not be uploaded)':''), files:u.urls }); });
      if(_btn){ _btn.disabled=false; _btn.textContent=_btnTxt; }
    }
  } else {
    (Array.isArray(_Q.extraFields)?_Q.extraFields:[]).forEach(function(f,i){
      if(!f||f.on===false) return;
      var lab=String(f.label||'').trim(); if(!lab) return;
      var el=g('q-extra-'+i); var v=el?String(el.value||'').trim():'';
      if(v) _extras.push({label:lab,value:v});
    });
  }`;
const NEW_SUBMIT = `  var _extras=[], _xc=(typeof _lpQxCollect==='function')?_lpQxCollect(g('quoteExtraFields')):null;
  if(_xc){
    if(_xc.missing.length){ alert("Please add "+_xc.missing.join(", ")+" so we can help you."); return; }
    _extras=_xc.extras;
  } else {
    (Array.isArray(_Q.extraFields)?_Q.extraFields:[]).forEach(function(f,i){
      if(!f||f.on===false) return;
      var lab=String(f.label||'').trim(); if(!lab) return;
      var el=g('q-extra-'+i); var v=el?String(el.value||'').trim():'';
      if(v) _extras.push({label:lab,value:v});
    });
  }`;

function patch(src, label, withSubmit) {
  let out = src, changed = false;
  if (out.indexOf(MARK) < 0) {
    if (out.indexOf(FN) < 0) throw new Error(label + ': applyCfg anchor missing');
    out = out.replace(FN, LIB + FN); changed = true;
  } else {
    const a = out.indexOf(MARK), e = out.indexOf(END, a), b = e >= 0 ? e + END.length + 1 : out.indexOf(FN, a);
    if (out.slice(a, b) !== LIB) { out = out.slice(0, a) + LIB + out.slice(b); changed = true; }
  }
  if (out.indexOf(OLD_RENDER) >= 0) { out = out.replace(OLD_RENDER, NEW_RENDER); changed = true; }
  else if (out.indexOf(NEW_RENDER) < 0) throw new Error(label + ': extra-field renderer anchor missing');
  if (withSubmit) {
    if (out.indexOf(PREV_SUBMIT) >= 0) { out = out.replace(PREV_SUBMIT, NEW_SUBMIT); changed = true; }
    else if (out.indexOf(OLD_SUBMIT) >= 0) { out = out.replace(OLD_SUBMIT, NEW_SUBMIT); changed = true; }
    else if (out.indexOf(NEW_SUBMIT) < 0) throw new Error(label + ': submitLead anchor missing');
  }
  return { out, changed };
}
function ok(src, withSubmit) { return src.indexOf(MARK) >= 0 && src.indexOf(NEW_RENDER) >= 0 && (!withSubmit || src.indexOf(NEW_SUBMIT) >= 0); }

const check = process.argv.includes('--check'); let bad = 0;
{
  const f = path.join(ROOT, 'marketplace/demos/demo-shared.js'), src = fs.readFileSync(f, 'utf8');
  if (check) { if (!ok(src, false)) { bad++; console.log('UNPATCHED demo-shared.js'); } }
  else { const r = patch(src, 'demo-shared.js', false); if (r.changed) fs.writeFileSync(f, r.out); console.log((r.changed ? 'patched ' : 'ok      ') + 'marketplace/demos/demo-shared.js'); }
}
for (const rel of ['trade.template.json', 'landing-shell-neutral-v1.template.json']) {
  const f = path.join(ROOT, rel), d = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (check) { if (!ok(d.html, true)) { bad++; console.log('UNPATCHED ' + rel); } continue; }
  const r = patch(d.html, rel, true); if (r.changed) { d.html = r.out; fs.writeFileSync(f, JSON.stringify(d)); }
  console.log((r.changed ? 'patched ' : 'ok      ') + rel);
}
if (check) { if (bad) process.exit(1); console.log('all copies patched'); }
