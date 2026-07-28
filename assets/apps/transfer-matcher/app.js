
/* ==================================================================
   1. MATCHING ENGINE  (mirrors engine.js — unit-tested in node)
   ================================================================== */
const DAY=86400000;

function parseDate(raw,order){
  if(raw==null) return null;
  const s=String(raw).trim(); if(!s) return null;
  let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m) return Date.UTC(+m[1],+m[2]-1,+m[3]);
  m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if(m){
    let a=+m[1],b=+m[2],y=+m[3];
    if(y<100) y+= y<70?2000:1900;
    let d,mo;
    if(order==='MDY'){mo=a;d=b;} else {d=a;mo=b;}
    if(mo>12&&d<=12){const t=mo;mo=d;d=t;}
    if(mo<1||mo>12||d<1||d>31) return null;
    return Date.UTC(y,mo-1,d);
  }
  const t=Date.parse(s);
  if(!isNaN(t)){const dt=new Date(t);return Date.UTC(dt.getFullYear(),dt.getMonth(),dt.getDate());}
  return null;
}
function fmtDate(ms){const d=new Date(ms),p=n=>String(n).padStart(2,'0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth()+1)}/${d.getUTCFullYear()}`;}
function daysBetween(a,b){return Math.round(Math.abs(a-b)/DAY);}

function parseAmount(raw){
  if(raw==null) return null;
  let s=String(raw).trim(); if(!s) return null;
  let neg=false;
  if(/^\(.*\)$/.test(s)){neg=true;s=s.slice(1,-1);}
  s=s.replace(/[$A-Za-z\s,]/g,'');
  if(s.startsWith('-')){neg=true;s=s.slice(1);}
  if(s.startsWith('+')) s=s.slice(1);
  if(!s||!/^\d*\.?\d*$/.test(s)) return null;
  const v=Math.round(parseFloat(s)*100);
  if(isNaN(v)) return null;
  return neg?-v:v;
}
function fmtMoney(c){
  return (c<0?'-$':'$')+(Math.abs(c)/100).toLocaleString('en-AU',
    {minimumFractionDigits:2,maximumFractionDigits:2});
}

function maxMatching(outIdx,inIdx,adj,banned){
  const matchIn=new Map(); let size=0;
  function tryAug(o,seen){
    for(const i of (adj.get(o)||[])){
      if(banned&&banned===o+'|'+i) continue;
      if(seen.has(i)) continue;
      seen.add(i);
      if(!matchIn.has(i)||tryAug(matchIn.get(i),seen)){matchIn.set(i,o);return true;}
    }
    return false;
  }
  for(const o of outIdx) if(tryAug(o,new Set())) size++;
  return {size,matchIn};
}

function matchTransfers(lines,opts={}){
  const tol=opts.toleranceDays==null?3:opts.toleranceDays;
  const byId=new Map(lines.map(l=>[l.id,l]));
  const outs=lines.filter(l=>l.amount<0), ins=lines.filter(l=>l.amount>0);
  const adj=new Map(),radj=new Map(),insByAmt=new Map();
  for(const i of ins){ if(!insByAmt.has(i.amount)) insByAmt.set(i.amount,[]); insByAmt.get(i.amount).push(i); }
  for(const o of outs){
    for(const i of (insByAmt.get(-o.amount)||[])){
      if(i.account===o.account) continue;
      if(daysBetween(o.date,i.date)>tol) continue;
      if(!adj.has(o.id)) adj.set(o.id,[]);
      if(!radj.has(i.id)) radj.set(i.id,[]);
      adj.get(o.id).push(i.id); radj.get(i.id).push(o.id);
    }
  }
  const seen=new Set(),components=[];
  for(const l of lines){
    if(seen.has(l.id)) continue;
    if(((adj.get(l.id)||[]).length+(radj.get(l.id)||[]).length)===0) continue;
    const stack=[l.id],comp=[]; seen.add(l.id);
    while(stack.length){
      const id=stack.pop(); comp.push(id);
      for(const n of (adj.get(id)||[]).concat(radj.get(id)||[]))
        if(!seen.has(n)){seen.add(n);stack.push(n);}
    }
    components.push(comp);
  }
  const groups=[],consumed=new Set();
  for(const comp of components){
    const cOuts=comp.filter(id=>byId.get(id).amount<0);
    const cIns =comp.filter(id=>byId.get(id).amount>0);
    const {size,matchIn}=maxMatching(cOuts,cIns,adj);
    const perfect = size===cOuts.length && size===cIns.length;
    const pairs=[]; for(const [i,o] of matchIn) pairs.push({out:o,in:i});
    let kind;
    if(perfect&&comp.length===2) kind='confirmed';
    else if(perfect){
      let unique=true;
      for(const p of pairs){
        if(maxMatching(cOuts,cIns,adj,p.out+'|'+p.in).size===size){unique=false;break;}
      }
      kind=unique?'confirmed':'balanced';
    } else kind='review';
    const matched=new Set(); pairs.forEach(p=>{matched.add(p.out);matched.add(p.in);});
    const dates=comp.map(id=>byId.get(id).date);
    comp.forEach(id=>consumed.add(id));
    groups.push({kind,amount:Math.abs(byId.get(comp[0]).amount),
      dateFrom:Math.min(...dates),dateTo:Math.max(...dates),
      spread:daysBetween(Math.min(...dates),Math.max(...dates)),
      outs:cOuts.map(id=>byId.get(id)),ins:cIns.map(id=>byId.get(id)),
      pairs:pairs.map(p=>({out:byId.get(p.out),in:byId.get(p.in)})),
      leftover:comp.filter(id=>!matched.has(id)).map(id=>byId.get(id)),
      accounts:[...new Set(comp.map(id=>byId.get(id).account))].sort()});
  }
  const unmatched=lines.filter(l=>!consumed.has(l.id));
  const rank={confirmed:0,balanced:1,review:2};
  groups.sort((a,b)=>rank[a.kind]-rank[b.kind]||b.amount-a.amount||a.dateFrom-b.dateFrom);
  const stats={
    totalLines:lines.length,
    accounts:[...new Set(lines.map(l=>l.account))].length,
    confirmed:groups.filter(g=>g.kind==='confirmed').length,
    balanced:groups.filter(g=>g.kind==='balanced').length,
    review:groups.filter(g=>g.kind==='review').length,
    unmatchedLines:unmatched.length,
    fromImages:lines.filter(l=>l.src==='image').length,
    linesCleared:groups.filter(g=>g.kind!=='review').reduce((n,g)=>n+g.outs.length+g.ins.length,0),
    valueCleared:groups.filter(g=>g.kind!=='review').reduce((n,g)=>n+g.amount*g.pairs.length,0)
  };
  return {groups,unmatched,stats};
}

/* ==================================================================
   2. CSV INGEST
   ================================================================== */
function parseCSV(text){
  text=text.replace(/^﻿/,'');
  const rows=[]; let row=[],cell='',q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){cell+='"';i++;} else q=false; } else cell+=c; }
    else if(c==='"') q=true;
    else if(c===','){ row.push(cell); cell=''; }
    else if(c==='\n'){ row.push(cell); rows.push(row); row=[]; cell=''; }
    else if(c==='\r'){}
    else cell+=c;
  }
  if(cell.length||row.length){ row.push(cell); rows.push(row); }
  return rows.filter(r=>r.some(x=>String(x).trim()!==''));
}
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const PAT={
  date:['date','transactiondate','posteddate','datepaid','valuedate','processdate'],
  amount:['amount','value','transactionamount','amt','net'],
  out:['spent','debit','moneyout','withdrawal','paidout','payment','dr','outflow'],
  in:['received','credit','moneyin','deposit','paidin','receipt','cr','inflow'],
  desc:['description','payee','narrative','details','particulars','reference','memo','name','transactiondetails'],
  status:['status','reconciled','isreconciled','reconciliationstatus']
};
function findCol(headers,keys){
  const h=headers.map(norm);
  for(const k of keys){const i=h.indexOf(k); if(i>=0) return i;}
  for(const k of keys){const i=h.findIndex(x=>x.includes(k)); if(i>=0) return i;}
  return -1;
}
function ingestCSV(rows,account,order,fileId,signMode){
  const flags=[];
  if(!rows.length) return {lines:[],cols:{},flags:[{bad:true,msg:'File looks empty.'}]};
  let hIdx=0,headers=rows[0];
  for(let r=0;r<Math.min(rows.length,15);r++){
    if(findCol(rows[r],PAT.date)>=0 && rows[r].filter(x=>String(x).trim()).length>=2){
      hIdx=r; headers=rows[r]; break;
    }
  }
  const cDate=findCol(headers,PAT.date);
  let   cAmt =findCol(headers,PAT.amount);
  const cOut =findCol(headers,PAT.out), cIn=findCol(headers,PAT.in);
  const cDesc=findCol(headers,PAT.desc), cStat=findCol(headers,PAT.status);
  const useSplit = cOut>=0 && cIn>=0;
  if(useSplit) cAmt=-1;
  const cols={date:cDate>=0?headers[cDate]:null,
    amount:useSplit?headers[cOut]+' / '+headers[cIn]:(cAmt>=0?headers[cAmt]:null),
    desc:cDesc>=0?headers[cDesc]:null, status:cStat>=0?headers[cStat]:null};
  if(cDate<0) flags.push({bad:true,msg:'No date column found — check this is a statement-line export.'});
  if(cAmt<0&&!useSplit) flags.push({bad:true,msg:'No amount column found.'});
  const lines=[]; let skipped=0,filtered=0;
  for(let r=hIdx+1;r<rows.length;r++){
    const row=rows[r];
    const d=cDate>=0?parseDate(row[cDate],order):null;
    let amt=null;
    if(useSplit){
      const o=parseAmount(row[cOut])||0, i=parseAmount(row[cIn])||0;
      amt=Math.abs(i)-Math.abs(o); if(o===0&&i===0) amt=null;
    } else if(cAmt>=0) amt=parseAmount(row[cAmt]);
    if(d===null||amt===null||amt===0){skipped++;continue;}
    if(cStat>=0){
      const st=norm(row[cStat]);
      if(st==='reconciled'||st==='true'||st==='yes'||st==='y'){filtered++;continue;}
    }
    if(signMode==='flip') amt=-amt;
    lines.push({id:fileId+'_'+r,account,date:d,amount:amt,src:'csv',
      desc:(cDesc>=0?String(row[cDesc]||'').trim():'')});
  }
  if(skipped) flags.push({msg:`${skipped} row${skipped>1?'s':''} skipped (no usable date/amount).`});
  if(filtered) flags.push({msg:`${filtered} already-reconciled row${filtered>1?'s':''} excluded.`});
  if(lines.length){
    const neg=lines.some(l=>l.amount<0), pos=lines.some(l=>l.amount>0);
    if(!neg||!pos) flags.push({sign:true,
      msg:`All amounts here are ${neg?'negative (money out)':'positive (money in)'} — fine if this account only moves money one way. If the export dropped the signs instead:`});
  }
  return {lines,cols,flags};
}

/* ==================================================================
   3. OCR  —  screenshots -> draft rows for review
   ================================================================== */
const OCR_CDN='https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js';
let ocrLoad=null;
function loadOCR(){
  if(ocrLoad) return ocrLoad;
  ocrLoad=new Promise((res,rej)=>{
    if(window.Tesseract) return res(window.Tesseract);
    const s=document.createElement('script');
    s.src=OCR_CDN;
    const timer=setTimeout(()=>rej(new Error('timeout')),30000);
    s.onload=()=>{clearTimeout(timer); window.Tesseract?res(window.Tesseract):rej(new Error('loaded but missing'));};
    s.onerror=()=>{clearTimeout(timer); rej(new Error('blocked'));};
    document.head.appendChild(s);
  });
  return ocrLoad;
}

/* Upscale to ~2x and boost contrast. Measured: at 1x a compressed screenshot
   produced 9 date errors and 8 amount errors; at 2x, zero. This step is not optional. */
function preprocess(img){
  const TARGET=2400, MAXPX=42e6;
  let scale=Math.max(2, Math.min(4, TARGET/img.naturalWidth));
  if(img.naturalWidth*scale*img.naturalHeight*scale > MAXPX)
    scale=Math.sqrt(MAXPX/(img.naturalWidth*img.naturalHeight));
  scale=Math.max(1,scale);
  const c=document.createElement('canvas');
  c.width=Math.round(img.naturalWidth*scale);
  c.height=Math.round(img.naturalHeight*scale);
  const x=c.getContext('2d',{willReadFrequently:true});
  x.imageSmoothingEnabled=true; x.imageSmoothingQuality='high';
  x.drawImage(img,0,0,c.width,c.height);
  const d=x.getImageData(0,0,c.width,c.height), p=d.data;
  // grayscale + mild contrast stretch around mid grey
  for(let i=0;i<p.length;i+=4){
    let g=(p[i]*0.299+p[i+1]*0.587+p[i+2]*0.114);
    g=(g-128)*1.35+128;
    g=g<0?0:g>255?255:g;
    p[i]=p[i+1]=p[i+2]=g;
  }
  x.putImageData(d,0,0);
  return c;
}

const RE_AMT=/^\(?[-+]?\$?[\d,]+\.\d{2}\)?$/;
const RE_DATE=/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/;

/* Turn Tesseract words into rows. The hazard here is vertically merging two
   table rows — that loses a line silently — so rows containing more than one
   date are re-split by proximity to each date. */
function wordsToRows(words){
  words=words.filter(w=>w.text&&w.text.trim()&&w.confidence>=0)
             .map(w=>({t:w.text.trim(),c:w.confidence,
                       x:w.bbox.x0,x1:w.bbox.x1,y:(w.bbox.y0+w.bbox.y1)/2,h:w.bbox.y1-w.bbox.y0}));
  if(!words.length) return [];
  const hs=words.map(w=>w.h).sort((a,b)=>a-b);
  const medH=hs[Math.floor(hs.length/2)]||10;
  words.sort((a,b)=>a.y-b.y);
  const rows=[]; let cur=[a=words[0]];
  for(let i=1;i<words.length;i++){
    const w=words[i];
    const centre=cur.reduce((s,q)=>s+q.y,0)/cur.length;
    if(Math.abs(w.y-centre) > medH*0.55){ rows.push(cur); cur=[w]; }
    else cur.push(w);
  }
  rows.push(cur);
  // split any row that swallowed two table rows
  const out=[];
  for(const r of rows){
    const ds=r.filter(w=>RE_DATE.test(w.t));
    if(ds.length<=1){ out.push(r); continue; }
    const buckets=ds.map(d=>({y:d.y,ws:[]}));
    for(const w of r){
      let best=0,bd=Infinity;
      buckets.forEach((b,i)=>{const dd=Math.abs(w.y-b.y); if(dd<bd){bd=dd;best=i;}});
      buckets[best].ws.push(w);
    }
    buckets.forEach(b=>out.push(b.ws));
  }
  out.forEach(r=>r.sort((a,b)=>a.x-b.x));
  return out.filter(r=>r.length);
}

/* Decide which x-band is "money out" and which is "money in". */
function inferColumns(rows){
  const edges=[];
  rows.forEach(r=>r.forEach(w=>{ if(RE_AMT.test(w.t)) edges.push(w.x1); }));
  if(edges.length<3) return null;
  edges.sort((a,b)=>a-b);
  // widest gap between consecutive right-edges = the column split
  let gap=0,at=null;
  for(let i=1;i<edges.length;i++){
    const g=edges[i]-edges[i-1];
    if(g>gap){gap=g;at=(edges[i]+edges[i-1])/2;}
  }
  const span=edges[edges.length-1]-edges[0];
  // only believe in two columns if the gap dominates the spread
  if(at!==null && span>0 && gap>span*0.45 && gap>30) return {split:at};
  return null;
}

function rowsToDraft(rows,order){
  const cols=inferColumns(rows);
  const draft=[];
  for(const r of rows){
    const dw=r.find(w=>RE_DATE.test(w.t));
    const aws=r.filter(w=>RE_AMT.test(w.t));
    if(!dw||!aws.length) continue;                      // header/footer/blank noise
    const desc=r.filter(w=>w!==dw&&!aws.includes(w)).map(w=>w.t).join(' ')
                .replace(/\s{2,}/g,' ').trim();
    let out='',inn='';
    if(aws.length>=2){
      out=aws[0].t; inn=aws[aws.length-1].t;            // both columns populated (rare)
    } else if(cols){
      (aws[0].x1 < cols.split ? out=aws[0].t : inn=aws[0].t);
    } else {
      const neg=/^\(|^-/.test(aws[0].t);
      neg ? out=aws[0].t : inn=aws[0].t;
    }
    const conf=Math.min(dw.c, ...aws.map(a=>a.c));
    draft.push({date:dw.t,desc,out:out.replace(/[()]/g,''),in:inn.replace(/[()]/g,''),
                conf:Math.round(conf), drop:false, oneCol:!cols});
    }
  return {draft,twoCol:!!cols};
}

async function ocrImage(src,onProgress){
  const T=await loadOCR();
  const img=await new Promise((res,rej)=>{
    const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=src;
  });
  const canvas=preprocess(img);
  const r=await T.recognize(canvas,'eng',{
    logger:m=>{ if(m.status==='recognizing text') onProgress(m.progress); }
  });
  const words=(r.data.words&&r.data.words.length)
    ? r.data.words
    : (r.data.blocks||[]).flatMap(b=>(b.paragraphs||[])
        .flatMap(p=>(p.lines||[]).flatMap(l=>l.words||[])));
  return rowsToDraft(wordsToRows(words));
}

/* parseAmount is deliberately forgiving (it strips "AUD", "$", spaces) which is right
   for CSV but wrong for OCR: "8B.00" would quietly become $8.00. Draft cells are held
   to a stricter shape, and anything that fails is flagged red and withheld from
   matching rather than guessed at. */
const AMT_CLEAN=/^\s*$|^\(?[-+]?\$?\s?[\d,]+(\.\d{1,2})?\)?\s*$/;
function amtOK(s){ return AMT_CLEAN.test(String(s==null?'':s)); }
function draftRowOK(d,order){
  const dOK=parseDate(d.date,order)!==null;
  const clean=amtOK(d.out)&&amtOK(d.in);
  const hasVal=(amtOK(d.out)&&parseAmount(d.out))||(amtOK(d.in)&&parseAmount(d.in));
  return {dOK, aOK:!!(clean&&hasVal)};
}

function draftToLines(draft,account,order,id,flip){
  const lines=[];
  draft.forEach((d,i)=>{
    if(d.drop) return;
    const v=draftRowOK(d,order);
    if(!v.dOK||!v.aOK) return;                 // flagged in the grid; never guessed
    const dt=parseDate(d.date,order);
    const o=parseAmount(d.out), n=parseAmount(d.in);
    let amt=null;
    if(o!=null&&o!==0) amt=-Math.abs(o);
    else if(n!=null&&n!==0) amt=Math.abs(n);
    if(dt===null||amt===null) return;
    if(flip) amt=-amt;
    lines.push({id:id+'_r'+i,account,date:dt,amount:amt,desc:d.desc,src:'image'});
  });
  return lines;
}

/* ==================================================================
   4. APP
   ================================================================== */
const S={src:[]};   // {id,kind,name,account,...}
let uid=0;
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

$('#theme').onclick=()=>{
  const dark=document.documentElement.dataset.theme==='dark';
  document.documentElement.dataset.theme=dark?'light':'dark';
  $('#theme').textContent=dark?'Dark':'Light';
};

/* tabs */
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x===t));
  $('#pane-csv').classList.toggle('hidden',t.dataset.tab!=='csv');
  $('#pane-img').classList.toggle('hidden',t.dataset.tab!=='img');
});

/* dropzones */
function wireDZ(dzSel,pickSel,handler){
  const dz=$(dzSel),pk=$(pickSel);
  dz.onclick=()=>pk.click();
  pk.onchange=e=>{handler([...e.target.files]); e.target.value='';};
  ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('over');}));
  ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('over');}));
  dz.addEventListener('drop',e=>handler([...e.dataTransfer.files]));
}
wireDZ('#dz-csv','#pick-csv',addCSV);
wireDZ('#dz-img','#pick-img',addIMG);

function accountFromName(n){
  return n.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ')
    .replace(/\b(unreconciled|statement|lines?|export|transactions?|bank|csv|report|screenshot|screen ?shot|img|image)\b/gi,'')
    .replace(/\d{4}-?\d{0,2}-?\d{0,2}/g,'').replace(/\s+/g,' ').trim()||n;
}

function addCSV(fs){
  fs.filter(f=>/\.(csv|txt)$/i.test(f.name)).forEach(f=>{
    const rd=new FileReader();
    rd.onload=()=>{
      S.src.push({id:'s'+(++uid),kind:'csv',name:f.name,account:accountFromName(f.name),
        rows:parseCSV(rd.result),signMode:'as-is'});
      refresh();
    };
    rd.readAsText(f);
  });
}

function addIMG(fs){
  const imgs=fs.filter(f=>/^image\//.test(f.type));
  if(!imgs.length) return;
  imgs.forEach(f=>{
    const rd=new FileReader();
    rd.onload=()=>{
      const s={id:'s'+(++uid),kind:'image',name:f.name,account:accountFromName(f.name),
        dataURL:rd.result,state:'queued',prog:0,draft:[],signMode:'as-is'};
      S.src.push(s); refresh(); runOCR(s);
    };
    rd.readAsDataURL(f);
  });
}

async function runOCR(s){
  s.state='loading'; s.prog=0; renderCards();
  try{
    const {draft,twoCol}=await ocrImage(s.dataURL,p=>{
      s.state='reading'; s.prog=p; updateProg(s);
    });
    s.draft=draft; s.twoCol=twoCol; s.state='done';
  }catch(err){
    s.state='failed';
    s.error = err && err.message==='blocked'
      ? 'The text-recognition engine could not load — this page is probably running somewhere that blocks external scripts. Download this file and open it directly in Chrome, and it will work.'
      : err && err.message==='timeout'
      ? 'The text-recognition engine timed out while downloading (it is about 15 MB on first use). Check your connection and try again.'
      : 'Could not read this image: '+(err&&err.message||err);
  }
  refresh();
}
function updateProg(s){
  const el=document.querySelector(`[data-prog="${s.id}"] > i`);
  if(el) el.style.width=Math.round(s.prog*100)+'%';
  const lb=document.querySelector(`[data-proglabel="${s.id}"]`);
  if(lb) lb.textContent=`Reading text… ${Math.round(s.prog*100)}%`;
}

function refresh(){
  const order=$('#dorder').value;
  S.src.forEach(s=>{
    if(s.kind==='csv'){
      const g=ingestCSV(s.rows,s.account,order,s.id,s.signMode);
      s.lines=g.lines; s.cols=g.cols; s.flags=g.flags;
    }else{
      s.lines = s.state==='done' ? draftToLines(s.draft,s.account,order,s.id,s.signMode==='flip') : [];
    }
  });
  $('#ncsv').textContent=S.src.filter(s=>s.kind==='csv').length;
  $('#nimg').textContent=S.src.filter(s=>s.kind==='image').length;
  renderCards();
  const ready=S.src.some(s=>(s.lines||[]).length);
  $('#settings').style.display=S.src.length?'':'none';
  $('#run').disabled=!ready;
}
$('#dorder').onchange=()=>{ refresh(); if(LAST){ runMatch(); applyView(); } };

/* ---------- source cards ---------- */
function renderCards(){
  const el=$('#cards');
  if(!S.src.length){el.innerHTML='';return;}
  el.innerHTML=S.src.map(s=>s.kind==='csv'?csvCard(s):imgCard(s)).join('');
  bindCards();
}

function csvCard(s){
  const c=s.cols||{};
  return `<div class="card">
    <div class="row1">
      <div><div class="fname">${esc(s.name)}</div>
        <input type="text" data-acct="${s.id}" value="${esc(s.account)}" placeholder="Account name"></div>
      <div style="display:flex;align-items:center;gap:10px">
        <div class="meta">${(s.lines||[]).length} line${(s.lines||[]).length===1?'':'s'}</div>
        <button class="rm" data-rm="${s.id}" title="Remove">&times;</button></div>
    </div>
    <div class="cols">
      <span><b>Date:</b> ${c.date?esc(c.date):'—'}</span>
      <span><b>Amount:</b> ${c.amount?esc(c.amount):'—'}</span>
      <span><b>Description:</b> ${c.desc?esc(c.desc):'—'}</span>
      ${c.status?`<span><b>Status:</b> ${esc(c.status)}</span>`:''}
    </div>
    ${(s.flags||[]).map(f=>flagHTML(f,s)).join('')}
  </div>`;
}

function flagHTML(f,s){
  return `<div class="flag${f.bad?' bad':''}"><span>${esc(f.msg)}</span>${
    f.sign?`<select data-sign="${s.id}">
      <option value="as-is"${s.signMode==='as-is'?' selected':''}>leave as-is</option>
      <option value="flip"${s.signMode==='flip'?' selected':''}>flip the signs</option>
    </select>`:''}</div>`;
}

function imgCard(s){
  const n=(s.lines||[]).length;
  let body='';
  if(s.state==='loading')
    body=`<div class="prog"><span data-proglabel="${s.id}">Loading the text-recognition engine…</span>
          <span class="bar" data-prog="${s.id}"><i></i></span></div>`;
  else if(s.state==='reading')
    body=`<div class="prog"><span data-proglabel="${s.id}">Reading text… ${Math.round(s.prog*100)}%</span>
          <span class="bar" data-prog="${s.id}"><i style="width:${Math.round(s.prog*100)}%"></i></span></div>`;
  else if(s.state==='failed')
    body=`<div class="flag bad" style="margin-top:0"><span>${esc(s.error||'Failed.')}</span>
          <button class="iconbtn" data-retry="${s.id}">Try again</button></div>`;
  else if(s.state==='done')
    body=reviewHTML(s);
  else body=`<div class="prog">Queued…</div>`;

  return `<div class="card">
    <div class="row1">
      <div><div class="fname">${esc(s.name)}</div>
        <input type="text" data-acct="${s.id}" value="${esc(s.account)}" placeholder="Account name"></div>
      <div style="display:flex;align-items:center;gap:10px">
        <div class="meta">${s.state==='done'?n+' line'+(n===1?'':'s'):''}</div>
        <button class="rm" data-rm="${s.id}" title="Remove">&times;</button></div>
    </div>
    <div class="shot">
      <img src="${s.dataURL}" data-zoom="${s.id}" alt="Screenshot of ${esc(s.account)} statement lines">
      <div>${body}</div>
    </div>
  </div>`;
}

function reviewHTML(s){
  const order=$('#dorder').value;
  const kept=s.draft.filter(d=>!d.drop);
  const low=kept.filter(d=>d.conf<88).length;
  const bad=kept.filter(d=>{const v=draftRowOK(d,order); return !v.dOK||!v.aOK;}).length;
  return `
  <div class="flag ${bad?'bad':low?'':'ok'}" style="margin-top:0">
    <span><b>${kept.length} row${kept.length===1?'':'s'} read.</b>
    ${bad?`${bad} could not be understood — fix or drop ${bad===1?'it':'them'}. `:''}
    ${low?`${low} row${low===1?' is':'s are'} shaded as low-confidence. `:''}
    <b>Does that count match what Xero shows?</b> A screenshot cut off at the edge of the
    window loses rows silently, and a missing transfer just looks like an unmatched one.</span>
  </div>
  ${s.twoCol?'':`<div class="flag"><span>Only one column of amounts was found, so direction was taken from
    the printed sign. If this screenshot is all one direction, set it here:</span>
    <select data-dir="${s.id}">
      <option value="as-is"${s.signMode==='as-is'?' selected':''}>as printed</option>
      <option value="flip"${s.signMode==='flip'?' selected':''}>flip the direction</option>
    </select></div>`}
  <div class="revwrap"><table class="rev">
    <thead><tr><th>Date</th><th>Description</th><th class="n">Out</th><th class="n">In</th><th></th></tr></thead>
    <tbody>${s.draft.map((d,i)=>revRow(s,d,i)).join('')}</tbody>
  </table></div>
  <div class="revfoot">
    <button class="iconbtn" data-addrow="${s.id}">+ Add a row</button>
    <span class="key"><span class="sw w"></span>low confidence</span>
    <span class="key"><span class="sw c"></span>unreadable</span>
    <span style="color:var(--muted)">Click the image to enlarge it.</span>
  </div>`;
}

function revRow(s,d,i){
  const order=$('#dorder').value;
  const {dOK,aOK}=draftRowOK(d,order);
  const lo=d.conf<88;
  const cls=x=>x?(lo?'lowconf':''):'bad';
  return `<tr class="${d.drop?'dropped':''}">
    <td class="${cls(dOK)}"><input value="${esc(d.date)}" data-cell="${s.id}|${i}|date" aria-label="Date"></td>
    <td class="${lo?'lowconf':''}"><input value="${esc(d.desc)}" data-cell="${s.id}|${i}|desc" aria-label="Description"></td>
    <td class="${cls(aOK)}"><input class="n" value="${esc(d.out)}" data-cell="${s.id}|${i}|out" aria-label="Amount out"></td>
    <td class="${cls(aOK)}"><input class="n" value="${esc(d.in)}" data-cell="${s.id}|${i}|in" aria-label="Amount in"></td>
    <td class="act"><button class="rm" data-drop="${s.id}|${i}" title="${d.drop?'Restore row':'Drop row'}">${d.drop?'↺':'×'}</button></td>
  </tr>`;
}

function bindCards(){
  const el=$('#cards');
  el.querySelectorAll('[data-acct]').forEach(i=>i.oninput=e=>{
    const s=S.src.find(x=>x.id===e.target.dataset.acct);
    const was=s.account;
    s.account=e.target.value;
    (s.lines||[]).forEach(l=>l.account=s.account);
    // Renaming changes matching (lines in the same account never pair), so re-run —
    // debounced so it doesn't thrash while you type.
    clearTimeout(renameTimer);
    renameTimer=setTimeout(()=>rerunAfterRename(was,s.account),350);
  });
  el.querySelectorAll('[data-rm]').forEach(b=>b.onclick=e=>{
    S.src=S.src.filter(x=>x.id!==e.target.dataset.rm);
    refresh(); $('#results').classList.add('hidden');
  });
  el.querySelectorAll('[data-sign],[data-dir]').forEach(sel=>sel.onchange=e=>{
    const id=e.target.dataset.sign||e.target.dataset.dir;
    S.src.find(x=>x.id===id).signMode=e.target.value; refresh();
  });
  el.querySelectorAll('[data-retry]').forEach(b=>b.onclick=e=>{
    const s=S.src.find(x=>x.id===e.target.dataset.retry); ocrLoad=null; runOCR(s);
  });
  el.querySelectorAll('[data-zoom]').forEach(im=>im.onclick=e=>{
    const o=document.createElement('div'); o.className='zoomed';
    const big=new Image(); big.src=e.target.src; o.appendChild(big);
    o.onclick=()=>o.remove(); document.body.appendChild(o);
  });
  el.querySelectorAll('[data-addrow]').forEach(b=>b.onclick=e=>{
    const s=S.src.find(x=>x.id===e.target.dataset.addrow);
    s.draft.push({date:'',desc:'',out:'',in:'',conf:100,drop:false});
    refresh();
  });
  el.querySelectorAll('[data-drop]').forEach(b=>b.onclick=e=>{
    const [id,i]=e.target.dataset.drop.split('|');
    const s=S.src.find(x=>x.id===id);
    s.draft[+i].drop=!s.draft[+i].drop; refresh();
  });
  // Live-edit cells without re-rendering (keeps focus + caret)
  el.querySelectorAll('[data-cell]').forEach(inp=>{
    inp.oninput=e=>{
      const [id,i,f]=e.target.dataset.cell.split('|');
      const s=S.src.find(x=>x.id===id);
      s.draft[+i][f]=e.target.value;
      s.draft[+i].conf=100;                       // a human touched it
      s.lines=draftToLines(s.draft,s.account,$('#dorder').value,s.id,s.signMode==='flip');
      const order=$('#dorder').value, d=s.draft[+i];
      const {dOK,aOK}=draftRowOK(d,order);
      const tr=e.target.closest('tr');
      tr.children[0].className = dOK?'':'bad';
      tr.children[2].className = aOK?'':'bad';
      tr.children[3].className = aOK?'':'bad';
      $('#run').disabled=!S.src.some(x=>(x.lines||[]).length);
    };
  });
}

/* ---------- run ---------- */
let LAST=null;      // the full, unfiltered result — matching always runs over everything
let VIEW=null;      // what's currently on screen
let renameTimer=null;

/* Renaming an account after a run re-matches straight away and carries any
   account filter across to the new name, so the view doesn't silently empty. */
function rerunAfterRename(was,now){
  if(!LAST||was===now) return;
  ['#fInv','#fFrom','#fTo'].forEach(sel=>{ if($(sel).value===was) $(sel).dataset.pending=now; });
  runMatch();
  ['#fInv','#fFrom','#fTo'].forEach(sel=>{
    const pend=$(sel).dataset.pending;
    if(pend!=null){ if([...$(sel).options].some(o=>o.value===pend)) $(sel).value=pend;
                    delete $(sel).dataset.pending; }
  });
  applyView();
}

function runMatch(){
  const min=Math.round((parseFloat($('#minamt').value)||0)*100);
  const lines=S.src.flatMap(s=>s.lines||[]).filter(l=>Math.abs(l.amount)>=min);
  LAST=matchTransfers(lines,{toleranceDays:+$('#tol').value});
  LAST.groups.forEach((g,i)=>g.gid='g'+i);
  buildSearchIndex();
  populateAccountFilters(LAST);
}

$('#run').onclick=()=>{
  runMatch(); applyView();
  $('#results').classList.remove('hidden');
  $('#results').scrollIntoView({behavior:'smooth',block:'start'});
};

/* Changing the matching rules after a run re-matches immediately too. */
['#tol','#minamt'].forEach(sel=>$(sel).addEventListener('change',()=>{
  if(LAST){ runMatch(); applyView(); }
}));

/* ==================================================================
   FILTERS
   These narrow what is DISPLAYED. Matching always runs over every line,
   because a group is only trustworthy when judged against all its rivals —
   filtering the input first would turn genuinely ambiguous sets into
   false "confirmed" pairs.
   ================================================================== */
function populateAccountFilters(r){
  const from=[...new Set(r.groups.flatMap(g=>g.outs.map(l=>l.account))
    .concat(r.unmatched.filter(l=>l.amount<0).map(l=>l.account)))].sort();
  const to=[...new Set(r.groups.flatMap(g=>g.ins.map(l=>l.account))
    .concat(r.unmatched.filter(l=>l.amount>0).map(l=>l.account)))].sort();
  const all=[...new Set([...from,...to])].sort();
  const fill=(sel,vals)=>{
    const el=$(sel), keep=el.value;
    el.innerHTML='<option value="">Any</option>'+
      vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
    if(vals.includes(keep)) el.value=keep;
  };
  fill('#fInv',all); fill('#fFrom',from); fill('#fTo',to);
}

function readFilters(){
  const d=s=>{const v=$(s).value; return v?parseDate(v,'DMY'):null;};   // date inputs are ISO
  const n=s=>{const v=parseFloat($(s).value); return isNaN(v)?null:Math.round(v*100);};
  return {inv:$('#fInv').value, from:$('#fFrom').value, to:$('#fTo').value,
          d1:d('#fDate1'), d2:d('#fDate2'), min:n('#fMin'), max:n('#fMax'),
          q:$('#fText').value.trim().toLowerCase(), sort:$('#fSort').value,
          merge:$('#fMerge').checked};
}
function filtersActive(f){
  return !!(f.inv||f.from||f.to||f.d1!=null||f.d2!=null||f.min!=null||f.max!=null||f.q);
}
const hit=(l,q)=>((l.desc||'')+' '+l.account).toLowerCase().includes(q);

function groupPasses(g,f){
  // "Involves" is direction-blind: the account may be on either side of the transfer.
  if(f.inv && !g.accounts.includes(f.inv)) return false;
  if(f.from && !g.outs.some(l=>l.account===f.from)) return false;
  if(f.to   && !g.ins .some(l=>l.account===f.to))   return false;
  if(f.d1!=null && g.dateTo   < f.d1) return false;   // group's window must overlap
  if(f.d2!=null && g.dateFrom > f.d2) return false;
  if(f.min!=null && g.amount < f.min) return false;
  if(f.max!=null && g.amount > f.max) return false;
  if(f.q && ![...g.outs,...g.ins].some(l=>hit(l,f.q))) return false;
  return true;
}
function linePasses(l,f){
  if(f.inv && l.account!==f.inv) return false;
  // From/To stay directional, so a filter only ever narrows: an unpaired outgoing line
  // is judged against "from", an incoming one against "to", unset meaning "any".
  if(l.amount<0){ if(f.from && l.account!==f.from) return false; }
  else          { if(f.to   && l.account!==f.to)   return false; }
  if(f.d1!=null && l.date < f.d1) return false;
  if(f.d2!=null && l.date > f.d2) return false;
  const a=Math.abs(l.amount);
  if(f.min!=null && a < f.min) return false;
  if(f.max!=null && a > f.max) return false;
  if(f.q && !hit(l,f.q)) return false;
  return true;
}
function sortGroups(gs,how){
  const rank={confirmed:0,balanced:1,review:2};
  const cmp={
    conf:(a,b)=>rank[a.kind]-rank[b.kind]||b.amount-a.amount||a.dateFrom-b.dateFrom,
    amtd:(a,b)=>b.amount-a.amount||a.dateFrom-b.dateFrom,
    amta:(a,b)=>a.amount-b.amount||a.dateFrom-b.dateFrom,
    datea:(a,b)=>a.dateFrom-b.dateFrom||b.amount-a.amount,
    dated:(a,b)=>b.dateFrom-a.dateFrom||b.amount-a.amount
  }[how]||cmp0;
  return gs.slice().sort(cmp);
}
function cmp0(a,b){return b.amount-a.amount;}

function applyView(){
  if(!LAST) return;
  const f=readFilters(), on=filtersActive(f);
  const groups=sortGroups(LAST.groups.filter(g=>groupPasses(g,f)),f.sort);
  const unmatched=LAST.unmatched.filter(l=>linePasses(l,f));
  const pairs=groups.filter(g=>g.kind!=='review').reduce((n,g)=>n+g.pairs.length,0);
  const lines=groups.reduce((n,g)=>n+g.outs.length+g.ins.length,0)+unmatched.length;
  VIEW={groups,unmatched,stats:{
    totalLines:lines,
    accounts:[...new Set(groups.flatMap(g=>g.accounts).concat(unmatched.map(l=>l.account)))].length,
    confirmed:groups.filter(g=>g.kind==='confirmed').length,
    balanced:groups.filter(g=>g.kind==='balanced').length,
    review:groups.filter(g=>g.kind==='review').length,
    unmatchedLines:unmatched.length,
    fromImages:groups.flatMap(g=>[...g.outs,...g.ins]).concat(unmatched).filter(l=>l.src==='image').length,
    valueCleared:groups.filter(g=>g.kind!=='review').reduce((n,g)=>n+g.amount*g.pairs.length,0)
  }};

  $('#fClear').disabled=!on;
  $('#csvout').textContent = on ? 'Export shown pairs as CSV' : 'Export pairs as CSV';
  const sum=$('#fsummary');
  if(on){
    const bits=[];
    if(f.inv) bits.push(`involving <b>${esc(f.inv)}</b> (both directions)`);
    if(f.from) bits.push(`from <b>${esc(f.from)}</b>`);
    if(f.to) bits.push(`to <b>${esc(f.to)}</b>`);
    if(f.d1!=null||f.d2!=null)
      bits.push(`dated <b>${f.d1!=null?fmtDate(f.d1):'any'}</b> – <b>${f.d2!=null?fmtDate(f.d2):'any'}</b>`);
    if(f.min!=null||f.max!=null)
      bits.push(`<b>${f.min!=null?fmtMoney(f.min):'any'}</b> – <b>${f.max!=null?fmtMoney(f.max):'any'}</b>`);
    if(f.q) bits.push(`matching “<b>${esc(f.q)}</b>”`);
    sum.innerHTML=`<span>Filtered: ${bits.join(' · ')} — showing
      <b>${groups.length}</b> of <b>${LAST.groups.length}</b> group${LAST.groups.length===1?'':'s'}
      and <b>${unmatched.length}</b> of <b>${LAST.unmatched.length}</b> unpaired line${LAST.unmatched.length===1?'':'s'}.
      Matching still ran across everything.</span>`;
    sum.classList.remove('hidden');
  } else sum.classList.add('hidden');

  render(VIEW);
}

['#fInv','#fFrom','#fTo','#fDate1','#fDate2','#fMin','#fMax','#fSort','#fMerge']
  .forEach(s=>$(s).onchange=applyView);
let qTimer; $('#fText').oninput=()=>{clearTimeout(qTimer);qTimer=setTimeout(applyView,180);};
$('#fClear').onclick=()=>{
  ['#fInv','#fFrom','#fTo','#fDate1','#fDate2','#fMin','#fMax','#fText'].forEach(s=>$(s).value='');
  applyView();
};

function tile(k,v,s,dot){
  return `<div class="tile"><div class="k">${dot?`<span class="dot ${dot}"></span>`:''}${k}</div>
    <div class="v">${v}</div>${s?`<div class="s">${s}</div>`:''}</div>`;
}
function render(r){
  const st=r.stats;
  const filtered = LAST && filtersActive(readFilters());
  const pairs=r.groups.filter(g=>g.kind!=='review').reduce((n,g)=>n+g.pairs.length,0);
  $('#tiles').innerHTML=
    tile(filtered?'Lines shown':'Lines in',st.totalLines,
      filtered?`of ${LAST.stats.totalLines} · ${st.accounts} account${st.accounts===1?'':'s'}`
              :`${st.accounts} account${st.accounts===1?'':'s'}${st.fromImages?` · ${st.fromImages} from screenshots`:''}`)+
    ($('#fMerge').checked
      ? tile('Matched',st.confirmed+st.balanced,
             st.balanced?`incl. ${st.balanced} recurring set${st.balanced===1?'':'s'}`:'ready to reconcile','good')+
        tile('Of those, ambiguous',st.balanced,'order does not matter','warn')
      : tile('Confirmed',st.confirmed,'one possible partner','good')+
        tile('Balances as a set',st.balanced,'pairing ambiguous, total nets','warn'))+
    tile('Needs a look',st.review,"sides don't balance",'serious')+
    tile('No partner',st.unmatchedLines,'not an inter-account transfer','mut')+
    tile('Value paired',fmtMoney(st.valueCleared),`${pairs} pair${pairs===1?'':'s'}`);

  const merge=$('#fMerge').checked;
  const nBal=r.groups.filter(g=>g.kind==='balanced').length;

  sect('#sect-confirmed',
    r.groups.filter(g=>merge ? (g.kind==='confirmed'||g.kind==='balanced') : g.kind==='confirmed'),{
    title: merge?'Matched — ready to reconcile':'Confirmed matches', badge:'good',
    blurb: merge
      ? `Everything here balances and is safe to reconcile as a Transfer in Xero.${
          nBal?` That includes ${nBal} recurring set${nBal===1?'':'s'} (amber bar) where several
          identical transfers ran in the same window — the totals cancel exactly, so it doesn't
          matter which one you tie to which.`:''}`
      : 'Exactly one line on the other side could be this transfer. Reconcile these as a Transfer in Xero — the partner account is named for you.',
    empty:'No pairs found.'});

  sect('#sect-balanced', merge?[]:r.groups.filter(g=>g.kind==='balanced'),{
    title:'Balances as a set', badge:'warn',
    blurb:"Same amount, same window, more than one candidate each way — so we can't say which is which. But the ins and outs cancel exactly, so whichever way you assign them the books balance.",
    empty:'Nothing ambiguous — everything resolved cleanly.'});
  $('#sect-balanced').classList.toggle('hidden',merge);
  sect('#sect-review',r.groups.filter(g=>g.kind==='review'),{
    title:'Needs a look',cls:'serious',badge:'serious',
    blurb:"A partner exists for some of these but the two sides don't balance — a missing statement line, a fee taken out in transit, a transfer to an account you haven't loaded, or a row the screenshot reader missed.",
    empty:'Nothing unbalanced.'});

  const u=r.unmatched, byAcct={};
  u.forEach(l=>{(byAcct[l.account]=byAcct[l.account]||[]).push(l);});
  $('#sect-unmatched').innerHTML=
    `<h3><span class="badge mut">${u.length}</span> No partner found</h3>
     <p class="blurb">No opposite-signed twin in any other account within the window — most likely ordinary sales and expenses, not transfers. Reconcile them the usual way.</p>`+
    (u.length?Object.keys(byAcct).sort().map(a=>`
      <div class="grp" data-uacct="${esc(a)}"><div class="hd"><span class="chev">▶</span>
        <span class="route"><span class="acct">${esc(a)}</span></span>
        <span class="when">${byAcct[a].length} line${byAcct[a].length===1?'':'s'}</span></div>
        <div class="bd">${lineTable(byAcct[a].sort((x,y)=>x.date-y.date),false)}</div></div>`).join('')
     :`<div class="empty">${filtered?'Nothing unpaired matches these filters.':'Every line found a partner.'}</div>`);
  wireGroups();
}
const KINDCLS={confirmed:'good',balanced:'warn',review:'serious'};
function sect(sel,groups,cfg){
  const filtered = LAST && filtersActive(readFilters());
  $(sel).innerHTML=`<h3><span class="badge ${cfg.badge}">${groups.length}</span> ${cfg.title}</h3>
    <p class="blurb">${cfg.blurb}</p>`+
    (groups.length?groups.map(g=>groupHTML(g,KINDCLS[g.kind])).join('')
      :`<div class="empty">${filtered?'None match these filters.':cfg.empty}</div>`);
}
/* With recurring transfers the same route repeats many times, so show the count
   per account — "Kiosk x30 + Super x8" says far more than "Kiosk + Super x38". */
function side(lines){
  const c=new Map();
  lines.forEach(l=>c.set(l.account,(c.get(l.account)||0)+1));
  return [...c.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
    .map(([a,n])=>`${esc(a)}${n>1?` <span class="mult">&times;${n}</span>`:''}`).join(' + ');
}
function routeText(g){
  return `<span class="acct">${side(g.outs)}</span>
    <span style="color:var(--muted)"> → </span><span class="acct">${side(g.ins)}</span>`;
}
function groupHTML(g,cls){
  const when=g.dateFrom===g.dateTo?fmtDate(g.dateFrom):`${fmtDate(g.dateFrom)} – ${fmtDate(g.dateTo)}`;
  let note='';
  if(g.kind==='balanced'){
    const many=g.pairs.length>=3;
    note=`<div class="note"><b>≈</b><span>${g.outs.length} out and ${g.ins.length} in of ${fmtMoney(g.amount)}${
      many?' — looks like a scheduled run':''}. Every one is the same amount in the same window, so
      the pairing below is one valid answer among several; the totals cancel either way.
      Reconcile them in whatever order Xero offers.</span></div>`;
  }
  if(g.kind==='review')
    note=`<div class="note"><b>!</b><span>${g.outs.length} out vs ${g.ins.length} in.
      ${g.leftover.length} line${g.leftover.length===1?'':'s'} can't be paired
      ${g.leftover.length?'('+g.leftover.map(l=>esc(l.account)+' '+fmtDate(l.date)).join(', ')+')':''} —
      check for a missing feed, a fee deducted in transit${
        [...g.outs,...g.ins].some(l=>l.src==='image')?', or a row the screenshot reader skipped':''}.</span></div>`;
  if(g.spread>0&&g.kind!=='review')
    note+=`<div class="note"><b>·</b><span>Dates differ by ${g.spread} day${g.spread===1?'':'s'} — settlement lag, not a mismatch.</span></div>`;
  if(g.pairs.length>=3){
    const byRoute=new Map();
    g.pairs.forEach(p=>{const k=p.out.account+' \u2192 '+p.in.account;
      byRoute.set(k,(byRoute.get(k)||0)+1);});
    // Only worth a rollup when a route actually repeats — otherwise it just
    // restates the table below.
    if([...byRoute.values()].some(n=>n>1))
      note=`<div class="note"><b>&#8721;</b><span>${
        [...byRoute.entries()].sort((a,b)=>b[1]-a[1])
          .map(([k,n])=>`${esc(k)} <b>&times;${n}</b>`).join(' &nbsp;·&nbsp; ')
      } &nbsp;—&nbsp; ${fmtMoney(g.amount*g.pairs.length)} in total.</span></div>`+note;
  }
  const all=[...g.outs,...g.ins].sort((a,b)=>a.date-b.date||a.amount-b.amount);
  const pairOf=new Map();
  g.pairs.forEach((p,i)=>{pairOf.set(p.out.id,i+1);pairOf.set(p.in.id,i+1);});
  return `<div class="grp ${cls}" data-gid="${g.gid||''}"><div class="hd">
      <span class="chev">▶</span><span class="amt">${fmtMoney(g.amount)}</span>
      <span class="route">${routeText(g)}</span>
      <span class="when">${when}</span></div>
    <div class="bd">${lineTable(all,true,pairOf)}${note}</div></div>`;
}
function lineTable(lines,showPair,pairOf){
  return `<table class="lines"><thead><tr>
      <th>Date</th><th>Account</th><th style="text-align:right">Out</th>
      <th style="text-align:right">In</th><th>Description</th>${showPair?'<th>Pair</th>':''}
    </tr></thead><tbody>
    ${lines.map(l=>`<tr>
      <td class="dt">${fmtDate(l.date)}</td>
      <td>${esc(l.account)}${l.src==='image'?'<span class="src" title="Read from a screenshot">shot</span>':''}</td>
      <td class="num out">${l.amount<0?fmtMoney(-l.amount):''}</td>
      <td class="num in">${l.amount>0?fmtMoney(l.amount):''}</td>
      <td class="desc">${esc(l.desc||'—')}</td>
      ${showPair?`<td><span class="pairtag">${pairOf&&pairOf.get(l.id)?'#'+pairOf.get(l.id):'—'}</span></td>`:''}
    </tr>`).join('')}</tbody></table>`;
}
function wireGroups(){
  document.querySelectorAll('.grp > .hd').forEach(h=>h.onclick=()=>h.parentElement.classList.toggle('open'));
}
$('#expand').onclick=()=>document.querySelectorAll('.grp').forEach(g=>g.classList.add('open'));
$('#collapse').onclick=()=>document.querySelectorAll('.grp').forEach(g=>g.classList.remove('open'));
$('#print').onclick=()=>window.print();

$('#csvout').onclick=()=>{
  const R=VIEW||LAST;
  if(!R) return;
  const q=s=>`"${String(s==null?'':s).replace(/"/g,'""')}"`;
  const rows=[['Confidence','Amount','From account','Out date','Out description','To account',
               'In date','In description','Days apart','Source','Group note']];
  const label={confirmed:'Confirmed',balanced:'Balances as a set',review:'Needs a look'};
  const srcOf=(a,b)=>[a,b].some(x=>x&&x.src==='image')?'includes screenshot':'CSV';
  R.groups.forEach(g=>{
    g.pairs.forEach(p=>rows.push([label[g.kind],(g.amount/100).toFixed(2),
      p.out.account,fmtDate(p.out.date),p.out.desc,
      p.in.account,fmtDate(p.in.date),p.in.desc,
      daysBetween(p.out.date,p.in.date),srcOf(p.out,p.in),
      g.kind==='balanced'?`Ambiguous within a set of ${g.pairs.length} — any assignment balances`:
      g.kind==='review'?`${g.outs.length} out vs ${g.ins.length} in — does not balance`:'']));
    g.leftover.forEach(l=>rows.push([label[g.kind],(Math.abs(l.amount)/100).toFixed(2),
      l.amount<0?l.account:'',l.amount<0?fmtDate(l.date):'',l.amount<0?l.desc:'',
      l.amount>0?l.account:'',l.amount>0?fmtDate(l.date):'',l.amount>0?l.desc:'',
      '',srcOf(l),'UNPAIRED within group']));
  });
  R.unmatched.forEach(l=>rows.push(['No partner',(Math.abs(l.amount)/100).toFixed(2),
    l.amount<0?l.account:'',l.amount<0?fmtDate(l.date):'',l.amount<0?l.desc:'',
    l.amount>0?l.account:'',l.amount>0?fmtDate(l.date):'',l.amount>0?l.desc:'',
    '',srcOf(l),'No opposite line in any other account']));
  const blob=new Blob([rows.map(r=>r.map(q).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download='transfer-matches.csv'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
};

/* ==================================================================
   SEARCH — every line, matched or not, regardless of the filters
   ================================================================== */
let SIDX=[];
function buildSearchIndex(){
  SIDX=[];
  LAST.groups.forEach(g=>{
    const partner=new Map();
    g.pairs.forEach(p=>{partner.set(p.out.id,p.in);partner.set(p.in.id,p.out);});
    [...g.outs,...g.ins].forEach(l=>SIDX.push({l,kind:g.kind,gid:g.gid,
      partner:partner.get(l.id)||null,groupAmt:g.amount}));
  });
  LAST.unmatched.forEach(l=>SIDX.push({l,kind:'none',gid:null,partner:null}));
}

const KINDCHIP={confirmed:['good','Confirmed'],balanced:['warn','Balances as a set'],
  review:['serious','Needs a look'],none:['mut','No partner']};

function searchHits(){
  const q=$('#sq').value.trim().toLowerCase();
  const field=$('#sField').value, status=$('#sStatus').value,
        dir=$('#sDir').value, exact=$('#sExact').checked;
  if(!q) return [];
  const qAmt=parseAmount(q);
  const qDate=parseDate(q,$('#dorder').value);
  const digits=q.replace(/[^0-9.]/g,'');

  return SIDX.filter(h=>{
    if(status && h.kind!==status) return false;
    if(dir==='out' && h.l.amount>=0) return false;
    if(dir==='in'  && h.l.amount<=0) return false;
    const abs=Math.abs(h.l.amount);
    const amtStr=(abs/100).toFixed(2);
    const amtHit = qAmt!=null &&
      (exact ? abs===Math.abs(qAmt)
             : (abs===Math.abs(qAmt) || (digits.length>=2 && amtStr.includes(digits))));
    const dateHit = qDate!=null && h.l.date===qDate;
    const descHit = (h.l.desc||'').toLowerCase().includes(q);
    const acctHit = (h.l.account||'').toLowerCase().includes(q);
    switch(field){
      case 'amount':  return amtHit;
      case 'date':    return dateHit || fmtDate(h.l.date).includes(q);
      case 'desc':    return descHit;
      case 'account': return acctHit;
      default:        return amtHit||dateHit||descHit||acctHit||fmtDate(h.l.date).includes(q);
    }
  }).sort((a,b)=>Math.abs(b.l.amount)-Math.abs(a.l.amount)||a.l.date-b.l.date).slice(0,200);
}

let sSel=0;
function renderSearch(){
  const hits=searchHits(), box=$('#sres');
  if(!$('#sq').value.trim()){
    box.innerHTML=`<div class="none">Type an amount like <b>412.80</b>, a date, a description,
      or an account name. Amount search looks across every account at once.</div>`;
    return;
  }
  if(!hits.length){ box.innerHTML='<div class="none">Nothing matches.</div>'; return; }
  if(sSel>=hits.length) sSel=0;
  box.innerHTML=hits.map((h,i)=>{
    const [cls,lbl]=KINDCHIP[h.kind];
    const dirTxt=h.l.amount<0?'out of':'into';
    const sub=h.partner
      ? `pairs with ${esc(h.partner.account)} on ${fmtDate(h.partner.date)}${h.partner.desc?' · '+esc(h.partner.desc):''}`
      : (h.l.desc?esc(h.l.desc):'—');
    return `<div class="hit${i===sSel?' sel':''}" data-hit="${i}">
      <span class="amt ${h.l.amount<0?'out':'in'}">${fmtMoney(Math.abs(h.l.amount))}</span>
      <span class="who"><i>${dirTxt}</i> ${esc(h.l.account)}${
        h.l.src==='image'?'<span class="src">shot</span>':''}</span>
      <span class="meta">${fmtDate(h.l.date)} <span class="chip ${cls}">${lbl}</span></span>
      <span class="sub">${sub}</span>
    </div>`;
  }).join('');
  box.querySelectorAll('[data-hit]').forEach(el=>el.onclick=()=>jumpTo(hits[+el.dataset.hit]));
  const sel=box.querySelector('.hit.sel'); if(sel) sel.scrollIntoView({block:'nearest'});
}

function jumpTo(h){
  closeSearch();
  // A filter may be hiding the thing you just searched for — clear it rather than
  // dropping you on an empty page.
  if(filtersActive(readFilters())) $('#fClear').click();
  $('#results').classList.remove('hidden');
  setTimeout(()=>{
    const el = h.gid ? document.querySelector(`[data-gid="${h.gid}"]`)
                     : document.querySelector(`[data-uacct="${CSS.escape(h.l.account)}"]`);
    if(!el) return;
    el.classList.add('open');
    el.scrollIntoView({behavior:'smooth',block:'center'});
    const hd=el.querySelector('.hd'); if(hd){ hd.classList.add('flash');
      setTimeout(()=>hd.classList.remove('flash'),1600); }
  },60);
}

function openSearch(){
  if(!LAST){ return; }
  $('#searchOvl').classList.remove('hidden');
  $('#sq').focus(); $('#sq').select(); sSel=0; renderSearch();
}
function closeSearch(){ $('#searchOvl').classList.add('hidden'); }

$('#openSearch').onclick=()=>{
  if(!LAST){ alert('Load some statement lines and run a match first.'); return; }
  openSearch();
};
$('#searchOvl').onclick=e=>{ if(e.target.id==='searchOvl') closeSearch(); };
['#sField','#sStatus','#sDir','#sExact'].forEach(sel=>$(sel).onchange=()=>{sSel=0;renderSearch();});
$('#sq').oninput=()=>{sSel=0;renderSearch();};
$('#sq').onkeydown=e=>{
  const n=searchHits().length;
  if(e.key==='ArrowDown'){e.preventDefault(); sSel=Math.min(sSel+1,n-1); renderSearch();}
  else if(e.key==='ArrowUp'){e.preventDefault(); sSel=Math.max(sSel-1,0); renderSearch();}
  else if(e.key==='Enter'){const h=searchHits()[sSel]; if(h) jumpTo(h);}
};
document.addEventListener('keydown',e=>{
  const typing=/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
  if(e.key==='Escape'){ closeSearch(); document.querySelectorAll('.zoomed').forEach(z=>z.remove()); }
  else if(!typing && (e.key==='/'||((e.metaKey||e.ctrlKey)&&e.key==='k')) && LAST){
    e.preventDefault(); openSearch();
  }
});

/* ==================================================================
   SAVE / REOPEN A SESSION
   ================================================================== */
$('#saveSession').onclick=()=>{
  const payload={
    app:'bean-culture-transfer-matcher', version:1,
    savedAt:new Date().toISOString(),
    settings:{tol:$('#tol').value,dorder:$('#dorder').value,minamt:$('#minamt').value},
    filters:{merge:$('#fMerge').checked,inv:$('#fInv').value,from:$('#fFrom').value,to:$('#fTo').value,d1:$('#fDate1').value,d2:$('#fDate2').value,
             min:$('#fMin').value,max:$('#fMax').value,q:$('#fText').value,sort:$('#fSort').value},
    sources:S.src.map(s=>s.kind==='csv'
      ? {id:s.id,kind:'csv',name:s.name,account:s.account,signMode:s.signMode,rows:s.rows}
      : {id:s.id,kind:'image',name:s.name,account:s.account,signMode:s.signMode,
         state:s.state,twoCol:s.twoCol,draft:s.draft,dataURL:s.dataURL})
  };
  const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  const d=new Date(), pad=n=>String(n).padStart(2,'0');
  a.download=`transfer-session-${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}.json`;
  a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000);
};

$('#openSession').onclick=()=>$('#pick-session').click();
$('#pick-session').onchange=e=>{
  const f=e.target.files[0]; e.target.value='';
  if(!f) return;
  const rd=new FileReader();
  rd.onload=()=>{
    let d; try{ d=JSON.parse(rd.result); }catch(_){ alert('That file is not a saved session.'); return; }
    if(!d||d.app!=='bean-culture-transfer-matcher'||!Array.isArray(d.sources)){
      alert('That file is not a saved session.'); return;
    }
    S.src=d.sources.map(x=>({...x}));
    uid=Math.max(uid,...S.src.map(x=>parseInt(String(x.id).replace(/\D/g,''),10)||0));
    if(d.settings){
      $('#tol').value=d.settings.tol??'3';
      $('#dorder').value=d.settings.dorder??'DMY';
      $('#minamt').value=d.settings.minamt??'0';
    }
    refresh();
    if(S.src.some(x=>(x.lines||[]).length)){
      runMatch();
      const F=d.filters||{};
      $('#fMerge').checked = F.merge!==false;
      $('#fInv').value =[...$('#fInv').options ].some(o=>o.value===F.inv)?F.inv:'';
      $('#fFrom').value=[...$('#fFrom').options].some(o=>o.value===F.from)?F.from:'';
      $('#fTo').value  =[...$('#fTo').options].some(o=>o.value===F.to)?F.to:'';
      $('#fDate1').value=F.d1||''; $('#fDate2').value=F.d2||'';
      $('#fMin').value=F.min||'';  $('#fMax').value=F.max||'';
      $('#fText').value=F.q||'';   $('#fSort').value=F.sort||'conf';
      applyView();
      $('#results').classList.remove('hidden');
    }
  };
  rd.readAsText(f);
};

/* ---------- example ---------- */
$('#demo').onclick=()=>{
  // Four weeks of $170 preset auto-transfers from three accounts into the main one —
  // the recurring case that lands in "balances as a set".
  const auto={main:[],Super:[],Esp:[],Kiosk:[]};
  for(let w=0;w<4;w++){
    const d=`${5+w*7}/06/2022`;
    ['Super','Esp','Kiosk'].forEach(k=>{
      auto[k].push(`${d},Auto transfer weekly,-170.00`);
      auto.main.push(`${d},Auto transfer in,170.00`);
    });
  }
  const mk=(name,rows)=>({id:'s'+(++uid),kind:'csv',name,account:name.replace('.csv',''),
    rows:parseCSV('Date,Description,Amount\n'+rows.join('\n')),signMode:'as-is'});
  S.src=[
    mk('Bean Culture.csv',[
      '1/01/2020,Transfer from Super,100.00','2/02/2022,Transfer in,100.00',
      '2/02/2022,Transfer in,100.00','14/03/2022,Square settlement,1284.55',
      '15/03/2022,Transfer from Espresso Bar,2500.00','2/04/2022,Transfer in,750.00',
      '18/04/2022,Milk supplier,-412.80','10/05/2022,Transfer to Super,-500.00',
      ...auto.main]),
    mk('Super Account.csv',[
      '1/01/2020,Transfer to Bean Culture,-100.00','2/02/2022,Transfer out,-100.00',
      '2/04/2022,Transfer out,-750.00','20/04/2022,Bank fee,-15.00',
      '10/05/2022,Transfer in,500.00','12/05/2022,Dividend received,88.40',
      ...auto.Super]),
    mk('Espresso Bar.csv',[
      '1/01/2020,EFTPOS settlement,250.00','2/02/2022,Transfer out,-100.00',
      '13/03/2022,Transfer to Bean Culture,-2500.00','2/04/2022,Transfer out,-750.00',
      '19/04/2022,Coffee roaster invoice,-980.20',...auto.Esp]),
    mk('Kiosk.csv',['7/06/2022,EFTPOS settlement,308.15',...auto.Kiosk])
  ];
  refresh(); $('#run').click();
};
refresh();
