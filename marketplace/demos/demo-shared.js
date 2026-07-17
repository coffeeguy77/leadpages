// Shared apply script for section demos
(function(){
  function esc(s){return String(s==null?'':s).replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}
  function lpIcon(v){ if(v==null) return ''; v=String(v); if(/^[a-z0-9-]+$/.test(v)){ var _i=(window.LP_ICONS&&window.LP_ICONS[v]); if(_i) return '<svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+_i+'</svg>'; } return esc(v); }
  function shade(hex,pct){ if(!hex||hex.charAt(0)!=='#'||hex.length<7) return hex; function cl(n){return Math.max(0,Math.min(255,Math.round(n)));} var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16),f=pct/100; r=cl(r+(pct<0?r:255-r)*f); g=cl(g+(pct<0?g:255-g)*f); b=cl(b+(pct<0?b:255-b)*f); return '#'+[r,g,b].map(function(x){return ('0'+x.toString(16)).slice(-2);}).join(''); }
  function applyThemeVars(th){
    th=th||{}; var rs=document.documentElement.style;
    function setv(v,name,deep,pct){ if(v){ rs.setProperty(name,v); if(deep) rs.setProperty(deep,shade(v,pct)); } else { rs.removeProperty(name); if(deep) rs.removeProperty(deep); } }
    setv(th.pipe,'--pipe','--pipe-deep',-22); if(th.pipe){ rs.setProperty('--pipe-glow',shade(th.pipe,14)); } else { rs.removeProperty('--pipe-glow'); }
    setv(th.hivis,'--hivis','--hivis-600',-12);
    if(th.steel){ rs.setProperty('--steel-900',th.steel); rs.setProperty('--steel-950',shade(th.steel,-30)); rs.setProperty('--steel-800',shade(th.steel,18)); } else { rs.removeProperty('--steel-900'); rs.removeProperty('--steel-950'); rs.removeProperty('--steel-800'); }
    setv(th.safety,'--safety',null,0);
    setv(th.lightBg,'--light',null,0);
  }
  function applyCfg(C){
    C=C||{}; var th=C.theme||{};
    var __lay=(C.layout&&typeof C.layout==='string')?C.layout:'classic'; if(__lay!=='classic'&&__lay!=='quote-first'&&__lay!=='photo-proof'&&__lay!=='emergency-response'&&__lay!=='authority-builder'&&__lay!=='service-area-dominator'&&__lay!=='reviews-first'&&__lay!=='premium-showcase'&&__lay!=='offer-funnel'&&__lay!=='ba-hero-slider'&&__lay!=='hero-image-slider'&&__lay!=='social-proof-feed') __lay='classic'; try{ var __de=document.documentElement; var __cl=(__de.className||'').split(' ').filter(function(x){return x && x.indexOf('layout-')!==0;}); __cl.push('layout-'+__lay); __de.className=__cl.join(' '); }catch(e){}
    try{ var __mn=document.querySelector('main#top'); if(__mn){ __mn.style.display='flex'; __mn.style.flexDirection='column'; if(Array.isArray(C.sectionOrder)&&C.sectionOrder.length){ C.sectionOrder.forEach(function(__id,__ix){ var __n=__mn.querySelector(':scope > [data-sec="'+__id+'"]'); if(__n) __n.style.order=String(__ix+1); }); } } }catch(e){} try{ _navMenuRender(C); }catch(e){}
    applyThemeVars(th);
    if(Array.isArray(C.services)){ var grid=document.querySelector('.svcs'); if(grid){
      function _svcHex(v){ v=String(v||'').trim(); if(/^#?[0-9a-fA-F]{3}$/.test(v)){ v=v.charAt(0)==='#'?v:'#'+v; return '#'+v.charAt(1)+v.charAt(1)+v.charAt(2)+v.charAt(2)+v.charAt(3)+v.charAt(3); } if(/^#?[0-9a-fA-F]{6}$/.test(v)) return v.charAt(0)==='#'?v:'#'+v; return ''; }
      function _svcRgba(hex,op){ hex=_svcHex(hex); if(!hex) return ''; var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return 'rgba('+r+','+g+','+b+','+op+')'; }
      function _svcMediaPx(s){ var S={compact:56,standard:80,large:120,hero:180}; var img=!!(s&&s.image&&String(s.image).trim()); var base=S[s&&s.mediaSize]||(img?80:48); var sc=parseInt(s&&s.mediaScale,10); if(isNaN(sc)) sc=100; return Math.round(base*Math.max(50,Math.min(250,sc))/100); }
      var on=C.services.filter(function(s){return s&&s.on!==false&&(s.title||s.body||s.icon||s.image);});
      grid.innerHTML=on.map(function(s){
        var st=[], cls=['svc'], bg=_svcHex(s.bg);
        if(bg){ var op=s.bgOpacity!=null?+s.bgOpacity:100; if(isNaN(op))op=100; op=Math.max(0,Math.min(100,op))/100; st.push('--svc-bg:'+(op>=1?bg:_svcRgba(bg,op))); st.push('background:'+(op>=1?bg:_svcRgba(bg,op))); }
        var stroke=_svcHex(s.stroke); if(stroke){ st.push('--svc-stroke:'+stroke); st.push('border-color:'+stroke); }
        var tc=_svcHex(s.titleColor); if(tc) st.push('--svc-title:'+tc);
        var fc=_svcHex(s.color); if(fc){ st.push('--svc-body:'+fc); st.push('color:'+fc); st.push('--svc-icon:'+fc); }
        var px=_svcMediaPx(s); if(s.mediaSize||(s.mediaScale!=null&&+s.mediaScale!==100)||(s.image&&String(s.image).trim())||px!==48) st.push('--svc-ic-size:'+px+'px');
        var al=(s.mediaAlign==='center'||s.mediaAlign==='right')?s.mediaAlign:'left'; cls.push('align-'+al); st.push('--svc-align:'+al);
        var fitMap={contain:'contain',cover:'cover',fill:'fill',stretch:'fill'}; var fit=fitMap[s.imageFit]||'contain'; st.push('--svc-img-fit:'+fit);
        var img=(s.image&&String(s.image).trim())||'';
        var icCls='ic'+(img?' has-img':'');
        var media=img?('<div class="'+icCls+'"><img src="'+esc(img)+'" alt="" style="object-fit:'+fit+'"></div>'):('<div class="'+icCls+'">'+lpIcon(s.icon)+'</div>');
        return '<div class="'+cls.join(' ')+'"'+(st.length?' style="'+st.join(';')+'"':'')+'>'+media+'<h3>'+esc(s.title||'')+'</h3><p>'+esc(s.body||'')+'</p></div>';
      }).join('');
    } }
    (function(){
      var SV=(C.sections&&C.sections.services)||{};
      var svNode=document.querySelector('[data-sec="services"]'); if(!svNode) return;
      function _svHex(v){ v=String(v||'').trim(); if(/^#?[0-9a-fA-F]{3}$/.test(v)){ v=v.charAt(0)==='#'?v:'#'+v; return '#'+v.charAt(1)+v.charAt(1)+v.charAt(2)+v.charAt(2)+v.charAt(3)+v.charAt(3); } if(/^#?[0-9a-fA-F]{6}$/.test(v)) return v.charAt(0)==='#'?v:'#'+v; return ''; }
      function _svSet(name,val){ if(val) svNode.style.setProperty(name,val); else svNode.style.removeProperty(name); }
      _svSet('--svc-sec-eyebrow', _svHex(SV.eyebrowColor));
      _svSet('--svc-sec-title', _svHex(SV.titleColor));
      _svSet('--svc-sec-intro', _svHex(SV.introColor));
    })();
    if(C.logo){ var L=C.logo, brands=document.querySelectorAll('a.brand'); var _lhd=Math.max(20,Math.min(320,(L.heightPx?L.heightPx:Math.round(40*(L.scale||1)))||44)); var _lhm=Math.max(16,Math.min(200,(L.heightPxM?L.heightPxM:Math.round(_lhd*0.72)))); var _lbg=(L.bg&&L.bg!=='transparent')?L.bg:'transparent'; var _lpad=(L.pad!=null?L.pad:(_lbg!=='transparent'?8:0)); var _lrad=(L.radius!=null?L.radius:(_lbg!=='transparent'?12:0)); var _lp=L.position||'left'; var _hs=L.headerStyle||(L.float?'float':'solid-sticky'); var _hbg=(L.headerBg&&L.headerBg!=='')?L.headerBg:''; var _hop=L.headerBgOpacity; var _hopa=1; if(_hop!=null&&_hop!==''){ var _hopn=parseFloat(_hop); if(!isNaN(_hopn)) _hopa=Math.max(0,Math.min(100,_hopn))/100; } function _lgHexRgba(hex,a){ var m=/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(String(hex||'').trim()); if(!m) return ''; var h=m[1]; if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; var n=parseInt(h,16); return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')'; } var _hbgBase=_hbg||'#0b1220'; var _hbgCss=_hopa<=0?'transparent':(_hopa<1?(_lgHexRgba(_hbgBase,_hopa)||_hbgBase):(_hbg||'')); var _barH=Math.max(40,Math.min(280,+(L.headerBarHeight!=null?L.headerBarHeight:0)||0)); var _hang=(L.headerHang==='below'||L.headerHang===true||(L.headerHang==null&&_barH>0)); var _align=_hang?'flex-start':((L.headerLogoAlign==='end'||L.headerLogoAlign==='bottom')?'flex-end':((L.headerLogoAlign==='start'||L.headerLogoAlign==='top')?'flex-start':'center')); var _pos='sticky',_top=';top:var(--emerg-sticky-h,0px)',_bg=(_hbgCss?('background:'+_hbgCss):''); if(_hs==='solid-scroll'){ _pos='relative'; _top=''; } else if(_hs==='float'){ _pos='absolute'; _top=';top:0;left:0;right:0'; _bg='background:transparent'; } else if(_hs==='shrink'){ _pos='sticky'; _top=';top:var(--emerg-sticky-h,0px)'; _bg='background:transparent'; } var _stTopOn=L.headerStrokeTopOn===true; var _stBotOn=L.headerStrokeBottomOn===true; var _stTopW=Math.max(0,Math.min(16,+(L.headerStrokeTopWidth!=null?L.headerStrokeTopWidth:2)||0)); var _stBotW=Math.max(0,Math.min(16,+(L.headerStrokeBottomWidth!=null?L.headerStrokeBottomWidth:2)||0)); var _stTopC=(L.headerStrokeTopColor&&String(L.headerStrokeTopColor).trim())||'#ffffff'; var _stBotC=(L.headerStrokeBottomColor&&String(L.headerStrokeBottomColor).trim())||'#ffffff'; var _hdrBase='header.site{position:'+_pos+';'+_top+';z-index:60;overflow:visible;'+_bg+'}'; var _barCss='header.site .bar{height:'+(_barH?(_barH+'px'):'auto')+';min-height:'+(_barH?(_barH+'px'):'70px')+';padding-top:10px;padding-bottom:10px;align-items:'+_align+';overflow:visible}'; var _shrinkBg=_hbgCss||'rgba(10,12,18,.94)'; var _shrinkCss=(_hs==='shrink')?('header.site{transition:background .25s,box-shadow .25s}header.site img.lp-logo{transition:height .25s}'+'header.site.lp-shrunk{background:'+_shrinkBg+'!important;box-shadow:0 6px 24px rgba(0,0,0,.28)}'+'header.site.lp-shrunk .bar{min-height:0;height:auto;padding-top:6px;padding-bottom:6px}'+'header.site.lp-shrunk a.brand{margin-left:0;margin-right:auto}'+'header.site.lp-shrunk img.lp-logo{height:'+Math.min(_lhd,52)+'px}'):''; var _hdrCss=_hdrBase+_barCss+_shrinkCss; (function(){ var _h=document.querySelector('header.site'); if(!_h) return; if(_hs==='float'||_hs==='shrink'){ _h.style.setProperty('--hdr-bg','transparent'); } else if(_hbgCss){ _h.style.setProperty('--hdr-bg',_hbgCss); } else { _h.style.removeProperty('--hdr-bg'); } if(_barH){ _h.style.setProperty('--hdr-bar-h',_barH+'px'); } else { _h.style.removeProperty('--hdr-bar-h'); } _h.style.setProperty('--hdr-logo-align',_align); _h.classList.toggle('lp-st-top', !!(!(_hs==='float')&&_stTopOn&&_stTopW>0)); _h.classList.toggle('lp-st-bot', !!(!(_hs==='float')&&_stBotOn&&_stBotW>0)); if(_stTopOn&&_stTopW>0){ _h.style.setProperty('--hdr-st-top-w',_stTopW+'px'); _h.style.setProperty('--hdr-st-top-c',_stTopC); } else { _h.style.removeProperty('--hdr-st-top-w'); _h.style.removeProperty('--hdr-st-top-c'); } if(_stBotOn&&_stBotW>0){ _h.style.setProperty('--hdr-st-bot-w',_stBotW+'px'); _h.style.setProperty('--hdr-st-bot-c',_stBotC); } else { _h.style.removeProperty('--hdr-st-bot-w'); _h.style.removeProperty('--hdr-st-bot-c'); } if(_hs==='shrink'){ if(!_h.__lpScroll){ _h.__lpScroll=function(){ if(window.scrollY>60) _h.classList.add('lp-shrunk'); else _h.classList.remove('lp-shrunk'); }; window.addEventListener('scroll',_h.__lpScroll,{passive:true}); } _h.__lpScroll(); } else { _h.classList.remove('lp-shrunk'); if(_h.__lpScroll){ window.removeEventListener('scroll',_h.__lpScroll); _h.__lpScroll=null; } } })(); var _st=document.getElementById('lp-logo-css'); if(!_st){ _st=document.createElement('style'); _st.id='lp-logo-css'; document.head.appendChild(_st); } _st.textContent='a.brand{max-width:100%;overflow:visible}'+_hdrCss+'a.brand .lp-logo-wrap{display:inline-flex;align-items:center;background:'+_lbg+';padding:'+_lpad+'px;border-radius:'+_lrad+'px;line-height:0;overflow:visible}'+'a.brand img.lp-logo{height:'+_lhd+'px;width:auto;max-width:min(62vw,440px);object-fit:contain;display:block}'+'@media(max-width:760px){a.brand img.lp-logo{height:'+_lhm+'px;max-width:72vw}}'; for(var i=0;i<brands.length;i++){ var a=brands[i]; if(a.__orig==null) a.__orig=a.innerHTML; if(L.mode==='image'&&L.imageUrl){ a.innerHTML='<span class="lp-logo-wrap"><img class="lp-logo" src="'+esc(L.imageUrl)+'" alt="'+esc(L.text||'')+'"></span>'; a.style.transform=''; } else { a.innerHTML=a.__orig; var mark=a.querySelector('.mark'), nm=a.querySelector('.nm'); if(L.mode==='text'&&mark) mark.style.display='none'; if(nm&&L.text){ var sm=nm.querySelector('small'); nm.textContent=L.text; if(sm) nm.appendChild(sm); } a.style.transformOrigin='left center'; var _ls=_lhd/40; a.style.transform=(_ls!==1?'scale('+_ls+')':''); } var _inHN=(C.sections&&C.sections.navMenu&&C.sections.navMenu.on===true&&C.sections.navMenu.placement==='header'); if(_inHN){ a.style.marginLeft=''; a.style.marginRight=''; } else { a.style.marginLeft=((_lp==='right'||_lp==='center')?'auto':''); a.style.marginRight=((_lp==='center')?'auto':''); } } }
    var SEC=C.sections||{};
    Object.keys(SEC).forEach(function(id){
      var node=document.querySelector('[data-sec="'+id+'"]'); if(!node) return;
      var s=SEC[id]||{};
      if(s.on===false){ node.style.display='none'; return; } node.style.display='';
      if(s.eyebrow!=null){ var e=node.querySelector('.eyebrow'); if(e) e.textContent=s.eyebrow; }
      if(id==='hero'){
        if(s.title!=null||s.titleHl!=null){ var h1=node.querySelector('h1'); if(h1) h1.innerHTML=esc(s.title!=null?s.title:'')+(s.titleHl?' <span class="hl">'+esc(s.titleHl)+'</span>':''); }
        if(s.sub!=null){ var hs=node.querySelector('.hero-sub'); if(hs) hs.textContent=s.sub; }
      } else {
        if(s.heading!=null){ var h2=node.querySelector('h2'); if(h2) h2.textContent=s.heading; }
        if(s.intro!=null){ var pp=node.querySelector('.section-head p'); if(pp) pp.textContent=s.intro; }
      }
    });
    /* hero CTA buttons (text / action / show-hide) + hero replacement hide */
    try{
      var __H=(C.sections&&C.sections.hero)||{};
      var __pt=C.phoneText||'', __ph=C.phone||'';
      var __subT=function(t){ return String(t==null?'':t).replace(/\{\{\s*phoneText\s*\}\}/g,__pt).replace(/\{\{\s*phone\s*\}\}/g,__ph); };
      var __hbIcon=function(v){ var p=(v&&window.LP_ICONS)?window.LP_ICONS[v]:null; return p?'<span class="hb-ic"><svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg></span>':''; };
      var __hbStyle=function(el,bg,bd,fg,glowOn,glowColor){ if(!el)return; el.style.background=(bg&&String(bg).trim())?bg:''; el.style.color=(fg&&String(fg).trim())?fg:''; if(bd&&String(bd).trim()){ el.style.border='2px solid '+bd; } else { el.style.border=''; } function _hx(v){ var m=/^#([0-9a-fA-F]{6})$/.exec(String(v||'').trim()); if(!m) return null; var n=parseInt(m[1],16); return [(n>>16)&255,(n>>8)&255,n&255]; } if(glowOn===true){ var _g=_hx(glowColor)||_hx((C.theme&&C.theme.hivis)||'')||[0,0,0]; el.style.setProperty('--btn-call-glow','rgba('+_g[0]+','+_g[1]+','+_g[2]+',.4)'); el.classList.add('has-glow'); el.style.boxShadow=''; } else { el.classList.remove('has-glow'); el.style.removeProperty('--btn-call-glow'); el.style.boxShadow='none'; } };
      var __hbContent=function(el,ic,only,txt,aria){ if(!el)return; var i=__hbIcon(ic); if(only){ el.innerHTML=i||esc(txt); if(i){ el.classList.add('btn-icononly'); if(aria)el.setAttribute('aria-label',aria); } else { el.classList.remove('btn-icononly'); el.removeAttribute('aria-label'); } } else { el.innerHTML=i+esc(txt); el.classList.remove('btn-icononly'); el.removeAttribute('aria-label'); } };
      var __call=document.getElementById('heroCall');
      if(__call){ if(__H.callOn===false){ __call.style.display='none'; } else { __call.style.display=''; var __ct=__subT((__H.callText!=null&&__H.callText!=='')?__H.callText:'📞 Call {{phoneText}}'); __hbContent(__call,__H.callIcon,__H.callIconOnly===true,__ct,__ct); __hbStyle(__call,__H.callBg,__H.callBorder,__H.callFg,__H.callGlow===true,__H.callGlowColor); if(__H.callAction==='link'&&__H.callHref){ __call.setAttribute('href',__H.callHref); } else { __call.setAttribute('href','tel:'+__ph); } } }
      var __q=document.querySelector('.hero .btn-quote');
      if(__q){ if(__H.quoteOn===false){ __q.style.display='none'; } else { __q.style.display=''; var __qt=__subT((__H.quoteText!=null&&__H.quoteText!=='')?__H.quoteText:'Get a fast quote'); __hbContent(__q,__H.quoteIcon,__H.quoteIconOnly===true,__qt,__qt); __hbStyle(__q,__H.quoteBg,__H.quoteBorder,__H.quoteFg,__H.quoteGlow===true,__H.quoteGlowColor); if(__H.quoteAction==='call'){ __q.setAttribute('href','tel:'+__ph); } else if(__H.quoteAction==='link'&&__H.quoteHref){ __q.setAttribute('href',__H.quoteHref); } else { __q.setAttribute('href','#quote'); } } }
      var __heroNode=document.querySelector('[data-sec="hero"]');
      if(__heroNode){ var __S=C.sections||{}; if((__S.heroSlider&&__S.heroSlider.on===true)||(__S.heroBeforeAfter&&__S.heroBeforeAfter.on===true)||(__S.splitHero&&__S.splitHero.on===true)) __heroNode.style.display='none'; }
    }catch(e){}
    /* Text Box content */
    try{ var __TB=(C.sections&&C.sections.textBox)||{}; var __tbn=document.querySelector('[data-sec="textBox"]');
      if(__tbn){ var __ti=__tbn.querySelector('.tb-intro'); if(__ti){ __ti.textContent=(__TB.intro!=null?__TB.intro:''); __ti.style.display=(__TB.intro!=null&&__TB.intro!=='')?'':'none'; }
        var __tc=__tbn.querySelector('.tb-content'); if(__tc){ __tc.textContent=(__TB.content!=null?__TB.content:''); }
        var __tm=__tbn.querySelector('.tb-media'), __tg=__tbn.querySelector('.tb-img'); var __iu=(__TB.image!=null?String(__TB.image).trim():'');
        if(__tm){ if(__iu){ if(__tg) __tg.setAttribute('src',__iu); __tm.style.display=''; } else { __tm.style.display='none'; } }
        var __tr=__tbn.querySelector('.tb-row'); var __ttx=__tbn.querySelector('.tb-text'); if(__tr&&__ttx&&__tm){ var __wrap=(__TB.imageLayout==='wrap'); if(__wrap){ __tbn.classList.add('tbx-wrap'); } else { __tbn.classList.remove('tbx-wrap'); } if(__TB.imageSide==='left'){ __tbn.classList.add('tbx-left'); } else { __tbn.classList.remove('tbx-left'); } if(__wrap){ if(__tr.firstElementChild!==__tm){ __tr.insertBefore(__tm,__tr.firstChild); } __tr.style.flexDirection=''; __tr.style.textAlign=''; } else { if(__tm.previousElementSibling!==__ttx){ __tr.appendChild(__tm); } __tr.style.flexDirection=(__TB.imageSide==='left'?'row-reverse':'row'); __tr.style.textAlign=(__TB.textAlign==='center'?'center':''); } }
      }
    }catch(e){}
    try{ ['navMenu','beforeAfter','responseCards','projectStats','serviceAreas','reviewHighlights','featuredProjects','featureStrip','specialOffer','heroBeforeAfter','heroSlider','splitHero','activityCounter','proofStream','projectFeed','jobsFeed','beforeAfterFeed','videoReels','activityTimeline','customerReactions','textBox','onlineQuote'].forEach(function(__id){ var __n=document.querySelector('[data-sec="'+__id+'"]'); if(!__n) return; if(SEC[__id] && SEC[__id].on===true){ __n.style.display='block'; } }); }catch(e){}
      (function(){ var SEC=C.sections||{}; function lpIcon(v){ if(v==null) return ''; v=String(v); if(/^[a-z0-9-]+$/.test(v)){ var _i=(window.LP_ICONS&&window.LP_ICONS[v]); if(_i) return '<svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+_i+'</svg>'; } return esc(v); }
      function rlist(sel,items,fn){ var box=document.querySelector(sel); if(!box||!Array.isArray(items)) return; box.innerHTML=items.filter(function(it){return it&&it.on!==false;}).map(fn).join(''); }
      var nmEl=document.querySelector('a.brand .nm'); var _SCb=(typeof SITE_CONFIG!=='undefined'&&SITE_CONFIG)||{}; var BIZ=(_SCb.business||_SCb.name||_SCb.business_name||_SCb.businessName||(nmEl&&nmEl.textContent.trim())||'');
      function tok(s){ return String(s==null?'':s).replace(/\{\{\s*businessName\s*\}\}/g,BIZ); }
      if(SEC.hero&&Array.isArray(SEC.hero.badges)) rlist('.badges',SEC.hero.badges,function(b){return '<div class="badge"><span class="b-ic">'+lpIcon(b.icon)+'</span>'+esc(b.text||'')+'</div>';});
      if(SEC.why&&Array.isArray(SEC.why.items)){
        var _whyAl=((SEC.why.iconAlign==='center'||SEC.why.iconAlign==='right')?SEC.why.iconAlign:'left');
        rlist('.why-grid',SEC.why.items,function(w){return '<div class="why-item align-'+_whyAl+'">'+(w.icon?'<div class="wic">'+lpIcon(w.icon)+'</div>':'<div class="n">'+esc(w.n||'')+'</div>')+'<h3>'+esc(w.title||'')+'</h3><p>'+esc(w.body||'')+'</p></div>';});
      }
      (function(){
        var WY=SEC.why||{}; var whyNode=document.querySelector('[data-sec="why"]'); if(!whyNode) return;
        function _whyHex(v){ v=String(v||'').trim(); if(/^#?[0-9a-fA-F]{3}$/.test(v)){ v=v.charAt(0)==='#'?v:'#'+v; return '#'+v.charAt(1)+v.charAt(1)+v.charAt(2)+v.charAt(2)+v.charAt(3)+v.charAt(3); } if(/^#?[0-9a-fA-F]{6}$/.test(v)) return v.charAt(0)==='#'?v:'#'+v; return ''; }
        function _whySet(name,val){ if(val) whyNode.style.setProperty(name,val); else whyNode.style.removeProperty(name); }
        var bg=_whyHex(WY.bg); if(bg){ _whySet('--why-bg',bg); whyNode.style.background=bg; } else { whyNode.style.removeProperty('--why-bg'); whyNode.style.background=''; }
        _whySet('--why-eyebrow', _whyHex(WY.eyebrowColor));
        _whySet('--why-headline', _whyHex(WY.titleColor));
        _whySet('--why-heading', _whyHex(WY.headingColor));
        _whySet('--why-text', _whyHex(WY.textColor));
        _whySet('--why-icon', _whyHex(WY.iconColor));
        var itemStrokeOn=WY.strokeOn===true; var itemStroke=_whyHex(WY.stroke)||'#ffffff';
        if(itemStrokeOn){ _whySet('--why-item-stroke', itemStroke); whyNode.style.setProperty('--why-item-stroke-w','1px'); whyNode.style.setProperty('--why-item-pad','18px 16px'); }
        else { whyNode.style.removeProperty('--why-item-stroke'); whyNode.style.removeProperty('--why-item-stroke-w'); whyNode.style.removeProperty('--why-item-pad'); }
        var secStrokeOn=WY.sectionStrokeOn!==false; var secStroke=_whyHex(WY.sectionStroke);
        whyNode.classList.toggle('why-sec-stroke-off', !secStrokeOn);
        if(secStrokeOn&&secStroke) _whySet('--why-sec-stroke', secStroke); else whyNode.style.removeProperty('--why-sec-stroke');
        var _al=(WY.iconAlign==='center'||WY.iconAlign==='right')?WY.iconAlign:'left';
        whyNode.style.setProperty('--why-align', _al);
        var S={compact:32,standard:42,large:56,hero:72}; var base=S[WY.iconSize]||42; var sc=parseInt(WY.iconScale,10); if(isNaN(sc)) sc=100; var px=Math.round(base*Math.max(50,Math.min(250,sc))/100);
        whyNode.style.setProperty('--why-ic-size', px+'px');
      })();
      var _RVSRC={google:{m:'G',n:'Google',c:'#4285F4'},facebook:{m:'f',n:'Facebook',c:'#1877F2'},hipages:{m:'h',n:'hipages',c:'#fc6c2c'},productreview:{m:'P',n:'ProductReview',c:'#19a39b'},word:{m:'♡',n:'Word of mouth',c:'#7a7a7a'}};
      function _rvKey(s){ s=String(s||'').toLowerCase().replace(/[^a-z]/g,''); if(s.indexOf('google')>=0)return 'google'; if(s.indexOf('face')>=0)return 'facebook'; if(s.indexOf('hipage')>=0)return 'hipages'; if(s.indexOf('product')>=0)return 'productreview'; if(s.indexOf('word')>=0||s.indexOf('mouth')>=0)return 'word'; return ''; }
      function _rvBadge(s){ if(!s||!String(s).trim())return ''; var k=_rvKey(s); if(k){ var d=_RVSRC[k]; return '<span class="rv-src"><span class="rv-mono" style="background:'+d.c+'">'+d.m+'</span>'+d.n+'</span>'; } return '<span class="rv-src"><span class="rv-mono" style="background:#888">★</span>'+esc(String(s).trim())+'</span>'; }
      (function(){ var host=document.querySelector('[data-sec="reviews"] .rv-sources'); if(!host) return; var src=(SEC.reviews&&Array.isArray(SEC.reviews.sources))?SEC.reviews.sources.filter(function(x){return x&&x.on!==false&&x.platform&&String(x.platform).trim();}):[]; host.innerHTML=src.map(function(x){ var k=_rvKey(x.platform); var d=k?_RVSRC[k]:null; var logo=(x.logo&&String(x.logo).trim())?('<img class="rv-logo" src="'+esc(x.logo)+'" alt="'+esc(x.platform)+'" loading="lazy">'):('<span class="rv-mono" style="background:'+(d?d.c:'#888')+'">'+(d?d.m:esc(String(x.platform).trim().charAt(0).toUpperCase()))+'</span>'); var nm=d?d.n:esc(String(x.platform).trim()); var rt=(x.rating&&String(x.rating).trim())?('★ '+esc(x.rating)):''; var ct=(x.count&&String(x.count).trim())?(esc(x.count)+' reviews'):''; var meta=(rt||ct)?('<span class="rv-pf-r">'+rt+(rt&&ct?' · ':'')+ct+'</span>'):''; var inner=logo+'<span class="rv-pf"><span class="rv-pf-n">'+nm+'</span>'+meta+'</span>'; return (x.url&&String(x.url).trim())?('<a class="rv-source" href="'+esc(x.url)+'" target="_blank" rel="noopener">'+inner+'</a>'):('<span class="rv-source">'+inner+'</span>'); }).join(''); host.style.display=src.length?'':'none'; })();
      if(SEC.reviews&&Array.isArray(SEC.reviews.items)) rlist('.reviews',SEC.reviews.items,function(r){return '<div class="review"><div class="stars">'+esc(r.stars||'\u2605\u2605\u2605\u2605\u2605')+'</div><p>'+esc(tok(r.text||''))+'</p><div class="rv-foot"><div class="who">'+esc(r.who||'')+'</div>'+_rvBadge(r.source)+'</div></div>';});
      (function(){
        var RV=SEC.reviews||{}; var rvNode=document.querySelector('[data-sec="reviews"]'); if(!rvNode) return;
        function _rvHex(v){ v=String(v||'').trim(); if(/^#?[0-9a-fA-F]{3}$/.test(v)){ v=v.charAt(0)==='#'?v:'#'+v; return '#'+v.charAt(1)+v.charAt(1)+v.charAt(2)+v.charAt(2)+v.charAt(3)+v.charAt(3); } if(/^#?[0-9a-fA-F]{6}$/.test(v)) return v.charAt(0)==='#'?v:'#'+v; return ''; }
        function _rvSet(name,val){ if(val) rvNode.style.setProperty(name,val); else rvNode.style.removeProperty(name); }
        _rvSet('--rv-card-bg', _rvHex(RV.cardBg));
        _rvSet('--rv-stroke', _rvHex(RV.stroke));
        _rvSet('--rv-stars', _rvHex(RV.starColor));
        _rvSet('--rv-text', _rvHex(RV.textColor));
        _rvSet('--rv-who', _rvHex(RV.whoColor));
        _rvSet('--rv-eyebrow', _rvHex(RV.eyebrowColor));
        _rvSet('--rv-title', _rvHex(RV.titleColor));
      })();
      if(SEC.faq&&Array.isArray(SEC.faq.items)) rlist('.faq',SEC.faq.items,function(f){return '<details><summary>'+esc(f.q||'')+'</summary><p>'+esc(f.a||'')+'</p></details>';});
      if(SEC.area){ if(Array.isArray(SEC.area.suburbs)){ var sb=document.querySelector('.suburbs'); if(sb) sb.innerHTML=SEC.area.suburbs.filter(function(x){return x&&String(x).trim();}).map(function(x){return '<span>'+esc(String(x).trim())+'</span>';}).join(''); } if(SEC.area.intro!=null){ var an=document.querySelector('[data-sec="area"]'); if(an){ var ap=an.querySelector('p'); if(ap) ap.textContent=SEC.area.intro; } } var _aq=document.querySelector('[data-sec="area"] .qcard'); if(_aq){ var _A=SEC.area||{}; var _ah=_aq.querySelector('h3'); var _as=_aq.querySelector('p'); var _noun=''; try{ _noun=String((SEC.header&&SEC.header.cta)||'').replace(/^speak to an? /i,'').trim(); }catch(_e){} var _art=(/^[aeiou]/i.test(_noun)?'an':'a'); if(_A.ctaTitle!=null){ if(_ah)_ah.textContent=_A.ctaTitle; } else if(_noun&&_ah){ _ah.textContent='Need '+_art+' '+_noun+' now?'; } if(_A.ctaSub!=null){ if(_as)_as.textContent=_A.ctaSub; } else if(_noun&&_as){ _as.textContent='Talk to a real Canberra '+_noun+' — not a call centre.'; } } }
      var BA=SEC.beforeAfter||{}; var baNode=document.querySelector('[data-sec="beforeAfter"]');
      if(baNode){
        var _be=baNode.querySelector('.eyebrow'); if(_be) _be.textContent=(BA.eyebrow!=null?BA.eyebrow:'Before & After');
        var _bh=baNode.querySelector('h2'); if(_bh) _bh.textContent=(BA.heading!=null?BA.heading:'Real Results From Local Jobs');
        var _bi=baNode.querySelector('.section-head p'); if(_bi) _bi.textContent=(BA.intro!=null?BA.intro:'Show customers the standard of work before they call.');
        var _bd=[{title:'Front yard transformation',caption:'From tired and patchy to clean, functional and ready to enjoy.'},{title:'Problem fixed properly',caption:'Clear proof of the issue, the work completed, and the finished result.'}];
        var _bit=(Array.isArray(BA.items)&&BA.items.length)?BA.items:_bd;
        var _bg=baNode.querySelector('.ba-grid');
        if(_bg){ _bg.innerHTML=_bit.filter(function(it){return it&&it.on!==false;}).map(function(it){
          function _pan(u,tag,lbl){ u=(u!=null?String(u).trim():''); return u?('<div class="ba-shot" data-tag="'+tag+'"><img class="ba-img" src="'+esc(u)+'" alt="'+esc(lbl)+'" loading="lazy"></div>'):('<div class="ba-shot ba-ph">'+lbl+'</div>'); }
          return '<div class="ba-card"><div class="ba-pair">'+_pan(it.beforeImage,'Before','Before image')+_pan(it.afterImage,'After','After image')+'</div><div class="ba-cap"><h3>'+esc(it.title||'')+'</h3><p>'+esc(it.caption||'')+'</p></div></div>';
        }).join(''); }
        baNode.style.display=(BA.on===false)?'none':'';
      }
      var RC=SEC.responseCards||{}; var rcNode=document.querySelector('[data-sec="responseCards"]');
      if(rcNode){
        var _re=rcNode.querySelector('.eyebrow'); if(_re) _re.textContent=(RC.eyebrow!=null?RC.eyebrow:"When it can't wait");
        var _rh=rcNode.querySelector('h2'); if(_rh) _rh.textContent=(RC.heading!=null?RC.heading:'Call us now \u2014 we solve this today');
        var _ri=rcNode.querySelector('.section-head p'); if(_ri) _ri.textContent=(RC.intro!=null?RC.intro:"Real help, fast. Here's what you get the moment you call.");
        var _rd=[{icon:'\u23f1',title:'24/7 Emergency',text:'Call any hour, day or night \u2014 someone answers.'},{icon:'\u26a1',title:'Same Day Service',text:'Most jobs sorted the same day you call.'},{icon:'$',title:'Upfront Pricing',text:'A fixed price agreed before any work starts.'},{icon:'\u2713',title:'Fully Licensed',text:'Licensed and insured \u2014 details on every invoice.'},{icon:'\u2794',title:'Rapid Response',text:'We dispatch fast and head straight to you.'},{icon:'\u260e',title:'No Call Centre',text:'Talk to a local tradie, never a script.'}];
        var _rit=(Array.isArray(RC.cards)&&RC.cards.length)?RC.cards:_rd;
        var _rg=rcNode.querySelector('.rcards');
        if(_rg){ _rg.innerHTML=_rit.filter(function(it){return it&&it.on!==false;}).map(function(it){ return '<div class="rcard"><div class="rc-ic">'+lpIcon(it.icon)+'</div><div class="rc-tx"><h3>'+esc(it.title||'')+'</h3>'+(it.text?'<p>'+esc(it.text)+'</p>':'')+'</div></div>'; }).join(''); }
        rcNode.style.display=(RC.on===false)?'none':'';
      }
      var PS=SEC.projectStats||{}; var psNode=document.querySelector('[data-sec="projectStats"]');
      if(psNode){
        var _pe=psNode.querySelector('.eyebrow'); if(_pe) _pe.textContent=(PS.eyebrow!=null?PS.eyebrow:'Established & accountable');
        var _ph=psNode.querySelector('h2'); if(_ph) _ph.textContent=(PS.heading!=null?PS.heading:'A track record you can check');
        var _pi=psNode.querySelector('.section-head p'); if(_pi){ var _piv=(PS.intro!=null?PS.intro:''); _pi.textContent=_piv; _pi.style.display=_piv?'':'none'; }
        var _pd=[{value:'17',label:'Years Operating'},{value:'1,842',label:'Projects Completed'},{value:'24',label:'Team Members'},{value:'4.9',label:'Google Rating'},{value:'100%',label:'Licensed & Insured'},{value:'ISO 9001',label:'Certified & Accredited'}];
        var _pit=(Array.isArray(PS.stats)&&PS.stats.length)?PS.stats:_pd;
        var _pg=psNode.querySelector('.pstats');
        if(_pg){ _pg.innerHTML=_pit.filter(function(it){return it&&it.on!==false&&((it.value!=null&&String(it.value).trim())||(it.label!=null&&String(it.label).trim()));}).map(function(it){ return '<div class="pstat"><div class="pv">'+esc(it.value||'')+'</div><div class="pl">'+esc(it.label||'')+'</div></div>'; }).join(''); }
        psNode.style.display=(PS.on===false)?'none':'';
      }
      var SA=SEC.serviceAreas||{}; var saNode=document.querySelector('[data-sec="serviceAreas"]');
      if(saNode){
        var _se=saNode.querySelector('.eyebrow'); if(_se) _se.textContent=(SA.eyebrow!=null?SA.eyebrow:'We service');
        var _sh=saNode.querySelector('h2'); if(_sh) _sh.textContent=(SA.heading!=null?SA.heading:'Suburbs we cover across Canberra & the ACT');
        var _si=saNode.querySelector('.section-head p'); if(_si){ var _siv=(SA.intro!=null?SA.intro:''); _si.textContent=_siv; _si.style.display=_siv?'':'none'; }
        var _sd=[{name:'Belconnen'},{name:'Gungahlin'},{name:'Woden'},{name:'Tuggeranong'},{name:'Queanbeyan'},{name:'Molonglo'}];
        var _sit=(Array.isArray(SA.areas)&&SA.areas.length)?SA.areas:_sd;
        var _sg=saNode.querySelector('.sa-grid');
        if(_sg){ _sg.innerHTML=_sit.filter(function(it){return it&&it.on!==false&&it.name&&String(it.name).trim();}).map(function(it){ return '<div class="sa-item"><span class="sa-ck">\u2713</span>'+esc(String(it.name).trim())+'</div>'; }).join(''); }
        saNode.style.display=(SA.on===false)?'none':'';
      }
      var RH=SEC.reviewHighlights||{}; var rhNode=document.querySelector('[data-sec="reviewHighlights"]');
      if(rhNode){
        var _he=rhNode.querySelector('.eyebrow'); if(_he) _he.textContent=(RH.eyebrow!=null?RH.eyebrow:"Don't take our word for it");
        var _hh=rhNode.querySelector('h2'); if(_hh) _hh.textContent=(RH.heading!=null?RH.heading:'What your neighbours say');
        var _hi=rhNode.querySelector('.section-head p'); if(_hi){ var _hiv=(RH.intro!=null?RH.intro:''); _hi.textContent=_hiv; _hi.style.display=_hiv?'':'none'; }
        var _hd=[{stars:'★★★★★',text:'Called at 8am. Drain fixed by 10am. Couldn\u2019t fault them.',who:'Sarah \u2014 Canberra'},{stars:'★★★★★',text:'Upfront price, turned up on time, cleaned up after. Rare these days.',who:'Mark \u2014 Belconnen'},{stars:'★★★★★',text:'Quoted three places \u2014 these guys were the clearest and fairest by far.',who:'Priya \u2014 Gungahlin'}];
        var _hit=(Array.isArray(RH.items)&&RH.items.length)?RH.items:_hd;
        var _hg=rhNode.querySelector('.rh-grid');
        if(_hg){ _hg.innerHTML=_hit.filter(function(it){return it&&it.on!==false&&((it.text&&String(it.text).trim())||(it.who&&String(it.who).trim()));}).map(function(it){ return '<div class="rh-card"><div class="rh-stars">'+esc(it.stars||'★★★★★')+'</div><p class="rh-quote">'+esc(it.text||'')+'</p><div class="rh-who">'+esc(it.who||'')+'</div></div>'; }).join(''); }
        rhNode.style.display=(RH.on===false)?'none':'';
      }
      var FP=SEC.featuredProjects||{}; var fpNode=document.querySelector('[data-sec="featuredProjects"]');
      if(fpNode) try {
        var _fe=fpNode.querySelector('.eyebrow'); if(_fe) _fe.textContent=(FP.eyebrow!=null?FP.eyebrow:'Recent work');
        var _fh=fpNode.querySelector('h2'); if(_fh) _fh.textContent=(FP.heading!=null?FP.heading:'A selection of recent projects');
        var _fi=fpNode.querySelector('.section-head p'); if(_fi){ var _fiv=(FP.intro!=null?FP.intro:''); _fi.textContent=_fiv; _fi.style.display=_fiv?'':'none'; } var _fpIcon=function(v){ v=(v||'').trim(); if(v&&/^[a-z0-9-]+$/.test(v)&&window.LP_ICONS&&window.LP_ICONS[v]){ return '<svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+window.LP_ICONS[v]+'</svg>'; } return ''; }; var _fcbg=(FP.cardBg||'').trim(); if(_fcbg){ fpNode.style.setProperty('--fp-card-bg',_fcbg); } else { fpNode.style.removeProperty('--fp-card-bg'); } var _fctx=(FP.cardText||'').trim(); if(_fctx){ fpNode.style.setProperty('--fp-text',_fctx); } else { fpNode.style.removeProperty('--fp-text'); } var _feb=(FP.eyebrowColor||'').trim(); if(_feb){ fpNode.style.setProperty('--fp-eyebrow',_feb); } else { fpNode.style.removeProperty('--fp-eyebrow'); } var _fhd=(FP.titleColor||'').trim(); if(_fhd){ fpNode.style.setProperty('--fp-heading',_fhd); } else { fpNode.style.removeProperty('--fp-heading'); } var _fpt=(FP.projectTitleColor||'').trim(); if(_fpt){ fpNode.style.setProperty('--fp-title',_fpt); } else { fpNode.style.removeProperty('--fp-title'); } var _floc=(FP.locationColor||'').trim(); if(_floc){ fpNode.style.setProperty('--fp-loc',_floc); } else { fpNode.style.removeProperty('--fp-loc'); } var _ftag=(FP.tagColor||'').trim(); if(_ftag){ fpNode.style.setProperty('--fp-tag',_ftag); } else { fpNode.style.removeProperty('--fp-tag'); } var _hbw=fpNode.querySelector('.fp-headbadges'); if(_hbw){ var _hbs=(Array.isArray(FP.headBadges)?FP.headBadges:[]).filter(function(b){ return b&&b.on!==false&&((b.label&&String(b.label).trim())||(b.sub&&String(b.sub).trim())||(b.icon&&String(b.icon).trim())); }); if(_hbs.length){ _hbw.className='fp-headbadges'+((FP.headSep!=='space')?' fp-hb-piped':''); _hbw.innerHTML=_hbs.map(function(b){ var _ic=_fpIcon(b.icon); return '<div class="fp-hb">'+(_ic?'<div class="fp-hb-ic">'+_ic+'</div>':'')+((b.label&&String(b.label).trim())?'<div class="fp-hb-label">'+esc(b.label)+'</div>':'')+((b.sub&&String(b.sub).trim())?'<div class="fp-hb-sub">'+esc(b.sub)+'</div>':'')+'</div>'; }).join(''); _hbw.style.display=''; } else { _hbw.style.display='none'; _hbw.innerHTML=''; } }
        var _fd=[{title:'Coastal-style backyard',tag:'Landscaping',location:'O\u2019Connor, ACT',description:'Full transformation \u2014 new turf, hardwood deck, retaining walls and garden lighting.'},{title:'Spotted gum deck & pergola',tag:'Decking',location:'Ainslie, ACT',description:'Hardwood deck with integrated pergola, bench seating and recessed step lighting.'},{title:'Ensuite renovation',tag:'Bathroom',location:'Kingston, ACT',description:'Floor-to-ceiling tiling, frameless shower screen and a floating timber vanity.'}];
        var _real=(Array.isArray(FP.projects)?FP.projects:[]).filter(function(it){return it&&it.on!==false&&((it.title&&String(it.title).trim())||(it.image&&String(it.image).trim())||(it.images&&String(it.images).trim())||(it.description&&String(it.description).trim()));});
        var _isPrem=document.documentElement.classList.contains('layout-premium-showcase');
        var _fit=_real.length?_real:(_isPrem?_fd:[]);
        if(FP.on===false||!_fit.length){ fpNode.style.display='none'; }
        else {
          fpNode.style.display='';
          var _fpLayRaw=String(FP.layout||'grid').toLowerCase().replace(/[-_\s]/g,'');
          var _fpLay=(_fpLayRaw==='fullwidth'||_fpLayRaw==='full'||_fpLayRaw==='strip')?'fullWidth':'grid';
          var _fpCols=parseInt(FP.columns,10); if([2,3,4,5].indexOf(_fpCols)<0) _fpCols=4;
          fpNode.classList.toggle('fp-fullwidth',_fpLay==='fullWidth');
          fpNode.classList.remove('fp-cols-2'); fpNode.classList.remove('fp-cols-3'); fpNode.classList.remove('fp-cols-4'); fpNode.classList.remove('fp-cols-5');
          if(_fpLay==='grid') fpNode.classList.add('fp-cols-'+_fpCols);
          if(_fpLay==='fullWidth'){
            var _fpH=FP.imageHeight!=null?+FP.imageHeight:280; if(isNaN(_fpH)) _fpH=280;
            _fpH=Math.max(160,Math.min(560,_fpH));
            fpNode.style.setProperty('--fp-img-h',_fpH+'px');
            var _fpStrokeOn=FP.strokeOn!==false;
            var _fpStroke=(FP.strokeColour||FP.stroke||'#ffffff').trim()||'#ffffff';
            fpNode.style.setProperty('--fp-stroke',_fpStroke);
            fpNode.style.setProperty('--fp-stroke-w',_fpStrokeOn?'2px':'0px');
            var _fpCap=(FP.captionColor||FP.fg||'').trim();
            if(_fpCap) fpNode.style.setProperty('--fp-cap',_fpCap); else fpNode.style.removeProperty('--fp-cap');
          } else {
            fpNode.style.removeProperty('--fp-img-h');
            fpNode.style.removeProperty('--fp-stroke');
            fpNode.style.removeProperty('--fp-stroke-w');
            fpNode.style.removeProperty('--fp-cap');
          }
          window.__FP_GAL=[];
          var _fg=fpNode.querySelector('.fp-grid');
          if(_fg){ _fg.innerHTML=_fit.map(function(it){
            var _gal=[]; var _cov=(it.image!=null?String(it.image).trim():''); if(_cov)_gal.push(_cov);
            String(it.images||'').split(/\r?\n/).forEach(function(u){ u=u.trim(); if(u&&_gal.indexOf(u)<0)_gal.push(u); });
            var _gi=window.__FP_GAL.length; window.__FP_GAL.push(_gal);
            var _ofit=(it.imageFit&&['cover','contain','fill'].indexOf(it.imageFit)>=0)?it.imageFit:'cover'; var _opm={left:'left center',right:'right center',top:'center top',bottom:'center bottom',center:'center'}; var _opos=_opm[it.imagePos]||'center'; var _cover=_gal.length?('<img class="fp-img" src="'+esc(_gal[0])+'" alt="'+esc(it.title||'')+'" loading="lazy" style="object-fit:'+_ofit+';object-position:'+_opos+'">'):('<div class="fp-ph">Project image</div>');
            var _multi=_gal.length>1;
            var _open=_multi?('<button type="button" class="fp-open" data-fp-g="'+_gi+'" data-fp-i="0" aria-label="View gallery"></button><span class="fp-count">+'+(_gal.length-1)+' photos</span>'):'';
            var _tag=(it.tag&&String(it.tag).trim())?('<span class="fp-tag">'+esc(it.tag)+'</span>'):'';
            var _thumbs=(_fpLay!=='fullWidth'&&_multi)?('<div class="fp-thumbs">'+_gal.slice(0,4).map(function(u,k){return '<button type="button" class="fp-thumb" data-fp-g="'+_gi+'" data-fp-i="'+k+'" aria-label="Photo '+(k+1)+'"><img src="'+esc(u)+'" alt="" loading="lazy"></button>';}).join('')+'</div>'):'';
            var _svc='';
            if(_fpLay!=='fullWidth'&&it.services&&String(it.services).trim()){ var _ss=String(it.services).split(',').map(function(s){return s.trim();}).filter(Boolean); if(_ss.length) _svc='<div class="fp-services">'+_ss.map(function(s){return '<span class="fp-chip">'+esc(s)+'</span>';}).join('')+'</div>'; }
            var _desc=(_fpLay!=='fullWidth'&&it.description)?('<p class="fp-desc">'+esc(it.description)+'</p>'):'';
            return '<div class="fp-card"><div class="fp-shot">'+_cover+_tag+_open+'</div>'+_thumbs+'<div class="fp-body">'+(it.title?'<h3 class="fp-title">'+esc(it.title)+'</h3>':'')+(it.location?'<div class="fp-loc">'+esc(it.location)+'</div>':'')+_desc+_svc+'</div></div>';
          }).join(''); }
        }
      } catch(_fpErr){ try{ console.error('featuredProjects',_fpErr); }catch(_e){} }
      (function(){ var lb=document.getElementById('fp-lightbox'); if(!lb||window.__fpLbBound) return; window.__fpLbBound=true; var imgEl=lb.querySelector('.fp-lb-img'), cEl=lb.querySelector('.fp-lb-count'); var cur=[], idx=0; function show(){ if(!cur.length)return; if(idx<0)idx=cur.length-1; if(idx>=cur.length)idx=0; if(imgEl)imgEl.src=cur[idx]; if(cEl)cEl.textContent=(idx+1)+' / '+cur.length; } function open(g,i){ cur=(window.__FP_GAL&&window.__FP_GAL[g])||[]; idx=i||0; if(!cur.length)return; lb.classList.add('open'); show(); } document.addEventListener('click',function(ev){ var t=ev.target; if(!t||!t.closest)return; var o=t.closest('.fp-open,.fp-thumb'); if(o){ var g=parseInt(o.getAttribute('data-fp-g'),10),i=parseInt(o.getAttribute('data-fp-i'),10)||0; if(!isNaN(g))open(g,i); return; } if(t.closest('.fp-lb-next')){ idx++; show(); return; } if(t.closest('.fp-lb-prev')){ idx--; show(); return; } if(t.closest('.fp-lb-close')||(t.classList&&t.classList.contains('fp-lb-back'))){ lb.classList.remove('open'); } }); document.addEventListener('keydown',function(e){ if(!lb.classList.contains('open'))return; if(e.key==='Escape')lb.classList.remove('open'); else if(e.key==='ArrowRight'){idx++;show();} else if(e.key==='ArrowLeft'){idx--;show();} }); })();
      var SO=SEC.specialOffer||{}; var soNode=document.querySelector('[data-sec="specialOffer"]');
      if(soNode){
        var _oe=soNode.querySelector('.so-eyebrow'); if(_oe) _oe.textContent=(SO.eyebrow!=null?SO.eyebrow:'Limited time offer');
        var _oh=soNode.querySelector('.so-headline'); if(_oh) _oh.textContent=(SO.heading!=null?SO.heading:'Free onsite quote');
        var _od=soNode.querySelector('.so-deadline'); if(_od){ var _odv=(SO.intro!=null?SO.intro:'Book before Friday'); _od.textContent=_odv; _od.style.display=_odv?'':'none'; }
        var _oc=soNode.querySelector('.so-cta'); if(_oc){ var _ocv=(SO.cta!=null?SO.cta:'Claim this offer'); _oc.textContent=_ocv; _oc.style.display=_ocv?'':'none'; }
        var _opd=[{text:'No callout fee'},{text:'Fixed pricing'},{text:'Same day response'}];
        var _opt=(Array.isArray(SO.points)&&SO.points.length)?SO.points:_opd;
        var _og=soNode.querySelector('.so-points');
        if(_og){ _og.innerHTML=_opt.filter(function(it){return it&&it.on!==false&&it.text&&String(it.text).trim();}).map(function(it){ return '<span class="so-pt">'+esc(String(it.text).trim())+'</span>'; }).join(''); }
        soNode.style.display=(SO.on===false)?'none':'';
      }
      var HB=SEC.heroBeforeAfter||{}; var hbNode=document.querySelector('[data-sec="heroBeforeAfter"]');
      if(hbNode){
        function _bahsHex(v){ v=String(v||'').trim(); if(/^#?[0-9a-fA-F]{3}$/.test(v)){ v=v.charAt(0)==='#'?v:'#'+v; return '#'+v.charAt(1)+v.charAt(1)+v.charAt(2)+v.charAt(2)+v.charAt(3)+v.charAt(3); } if(/^#?[0-9a-fA-F]{6}$/.test(v)) return v.charAt(0)==='#'?v:'#'+v; return ''; }
        function _bahsSet(name,val,fallback){ var c=_bahsHex(val)||fallback||''; if(c) hbNode.style.setProperty(name,c); else hbNode.style.removeProperty(name); }
        var _sideOn=(HB.layout==='sidebar');
        var _side=(HB.sidebarSide==='right')?'right':'left';
        hbNode.classList.toggle('bahs-layout-sidebar',_sideOn);
        var _hbe=hbNode.querySelector('.eyebrow'); if(_hbe) _hbe.textContent=(HB.eyebrow!=null?HB.eyebrow:'See The Difference');
        var _hbh=hbNode.querySelector('h2'); if(_hbh) _hbh.textContent=(HB.heading!=null?HB.heading:'Drag To Reveal The Result');
        var _hbi=hbNode.querySelector('.section-head p'); if(_hbi){ var _hbiv=(HB.intro!=null?HB.intro:'Show customers the transformation in one simple swipe.'); _hbi.textContent=_hbiv; _hbi.style.display=_hbiv?'':'none'; }
        var _bl=(HB.beforeLabel!=null&&String(HB.beforeLabel).trim())?HB.beforeLabel:'Before';
        var _al=(HB.afterLabel!=null&&String(HB.afterLabel).trim())?HB.afterLabel:'After';
        var _bu=(HB.beforeImage!=null?String(HB.beforeImage).trim():''); var _au=(HB.afterImage!=null?String(HB.afterImage).trim():'');
        var _aft=hbNode.querySelector('.bahs-after'), _bef=hbNode.querySelector('.bahs-before');
        if(_aft) _aft.innerHTML=(_au?'<img class="bahs-img" src="'+esc(_au)+'" alt="'+esc(_al)+'" loading="lazy">':'<div class="bahs-ph">After image</div>')+'<span class="bahs-lab bahs-lab-a">'+esc(_al)+'</span>';
        if(_bef) _bef.innerHTML=(_bu?'<img class="bahs-img" src="'+esc(_bu)+'" alt="'+esc(_bl)+'" loading="lazy">':'<div class="bahs-ph">Before image</div>')+'<span class="bahs-lab bahs-lab-b">'+esc(_bl)+'</span>';
        var _ht=hbNode.querySelector('.bahs-title'); if(_ht){ var _htv=(HB.title!=null?HB.title:'Real local transformation'); _ht.textContent=_htv; _ht.style.display=_htv?'':'none'; }
        var _hc=hbNode.querySelector('.bahs-cap'); if(_hc){ var _hcv=(HB.caption!=null?HB.caption:'A clear look at the problem before and the finished result after the job was completed.'); _hc.textContent=_hcv; _hc.style.display=_hcv?'':'none'; }
        var _bahs=hbNode.querySelector('.bahs');
        if(_bahs){
          _bahs.classList.toggle('bahs-split',_sideOn);
          _bahs.classList.toggle('bahs-side-left',_sideOn&&_side==='left');
          _bahs.classList.toggle('bahs-side-right',_sideOn&&_side==='right');
          var _sideEl=_bahs.querySelector('.bahs-side');
          if(_sideOn){
            if(!_sideEl){ _sideEl=document.createElement('div'); _sideEl.className='bahs-side'; _bahs.insertBefore(_sideEl,_bahs.firstChild); }
            _bahsSet('--bahs-side-bg',HB.sidebarBg,'#f4f1ea');
            _bahsSet('--bahs-eyebrow',HB.eyebrowColor,'#1f5c3a');
            _bahsSet('--bahs-title',HB.titleColor,'#1a2230');
            _bahsSet('--bahs-text',HB.textColor,'#46535f');
            _bahsSet('--bahs-feat',HB.featureColor,(HB.textColor||'#33414f'));
            _bahsSet('--bahs-icon',HB.iconColor,(HB.eyebrowColor||'#1f5c3a'));
            _bahsSet('--bahs-cta-bg',HB.ctaBg,'#1f5c3a');
            _bahsSet('--bahs-cta-fg',HB.ctaFg,'#ffffff');
            _bahsSet('--bahs-cta-bd',HB.ctaBorder,(HB.ctaBg||'#1f5c3a'));
            var _seb=(HB.eyebrow!=null?String(HB.eyebrow):'Featured Project');
            var _stt=(HB.heading!=null?String(HB.heading):(HB.title!=null?String(HB.title):'From Unused Yard to Complete Outdoor Space'));
            var _stx=(HB.intro!=null?String(HB.intro):'');
            var _featDef=[{on:true,icon:'circle-check',label:'Retaining walls & excavation'},{on:true,icon:'circle-check',label:'Paving & steps'},{on:true,icon:'circle-check',label:'Turf & irrigation'},{on:true,icon:'circle-check',label:'Garden beds & planting'},{on:true,icon:'circle-check',label:'Outdoor entertaining area'}];
            var _featsSrc=Array.isArray(HB.features)?HB.features:_featDef;
            var _feats=_featsSrc.filter(function(f){ return f&&f.on!==false&&f.label&&String(f.label).trim(); });
            var _featHtml=_feats.map(function(f){ var ic=(f.icon&&window.LP_ICONS&&window.LP_ICONS[f.icon])?('<span class="bahs-feat-ic"><svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+window.LP_ICONS[f.icon]+'</svg></span>'):''; return '<li class="bahs-feat">'+ic+'<span>'+esc(String(f.label).trim())+'</span></li>'; }).join('');
            var _ctaT=(HB.ctaText!=null&&String(HB.ctaText).trim())?String(HB.ctaText).trim():'View more projects';
            var _ctaA=(HB.ctaAction||'quote'); var _ctaHref='#quote';
            if(_ctaA==='call'){ var _ph=(C&&C.phone)?C.phone:((typeof SITE_CONFIG!=='undefined'&&SITE_CONFIG.phone)?SITE_CONFIG.phone:''); _ctaHref=_ph?('tel:'+String(_ph).replace(/\s+/g,'')):'#quote'; }
            else if(_ctaA==='link'&&HB.ctaHref){ _ctaHref=String(HB.ctaHref); }
            else if(_ctaA==='none'){ _ctaHref=''; }
            var _ctaHtml=_ctaHref?('<a class="bahs-side-cta" href="'+esc(_ctaHref)+'"'+(_ctaA==='link'?' target="_blank" rel="noopener"':'')+'>'+esc(_ctaT)+'</a>'):'';
            _sideEl.innerHTML=(_seb?'<span class="bahs-side-eyebrow">'+esc(_seb)+'</span>':'')+(_stt?'<h3 class="bahs-side-title">'+esc(_stt)+'</h3>':'')+(_stx?'<p class="bahs-side-text">'+esc(_stx)+'</p>':'')+(_featHtml?'<ul class="bahs-feats">'+_featHtml+'</ul>':'')+_ctaHtml;
            var _ctaBtn=_sideEl.querySelector('.bahs-side-cta');
            if(_ctaBtn&&_ctaA==='call'){ _ctaBtn.addEventListener('click',function(){ try{trackEvent('call_click',{location:'heroBeforeAfter'});}catch(_e){} }); }
          } else if(_sideEl){ _sideEl.innerHTML=''; }
        }
        var _stg=hbNode.querySelector('.bahs-stage');
        if(_stg){
          var _hd=hbNode.querySelector('.bahs-handle');
          var _setp=function(p){ p=Math.max(0,Math.min(100,p)); _stg.style.setProperty('--pos',p+'%'); _stg.setAttribute('data-pos',String(Math.round(p))); if(_hd) _hd.setAttribute('aria-valuenow',String(Math.round(p))); };
          if(!_stg.__bahs){ _stg.__bahs=true; var _drag=false;
            var _fromX=function(x){ var r=_stg.getBoundingClientRect(); if(!r.width) return; _setp(((x-r.left)/r.width)*100); };
            _stg.addEventListener('pointerdown',function(e){ _drag=true; try{ _stg.setPointerCapture(e.pointerId); }catch(_e){} _fromX(e.clientX); e.preventDefault(); });
            _stg.addEventListener('pointermove',function(e){ if(_drag) _fromX(e.clientX); });
            _stg.addEventListener('pointerup',function(e){ _drag=false; try{ _stg.releasePointerCapture(e.pointerId); }catch(_e){} });
            _stg.addEventListener('pointercancel',function(){ _drag=false; });
            if(_hd){ _hd.setAttribute('tabindex','0'); _hd.addEventListener('keydown',function(e){ var cur=parseFloat(_stg.getAttribute('data-pos'))||50; if(e.key==='ArrowLeft'){ _setp(cur-4); e.preventDefault(); } else if(e.key==='ArrowRight'){ _setp(cur+4); e.preventDefault(); } }); }
          }
          _setp(parseFloat(_stg.getAttribute('data-pos'))||50);
        }
        hbNode.style.display=(HB.on===false)?'none':'';
      }
      var HS=SEC.heroSlider||{}; var hsNode=document.querySelector('[data-sec="heroSlider"]');
      if(hsNode){ var _hsl=hsNode.querySelector('.hsl');
        if(HS.on===true||__lay==='hero-image-slider'){
          var _trk=hsNode.querySelector('.hsl-track'), _dots=hsNode.querySelector('.hsl-dots'), _prev=hsNode.querySelector('.hsl-prev'), _next=hsNode.querySelector('.hsl-next');
          var _sl=(Array.isArray(HS.slides)?HS.slides:[]).filter(function(s){return s&&s.on!==false;});
          if(!_sl.length){ var _H=SEC.hero||{}; _sl=[{imageUrl:'',eyebrow:(_H.eyebrow!=null?_H.eyebrow:''),heading:(_H.title!=null?_H.title:''),highlightText:(_H.titleHl!=null?_H.titleHl:''),subText:(_H.sub!=null?_H.sub:''),primaryCtaText:'Call Now',primaryCtaAction:'call',secondaryCtaText:'Get A Fast Quote',secondaryCtaAction:'quote'}]; }
          var _fx=(HS.transitionEffect||'fade'), _al=(HS.textAlign||'left');
          var _ovv=(HS.overlayStrength!=null?HS.overlayStrength:65)/100; var _mhd=(HS.minHeightDesktop!=null?HS.minHeightDesktop:680), _mhm=(HS.minHeightMobile!=null?HS.minHeightMobile:560);
          if(_hsl){ _hsl.setAttribute('data-fx',_fx); _hsl.setAttribute('data-align',_al); _hsl.style.setProperty('--hsl-ov',String(_ovv)); _hsl.style.setProperty('--hsl-mh-d',_mhd+'px'); _hsl.style.setProperty('--hsl-mh-m',_mhm+'px'); }
          var _tel='tel:'+((typeof SITE_CONFIG!=='undefined'&&SITE_CONFIG.phone)?SITE_CONFIG.phone:'');
          function _hcta(s,k){ var t=s[k+'CtaText'], a=s[k+'CtaAction'], ic=s[k+'CtaIcon'], io=(s[k+'CtaIconOnly']===true); var ht=t&&String(t).trim(); if((!ht&&!(io&&ic))||a==='none') return ''; var _ip=(ic&&window.LP_ICONS&&window.LP_ICONS[ic])?window.LP_ICONS[ic]:''; var _ico=_ip?'<span class="hb-ic"><svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+_ip+'</svg></span>':''; var _only=(io&&_ico); var _inner=_only?_ico:(_ico+(ht?esc(t):'')); var _ec=_only?' btn-icononly':''; var _lbl=(_only&&ht)?(' aria-label="'+esc(t)+'"'):''; function _sc(v){ v=(v==null?'':String(v)).trim(); return (/^#[0-9a-fA-F]{3,8}$/.test(v)||/^[a-zA-Z]{2,20}$/.test(v)||/^rgba?\([0-9.,%\s]+\)$/.test(v))?v:''; } var _st='', _bg=_sc(s[k+'CtaBg']), _bd=_sc(s[k+'CtaBorder']), _fg=_sc(s[k+'CtaFg']); function _hexRgba(hex,a){ var m=/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(String(hex||'').trim()); if(!m) return ''; var h=m[1]; if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; var n=parseInt(h,16); return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')'; } var _op=s[k+'CtaOpacity']; var _opa=1; if(_op!=null&&_op!==''){ var _opn=parseFloat(_op); if(!isNaN(_opn)) _opa=Math.max(0,Math.min(100,_opn))/100; } var _bgUse=_bg; if(!_bgUse && _opa<1){ _bgUse=_sc((k==='primary'?((C.theme&&C.theme.hivis)||'#ff6a1f'):'#ffffff'))|| (k==='primary'?'#ff6a1f':'#ffffff'); } if(_bgUse){ var _bgOut=(_opa<1?(_hexRgba(_bgUse,_opa)||_bgUse):_bgUse); _st+='background:'+_bgOut+';'; } if(_fg)_st+='color:'+_fg+';'; if(_bd)_st+='border:2px solid '+_bd+';'; if(s[k+'CtaGlow']===true){ var _gc=_sc(s[k+'CtaGlowColor'])||_sc((C.theme&&C.theme.hivis)||'')||'#000000'; var _gm=/^#([0-9a-fA-F]{6})$/.exec(_gc); if(_gm){ var _gn=parseInt(_gm[1],16); _st+='--btn-call-glow:rgba('+((_gn>>16)&255)+','+((_gn>>8)&255)+','+(_gn&255)+',.4);'; _ec+=' has-glow'; } } else { _st+='box-shadow:none;'; } var _sa=_st?(' style="'+_st+'"'):''; if(a==='call') return '<a class="btn btn-call hsl-cta-call'+_ec+'" href="'+esc(_tel)+'"'+_lbl+_sa+'>'+_inner+'</a>'; if(a==='quote') return '<a class="btn btn-quote'+_ec+'" href="#quote"'+_lbl+_sa+'>'+_inner+'</a>'; return ''; }
          if(_trk){ _trk.innerHTML=_sl.map(function(s){ var _u=(s.imageUrl!=null?String(s.imageUrl).trim():''); var _us=_u.replace(/[)\s"<>]/g,''); var _fit=(s.imageFit||'cover'); var _pm={left:'left center',right:'right center',top:'center top',bottom:'center bottom',center:'center'}; var _pos=_pm[s.imagePos||'center']||'center'; var _bgc=(s.bgColour&&String(s.bgColour).trim())?String(s.bgColour).trim():''; var _sz=(_fit==='contain'||_fit==='blend')?'contain':((_fit==='fill')?'100% 100%':'cover'); var _rep=(_fit==='contain'||_fit==='blend')?';background-repeat:no-repeat':''; var _bg=_us?('<div class="hsl-bg" style="background-image:url('+_us+');background-size:'+_sz+';background-position:'+_pos+_rep+'"></div>'):('<div class="hsl-bg hsl-bg-grad"></div>'); var _blend=(_fit==='blend'&&_bgc)?('<div class="hsl-blend" style="background:linear-gradient(90deg,'+_bgc+' 0%,rgba(0,0,0,0) 16%,rgba(0,0,0,0) 84%,'+_bgc+' 100%)"></div>'):''; var _al=(s.slideTextAlign&&String(s.slideTextAlign).trim())?(' hsl-al-'+String(s.slideTextAlign).trim()):''; var _slStyle=_bgc?(' style="background-color:'+_bgc+'"'):''; function _hslCol(v){ v=(v==null?'':String(v)).trim(); return (/^#[0-9a-fA-F]{3,8}$/.test(v)||/^rgba?\([0-9.,%\s]+\)$/.test(v))?v:''; } var _ftc=_hslCol(s.featureTextColor), _hlc=_hslCol(s.highlightColor); var _innerSt=_ftc?(' style="color:'+_ftc+'"'):''; var _hlSpan=(s.highlightText&&String(s.highlightText).trim())?(' <span class="hl"'+(_hlc?(' style="color:'+_hlc+'"'):'')+'>'+esc(s.highlightText)+'</span>'):''; var _hd=esc(s.heading||'')+_hlSpan; return '<div class="hsl-slide'+_al+'"'+_slStyle+'><div class="hsl-bgwrap">'+_bg+'</div><div class="hsl-ov"></div>'+_blend+'<div class="hsl-inner"'+_innerSt+'><div class="wrap">'+(s.eyebrow&&String(s.eyebrow).trim()?'<span class="eyebrow hsl-eyebrow">'+esc(s.eyebrow)+'</span>':'')+(_hd.trim()?'<h2 class="hsl-h">'+_hd+'</h2>':'')+(s.subText&&String(s.subText).trim()?'<p class="hsl-sub">'+esc(s.subText)+'</p>':'')+'<div class="hsl-cta">'+_hcta(s,'primary')+_hcta(s,'secondary')+'</div></div></div></div>'; }).join('');
            var _cl=_trk.querySelectorAll('.hsl-cta-call'); for(var _ci=0;_ci<_cl.length;_ci++){ (function(b){ b.addEventListener('click',function(){ try{ trackEvent('call_click',{location:'heroSlider'}); }catch(_e){} }); })(_cl[_ci]); } }
          if(_dots){ if(_sl.length>1){ _dots.style.display=''; _dots.innerHTML=_sl.map(function(_,i){ return '<button type="button" class="hsl-dot" data-i="'+i+'" aria-label="Go to slide '+(i+1)+'"></button>'; }).join(''); } else { _dots.style.display='none'; _dots.innerHTML=''; } }
          var _showNav=(_sl.length>1)&&(HS.hideArrows!==true); if(_prev) _prev.style.display=_showNav?'':'none'; if(_next) _next.style.display=_showNav?'':'none';
          if(_hsl){ var st=_hsl.__hsl||(_hsl.__hsl={i:0}); st.n=_sl.length; if(st.i>=st.n) st.i=0; if(st.i<0) st.i=0; st.autoplay=(HS.autoplay!==false); st.sec=Math.max(1,(HS.autoplaySeconds!=null?HS.autoplaySeconds:5));
            var _sE=_trk?_trk.querySelectorAll('.hsl-slide'):[], _dE=_dots?_dots.querySelectorAll('.hsl-dot'):[];
            st.show=function(){ for(var k=0;k<_sE.length;k++) _sE[k].classList.toggle('is-active',k===st.i); for(var m2=0;m2<_dE.length;m2++) _dE[m2].classList.toggle('on',m2===st.i); };
            st.go=function(x){ if(st.n<1) return; st.i=((x%st.n)+st.n)%st.n; st.show(); };
            st.stop=function(){ if(_hsl.__t){ clearInterval(_hsl.__t); _hsl.__t=null; } };
            st.start=function(){ st.stop(); if(st.autoplay&&st.n>1&&!st.paused){ _hsl.__t=setInterval(function(){ st.go(st.i+1); }, st.sec*1000); } };
            st.show(); st.start();
            if(!_hsl.__bound){ _hsl.__bound=true;
              if(_prev) _prev.addEventListener('click',function(){ st.go(st.i-1); st.start(); });
              if(_next) _next.addEventListener('click',function(){ st.go(st.i+1); st.start(); });
              if(_dots) _dots.addEventListener('click',function(e){ var b=e.target.closest&&e.target.closest('.hsl-dot'); if(!b) return; st.go(parseInt(b.getAttribute('data-i'),10)||0); st.start(); });
              _hsl.addEventListener('keydown',function(e){ if(e.key==='ArrowLeft'){ st.go(st.i-1); st.start(); e.preventDefault(); } else if(e.key==='ArrowRight'){ st.go(st.i+1); st.start(); e.preventDefault(); } });
              _hsl.addEventListener('mouseenter',function(){ st.paused=true; st.stop(); }); _hsl.addEventListener('mouseleave',function(){ st.paused=false; st.start(); });
              _hsl.addEventListener('focusin',function(){ st.paused=true; st.stop(); }); _hsl.addEventListener('focusout',function(){ st.paused=false; st.start(); });
              var _sx=null; _hsl.addEventListener('pointerdown',function(e){ _sx=e.clientX; }); _hsl.addEventListener('pointerup',function(e){ if(_sx==null) return; var dx=e.clientX-_sx; _sx=null; if(Math.abs(dx)>40){ if(dx<0) st.go(st.i+1); else st.go(st.i-1); st.start(); } });
            }
          }
        } else { if(_hsl&&_hsl.__t){ clearInterval(_hsl.__t); _hsl.__t=null; } }
        hsNode.style.display=(HS.on===false)?'none':'';
      }
      var PF=SEC.proofStream||{}; var pfNode=document.querySelector('[data-sec="proofStream"]');
      if(pfNode){
        var _pe=pfNode.querySelector('.eyebrow'); if(_pe) _pe.textContent=(PF.eyebrow!=null?PF.eyebrow:'Proof Stream');
        var _ph2=pfNode.querySelector('h2'); if(_ph2) _ph2.textContent=(PF.heading!=null?PF.heading:"Proof we're working, every day");
        var _pi=pfNode.querySelector('.section-head p'); if(_pi){ var _piv=(PF.intro!=null?PF.intro:'Real jobs, real reviews, real results \u2014 straight from the team.'); _pi.textContent=_piv; _pi.style.display=_piv?'':'none'; }
        var _S='\u2605\u2605\u2605\u2605\u2605';
        var _pd=[{type:'job',title:'Blocked drain cleared',location:'Belconnen, ACT',time:'2 hours ago',text:'Cleared a full blockage and camera-checked the line before leaving.',ctaText:'Book the same fix',ctaAction:'quote'},{type:'review',rating:_S,text:'Fast, fair and tidy \u2014 sorted our burst pipe the same day we called.',who:'Sarah \u2014 Gungahlin',time:'Yesterday',ctaText:'Call the team',ctaAction:'call'},{type:'video',title:'Watch us clear a tree-root blockage',time:'2 days ago',ctaText:'Get a quote',ctaAction:'quote'},{type:'beforeafter',title:'Hot water system replaced',location:'Woden, ACT',time:'3 days ago',ctaText:'Get yours sorted',ctaAction:'quote'},{type:'job',title:'Roof leak found and sealed',location:'Queanbeyan',time:'Last week',text:'Tracked down the leak and sealed it \u2014 no more drips.',ctaText:'Call now',ctaAction:'call'},{type:'review',rating:_S,text:'On time, upfront price, great work. Would use again.',who:'Mark \u2014 Belconnen',time:'Last week',ctaText:'Get a quote',ctaAction:'quote'}];
        var _pit=(Array.isArray(PF.items)&&PF.items.length)?PF.items:_pd;
        var _tel='tel:'+((typeof SITE_CONFIG!=='undefined'&&SITE_CONFIG.phone)?SITE_CONFIG.phone:'');
        function _pcta(t,a){ if(!t||!String(t).trim()||a==='none') return ''; if(a==='call') return '<span class="ps-cta"><a class="btn btn-call ps-cta-call" href="'+esc(_tel)+'">'+esc(t)+'</a></span>'; return '<span class="ps-cta"><a class="btn btn-quote" href="#quote">'+esc(t)+'</a></span>'; }
        function _pmeta(it){ var a=[]; if(it.location&&String(it.location).trim()) a.push(esc(it.location)); if(it.time&&String(it.time).trim()) a.push(esc(it.time)); return a.length?'<div class="ps-meta">'+a.join(' \u00b7 ')+'</div>':''; }
        function _pimg(u,lbl){ u=(u!=null?String(u).trim():''); return u?'<img class="ps-img" src="'+esc(u)+'" alt="'+esc(lbl||'')+'" loading="lazy">':'<div class="ps-ph">'+esc(lbl||'Photo')+'</div>'; }
        var _pg=pfNode.querySelector('.ps-feed');
        if(_pg){ _pg.innerHTML=_pit.filter(function(it){return it&&it.on!==false;}).map(function(it){
          var ty=it.type||'job'; var cta=_pcta(it.ctaText,it.ctaAction); var meta=_pmeta(it);
          if(ty==='review'){ return '<article class="ps-card ps-type-review"><div class="ps-body">'+(it.rating&&String(it.rating).trim()?'<div class="ps-stars">'+esc(it.rating)+'</div>':'')+(it.text?'<p class="ps-quote">\u201C'+esc(it.text)+'\u201D</p>':'')+(it.who?'<div class="ps-meta">'+esc(it.who)+(it.time?' \u00b7 '+esc(it.time):'')+'</div>':meta)+cta+'</div></article>'; }
          if(ty==='video'){ var _vu=(it.videoUrl!=null?String(it.videoUrl).trim():''); var thumb='<div class="ps-media ps-video">'+_pimg(it.image,'Video')+'<span class="ps-play">\u25B6</span></div>'; if(_vu) thumb='<a class="ps-media ps-video" href="'+esc(_vu)+'" target="_blank" rel="noopener">'+_pimg(it.image,'Video')+'<span class="ps-play">\u25B6</span></a>'; return '<article class="ps-card ps-type-video">'+thumb+'<div class="ps-body"><span class="ps-pill">\u25B6 Video</span>'+(it.title?'<h3 class="ps-title">'+esc(it.title)+'</h3>':'')+meta+cta+'</div></article>'; }
          if(ty==='beforeafter'){ return '<article class="ps-card ps-type-ba"><div class="ps-barow"><div class="ps-bahalf">'+_pimg(it.image,'Before')+'<span>Before</span></div><div class="ps-bahalf">'+_pimg(it.afterImage,'After')+'<span>After</span></div></div><div class="ps-body"><span class="ps-pill">Before / After</span>'+(it.title?'<h3 class="ps-title">'+esc(it.title)+'</h3>':'')+meta+(it.text?'<p class="ps-text">'+esc(it.text)+'</p>':'')+cta+'</div></article>'; }
          var _hasImg=(it.image&&String(it.image).trim()); var media=_hasImg?'<div class="ps-media">'+_pimg(it.image,it.title)+'</div>':''; return '<article class="ps-card ps-type-job">'+media+'<div class="ps-body"><span class="ps-pill">\u2713 '+(ty==='photo'?'Photo':'Completed job')+'</span>'+(it.title?'<h3 class="ps-title">'+esc(it.title)+'</h3>':'')+meta+(it.text?'<p class="ps-text">'+esc(it.text)+'</p>':'')+cta+'</div></article>';
        }).join('');
          var _pc=_pg.querySelectorAll('.ps-cta-call'); for(var _pci=0;_pci<_pc.length;_pci++){ (function(b){ b.addEventListener('click',function(){ try{ trackEvent('call_click',{location:'proofStream'}); }catch(_e){} }); })(_pc[_pci]); } }
        pfNode.style.display=(PF.on===false)?'none':'';
      }
      var SP=SEC.splitHero||{}; var spNode=document.querySelector('[data-sec="splitHero"]');
      if(spNode){
        var _spe=spNode.querySelector('.sph-eyebrow'); if(_spe) _spe.textContent=(SP.eyebrow!=null?SP.eyebrow:'Active across the ACT today');
        var _sph=spNode.querySelector('.sph-h'); if(_sph){ var _spheJoin=esc(SP.heading!=null?SP.heading:"Canberra's most active drain cleaning team"); var _sphl=(SP.highlightText!=null?String(SP.highlightText).trim():''); if(_sphl){ var _re=new RegExp('('+_sphl.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','i'); _spheJoin=_spheJoin.replace(_re,'<span class="hl">$1</span>'); } _sph.innerHTML=_spheJoin; }
        var _sps=spNode.querySelector('.sph-sub'); if(_sps){ var _spsv=(SP.subText!=null?SP.subText:'Real jobs, all day, every day.'); _sps.textContent=_spsv; _sps.style.display=_spsv?'':'none'; }
        var _stel='tel:'+((typeof SITE_CONFIG!=='undefined'&&SITE_CONFIG.phone)?SITE_CONFIG.phone:'');
        function _spcta(t,a){ if(!t||!String(t).trim()||a==='none') return ''; if(a==='call') return '<a class="btn btn-call sph-cta-call" href="'+esc(_stel)+'">'+esc(t)+'</a>'; if(a==='quote') return '<a class="btn btn-quote" href="#quote">'+esc(t)+'</a>'; return ''; }
        var _spc=spNode.querySelector('.sph-cta'); if(_spc){ _spc.innerHTML=_spcta(SP.primaryCtaText!=null?SP.primaryCtaText:'Call Now',SP.primaryCtaAction||'call')+_spcta(SP.secondaryCtaText!=null?SP.secondaryCtaText:'Get A Fast Quote',SP.secondaryCtaAction||'quote'); var _spcl=_spc.querySelectorAll('.sph-cta-call'); for(var _x=0;_x<_spcl.length;_x++){ (function(b){ b.addEventListener('click',function(){ try{ trackEvent('call_click',{location:'splitHero'}); }catch(_e){} }); })(_spcl[_x]); } }
        var _spfd=[{text:'Drain cleared in Belconnen',time:'2 hours ago'},{text:'Burst pipe repaired in Gungahlin',time:'Yesterday'},{text:'New hot water system installed',time:'3 days ago'},{text:'Emergency callout in Woden',time:'Last week'}];
        var _spfit=(Array.isArray(SP.feed)&&SP.feed.length)?SP.feed:_spfd;
        var _spw=spNode.querySelector('.sph-wall'); if(_spw){ _spw.innerHTML=_spfit.filter(function(it){return it&&it.on!==false&&((it.text&&String(it.text).trim())||(it.time&&String(it.time).trim()));}).map(function(it,ix){ return '<div class="sph-note" style="animation-delay:'+(ix*0.12).toFixed(2)+'s"><span class="sph-tick">\u2713</span><div><div class="sph-note-t">'+esc(it.text||'')+'</div>'+(it.time?'<div class="sph-note-time">'+esc(it.time)+'</div>':'')+'</div></div>'; }).join(''); }
        spNode.style.display=(SP.on===false)?'none':'';
      }
      var AC=SEC.activityCounter||{}; var acNode=document.querySelector('[data-sec="activityCounter"]');
      if(acNode){
        var _ace=acNode.querySelector('.eyebrow'); if(_ace) _ace.textContent=(AC.eyebrow!=null?AC.eyebrow:"Today's activity");
        var _ach=acNode.querySelector('h2'); if(_ach) _ach.textContent=(AC.heading!=null?AC.heading:"We don't slow down");
        var _aci=acNode.querySelector('.section-head p'); if(_aci){ var _aciv=(AC.intro!=null?AC.intro:''); _aci.textContent=_aciv; _aci.style.display=_aciv?'':'none'; }
        var _acd=[{value:'7',label:'Jobs completed today'},{value:'24',label:'Calls answered this week'},{value:'387',label:'Happy customers this year'},{value:'4.9\u2605',label:'Google Rating'}];
        var _acit=(Array.isArray(AC.stats)&&AC.stats.length)?AC.stats:_acd;
        var _acg=acNode.querySelector('.ac-grid');
        if(_acg){ _acg.innerHTML=_acit.filter(function(it){return it&&it.on!==false&&((it.value!=null&&String(it.value).trim())||(it.label!=null&&String(it.label).trim()));}).map(function(it){ return '<div class="ac-stat"><div class="ac-value" data-raw="'+esc(String(it.value!=null?it.value:''))+'">'+esc(String(it.value!=null?it.value:''))+'</div><div class="ac-label">'+esc(it.label||'')+'</div></div>'; }).join('');
          if(acNode.__obs){ try{ acNode.__obs.disconnect(); }catch(_e){} acNode.__obs=null; }
          function _acrun(el){ var raw=el.getAttribute('data-raw')||''; var m=String(raw).match(/^(\D*)([0-9][0-9.,]*)(.*)$/); if(!m){ el.textContent=raw; return; } var pre=m[1],num=m[2],suf=m[3]; var hasC=num.indexOf(',')>=0; var dec=(num.split('.')[1]||'').length; var tgt=parseFloat(num.replace(/,/g,'')); if(isNaN(tgt)){ el.textContent=raw; return; } var fmt=function(n){ var s=hasC?n.toLocaleString('en-US',{minimumFractionDigits:dec,maximumFractionDigits:dec}):n.toFixed(dec); return pre+s+suf; }; var dur=1100, t0=null; function step(ts){ if(t0==null) t0=ts; var p=Math.min(1,(ts-t0)/dur); var e=1-Math.pow(1-p,3); el.textContent=fmt(tgt*e); if(p<1) requestAnimationFrame(step); else el.textContent=fmt(tgt); } el.textContent=fmt(0); requestAnimationFrame(step); }
          var _acv=_acg.querySelectorAll('.ac-value');
          if(__lay==='social-proof-feed' && 'IntersectionObserver' in window){ var _o=new IntersectionObserver(function(es){ es.forEach(function(en){ if(en.isIntersecting){ _acrun(en.target); _o.unobserve(en.target); } }); },{threshold:.4}); acNode.__obs=_o; for(var _ai=0;_ai<_acv.length;_ai++) _o.observe(_acv[_ai]); }
        }
        acNode.style.display=(AC.on===false)?'none':'';
      }
      var CW=SEC.crew||{}; var cwNode=document.querySelector('[data-sec="crew"]');
      if(cwNode){
        function _cwHex(v){ v=String(v||'').trim(); if(/^#?[0-9a-fA-F]{3}$/.test(v)){ v=v.charAt(0)==='#'?v:'#'+v; return '#'+v.charAt(1)+v.charAt(1)+v.charAt(2)+v.charAt(2)+v.charAt(3)+v.charAt(3); } if(/^#?[0-9a-fA-F]{6}$/.test(v)) return v.charAt(0)==='#'?v:'#'+v; return ''; }
        function _cwRgba(hex,op){ hex=_cwHex(hex); if(!hex) return ''; var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return 'rgba('+r+','+g+','+b+','+op+')'; }
        function _cwSet(name,val){ if(val) cwNode.style.setProperty(name,val); else cwNode.style.removeProperty(name); }
        var _cwe=cwNode.querySelector('.eyebrow'); if(_cwe){ _cwe.textContent=(CW.eyebrow!=null?CW.eyebrow:'Our team'); }
        var _cwh=cwNode.querySelector('h2'); if(_cwh) _cwh.textContent=(CW.heading!=null?CW.heading:'Meet The Team');
        var _cwi=cwNode.querySelector('.section-head p'); if(_cwi){ var _cwiv=(CW.intro!=null?CW.intro:''); _cwi.textContent=_cwiv; _cwi.style.display=_cwiv?'':'none'; }
        var _bg=_cwHex(CW.cardBg); var _op=CW.bgOpacity!=null?+CW.bgOpacity:100; if(isNaN(_op))_op=100; _op=Math.max(0,Math.min(100,_op))/100;
        _cwSet('--crew-card-bg', _bg?(_op>=1?_bg:_cwRgba(_bg,_op)):'');
        _cwSet('--crew-stroke', _cwHex(CW.stroke));
        _cwSet('--crew-eyebrow', _cwHex(CW.eyebrowColor));
        _cwSet('--crew-title', _cwHex(CW.titleColor));
        _cwSet('--crew-font', _cwHex(CW.fontColor));
        _cwSet('--crew-name', _cwHex(CW.nameColor));
        _cwSet('--crew-role', _cwHex(CW.roleColor));
        var _psz=CW.photoSize!=null?+CW.photoSize:112; if(isNaN(_psz))_psz=112; _psz=Math.max(64,Math.min(220,_psz));
        var _pzm=CW.photoZoom!=null?+CW.photoZoom:100; if(isNaN(_pzm))_pzm=100; _pzm=Math.max(100,Math.min(200,_pzm))/100;
        var _pp={center:'center',top:'center top',bottom:'center bottom',left:'left center',right:'right center'};
        var _ppos=_pp[CW.photoPos]||'center';
        cwNode.style.setProperty('--crew-photo-size',_psz+'px');
        cwNode.style.setProperty('--crew-photo-zoom',String(_pzm));
        cwNode.style.setProperty('--crew-photo-pos',_ppos);
        var _cwd=[{name:'Steve',role:'Owner',detail:'17 years experience'},{name:'Tom',role:'Senior Technician',detail:'Blocked drain specialist'},{name:'Matt',role:'Technician',detail:'Hot water expert'}];
        var _cwit=(Array.isArray(CW.members)&&CW.members.length)?CW.members:_cwd;
        var _split=CW.layout==='split'; var _flip=CW.splitFlip===true;
        var _cwg=cwNode.querySelector('.crew-grid');
        if(_cwg){
          _cwg.classList.toggle('crew-layout-split',_split);
          _cwg.innerHTML=_cwit.filter(function(it){return it&&it.on!==false&&((it.name&&String(it.name).trim())||(it.role&&String(it.role).trim())||(it.detail&&String(it.detail).trim()));}).map(function(it){
            var _p=(it.photo!=null?String(it.photo).trim():''); var _nm=(it.name!=null?String(it.name).trim():'');
            var _media='<div class="crew-media">'+(_p?('<img class="crew-photo" src="'+esc(_p)+'" alt="'+esc(_nm)+'" loading="lazy">'):('<div class="crew-avatar">'+esc((_nm||'?').charAt(0).toUpperCase())+'</div>'))+'</div>';
            var _body=(_nm?'<h3 class="crew-name">'+esc(_nm)+'</h3>':'')+(it.role?'<p class="crew-role">'+esc(it.role)+'</p>':'')+(it.detail?'<p class="crew-detail">'+esc(it.detail)+'</p>':'');
            if(_split) return '<div class="crew-card crew-split'+(_flip?' flip':'')+'">'+_media+'<div class="crew-body">'+_body+'</div></div>';
            return '<div class="crew-card">'+_media+_body+'</div>';
          }).join('');
        }
        cwNode.style.display=(CW.on===false)?'none':'';
      }
      ;(function(){ var CR=SEC.certifications||{}; var node=document.querySelector('[data-sec="certifications"]'); if(node&&CR.on!==false){ var host=node.querySelector('.cert-grid'); if(host){ var its=(CR.items||[]).filter(function(x){return x&&x.on!==false;}); host.innerHTML=its.map(function(x){ var logo=x.image?'<img class="cert-logo" src="'+esc(x.image)+'" alt="'+esc(x.name||'')+'" loading="lazy">':''; var meta=''; if(x.number) meta+='<span>No. '+esc(x.number)+'</span>'; if(x.expiry) meta+='<span>Exp '+esc(x.expiry)+'</span>'; return '<div class="cert-card">'+logo+(x.name?'<div class="cert-name">'+esc(x.name)+'</div>':'')+(x.body?'<div class="cert-body">'+esc(x.body)+'</div>':'')+(meta?'<div class="cert-meta">'+meta+'</div>':'')+'</div>'; }).join(''); if(!its.length) node.style.display='none'; } } })();
      ;(function(){ var SM=SEC.serviceAreaMap||{}; var node=document.querySelector('[data-sec="serviceAreaMap"]'); if(!node) return;
        if(SM.on===false){ node.style.display='none'; return; }
        var areas=(SEC.serviceAreas&&Array.isArray(SEC.serviceAreas.areas))?SEC.serviceAreas.areas:[];
        areas=areas.filter(function(a){return a&&a.on!==false&&a.name&&String(a.name).trim();});
        var host=node.querySelector('.sam-wrap'); if(!host){ return; }
        if(!areas.length){ node.style.display='none'; return; }
        node.style.display='';
        var DIST={gungahlin:{x:215,y:72,label:'Gungahlin'},belconnen:{x:108,y:152,label:'Belconnen'},north:{x:212,y:168,label:'North Canberra'},molonglo:{x:132,y:238,label:'Molonglo'},weston:{x:104,y:288,label:'Weston Creek'},south:{x:238,y:232,label:'South Canberra'},woden:{x:172,y:300,label:'Woden'},queanbeyan:{x:324,y:244,label:'Queanbeyan'},tuggeranong:{x:158,y:392,label:'Tuggeranong'}};
        var ALIAS={'woden valley':'woden','molonglo valley':'molonglo','weston creek':'weston','north canberra':'north','south canberra':'south','inner north':'north','inner south':'south',city:'north',civic:'north',acton:'north',braddon:'north',turner:'north',reid:'north',campbell:'north',ainslie:'north',lyneham:'north',oconnor:'north',"o'connor":'north',dickson:'north',downer:'north',watson:'north',hackett:'north',kingston:'south',manuka:'south',barton:'south',forrest:'south',griffith:'south',narrabundah:'south',deakin:'south',yarralumla:'south',parkes:'south','red hill':'south',redhill:'south',bruce:'belconnen',kaleen:'belconnen',giralang:'belconnen',evatt:'belconnen',mckellar:'belconnen',florey:'belconnen',page:'belconnen',scullin:'belconnen',hawker:'belconnen',weetangera:'belconnen',macquarie:'belconnen',aranda:'belconnen',cook:'belconnen',charnwood:'belconnen',holt:'belconnen',latham:'belconnen',macgregor:'belconnen',dunlop:'belconnen',fraser:'belconnen',flynn:'belconnen',melba:'belconnen',spence:'belconnen',higgins:'belconnen',harrison:'gungahlin',franklin:'gungahlin',palmerston:'gungahlin',ngunnawal:'gungahlin',nicholls:'gungahlin',casey:'gungahlin',crace:'gungahlin',bonner:'gungahlin',forde:'gungahlin',amaroo:'gungahlin',moncrieff:'gungahlin',throsby:'gungahlin',taylor:'gungahlin',jacka:'gungahlin',mitchell:'gungahlin',hall:'gungahlin',phillip:'woden',curtin:'woden',lyons:'woden',mawson:'woden',pearce:'woden',torrens:'woden',chifley:'woden',garran:'woden',hughes:'woden',farrer:'woden',isaacs:'woden',weston:'weston',holder:'weston',duffy:'weston',chapman:'weston',fisher:'weston',waramanga:'weston',stirling:'weston',rivett:'weston',coombs:'molonglo',wright:'molonglo',whitlam:'molonglo','denman prospect':'molonglo',denman:'molonglo',kambah:'tuggeranong',wanniassa:'tuggeranong',greenway:'tuggeranong',calwell:'tuggeranong',conder:'tuggeranong',banks:'tuggeranong',gowrie:'tuggeranong',monash:'tuggeranong',oxley:'tuggeranong',gilmore:'tuggeranong',chisholm:'tuggeranong',richardson:'tuggeranong',theodore:'tuggeranong','isabella plains':'tuggeranong',bonython:'tuggeranong',gordon:'tuggeranong',macarthur:'tuggeranong',fadden:'tuggeranong',jerrabomberra:'queanbeyan',googong:'queanbeyan'};
        Object.keys(DIST).forEach(function(k){ ALIAS[DIST[k].label.toLowerCase()]=k; });
        function norm(s){return String(s||'').toLowerCase().replace(/\s+/g,' ').trim();}
        var covered={}, extras=[];
        areas.forEach(function(a){ var key=ALIAS[norm(a.name)]; if(key){ covered[key]=true; } else { extras.push(String(a.name).trim()); } });
        var W=380,H=462;
        var s='<svg class="sam-svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Service area map of the ACT" xmlns="http://www.w3.org/2000/svg">';
        s+='<path class="sam-land" d="M158,48 L300,118 L252,432 L100,356 Z"/>';
        s+='<path class="sam-lake" d="M112,206 Q172,184 230,210 T326,202" fill="none"/>';
        s+='<text class="sam-nsw" x="344" y="296" text-anchor="middle">NSW</text>';
        Object.keys(DIST).forEach(function(k){ var dd=DIST[k]; if(covered[k]){
            s+='<g class="sam-pin on"><circle class="sam-halo" cx="'+dd.x+'" cy="'+dd.y+'" r="12"/><circle class="sam-dot-on" cx="'+dd.x+'" cy="'+dd.y+'" r="6.5"/><circle class="sam-dot-in" cx="'+dd.x+'" cy="'+dd.y+'" r="2.4"/><text class="sam-lbl on" x="'+dd.x+'" y="'+(dd.y+23)+'" text-anchor="middle">'+esc(dd.label)+'</text></g>';
          } else {
            s+='<g class="sam-pin"><circle class="sam-dot-off" cx="'+dd.x+'" cy="'+dd.y+'" r="3.2"/><text class="sam-lbl off" x="'+dd.x+'" y="'+(dd.y+15)+'" text-anchor="middle">'+esc(dd.label)+'</text></g>';
          } });
        s+='</svg>';
        var cov=Object.keys(covered).length;
        var legend='<div class="sam-legend"><span class="sam-key"><span class="sam-key-dot"></span>Areas we cover</span>'+(cov?('<span class="sam-count">'+cov+' '+(cov===1?'district':'districts')+'</span>'):'')+'</div>';
        var ex=extras.length?('<div class="sam-extra"><span class="sam-extra-lbl">Also servicing:</span> '+extras.map(function(x){return esc(x);}).join(', ')+'</div>'):'';
        host.innerHTML='<div class="sam-map">'+s+'</div>'+legend+ex;
      })();
      ;(function(){ var node=document.querySelector('[data-sec="emergencyAvailability"]'); if(!node) return;
        var EA=SEC.emergencyAvailability||{}; if(EA.on!==true){ node.style.display='none'; return; } node.style.display='';
        window.__EA=EA;
        var _DAY=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        function _pT(t){ if(!t)return null; var m=String(t).match(/^(\d{1,2}):(\d{2})/); if(!m)return null; return parseInt(m[1],10)*60+parseInt(m[2],10); }
        function _dH(E,d){ if(d===0)return {o:_pT(E.sunOpen),c:_pT(E.sunClose)}; if(d===6)return {o:_pT(E.satOpen),c:_pT(E.satClose)}; return {o:_pT(E.weekdayOpen),c:_pT(E.weekdayClose)}; }
        function _fT(mins){ var H=Math.floor(mins/60),M=mins%60; var ap=H>=12?'pm':'am'; var hh=H%12; if(hh===0)hh=12; return hh+(M?(':'+(M<10?'0':'')+M):'')+ap; }
        function _evalEA(E){ if((E.mode||'schedule')==='manual'){ return {avail:E.available!==false}; }
          var now=new Date(), d=now.getDay(), cur=now.getHours()*60+now.getMinutes(), t=_dH(E,d);
          if(t.o!=null&&t.c!=null&&cur>=t.o&&cur<t.c) return {avail:true};
          for(var i=0;i<8;i++){ var dd=(d+i)%7, hh=_dH(E,dd); if(hh.o!=null&&hh.c!=null){ if(i===0){ if(cur<hh.o) return {avail:false,next:'today '+_fT(hh.o)}; } else { return {avail:false,next:(i===1?'tomorrow':_DAY[dd])+' '+_fT(hh.o)}; } } }
          return {avail:false}; }
        window.__eaDraw=function(){ var E=window.__EA||{}; var host=node.querySelector('.ea-wrap'); if(!host) return; var st=_evalEA(E);
          var head=(E.heading?'<h3 class="ea-head">'+esc(E.heading)+'</h3>':'')+(E.intro?'<p class="ea-intro">'+esc(E.intro)+'</p>':'');
          var label=st.avail?(E.availableLabel||'Available now'):(E.afterHoursLabel||'After hours');
          var sub=st.avail?(E.responseText||''):(((E.afterHoursText||'')+(st.next?(' Opens '+st.next+'.'):'')).trim());
          var emerg=(!st.avail&&E.emergencyText)?('<p class="ea-emerg">'+esc(E.emergencyText)+'</p>'):'';
          var ca=(E.cta&&E.cta.action)||'call'; var ctx=(E.cta&&E.cta.text)?E.cta.text:(st.avail?'Call now':'Leave a message'); var cta='';
          if(ca!=='none'){ if(ca==='call'){ var ph=(typeof SITE_CONFIG!=='undefined'&&SITE_CONFIG.phone)?SITE_CONFIG.phone:''; if(ph) cta='<a class="ea-cta ea-call" href="tel:'+esc(ph)+'">'+esc(ctx)+'</a>'; } else { cta='<a class="ea-cta" href="#quote">'+esc(ctx)+'</a>'; } }
          host.innerHTML=head+'<div class="ea-band '+(st.avail?'is-live':'is-off')+'"><span class="ea-dot '+(st.avail?'live':'off')+'"></span><div class="ea-text"><span class="ea-label">'+esc(label)+'</span>'+(sub?'<span class="ea-sub">'+esc(sub)+'</span>':'')+'</div>'+cta+'</div>'+emerg;
        };
        window.__eaDraw();
        if(!window.__eaTimer){ window.__eaTimer=true; setInterval(function(){ if(window.__eaDraw) window.__eaDraw(); },60000);
          document.addEventListener('click',function(ev){ var t=ev.target; if(t&&t.closest&&t.closest('.ea-call')){ try{trackEvent('call_click',{location:'availability'});}catch(_e){} } }); }
      })();
      ;(function(){ var FN=SEC.finance||{}; var node=document.querySelector('[data-sec="finance"]'); if(node&&FN.on!==true){ node.style.display='none'; return; } if(node){ node.style.display=''; var card=node.querySelector('.fin-card'); if(card){ var amt=(FN.amount!=null?String(FN.amount).trim():''); var per=(FN.period!=null&&String(FN.period).trim())?String(FN.period).trim():'week'; var big=amt?('<div class="fin-amount-row"><span class="fin-from">From</span><span class="fin-amount">'+esc(amt.charAt(0)==='$'?amt:('$'+amt))+'</span><span class="fin-per">per '+esc(per)+'</span></div>'):''; var desc=FN.description?'<p class="fin-desc">'+esc(FN.description)+'</p>':''; var disc=FN.disclaimer?'<p class="fin-disc">'+esc(FN.disclaimer)+'</p>':''; var ca=(FN.cta&&FN.cta.action)||'quote'; var ctx=(FN.cta&&FN.cta.text)?FN.cta.text:'Ask about finance'; var cta=''; if(ca!=='none'){ if(ca==='call'){ var ph=(typeof SITE_CONFIG!=='undefined'&&SITE_CONFIG.phone)?SITE_CONFIG.phone:''; if(ph) cta='<a class="fin-cta fin-call" href="tel:'+esc(ph)+'">'+esc(ctx)+'</a>'; } else { cta='<a class="fin-cta" href="#quote">'+esc(ctx)+'</a>'; } } card.innerHTML=big+desc+disc+cta; } } if(!window.__finBound){ window.__finBound=true; document.addEventListener('click',function(ev){ var t=ev.target; if(t&&t.closest&&t.closest('.fin-call')){ try{trackEvent('call_click',{location:'finance'});}catch(_e){} } }); } })();
      ;(function(){ var EB=SEC.estimateBuilder||{}; var node=document.querySelector('[data-sec="estimateBuilder"]'); if(!node) return;
        if(EB.on!==true){ node.style.display='none'; return; } node.style.display='';
        var _eh=node.querySelector('.section-head .eyebrow'); if(_eh) _eh.textContent=(EB.eyebrow||'');
        var _hh=node.querySelector('.section-head h2'); if(_hh) _hh.textContent=(EB.heading||'');
        var _pp=node.querySelector('.section-head p'); if(_pp){ var _pv=(EB.intro||''); _pp.textContent=_pv; _pp.style.display=_pv?'':'none'; }
        var cur=(EB.currency&&String(EB.currency).trim())?String(EB.currency).trim():'$';
        var rows=(Array.isArray(EB.options)?EB.options:[]).filter(function(o){return o&&o.on!==false&&((o.step&&String(o.step).trim())||(o.label&&String(o.label).trim()));});
        var order=[], map={};
        rows.forEach(function(o){ var q=(o.step!=null?String(o.step).trim():'')||'Options'; if(!map[q]){ map[q]={q:q,opts:[]}; order.push(map[q]); } map[q].opts.push({label:(o.label!=null?String(o.label):''),min:(parseFloat(o.min)||0),max:(parseFloat(o.max)||0)}); });
        var steps=order.filter(function(s){return s.opts.length;});
        window.__EB={steps:steps,sel:[],i:0,cur:cur,disc:(EB.disclaimer||''),cta:(EB.ctaText||'Get my exact quote')};
        window.__ebFmt=function(n){ n=Math.round(n); return String(n).replace(/\B(?=(\d{3})+(?!\d))/g,','); };
        window.__ebDraw=function(){ var E=window.__EB; var shell=node.querySelector('.eb-shell'); if(!E||!shell) return; var n=E.steps.length;
          if(!n){ shell.innerHTML='<p class="eb-empty">Add some questions and options to build your estimate.</p>'; return; }
          if(E.i>=n){ var lo=0,hi=0; for(var s=0;s<n;s++){ var oi=E.sel[s]; if(oi==null)continue; var o=E.steps[s].opts[oi]; lo+=o.min; hi+=o.max; } shell.innerHTML='<div class="eb-result"><div class="eb-range-cap">Your estimated range</div><div class="eb-range">'+E.cur+window.__ebFmt(lo)+(hi>lo?(' \u2013 '+E.cur+window.__ebFmt(hi)):'')+'</div>'+(E.disc?'<p class="eb-disc">'+esc(E.disc)+'</p>':'')+'<div class="eb-result-nav"><button type="button" class="eb-cta">'+esc(E.cta)+'</button><button type="button" class="eb-restart">Start over</button></div></div>'; return; }
          var st=E.steps[E.i]; var pct=Math.round((E.i/n)*100);
          var opts=st.opts.map(function(o,k){ var sel=(E.sel[E.i]===k)?' is-sel':''; var pr=(o.min||o.max)?('<span class="eb-opt-price">'+E.cur+window.__ebFmt(o.min)+(o.max>o.min?('\u2013'+E.cur+window.__ebFmt(o.max)):'')+'</span>'):''; return '<button type="button" class="eb-opt'+sel+'" data-step="'+E.i+'" data-opt="'+k+'"><span class="eb-opt-label">'+esc(o.label)+'</span>'+pr+'</button>'; }).join('');
          shell.innerHTML='<div class="eb-prog"><div class="eb-prog-track"><span style="width:'+pct+'%"></span></div><span class="eb-prog-txt">Step '+(E.i+1)+' of '+n+'</span></div><h3 class="eb-q">'+esc(st.q)+'</h3><div class="eb-opts">'+opts+'</div>'+((E.i>0)?'<div class="eb-nav"><button type="button" class="eb-back">\u2039 Back</button></div>':'');
        };
        window.__ebDraw();
        if(!window.__ebBound){ window.__ebBound=true; document.addEventListener('click',function(ev){ var t=ev.target; if(!t||!t.closest) return; var E=window.__EB; if(!E) return;
          var op=t.closest('.eb-opt'); if(op){ var s=parseInt(op.getAttribute('data-step'),10), k=parseInt(op.getAttribute('data-opt'),10); if(!isNaN(s)&&!isNaN(k)){ E.sel[s]=k; E.i=(s+1<E.steps.length)?(s+1):E.steps.length; window.__ebDraw(); } return; }
          if(t.closest('.eb-back')){ E.i=Math.max(0,E.i-1); window.__ebDraw(); return; }
          if(t.closest('.eb-restart')){ E.sel=[]; E.i=0; window.__ebDraw(); return; }
          if(t.closest('.eb-cta')){ var lo=0,hi=0,parts=[]; for(var s2=0;s2<E.steps.length;s2++){ var oi=E.sel[s2]; if(oi==null)continue; var o=E.steps[s2].opts[oi]; lo+=o.min;hi+=o.max; parts.push(E.steps[s2].q+': '+o.label); } var sum='Estimate request \u2014 '+parts.join('; ')+' \u2014 estimated '+E.cur+window.__ebFmt(lo)+(hi>lo?('\u2013'+E.cur+window.__ebFmt(hi)):''); var dEl=document.getElementById('detail'); if(dEl){ dEl.value=sum; } try{trackEvent('estimate_complete',{low:lo,high:hi});}catch(_e){} var qq=document.getElementById('quote'); if(qq&&qq.scrollIntoView){ qq.scrollIntoView({behavior:'smooth'}); } return; }
        }); }
      })();
      ;(function(){ var OQ=SEC.onlineQuote||{}; var node=document.querySelector('[data-sec="onlineQuote"]'); if(!node) return;
        if(OQ.on!==true){ node.style.display='none'; return; } node.style.display='';
        var _eh=node.querySelector('.ey'); if(_eh) _eh.textContent=(OQ.eyebrow||'');
        var _hh=node.querySelector('h2'); if(_hh) _hh.textContent=(OQ.heading||'');
        var _pp=node.querySelector('.intro'); if(_pp){ var _pv=(OQ.intro||''); _pp.textContent=_pv; _pp.style.display=_pv?'':'none'; }
        var _oqEl=node.querySelector('#lp-online-quote');
        if(_oqEl){
          var _slug=(C.slug||'').trim().toLowerCase();
          if(_slug) _oqEl.setAttribute('data-slug',_slug);
          if(window.LPOnlineQuoteMount) window.LPOnlineQuoteMount(_oqEl);
        }
      })();
      var JF=SEC.jobsFeed||{}; var jfNode=document.querySelector('[data-sec="jobsFeed"]');
      if(jfNode){
        var _jfe=jfNode.querySelector('.eyebrow'); if(_jfe) _jfe.textContent=(JF.eyebrow!=null?JF.eyebrow:'Latest jobs');
        var _jfh=jfNode.querySelector('h2'); if(_jfh) _jfh.textContent=(JF.heading!=null?JF.heading:'Fresh off the tools');
        var _jfi=jfNode.querySelector('.section-head p'); if(_jfi){ var _jfiv=(JF.intro!=null?JF.intro:''); _jfi.textContent=_jfiv; _jfi.style.display=_jfiv?'':'none'; }
        var _jfd=[{title:'Blocked Drain',location:'Mitchell, ACT',time:'4 hours ago',result:'Cleared and camera-checked the line.'},{title:'Hot Water System',location:'Woden, ACT',time:'Yesterday',result:'Old unit out, new one installed.'},{title:'Roof Leak Repair',location:'Queanbeyan',time:'2 days ago',result:'Tracked the leak and sealed it for good.'}];
        var _jfit=(Array.isArray(JF.items)&&JF.items.length)?JF.items:_jfd;
        function _jfmeta(it){ var a=[]; if(it.location&&String(it.location).trim()) a.push(esc(it.location)); if(it.time&&String(it.time).trim()) a.push(esc(it.time)); return a.length?'<div class="jf-meta">'+a.join(' \u00b7 ')+'</div>':''; }
        var _jfg=jfNode.querySelector('.jf-grid');
        if(_jfg){ _jfg.innerHTML=_jfit.filter(function(it){return it&&it.on!==false&&((it.title&&String(it.title).trim())||(it.image&&String(it.image).trim())||(it.result&&String(it.result).trim()));}).map(function(it){ var _u=(it.image!=null?String(it.image).trim():''); var _shot=_u?('<img class="jf-img" src="'+esc(_u)+'" alt="'+esc(it.title||'')+'" loading="lazy">'):('<div class="jf-ph">Job photo</div>'); return '<div class="jf-card"><div class="jf-shot">'+_shot+'</div><div class="jf-body">'+(it.title?'<h3 class="jf-title">'+esc(it.title)+'</h3>':'')+_jfmeta(it)+(it.result?'<p class="jf-result">'+esc(it.result)+'</p>':'')+'</div></div>'; }).join(''); }
        jfNode.style.display=(JF.on===false)?'none':'';
      }
      var BF=SEC.beforeAfterFeed||{}; var bfNode=document.querySelector('[data-sec="beforeAfterFeed"]');
      if(bfNode){
        var _bfe=bfNode.querySelector('.eyebrow'); if(_bfe) _bfe.textContent=(BF.eyebrow!=null?BF.eyebrow:'Before & after');
        var _bfh=bfNode.querySelector('h2'); if(_bfh) _bfh.textContent=(BF.heading!=null?BF.heading:'See the difference');
        var _bfi=bfNode.querySelector('.section-head p'); if(_bfi){ var _bfiv=(BF.intro!=null?BF.intro:''); _bfi.textContent=_bfiv; _bfi.style.display=_bfiv?'':'none'; }
        var _bfd=[{title:'Driveway pressure clean',location:'Belconnen, ACT',time:'Last week',caption:'Years of grime gone in an afternoon.'},{title:'Bathroom renovation',location:'Kingston, ACT',time:'2 weeks ago',caption:'Full strip-out to a clean, modern finish.'},{title:'Blocked gutter cleared',location:'Gungahlin, ACT',time:'3 weeks ago',caption:'From overflowing to free-flowing.'}];
        var _bfit=(Array.isArray(BF.items)&&BF.items.length)?BF.items:_bfd;
        function _bfmeta(it){ var a=[]; if(it.location&&String(it.location).trim()) a.push(esc(it.location)); if(it.time&&String(it.time).trim()) a.push(esc(it.time)); return a.length?'<div class="baf-meta">'+a.join(' \u00b7 ')+'</div>':''; }
        function _bfpan(u,lbl){ u=(u!=null?String(u).trim():''); return '<div class="baf-shot">'+(u?('<img class="baf-img" src="'+esc(u)+'" alt="'+esc(lbl)+'" loading="lazy">'):('<div class="baf-ph">'+lbl+' image</div>'))+'<span>'+lbl+'</span></div>'; }
        var _bfg=bfNode.querySelector('.baf-grid');
        if(_bfg){ _bfg.innerHTML=_bfit.filter(function(it){return it&&it.on!==false;}).map(function(it){ return '<div class="baf-card"><div class="baf-pair">'+_bfpan(it.beforeImage,'Before')+_bfpan(it.afterImage,'After')+'</div><div class="baf-body">'+(it.title?'<h3 class="baf-title">'+esc(it.title)+'</h3>':'')+_bfmeta(it)+(it.caption?'<p class="baf-cap">'+esc(it.caption)+'</p>':'')+'</div></div>'; }).join(''); }
        bfNode.style.display=(BF.on===false)?'none':'';
      }
      var VR=SEC.videoReels||{}; var vrNode=document.querySelector('[data-sec="videoReels"]');
      if(vrNode){
        var _vre=vrNode.querySelector('.eyebrow'); if(_vre) _vre.textContent=(VR.eyebrow!=null?VR.eyebrow:'Watch');
        var _vrh=vrNode.querySelector('h2'); if(_vrh) _vrh.textContent=(VR.heading!=null?VR.heading:'Reels from the job');
        var _vri=vrNode.querySelector('.section-head p'); if(_vri){ var _vriv=(VR.intro!=null?VR.intro:''); _vri.textContent=_vriv; _vri.style.display=_vriv?'':'none'; }
        var _vrd=[{title:'Inside a full bathroom reno',tag:'Reel'},{title:'How we clear a blocked drain',tag:'Reel'},{title:'Hot water swap in under an hour',tag:'Reel'}];
        var _vrit=(Array.isArray(VR.reels)&&VR.reels.length)?VR.reels:_vrd;
        var _vrg=vrNode.querySelector('.vr-row');
        if(_vrg){ _vrg.innerHTML=_vrit.filter(function(it){return it&&it.on!==false&&((it.title&&String(it.title).trim())||(it.thumbnail&&String(it.thumbnail).trim())||(it.videoUrl&&String(it.videoUrl).trim()));}).map(function(it){ var _t=(it.thumbnail!=null?String(it.thumbnail).trim():''); var _v=(it.videoUrl!=null?String(it.videoUrl).trim():''); var _media=_t?('<img class="vr-img" src="'+esc(_t)+'" alt="'+esc(it.title||'')+'" loading="lazy">'):('<div class="vr-ph">Video</div>'); var _inner=_media+'<div class="vr-ov"></div>'+(it.tag&&String(it.tag).trim()?'<span class="vr-tag">'+esc(it.tag)+'</span>':'')+'<div class="vr-play"></div>'+(it.title?'<div class="vr-cap">'+esc(it.title)+'</div>':''); return _v?('<a class="vr-card" href="'+esc(_v)+'" target="_blank" rel="noopener noreferrer">'+_inner+'</a>'):('<div class="vr-card">'+_inner+'</div>'); }).join(''); }
        vrNode.style.display=(VR.on===false)?'none':'';
      }
      var AT=SEC.activityTimeline||{}; var atNode=document.querySelector('[data-sec="activityTimeline"]');
      if(atNode){
        var _ate=atNode.querySelector('.eyebrow'); if(_ate) _ate.textContent=(AT.eyebrow!=null?AT.eyebrow:'Live');
        var _ath=atNode.querySelector('h2'); if(_ath) _ath.textContent=(AT.heading!=null?AT.heading:'What we\u2019re working on');
        var _ati=atNode.querySelector('.section-head p'); if(_ati){ var _ativ=(AT.intro!=null?AT.intro:''); _ati.textContent=_ativ; _ati.style.display=_ativ?'':'none'; }
        var _atSt={active:'On the job',completed:'Completed',enroute:'On the way',booked:'Booked'};
        var _atd=[{time:'7:40am',task:'Hot water system replacement',location:'Woden, ACT',status:'completed'},{time:'9:15am',task:'Blocked drain cleared',location:'Mitchell, ACT',status:'completed'},{time:'11:30am',task:'Burst pipe repair',location:'Belconnen, ACT',status:'active'},{time:'1:00pm',task:'Roof leak inspection',location:'Gungahlin, ACT',status:'booked'}];
        var _atit=(Array.isArray(AT.events)&&AT.events.length)?AT.events:_atd;
        var _atl=atNode.querySelector('.at-list');
        if(_atl){ _atl.innerHTML=_atit.filter(function(ev){return ev&&ev.on!==false&&((ev.task&&String(ev.task).trim())||(ev.time&&String(ev.time).trim()));}).map(function(ev){ var _st=(ev.status!=null?String(ev.status).trim():''); var _lbl=_atSt[_st]||''; var _row2=''; if(ev.location&&String(ev.location).trim()) _row2+='<span class="at-meta">'+esc(ev.location)+'</span>'; if(_lbl) _row2+='<span class="at-pill" data-status="'+esc(_st)+'">'+esc(_lbl)+'</span>'; return '<div class="at-row"><div class="at-time">'+esc(ev.time||'')+'</div><div class="at-rail"><span class="at-dot" data-status="'+esc(_st)+'"></span></div><div class="at-body"><div class="at-task">'+esc(ev.task||'')+'</div>'+(_row2?'<div class="at-row2">'+_row2+'</div>':'')+'</div></div>'; }).join(''); }
        atNode.style.display=(AT.on===false)?'none':'';
      }
      var CR=SEC.customerReactions||{}; var crNode=document.querySelector('[data-sec="customerReactions"]');
      if(crNode){
        var _cre=crNode.querySelector('.eyebrow'); if(_cre) _cre.textContent=(CR.eyebrow!=null?CR.eyebrow:'In their words');
        var _crh=crNode.querySelector('h2'); if(_crh) _crh.textContent=(CR.heading!=null?CR.heading:'What customers are saying');
        var _cri=crNode.querySelector('.section-head p'); if(_cri){ var _criv=(CR.intro!=null?CR.intro:''); _cri.textContent=_criv; _cri.style.display=_criv?'':'none'; }
        var _crBrand={google:'Google review',facebook:'Facebook',sms:'SMS',messenger:'Messenger',image:'Photo'};
        function _crStars(n){ n=parseInt(n,10); if(isNaN(n)||n<1)n=5; if(n>5)n=5; var s=''; for(var i=0;i<5;i++) s+=(i<n?'\u2605':'\u2606'); return s; }
        function _crAva(nm){ return '<div class="cr-ava">'+esc((String(nm||'?').trim()||'?').charAt(0).toUpperCase())+'</div>'; }
        function _crCard(it){ var sty=(it.style!=null?String(it.style).trim():'')||'google'; var nm=(it.name!=null?String(it.name).trim():'')||'Customer'; var msg=(it.message!=null?String(it.message):''); var tm=(it.time!=null?String(it.time).trim():''); var img=(it.image!=null?String(it.image).trim():''); var brand=_crBrand[sty]||''; var headSub=(sty==='google'||sty==='image')?tm:''; var head='<div class="cr-head">'+_crAva(nm)+'<div><div class="cr-name">'+esc(nm)+'</div>'+(headSub?'<div class="cr-sub">'+esc(headSub)+'</div>':'')+'</div>'+(brand?'<span class="cr-brand">'+esc(brand)+'</span>':'')+'</div>'; if(sty==='image'){ var im=img?('<img class="cr-img" src="'+esc(img)+'" alt="'+esc(nm)+'" loading="lazy">'):('<div class="cr-imgph">Screenshot</div>'); return '<div class="cr-card" data-style="image">'+head+im+'</div>'; } var body; if(sty==='google'){ body='<div class="cr-body"><div class="cr-stars">'+_crStars(it.rating)+'</div>'+(msg?'<div class="cr-msg">'+esc(msg)+'</div>':'')+'</div>'; } else if(sty==='facebook'){ body='<div class="cr-body">'+(msg?'<div class="cr-bubble">'+esc(msg)+'</div>':'')+'<div class="cr-actions">Like \u00b7 Reply'+(tm?' \u00b7 '+esc(tm):'')+'</div></div>'; } else { body='<div class="cr-body">'+(msg?'<div class="cr-bubble">'+esc(msg)+'</div>':'')+(tm?'<div class="cr-time">'+esc(tm)+'</div>':'')+'</div>'; } return '<div class="cr-card" data-style="'+esc(sty)+'">'+head+body+'</div>'; }
        var _crd=[{style:'google',name:'Sarah M.',message:'Turned up on time, fixed the problem fast and left everything spotless. Couldn\u2019t ask for more.',time:'2 days ago',rating:'5'},{style:'sms',name:'Dave',message:'Mate that\u2019s sorted now, water pressure\u2019s perfect. Thanks heaps \u2014 will be calling you again!',time:'9:42 am'},{style:'facebook',name:'Megan T.',message:'Highly recommend these guys to anyone in Canberra. Honest pricing and quality work.',time:'1 week ago'},{style:'google',name:'James K.',message:'Quick response on an emergency call-out late at night. Absolute lifesavers.',time:'3 weeks ago',rating:'5'}];
        var _crit=(Array.isArray(CR.items)&&CR.items.length)?CR.items:_crd;
        var _crg=crNode.querySelector('.cr-grid');
        if(_crg){ _crg.innerHTML=_crit.filter(function(it){return it&&it.on!==false&&((it.message&&String(it.message).trim())||(it.image&&String(it.image).trim())||(it.name&&String(it.name).trim()));}).map(_crCard).join(''); }
        crNode.style.display=(CR.on===false)?'none':'';
      }
      var PF=SEC.projectFeed||{}; var pfNode=document.querySelector('[data-sec="projectFeed"]');
      if(pfNode){
        var _pfe=pfNode.querySelector('.eyebrow'); if(_pfe) _pfe.textContent=(PF.eyebrow!=null?PF.eyebrow:'Latest work');
        var _pfh=pfNode.querySelector('h2'); if(_pfh) _pfh.textContent=(PF.heading!=null?PF.heading:'Latest Work');
        var _pfi=pfNode.querySelector('.section-head p'); if(_pfi){ var _pfiv=(PF.intro!=null?PF.intro:''); _pfi.textContent=_pfiv; _pfi.style.display=_pfiv?'':'none'; }
        var _pfd=[{title:'Merbau Deck',location:'Gungahlin, ACT',service:'Deck building',date:'2 days ago',caption:'Installed a new Merbau deck in Gungahlin \u2014 ready for summer.'},{title:'Composite Deck',location:'Belconnen, ACT',service:'Deck building',date:'4 days ago',caption:'Low-maintenance composite deck, built to last.'},{title:'Pergola Build',location:'Canberra, ACT',service:'Pergola',date:'1 week ago',caption:'Custom pergola built to match the home.'}];
        var _pfAll=(Array.isArray(PF.items)&&PF.items.length)?PF.items:_pfd;
        var _pfit=_pfAll.filter(function(it){return it&&it.on!==false&&((it.image&&String(it.image).trim())||(it.title&&String(it.title).trim())||(it.caption&&String(it.caption).trim()));});
        if((PF.sortOrder||'newest')==='oldest') _pfit=_pfit.slice().reverse();
        var _pfLim=parseInt(PF.postsToShow,10); if(!isNaN(_pfLim)&&_pfLim>0) _pfit=_pfit.slice(0,_pfLim);
        window.__PF_ITEMS=_pfit; window.__PF_OPTS={showCall:(PF.showCall!==false),showQuote:(PF.showQuote!==false),showLink:(PF.showLink!==false),callLabel:(PF.callLabel||'Call now'),quoteLabel:(PF.quoteLabel||'Get a quote'),linkLabel:(PF.linkLabel||'View original'),textColor:(PF.textColor||'#1a2230'),textBg:(PF.textBg||'#ffffff'),btnBg:(PF.btnBg||'#ff7a00'),btnText:(PF.btnText||'#ffffff')};
        var _pfg=pfNode.querySelector('.pf-grid');
        if(_pfg){ var _pfStyle=(PF.cardStyle==='below')?'below':'overlay';var _pfShowTag=(PF.showTag!==false),_pfShowTitle=(PF.showTitle!==false),_pfShowLoc=(PF.showLocation!==false),_pfShowDate=(PF.showDate===true),_pfShowDesc=(PF.showDesc===true);try{var _pfr=document.documentElement.style;_pfr.setProperty('--pf-tc',(PF.textColor||'#1a2230'));_pfr.setProperty('--pf-bg',(PF.textBg||'#ffffff'));_pfr.setProperty('--pf-btnbg',(PF.btnBg||'#ff7a00'));_pfr.setProperty('--pf-btntext',(PF.btnText||'#ffffff'));}catch(e){}_pfg.innerHTML=_pfit.map(function(it,idx){ var _u=(it.image!=null?String(it.image).trim():''); var _shot=_u?('<img class="pf-img" src="'+esc(_u)+'" alt="'+esc(it.title||'')+'" loading="lazy">'):('<div class="pf-ph">Project photo</div>'); var _tag=(_pfShowTag&&it.service&&String(it.service).trim())?('<span class="pf-tag">'+esc(it.service)+'</span>'):''; var _ttl=(_pfShowTitle&&it.title&&String(it.title).trim())?('<h3 class="pf-title">'+esc(it.title)+'</h3>'):''; var _m=[]; if(_pfShowLoc&&it.location&&String(it.location).trim())_m.push(esc(it.location)); if(_pfShowDate&&it.date&&String(it.date).trim())_m.push(esc(it.date)); var _meta=_m.length?('<div class="pf-meta">'+_m.join(' \u00b7 ')+'</div>'):''; var _desc=(_pfShowDesc&&it.caption&&String(it.caption).trim())?('<p class="pf-cardline">'+esc(String(it.caption).slice(0,120))+'</p>'):''; if(_pfStyle==='overlay'){ var _ov=(_ttl||_meta||_desc)?('<div class="pf-overlay">'+_ttl+_meta+_desc+'</div>'):''; return '<button type="button" class="pf-card pf-card--overlay" data-pf="'+idx+'"><div class="pf-shot">'+_shot+_tag+_ov+'<span class="pf-zoom">View</span></div></button>'; } return '<button type="button" class="pf-card" data-pf="'+idx+'"><div class="pf-shot">'+_shot+_tag+'<span class="pf-zoom">View</span></div><div class="pf-body">'+_ttl+_meta+_desc+'</div></button>'; }).join(''); }
        pfNode.style.display=(PF.on===false)?'none':'';
        if(!pfNode.__pfdeleg){ pfNode.__pfdeleg=true; pfNode.addEventListener('click',function(e){ var b=e.target.closest('.pf-card'); if(b){ var i=parseInt(b.getAttribute('data-pf'),10); if(!isNaN(i)&&window.__pfOpenLightbox) window.__pfOpenLightbox(i); } }); }
      }
      var _pflb=document.getElementById('pf-lightbox');
      if(_pflb && !_pflb.__pfbound){ _pflb.__pfbound=true;
        var _pfLbClose=function(){ _pflb.classList.remove('open'); _pflb.setAttribute('aria-hidden','true'); document.documentElement.style.overflow=''; };
        window.__pfOpenLightbox=function(idx){ var items=window.__PF_ITEMS||[]; var o=window.__PF_OPTS||{}; var it=items[idx]; if(!it) return; try{_pflb.style.setProperty('--pf-tc',o.textColor||'#1a2230');_pflb.style.setProperty('--pf-bg',o.textBg||'#ffffff');_pflb.style.setProperty('--pf-btnbg',o.btnBg||'#ff7a00');_pflb.style.setProperty('--pf-btntext',o.btnText||'#ffffff');}catch(_se){} var _img=(it.image!=null?String(it.image).trim():''); _pflb.querySelector('.pf-lb-media').innerHTML=_img?('<img class="pf-lb-img" src="'+esc(_img)+'" alt="'+esc(it.title||'')+'">'):('<div class="pf-lb-ph">No image yet</div>'); var _row=function(l,v){ return (v&&String(v).trim())?'<div class="pf-lb-row"><span>'+l+'</span><strong>'+esc(v)+'</strong></div>':''; }; var _spec=_row('Project',it.title)+_row('Location',it.location)+_row('Service',it.service)+_row('Completed',it.date); var _ml=[]; if(it.location&&String(it.location).trim())_ml.push(esc(it.location)); if(it.date&&String(it.date).trim())_ml.push(esc(it.date)); var _info=(it.title?'<h3 class="pf-lb-title">'+esc(it.title)+'</h3>':'')+(_ml.length?'<div class="pf-lb-meta">'+_ml.join(' \u00b7 ')+'</div>':'')+(_spec?'<div class="pf-lb-spec">'+_spec+'</div>':'')+(it.caption?'<p class="pf-lb-cap">'+esc(it.caption)+'</p>':''); _pflb.querySelector('.pf-lb-body').innerHTML=_info; var _pl=(it.permalink!=null?String(it.permalink).trim():''); var _phone=(typeof SITE_CONFIG!=='undefined'&&SITE_CONFIG.phone)?SITE_CONFIG.phone:''; var _acts=''; if(o.showLink!==false&&_pl)_acts+='<a class="pf-lb-btn pf-lb-link" href="'+esc(_pl)+'" target="_blank" rel="noopener noreferrer">'+esc((o&&o.linkLabel)||'View original')+'</a>'; if(o.showCall!==false&&_phone)_acts+='<a class="pf-lb-btn pf-lb-call" href="tel:'+esc(_phone)+'">'+esc((o&&o.callLabel)||'Call now')+'</a>'; if(o.showQuote!==false)_acts+='<a class="pf-lb-btn pf-lb-quote" href="#quote">'+esc((o&&o.quoteLabel)||'Get a quote')+'</a>'; var _ab=_pflb.querySelector('.pf-lb-actions'); _ab.innerHTML=_acts; var _cb=_ab.querySelector('.pf-lb-call'); if(_cb)_cb.addEventListener('click',function(){ try{trackEvent('call_click',{location:'projectFeed'});}catch(e){} }); var _qb=_ab.querySelector('.pf-lb-quote'); if(_qb)_qb.addEventListener('click',function(){ _pfLbClose(); }); _pflb.classList.add('open'); _pflb.setAttribute('aria-hidden','false'); document.documentElement.style.overflow='hidden'; };
        _pflb.addEventListener('click',function(e){ if(e.target===_pflb||e.target.classList.contains('pf-lb-backdrop')||e.target.classList.contains('pf-lb-close')) _pfLbClose(); });
        document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&_pflb.classList.contains('open')) _pfLbClose(); });
      }
      var TB=SEC.trustBar||{}; var tbNode=document.querySelector('[data-sec="trustBar"]');
      if(tbNode){
        var _tbd=[{label:'Licensed'},{label:'Insured'},{label:'Fixed Pricing'},{label:'Work Guaranteed'},{label:'5 Star Rated'},{label:'Local Business'}];
        var _tbit=(Array.isArray(TB.badges)&&TB.badges.length)?TB.badges:_tbd;
        var _tbMode=(TB.mode==='images')?'images':'badges';
        var _tbr=tbNode.querySelector('.tb-row');
        function _tbHex(v){ v=String(v||'').trim(); if(/^#?[0-9a-fA-F]{3}$/.test(v)){ v=v.charAt(0)==='#'?v:'#'+v; return '#'+v.charAt(1)+v.charAt(1)+v.charAt(2)+v.charAt(2)+v.charAt(3)+v.charAt(3); } if(/^#?[0-9a-fA-F]{6}$/.test(v)) return v.charAt(0)==='#'?v:'#'+v; return ''; }
        if(_tbMode==='images'){
          tbNode.classList.add('tb-images');
          var _tbH=TB.imageHeight!=null?+TB.imageHeight:280; if(isNaN(_tbH)) _tbH=280; _tbH=Math.max(120,Math.min(640,_tbH));
          tbNode.style.setProperty('--tb-img-h',_tbH+'px');
          var _strokeOn=(TB.strokeOn!==false);
          var _stroke=_tbHex(TB.strokeColour||TB.stroke)||'#ffffff';
          if(_strokeOn){ tbNode.style.setProperty('--tb-stroke',_stroke); tbNode.style.setProperty('--tb-stroke-w','2px'); }
          else { tbNode.style.setProperty('--tb-stroke','transparent'); tbNode.style.setProperty('--tb-stroke-w','0px'); }
          var _edgeOn=(TB.edgeOn!==false);
          var _edge=_tbHex(TB.edgeColour||TB.edge)||'#ffffff';
          if(_edgeOn){ tbNode.style.setProperty('--tb-edge',_edge); tbNode.style.setProperty('--tb-edge-w','2px'); }
          else { tbNode.style.setProperty('--tb-edge','transparent'); tbNode.style.setProperty('--tb-edge-w','0px'); }
          var _tbfg=_tbHex(TB.fg)||'#ffffff'; tbNode.style.setProperty('--tb-fg',_tbfg); tbNode.style.setProperty('--tb-icon',_tbfg);
          var _tbck='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
          var _tbIc=function(v){ if(!v) return ''; v=String(v); var _i=(window.LP_ICONS&&window.LP_ICONS[v]); if(!_i) return ''; return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+_i+'</svg>'; };
          var _tiles=_tbit.filter(function(b){ return b&&b.on!==false&&((b.image&&String(b.image).trim())||(b.label&&String(b.label).trim())); });
          if(!_tiles.length) _tiles=_tbd;
          if(_tbr){
            _tbr.innerHTML=_tiles.map(function(b){
              var img=(b.image!=null?String(b.image).trim():'');
              var lab=(b.label!=null?String(b.label):'');
              var ic=_tbIc(b.icon);
              var _iu=img.replace(/[)\s"'<>\\]/g,''); var bg=_iu?('<div class="tb-tile-bg" style="background-image:url('+_iu+')"></div>'):'<div class="tb-tile-bg tb-tile-ph"></div>';
              return '<div class="tb-tile">'+bg+'<div class="tb-tile-grad" aria-hidden="true"></div><div class="tb-tile-cap">'+(ic?'<span class="tb-tile-ic">'+ic+'</span>':'')+(lab?'<span class="tb-tile-txt">'+esc(lab)+'</span>':'')+'</div></div>';
            }).join('');
          }
          tbNode.classList.add('tb-noline');
          tbNode.style.removeProperty('--tb-bg');
          tbNode.style.removeProperty('--tb-line');
        } else {
          tbNode.classList.remove('tb-images');
          tbNode.style.removeProperty('--tb-img-h');
          tbNode.style.removeProperty('--tb-stroke');
          tbNode.style.removeProperty('--tb-stroke-w');
          tbNode.style.removeProperty('--tb-edge');
          tbNode.style.removeProperty('--tb-edge-w');
          var _tbck='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
          var _tbIc=function(v){ if(!v) return _tbck; v=String(v); var _i=(window.LP_ICONS&&window.LP_ICONS[v]); if(!_i) return _tbck; return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">'+_i+'</svg>'; };
          if(_tbr){
            var _tbp=_tbit.filter(function(b){return b&&b.on!==false&&b.label&&String(b.label).trim();}).map(function(b){
              var lab=esc(String(b.label||'')).replace(/\n/g,'<br>');
              return '<span class="tb-badge">'+_tbIc(b.icon)+'<span class="tb-txt">'+lab+'</span></span>';
            });
            var _tbpipe=(TB.sep==='pipe');
            var _tbsep=_tbpipe?'<span class="tb-pipe" aria-hidden="true">|</span>':'';
            _tbr.innerHTML=_tbsep?_tbp.join(_tbsep):_tbp.join('');
            _tbr.style.columnGap=_tbpipe?'16px':'';
          }
          var _tbbg=(TB.bg||'').trim(); if(_tbbg){ tbNode.style.setProperty('--tb-bg',_tbbg); } else { tbNode.style.removeProperty('--tb-bg'); }
          var _tbfg=(TB.fg||'').trim(); if(_tbfg){ tbNode.style.setProperty('--tb-fg',_tbfg); tbNode.style.setProperty('--tb-icon',_tbfg); } else { tbNode.style.removeProperty('--tb-fg'); tbNode.style.removeProperty('--tb-icon'); }
          var _tbln=(TB.line||'').trim(); if(_tbln){ tbNode.style.setProperty('--tb-line',_tbln); } else { tbNode.style.removeProperty('--tb-line'); }
          if(TB.lineOn===false){ tbNode.classList.add('tb-noline'); } else { tbNode.classList.remove('tb-noline'); }
        }
        tbNode.style.display=(TB.on===false)?'none':'';
      }
      var SP=SEC.serviceProcess||{}; var spNode=document.querySelector('[data-sec="serviceProcess"]');
      if(spNode){
        var _spe=spNode.querySelector('.eyebrow'); if(_spe) _spe.textContent=(SP.eyebrow!=null?SP.eyebrow:'How it works');
        var _sph=spNode.querySelector('h2'); if(_sph) _sph.textContent=(SP.heading!=null?SP.heading:'How It Works');
        var _spi=spNode.querySelector('.section-head p'); if(_spi){ var _spiv=(SP.intro!=null?SP.intro:''); _spi.textContent=_spiv; _spi.style.display=_spiv?'':'none'; }
        var _spd=[{title:'Call Us',text:'Tell us what\u2019s going on. We\u2019ll book a time that suits you.',icon:'phone-call'},{title:'We Inspect',text:'We assess the job on site and explain your options.',icon:'clipboard-list'},{title:'Fixed Price Quote',text:'A clear, upfront price before any work starts.',icon:'file-text'},{title:'Work Completed',text:'Tidy, professional work done right the first time.',icon:'check-circle'},{title:'Satisfaction Guaranteed',text:'We\u2019re not happy until you are.',icon:'shield'}];
        var _spit=(Array.isArray(SP.steps)&&SP.steps.length)?SP.steps:_spd;
        var _spg=spNode.querySelector('.sp-steps');
        var _spAlign=(SP.textAlign==='center'||SP.textAlign==='right')?SP.textAlign:'left';
        var _spArrowOn=SP.arrowsOn!==false;
        var _spArrowSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';
        if(_spg){
          var _spVis=_spit.filter(function(s){return s&&s.on!==false&&((s.title&&String(s.title).trim())||(s.text&&String(s.text).trim())||(s.icon&&String(s.icon).trim()));});
          var _spParts=[];
          _spVis.forEach(function(s,i){
            var _ic=lpIcon(s.icon);
            _spParts.push('<div class="sp-step align-'+_spAlign+'"><div class="sp-media"><div class="sp-num">'+(i+1)+'</div>'+(_ic?'<div class="sp-ic">'+_ic+'</div>':'')+'</div><div class="sp-body">'+(s.title?'<h3 class="sp-title">'+esc(s.title)+'</h3>':'')+(s.text?'<p class="sp-text">'+esc(s.text)+'</p>':'')+'</div></div>');
            if(_spArrowOn&&i<_spVis.length-1) _spParts.push('<div class="sp-arrow" aria-hidden="true">'+_spArrowSvg+'</div>');
          });
          _spg.innerHTML=_spParts.join('');
          _spg.classList.toggle('sp-no-arrows', !_spArrowOn);
        }
        function _spHex(v){ v=String(v||'').trim(); if(/^#?[0-9a-fA-F]{3}$/.test(v)){ v=v.charAt(0)==='#'?v:'#'+v; return '#'+v.charAt(1)+v.charAt(1)+v.charAt(2)+v.charAt(2)+v.charAt(3)+v.charAt(3); } if(/^#?[0-9a-fA-F]{6}$/.test(v)) return v.charAt(0)==='#'?v:'#'+v; return ''; }
        function _spSet(name,val){ if(val) spNode.style.setProperty(name,val); else spNode.style.removeProperty(name); }
        _spSet('--sp-eyebrow', _spHex(SP.eyebrowColor));
        _spSet('--sp-heading', _spHex(SP.titleColor));
        _spSet('--sp-intro', _spHex(SP.introColor));
        _spSet('--sp-step-title', _spHex(SP.stepTitleColor));
        _spSet('--sp-detail', _spHex(SP.textColor));
        _spSet('--sp-num-bg', _spHex(SP.numBg));
        _spSet('--sp-num-fg', _spHex(SP.numFg));
        _spSet('--sp-icon', _spHex(SP.iconColor));
        _spSet('--sp-arrow', _spHex(SP.arrowColor)||_spHex(SP.iconColor));
        spNode.style.setProperty('--sp-align', _spAlign);
        var _spSizes={compact:32,standard:42,large:56,hero:72}; var _spBase=_spSizes[SP.iconSize]||42; var _spSc=parseInt(SP.iconScale,10); if(isNaN(_spSc)) _spSc=100; var _spPx=Math.round(_spBase*Math.max(50,Math.min(250,_spSc))/100);
        spNode.style.setProperty('--sp-num-size', _spPx+'px');
        spNode.style.setProperty('--sp-ic-size', Math.round(_spPx*0.78)+'px');
        spNode.style.display=(SP.on===false)?'none':'';
      }
      var FS=SEC.featureStrip||{}; var fsNode=document.querySelector('[data-sec="featureStrip"]');
      if(fsNode){
        var _fse=fsNode.querySelector('.eyebrow'); if(_fse) _fse.textContent=(FS.eyebrow!=null?FS.eyebrow:'Why choose us');
        var _fsh=fsNode.querySelector('h2'); if(_fsh) _fsh.textContent=(FS.heading!=null?FS.heading:'What sets us apart');
        var _fsi=fsNode.querySelector('.section-head p'); if(_fsi){ var _fsiv=(FS.intro!=null?FS.intro:''); _fsi.textContent=_fsiv; _fsi.style.display=_fsiv?'':'none'; }
        var _fsd=[{title:'Local Knowledge',text:'We understand the soil, weather and regional conditions so gardens thrive.',icon:'map-pin'},{title:'Complete Project Delivery',text:'One team for design, construction, planting and finishes — start to finish.',icon:'settings'},{title:'Practical Design',text:'Beautiful spaces that are functional, maintainable and suited to your lifestyle.',icon:'leaf'},{title:'Reliable Communication',text:'Clear quotes, realistic timeframes and regular updates every step of the way.',icon:'message-circle'}];
        var _fsit=(Array.isArray(FS.items)&&FS.items.length)?FS.items:_fsd;
        var _fsg=fsNode.querySelector('.fstr-grid');
        var _fsAlign=(FS.textAlign==='center'||FS.textAlign==='right')?FS.textAlign:'left';
        var _fsHeadAlign=(FS.headerAlign==='left'||FS.headerAlign==='right')?FS.headerAlign:'center';
        if(_fsg){
          _fsg.innerHTML=_fsit.filter(function(it){return it&&it.on!==false&&((it.title&&String(it.title).trim())||(it.text&&String(it.text).trim())||(it.icon&&String(it.icon).trim()));}).map(function(it){
            var _ic=lpIcon(it.icon);
            return '<div class="fstr-item align-'+_fsAlign+'">'+(_ic?'<div class="fstr-ic">'+_ic+'</div>':'')+'<div class="fstr-body">'+(it.title?'<h3 class="fstr-title">'+esc(it.title)+'</h3>':'')+(it.text?'<p class="fstr-text">'+esc(it.text)+'</p>':'')+'</div></div>';
          }).join('');
        }
        function _fsHex(v){ v=String(v||'').trim(); if(/^#?[0-9a-fA-F]{3}$/.test(v)){ v=v.charAt(0)==='#'?v:'#'+v; return '#'+v.charAt(1)+v.charAt(1)+v.charAt(2)+v.charAt(2)+v.charAt(3)+v.charAt(3); } if(/^#?[0-9a-fA-F]{6}$/.test(v)) return v.charAt(0)==='#'?v:'#'+v; return ''; }
        function _fsSet(name,val){ if(val) fsNode.style.setProperty(name,val); else fsNode.style.removeProperty(name); }
        _fsSet('--fstr-eyebrow', _fsHex(FS.eyebrowColor));
        _fsSet('--fstr-heading', _fsHex(FS.titleColor));
        _fsSet('--fstr-intro', _fsHex(FS.introColor));
        _fsSet('--fstr-item', _fsHex(FS.itemTitleColor));
        _fsSet('--fstr-detail', _fsHex(FS.textColor));
        _fsSet('--fstr-icon', _fsHex(FS.iconColor));
        fsNode.style.setProperty('--fstr-align', _fsAlign);
        fsNode.style.setProperty('--fstr-head-align', _fsHeadAlign);
        var _fsSizes={compact:28,standard:40,large:52,hero:64}; var _fsBase=_fsSizes[FS.iconSize]||40; var _fsSc=parseInt(FS.iconScale,10); if(isNaN(_fsSc)) _fsSc=100; var _fsPx=Math.round(_fsBase*Math.max(50,Math.min(250,_fsSc))/100);
        fsNode.style.setProperty('--fstr-ic-size', _fsPx+'px');
        if(FS.on===true){ fsNode.style.setProperty('display','block','important'); }
        else { fsNode.style.setProperty('display','none','important'); }
      }



      var PR=SEC.promotions||{};
      var _prHero=document.querySelector('[data-sec="promotions-hero"]');
      var _prInlineSec=document.querySelector('[data-sec="promotions-inline"]');
      var _prFloat=document.getElementById('promo-float');
      var _prSticky=document.getElementById('promo-sticky');
      var _prPopup=document.getElementById('promo-popup');
      if(_prHero&&_prInlineSec){
        var _prList=Array.isArray(PR.items)?PR.items:[];
        var _DOW=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        function _prFmtTime(hm){ if(!hm) return ''; var a=String(hm).split(':'); var H=parseInt(a[0],10); var Mn=a[1]||'00'; if(isNaN(H)) return hm; var ap=H>=12?'pm':'am'; var h12=H%12; if(h12===0)h12=12; return h12+(Mn!=='00'?(':'+Mn):'')+ap; }
        function _prActive(p){ var t=p.type;
          if(t==='deadline'){ var x=Date.parse(p.expiry); if(isNaN(x)) return true; return (x-Date.now())>0; }
          if(t==='seasonal'){ var now=Date.now(); var s=Date.parse(p.startDate); if(!isNaN(s)&&now<s) return false; if(p.endDate){ var e=new Date(p.endDate); if(!isNaN(e.getTime())){ e.setHours(23,59,59,999); if(now>e.getTime()) return false; } } return true; }
          if(t==='spots'){ var r=parseInt(p.spotsRemaining,10); if(!isNaN(r)&&r<=0) return false; return true; }
          return true; }
        function _prCd(p){ if(p.type!=='weekly'&&p.type!=='deadline') return ''; var seg=function(cl,lb){return '<span class="cd-seg"><b class="'+cl+'">00</b><i>'+lb+'</i></span>';}; var attrs; if(p.type==='deadline'){ var t=Date.parse(p.expiry); if(isNaN(t)) return ''; attrs='data-mode="fixed" data-target="'+t+'"'; } else { var d=(p.weeklyDay!=null?p.weeklyDay:4); attrs='data-mode="weekly" data-day="'+esc(String(d))+'" data-cut="'+esc(p.weeklyCutoff||'16:00')+'"'; } return '<div class="promo-cd" '+attrs+'>'+seg('cd-d','days')+seg('cd-h','hrs')+seg('cd-m','min')+seg('cd-s','sec')+'</div>'; }
        function _prExtra(p){ var t=p.type;
          if(t==='spots'){ var tot=parseInt(p.spotsTotal,10); var rem=parseInt(p.spotsRemaining,10); if(isNaN(tot)||tot<=0)tot=10; if(isNaN(rem))rem=tot; if(rem<0)rem=0; if(rem>tot)rem=tot; var pct=Math.round(((tot-rem)/tot)*100); return '<div class="promo-spots"><div class="promo-spots-bar"><span style="width:'+pct+'%"></span></div><div class="promo-spots-lbl">Only '+rem+' of '+tot+' spots left</div></div>'; }
          if(t==='finance'){ var amt=(p.amount!=null&&String(p.amount).trim())?String(p.amount):'$0'; return '<div class="promo-fin"><span class="promo-fin-amt">'+esc(amt)+'</span><span class="promo-fin-per">per week</span></div>'+(p.disclaimer?'<p class="promo-fin-disc">'+esc(p.disclaimer)+'</p>':''); }
          if(t==='socialProof'){ var n=(p.number!=null?String(p.number).trim():''); return n?'<div class="promo-num"><span class="promo-num-n">'+esc(n)+'</span></div>':''; }
          if(t==='firstTime'){ return (p.discountText&&String(p.discountText).trim())?'<div class="promo-badge">'+esc(p.discountText)+'</div>':''; }
          if(t==='suburb'){ var s=(p.suburbs!=null?String(p.suburbs).trim():''); return s?'<p class="promo-suburb">For '+esc(s)+' customers</p>':''; }
          if(t==='mystery'){ return '<div class="promo-mystery"><button type="button" class="promo-reveal">Reveal offer</button><div class="promo-reveal-text" hidden>'+esc(p.revealText||'')+'</div></div>'; }
          return ''; }
        function _prCta(p){ var a=(p.cta&&p.cta.action)||'quote'; var txt=(p.cta&&p.cta.text)?p.cta.text:'Book now'; if(a==='none') return ''; if(a==='call'){ var ph=(typeof SITE_CONFIG!=='undefined'&&SITE_CONFIG.phone)?SITE_CONFIG.phone:''; if(!ph) return ''; return '<a class="promo-cta promo-call" href="tel:'+esc(ph)+'">'+esc(txt)+'</a>'; } return '<a class="promo-cta" href="#quote">'+esc(txt)+'</a>'; }
        function _prInner(p){ var before=''; if(p.type==='weekly'){ var d=(p.weeklyDay!=null?p.weeklyDay:4); before='<p class="promo-before">Book before: '+esc(_DOW[d]||'')+' '+esc(_prFmtTime(p.weeklyCutoff||'16:00'))+'</p>'; } var txt='<div class="promo-text">'+(p.title?'<h3 class="promo-title">'+esc(p.title)+'</h3>':'')+(p.description?'<p class="promo-desc">'+esc(p.description)+'</p>':'')+before+'</div>'; return txt+_prExtra(p)+_prCd(p)+_prCta(p); }
        function _prCard(p,idx){ return '<div class="promo promo-'+((p.style==='card')?'card':'banner')+'" data-promo="'+idx+'"><div class="promo-inner">'+_prInner(p)+'</div></div>'; }
        function _prFirst(place){ for(var i=0;i<_prList.length;i++){ var p=_prList[i]; if(p&&p.on!==false&&_prActive(p)&&((p.placement||'belowHero')===place)) return p; } return null; }
        function _prMountFixed(el,p){ if(!el) return; if(p){ var b=el.querySelector('.promo-fixed-body'); if(b) b.innerHTML=_prInner(p); el.classList.add('shown'); } else { el.classList.remove('shown'); } }
        if(PR.on===false){ _prHero.style.display='none'; _prInlineSec.style.display='none'; if(_prFloat)_prFloat.classList.remove('shown'); if(_prSticky)_prSticky.classList.remove('shown'); if(_prPopup)_prPopup.classList.remove('open'); }
        else {
          var _hh='',_ih='';
          _prList.forEach(function(p,idx){ if(!p||p.on===false||!_prActive(p)) return; var pl=p.placement||'belowHero'; if(pl==='inline')_ih+=_prCard(p,idx); else if(pl==='belowHero')_hh+=_prCard(p,idx); });
          var _hHost=_prHero.querySelector('.promo-host'); var _iHost=_prInlineSec.querySelector('.promo-host');
          if(_hHost)_hHost.innerHTML=_hh; if(_iHost)_iHost.innerHTML=_ih;
          _prHero.style.display=_hh?'':'none'; _prInlineSec.style.display=_ih?'':'none';
          _prMountFixed(_prFloat,_prFirst('floatingBar'));
          _prMountFixed(_prSticky,_prFirst('stickyStrip'));
          var _pp=_prFirst('popup'); if(_prPopup){ if(_pp){ var pb=_prPopup.querySelector('.promo-pop-body'); if(pb) pb.innerHTML=_prInner(_pp); _prPopup.classList.add('open'); } else { _prPopup.classList.remove('open'); } }
        }
      }
      (function(){
        var _body=document.body, _hdr=document.querySelector('header.site');
        function _prNextWeekly(dayIdx,cut){ var a=String(cut||'16:00').split(':'); var H=parseInt(a[0],10)||0,Mn=parseInt(a[1],10)||0; var now=new Date(); var t=new Date(now); t.setHours(H,Mn,0,0); var delta=((dayIdx-now.getDay())+7)%7; t.setDate(now.getDate()+delta); if(t.getTime()<=now.getTime()) t.setDate(t.getDate()+7); return t.getTime(); }
        function _pad(n){ n=Math.floor(n); return (n<10?'0':'')+n; }
        function _prPad(){ var fl=document.getElementById('promo-float'); var st=document.getElementById('promo-sticky'); var fh=(fl&&fl.classList.contains('shown'))?fl.offsetHeight:0; var sh=(st&&st.classList.contains('shown'))?st.offsetHeight:0; var em=document.querySelector('.emerg.emerg-sticky'); var eh=(em&&em.style.display!=='none')?(em.offsetHeight||0):0; document.documentElement.style.setProperty('--promo-float-h',fh?(fh+'px'):'0px'); document.documentElement.style.setProperty('--emerg-sticky-h',eh?(eh+'px'):'0px'); if(_body){ _body.style.paddingTop=fh?fh+'px':''; _body.style.paddingBottom=sh?sh+'px':''; } if(_hdr){ var _top=fh+eh; _hdr.style.top=_top?(_top+'px'):''; } }
        function _prTick(){ var now=Date.now(); document.querySelectorAll('.promo-cd').forEach(function(cd){ var mode=cd.getAttribute('data-mode'); var target; if(mode==='weekly'){ target=_prNextWeekly(parseInt(cd.getAttribute('data-day'),10)||0, cd.getAttribute('data-cut')); } else { target=parseInt(cd.getAttribute('data-target'),10); } if(isNaN(target)) return; var rem=target-now; if(rem<=0){ if(mode!=='weekly'){ var host=cd.closest('.promo')||cd.closest('.promo-fixed')||cd.closest('#promo-popup'); if(host){ if(host.id==='promo-popup') host.classList.remove('open'); else if(host.classList.contains('promo-fixed')) host.classList.remove('shown'); else host.style.display='none'; } } rem=0; } var s=Math.floor(rem/1000); var d=Math.floor(s/86400),H=Math.floor((s%86400)/3600),Mn=Math.floor((s%3600)/60),S=s%60; var e; e=cd.querySelector('.cd-d'); if(e) e.textContent=String(d); e=cd.querySelector('.cd-h'); if(e) e.textContent=_pad(H); e=cd.querySelector('.cd-m'); if(e) e.textContent=_pad(Mn); e=cd.querySelector('.cd-s'); if(e) e.textContent=_pad(S); }); ['promotions-hero','promotions-inline'].forEach(function(sec){ var n=document.querySelector('[data-sec="'+sec+'"]'); if(!n||n.style.display==='none') return; var host=n.querySelector('.promo-host'); if(!host) return; var any=false; host.querySelectorAll('.promo').forEach(function(cc){ if(cc.style.display!=='none') any=true; }); if(!any) n.style.display='none'; }); _prPad(); }
        if(!window.__prTimer){ window.__prTimer=true; setInterval(_prTick,1000); window.addEventListener('resize',_prPad);
          document.addEventListener('click',function(ev){ var t=ev.target; if(!t||!t.closest) return;
            var cc=t.closest('.promo-call'); if(cc){ try{trackEvent('call_click',{location:'promo'});}catch(_e){} }
            var rv=t.closest('.promo-reveal'); if(rv){ var mw=rv.parentNode; var rt=mw&&mw.querySelector('.promo-reveal-text'); if(rt){ rt.hidden=false; } rv.style.display='none'; }
            var cl=t.closest('.promo-close'); if(cl){ var box=cl.closest('.promo-fixed')||cl.closest('#promo-popup'); if(box){ if(box.id==='promo-popup') box.classList.remove('open'); else box.classList.remove('shown'); _prPad(); } }
            if(t.classList&&t.classList.contains('promo-pop-backdrop')){ var pop=document.getElementById('promo-popup'); if(pop) pop.classList.remove('open'); }
            var ct=t.closest('.promo-cta'); if(ct){ var ip=ct.closest('#promo-popup'); if(ip) ip.classList.remove('open'); }
          });
          document.addEventListener('keydown',function(ev){ if(ev.key==='Escape'){ var pop=document.getElementById('promo-popup'); if(pop&&pop.classList.contains('open')) pop.classList.remove('open'); } });
        }
        _prTick();
      })();

    })();
    (function(){ var S=C.sections||{};
      var nmEl=document.querySelector('a.brand .nm'); var _SCb=(typeof SITE_CONFIG!=='undefined'&&SITE_CONFIG)||{}; var BIZ=(_SCb.business||_SCb.name||_SCb.business_name||_SCb.businessName||(nmEl&&nmEl.textContent.trim())||'');
      function tok(s){ return String(s==null?'':s).replace(/\{\{\s*businessName\s*\}\}/g,BIZ); }
      var E=S.emerg||{}; var em=document.querySelector('.emerg');
      if(em){
        var ea=em.querySelector('a')||em.__lpEmergA||document.getElementById('emergCall');
        if(ea) em.__lpEmergA=ea;
        var _emCallOn=(E.callOn!==false);
        if(E.text!=null){
          var _emMsg=String(E.text);
          em.textContent=_emCallOn?(_emMsg+(_emMsg?' ':'')):_emMsg;
          if(_emCallOn&&ea){ ea.style.display=''; em.appendChild(ea); }
        } else if(ea){
          if(_emCallOn){ ea.style.display=''; if(!em.contains(ea)) em.appendChild(ea); }
          else { ea.style.display='none'; }
        }
        function _emHex(v){ v=String(v||'').trim(); if(/^#?[0-9a-fA-F]{3}$/.test(v)){ v=v.charAt(0)==='#'?v:'#'+v; return '#'+v.charAt(1)+v.charAt(1)+v.charAt(2)+v.charAt(2)+v.charAt(3)+v.charAt(3); } if(/^#?[0-9a-fA-F]{6}$/.test(v)) return v.charAt(0)==='#'?v:'#'+v; return ''; }
        var _emSticky=(E.sticky===true);
        var _emTrans=(E.bgTransparent===true||E.bg==='transparent');
        em.classList.toggle('emerg-sticky',_emSticky);
        em.classList.toggle('emerg-transparent',_emTrans);
        document.documentElement.classList.toggle('lp-emerg-sticky',_emSticky);
        if(_emTrans){
          em.style.setProperty('--emerg-bg','transparent');
          em.style.setProperty('background','transparent','important');
        } else {
          var _ebg=_emHex(E.bg);
          if(_ebg){ em.style.setProperty('--emerg-bg',_ebg); em.style.setProperty('background',_ebg,'important'); }
          else { em.style.removeProperty('--emerg-bg'); em.style.removeProperty('background'); }
        }
        var _efg=_emHex(E.fg); if(_efg) em.style.setProperty('--emerg-fg',_efg); else em.style.removeProperty('--emerg-fg');
        if(_emSticky){ em.style.setProperty('position','sticky','important'); em.style.top='var(--promo-float-h,0px)'; }
        else { em.style.removeProperty('position'); em.style.removeProperty('top'); }
        function _emSyncH(){ var _vis=false; try{ _vis=_emSticky&&em&&em.style.display!=='none'&&getComputedStyle(em).display!=='none'; }catch(_e){ _vis=_emSticky; } var _h=_vis?(em.offsetHeight||0):0; document.documentElement.style.setProperty('--emerg-sticky-h',_h?(_h+'px'):'0px'); }
        _emSyncH();
        if(!em.__lpEmResize){ em.__lpEmResize=function(){ _emSyncH(); }; window.addEventListener('resize',em.__lpEmResize,{passive:true}); }
      } else {
        document.documentElement.classList.remove('lp-emerg-sticky');
        document.documentElement.style.setProperty('--emerg-sticky-h','0px');
      }
      var Q=S.quote||{}; var qs=document.querySelector('[data-sec="quote"]'); if(qs){ var _qc=qs.querySelector('.qcard'); if(_qc){ if(Q.formStyle==='feature') _qc.classList.add('qcard-feature'); else _qc.classList.remove('qcard-feature'); }
        (function(){ function _qsc(v){ v=(v==null?'':String(v)).trim(); return (/^#[0-9a-fA-F]{3,8}$/.test(v)||/^[a-zA-Z]{2,20}$/.test(v)||/^rgba?\([0-9.,%\s]+\)$/.test(v))?v:''; } function _qhx(v){ var m=/^#([0-9a-fA-F]{6})$/.exec(String(v||'').trim()); if(!m) return null; var n=parseInt(m[1],16); return [(n>>16)&255,(n>>8)&255,n&255]; } function _qf(name,cls,val){ var c=_qsc(val); if(c){ qs.style.setProperty(name,c); qs.classList.add(cls); } else { qs.style.removeProperty(name); qs.classList.remove(cls); } return c; } _qf('--qf-bg','qf-bg',Q.bg); _qf('--qf-input-bg','qf-ibg',Q.inputBg); _qf('--qf-input-border','qf-ibd',Q.inputBorder); _qf('--qf-label','qf-lbl',Q.label); _qf('--qf-text','qf-txt',Q.text); _qf('--qf-success','qf-suc',Q.success); var _acc=_qf('--qf-accent','qf-acc',Q.accent); _qf('--qf-error','qf-err',Q.error); var _ag=_qhx(Q.accent); if(_ag) qs.style.setProperty('--qf-accent-glow','rgba('+_ag[0]+','+_ag[1]+','+_ag[2]+',.18)'); else qs.style.removeProperty('--qf-accent-glow'); var _eg=_qhx(Q.error); if(_eg) qs.style.setProperty('--qf-error-glow','rgba('+_eg[0]+','+_eg[1]+','+_eg[2]+',.16)'); else qs.style.removeProperty('--qf-error-glow'); var _bt=qs.querySelector('.btn-call'); if(_bt){ var _bbg=_qsc(Q.btnBg),_btx=_qsc(Q.btnText),_bhv=_qsc(Q.btnHover); _bt.style.background=''; _bt.style.color=''; if(_bbg){ qs.style.setProperty('--qf-btn-bg',_bbg); _bt.classList.add('qf-bbg'); } else { qs.style.removeProperty('--qf-btn-bg'); _bt.classList.remove('qf-bbg'); } if(_btx){ qs.style.setProperty('--qf-btn-text',_btx); _bt.classList.add('qf-btxt'); } else { qs.style.removeProperty('--qf-btn-text'); _bt.classList.remove('qf-btxt'); } if(Q.btnHoverOff===true){ var _ob=_bbg||(Q.formStyle==='feature'?'#ffffff':'var(--hivis)'); qs.style.setProperty('--qf-btn-hover',_ob); _bt.classList.add('qf-bhov'); } else if(_bhv){ qs.style.setProperty('--qf-btn-hover',_bhv); _bt.classList.add('qf-bhov'); } else { qs.style.removeProperty('--qf-btn-hover'); _bt.classList.remove('qf-bhov'); } if(Q.btnShadowOff===true||(Q.btnShadowOn!==true&&!_qhx(Q.btnShadow))){ _bt.classList.add('qf-noshadow'); _bt.classList.remove('qf-bsh','has-glow'); qs.style.removeProperty('--qf-btn-shadow'); _bt.style.removeProperty('--btn-call-glow'); } else { _bt.classList.remove('qf-noshadow'); var _bsh=_qhx(Q.btnShadow)||_qhx((C.theme&&C.theme.hivis)||''); if(_bsh){ qs.style.setProperty('--qf-btn-shadow','rgba('+_bsh[0]+','+_bsh[1]+','+_bsh[2]+',.4)'); _bt.style.setProperty('--btn-call-glow','rgba('+_bsh[0]+','+_bsh[1]+','+_bsh[2]+',.4)'); _bt.classList.add('qf-bsh','has-glow'); } else { qs.style.removeProperty('--qf-btn-shadow'); _bt.style.removeProperty('--btn-call-glow'); _bt.classList.remove('qf-bsh','has-glow'); } } } var _eb=qs.querySelector('.eyebrow'); if(_eb) _eb.style.color=_acc||'var(--safety)'; var _fc=qs.querySelector('#formCall'); if(_fc) _fc.style.color=_acc||'var(--pipe)'; })();
        if(Q.sub!=null){ var ls=qs.querySelector('.lead-sub'); if(ls) ls.textContent=Q.sub; }
        if(Array.isArray(Q.points)){ var ul=qs.querySelector('.q-points'); if(ul) ul.innerHTML=Q.points.filter(function(x){return x&&x.text&&x.on!==false;}).map(function(x){return '<li><span class="t">'+(x.icon&&window.LP_ICONS&&window.LP_ICONS[x.icon]?'<svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+window.LP_ICONS[x.icon]+'</svg>':'\u2713')+'</span>'+esc(x.text)+'</li>';}).join(''); }
        if(Q.button!=null){ var bt=qs.querySelector('.btn-call'); if(bt) bt.textContent=Q.button; } var _qLbl=function(forId,val){ if(val==null) return; var _l=qs.querySelector('label[for="'+forId+'"]'); if(_l) _l.textContent=val; }; if(Q.formTitle!=null){ var _qh=qs.querySelector('#quoteForm h3'); if(_qh) _qh.textContent=Q.formTitle; } _qLbl('name',Q.lblName); _qLbl('phone',Q.lblPhone); _qLbl('job',Q.lblJob); _qLbl('suburb',Q.lblSuburb); _qLbl('detail',Q.lblDetail); if(Q.suburbPh!=null){ var _qsb=qs.querySelector('#suburb'); if(_qsb) _qsb.setAttribute('placeholder',Q.suburbPh); } if(Q.detailPh!=null){ var _qdt=qs.querySelector('#detail'); if(_qdt) _qdt.setAttribute('placeholder',Q.detailPh); } if(Q.namePh!=null){ var _qnm=qs.querySelector('#name'); if(_qnm) _qnm.setAttribute('placeholder',Q.namePh); } if(Q.phonePh!=null){ var _qpn=qs.querySelector('#phone'); if(_qpn) _qpn.setAttribute('placeholder',Q.phonePh); } (function(){ function _rq(id,key,df){ var el=qs.querySelector('#'+id); if(!el) return; var on=(Q[key]===true)||(Q[key]==null&&df); if(on) el.setAttribute('required',''); else el.removeAttribute('required'); } _rq('name','reqName',true); _rq('phone','reqPhone',true); _rq('email','reqEmail',true); _rq('job','reqJob',false); _rq('suburb','reqSuburb',false); _rq('detail','reqDetail',false); })(); if(Q.successTitle!=null){ var _qsc=qs.querySelector('#quoteSuccess .big'); if(_qsc) _qsc.textContent=Q.successTitle; } (function(){ var _fine=qs.querySelector('.q-fine'); if(!_fine) return; var _ph=(typeof SITE_CONFIG!=='undefined'&&SITE_CONFIG.phone)?SITE_CONFIG.phone:''; var _lead=(Q.fineText!=null?Q.fineText:'Genuine emergency? Don’t wait —'); var _ct=(Q.callText!=null&&String(Q.callText).trim())?Q.callText:'call us now'; var _on=(Q.callOn!==false); if(!_on||!_ph){ _fine.textContent=_lead; return; } _fine.innerHTML=esc(_lead)+(_lead?' ':'')+'<a id="formCall" href="tel:'+esc(_ph)+'" style="color:var(--pipe);font-weight:700">'+esc(_ct)+'</a>.'; var _fc=_fine.querySelector('#formCall'); if(_fc) _fc.addEventListener('click',function(){ try{ trackEvent('call_click',{location:'quote_form'}); }catch(_e){} }); })();
      try{
        var MB=(C.sections&&C.sections.mobileBar)||null;
        var _bar=document.getElementById('mobileBar');
        if(_bar){
          var _SC=(typeof SITE_CONFIG!=='undefined')?SITE_CONFIG:{};
          var _rawPhone=_SC.phone||'';
          var _dig=function(s){return String(s||'').replace(/[^0-9+]/g,'');};
          var _wa=function(s){return String(s||'').replace(/[^0-9]/g,'');};
          var _track=function(ev,extra){ try{ trackEvent(ev,extra||{location:'mobile_bar'}); }catch(_e){} };
          var _lpmWasOpen=!!document.querySelector('.lpm-panel.lpm-open');
          Array.prototype.forEach.call(document.querySelectorAll('.lpm-backdrop,.lpm-panel'),function(_oe){ if(_oe.parentNode) _oe.parentNode.removeChild(_oe); });
          var _btns=[]; var _menuExtras=[];
          var _menuOn=!!(MB&&MB.on!==false&&MB.menu&&MB.menu.on);
          if(MB && MB.on!==false){
            var B=MB.buttons||{};
            var _c=B.call||{}; if(_c.on!==false){ var _cn=(_c.source==='custom'&&_dig(_c.number))?_dig(_c.number):_dig(_rawPhone); if(_cn) _btns.push({href:'tel:'+_cn,icon:_c.icon||'phone',label:_c.label||'Call',ev:'call_click'}); }
            var _d=B.directions||{}; if(_d.on){ var _addr=String(_d.address||'').trim()||_SC.address||_SC.businessName||''; _btns.push({href:'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(_addr),target:'_blank',icon:_d.icon||'navigation',label:_d.label||'Directions',ev:'directions_click'}); }
            var _m=B.message||{}; if(_m.on){ var _mh=(_m.kind==='whatsapp')?('https://wa.me/'+_wa(_m.number||_rawPhone)):('sms:'+_dig(_m.number||_rawPhone)); _btns.push({href:_mh,target:(_m.kind==='whatsapp'?'_blank':''),icon:_m.icon||(_m.kind==='whatsapp'?'whatsapp':'message-circle'),label:_m.label||'Text',ev:'message_click'}); }
            var _ml=B.mail||{}; if(_ml.on){ _btns.push({scroll:1,icon:_ml.icon||'mail',label:_ml.label||'Enquire',ev:'mail_click'}); }
            (MB.extras||[]).forEach(function(x){ if(!x||x.on===false) return; var t=x.type||'link', v=String(x.value||'').trim(), href,target='',ev,dic; if(t==='social'){ if(!v) return; href=v; target='_blank'; ev='social_click'; dic='share-2'; } else if(t==='whatsapp'){ href='https://wa.me/'+_wa(v||_rawPhone); target='_blank'; ev='message_click'; dic='whatsapp'; } else if(t==='sms'){ href='sms:'+_dig(v||_rawPhone); ev='message_click'; dic='message-circle'; } else { if(!v) return; href=v; target=(x.opens==='_blank'?'_blank':'_self'); ev='custom_click'; dic='external-link'; } var _xb={href:href,target:target,icon:x.icon||dic,label:x.label||'',ev:ev}; if(x.inMenu&&_menuOn){ _menuExtras.push(_xb); } else { _btns.push(_xb); } });
            if(_menuOn){ var _MM=MB.menu; _btns.push({menu:1,icon:_MM.triggerIcon||'menu',label:_MM.triggerLabel||'Menu',image:(_MM.trigger==='image'?(_MM.triggerImage||''):'')}); }
          }
          if(_btns.length){
            _bar.className='mobile-call lab-'+((MB.labelMode==='beside'||MB.labelMode==='icon')?MB.labelMode:'under');
            _bar.style.display='';
            _bar.innerHTML='<div class="mc-row">'+_btns.map(function(b){ if(b.menu){ var _mi=(b.image?'<img class="mc-img" src="'+esc(b.image)+'" alt="">':lpIcon(b.icon))+(b.label?'<span>'+esc(b.label)+'</span>':''); return '<button type="button" class="mc-btn" data-mc-menu="1">'+_mi+'</button>'; } var _in=lpIcon(b.icon)+(b.label?'<span>'+esc(b.label)+'</span>':''); if(b.scroll){ return '<button type="button" class="mc-btn" data-mc-scroll="1" data-mc-ev="'+b.ev+'">'+_in+'</button>'; } var _t=b.target?(' target="'+b.target+'" rel="noopener"'):''; return '<a class="mc-btn" href="'+esc(b.href)+'"'+_t+' data-mc-ev="'+b.ev+'">'+_in+'</a>'; }).join('')+'</div>';
            if(MB.bg){ _bar.style.background=MB.bg; }
            Array.prototype.forEach.call(_bar.querySelectorAll('[data-mc-ev]'),function(el){ el.addEventListener('click',function(ev){ if(el.getAttribute('data-mc-scroll')){ ev.preventDefault(); var t=document.querySelector('[data-sec="quote"]')||document.getElementById('quoteForm'); if(t&&t.scrollIntoView) t.scrollIntoView({behavior:'smooth',block:'start'}); } _track(el.getAttribute('data-mc-ev')); }); });
            if(_menuOn){ try{
              var M=MB.menu; var _items=(MB.menuItems||[]).filter(function(it){return it&&it.on!==false;});
              var _bd=document.createElement('div'); _bd.className='lpm-backdrop';
              var _pn=document.createElement('div');
              var _sty=(M.style==='mega')?'mega':'drawer';
              var _cls='lpm-panel lpm-'+_sty; if(_sty==='drawer') _cls+=' lpm-'+(M.side==='left'?'left':'right');
              if(M.bgType==='image'&&M.bgImage){ _cls+=' bg-img'; } else if(M.bgType==='transparent'){ _cls+=' bg-trans'; }
              _pn.className=_cls;
              if(M.bgType==='image'&&M.bgImage){ _pn.style.backgroundImage='url("'+String(M.bgImage).replace(/"/g,'')+'")'; } else if(M.bgType!=='transparent'){ var _bgc=String(M.bgColour||'').trim(); if(/^[0-9a-fA-F]{6}$/.test(_bgc)||/^[0-9a-fA-F]{3}$/.test(_bgc)) _bgc='#'+_bgc; _pn.style.background=_bgc||'#11161f'; }
              var _ih=_items.map(function(it){ var _ic=lpIcon(it.icon||'chevron-right'); var _lb='<span>'+esc(it.label||'')+'</span>'; var _ty=it.type||'link';
                if(_ty==='call'){ return '<a class="lpm-item" href="tel:'+_dig(_rawPhone)+'" data-lpm data-lpm-type="call" data-lpm-label="'+esc(it.label||'')+'">'+_ic+_lb+'</a>'; }
                if(_ty==='scroll'){ return '<button type="button" class="lpm-item" data-lpm data-lpm-type="scroll" data-lpm-target="'+esc(String(it.value||'').replace(/^#/,''))+'" data-lpm-label="'+esc(it.label||'')+'">'+_ic+_lb+'</button>'; }
                if(_ty==='quote'){ return '<button type="button" class="lpm-item" data-lpm data-lpm-type="quote" data-lpm-target="quote" data-lpm-label="'+esc(it.label||'')+'">'+_ic+_lb+'</button>'; }
                var _v=String(it.value||'').trim(); var _tg=(it.opens==='_blank'?' target="_blank" rel="noopener"':''); return '<a class="lpm-item" href="'+esc(_v)+'"'+_tg+' data-lpm data-lpm-type="link" data-lpm-label="'+esc(it.label||'')+'">'+_ic+_lb+'</a>';
              }).join('');
              if(_menuExtras.length){ _ih += _menuExtras.map(function(b){ var _ic2=lpIcon(b.icon||'chevron-right'); var _lb2='<span>'+esc(b.label||'')+'</span>'; var _tg2=(b.target==='_blank'?' target="_blank" rel="noopener"':''); return '<a class="lpm-item" href="'+esc(b.href)+'"'+_tg2+' data-lpm data-lpm-type="link" data-lpm-label="'+esc(b.label||'')+'">'+_ic2+_lb2+'</a>'; }).join(''); }
              _pn.innerHTML='<button type="button" class="lpm-close" aria-label="Close menu">'+lpIcon('x')+'</button>'+(_sty==='mega'?'<div class="lpm-grid">'+_ih+'</div>':_ih);
              document.body.appendChild(_bd); document.body.appendChild(_pn);
              var _open=function(){ _bd.classList.add('lpm-open'); _pn.classList.add('lpm-open'); _track('menu_open'); }; if(_lpmWasOpen){ setTimeout(function(){ _bd.classList.add('lpm-open'); _pn.classList.add('lpm-open'); },0); }
              var _close=function(){ _bd.classList.remove('lpm-open'); _pn.classList.remove('lpm-open'); };
              _bd.addEventListener('click',_close);
              var _cbtn=_pn.querySelector('.lpm-close'); if(_cbtn) _cbtn.addEventListener('click',_close);
              Array.prototype.forEach.call(_pn.querySelectorAll('[data-lpm]'),function(el){ el.addEventListener('click',function(ev){ var t=el.getAttribute('data-lpm-type'); if(t==='scroll'||t==='quote'){ ev.preventDefault(); var nm=el.getAttribute('data-lpm-target'); var tg=nm?document.querySelector('[data-sec="'+nm+'"]'):null; if(tg&&tg.scrollIntoView) tg.scrollIntoView({behavior:'smooth',block:'start'}); } _close(); _track('menu_click',{type:t,label:el.getAttribute('data-lpm-label')||''}); }); });
              var _mtrig=_bar.querySelector('[data-mc-menu]'); if(_mtrig) _mtrig.addEventListener('click',function(){ (_pn.classList.contains('lpm-open')?_close:_open)(); });
            }catch(_menErr){} }
          } else { _bar.style.display='none'; _bar.innerHTML=''; }
        }
      }catch(_mbErr){}
      }
      var F=S.footer||{}; var ft=document.querySelector('footer.site'); if(ft){
        var blurbText=F.blurb!=null?String(tok(F.blurb)).trim():'';
        var legalText=F.legal!=null?String(tok(F.legal)).trim():'';
        var fp=ft.querySelector('.foot-blurb')||ft.querySelector('.foot-grid p');
        if(fp){ if(F.blurb!=null) fp.textContent=blurbText; else blurbText=String(fp.textContent||'').trim(); fp.hidden=!blurbText; fp.classList.add('foot-blurb'); }
        else blurbText='';
        var fl=ft.querySelector('.foot-legal:not(.foot-privacy)');
        if(fl){ if(F.legal!=null) fl.textContent=legalText; else legalText=String(fl.textContent||'').trim(); fl.hidden=!legalText; }
        else legalText='';
        ft.classList.toggle('foot-no-blurb',!blurbText);
        ft.classList.toggle('foot-no-legal',!legalText);
        ft.classList.toggle('foot-meta-empty',!blurbText&&!legalText);
        var cols=ft.querySelectorAll('.foot-grid > div');
        var callCol=ft.querySelector('.foot-call')||(cols.length>1?cols[1]:null);
        if(callCol){
          callCol.classList.add('foot-call');
          if(F.callTitle!=null){ var h4c=callCol.querySelector('h4'); if(h4c) h4c.textContent=String(F.callTitle).trim()||'Call us'; }
          if(Array.isArray(F.callItems)){
            var callTitle=(F.callTitle!=null&&String(F.callTitle).trim())?String(F.callTitle).trim():((callCol.querySelector('h4')&&callCol.querySelector('h4').textContent)||'Call us');
            var ci=F.callItems.filter(function(s){return s&&s.label&&s.on!==false;});
            callCol.innerHTML='<h4>'+esc(callTitle)+'</h4>'+ci.map(function(s){return '<a href="'+esc(s.href||'#')+'">'+esc(s.label)+'</a>';}).join('');
          }
        }
        if(Array.isArray(F.services)){ var col=cols[cols.length-1]; if(col){ var h4=col.querySelector('h4'); var lk=F.services.filter(function(s){return s&&s.label&&s.on!==false;}); col.innerHTML=(h4?h4.outerHTML:'<h4>Services</h4>')+lk.map(function(s){return '<a href="'+esc(s.href||'#quote')+'">'+esc(s.label)+'</a>';}).join(''); } }
      }
    })();
    (function(){ var S=C.sections||{};
      var H=S.header||{};
      var hp=document.querySelector('.head-phone small'); if(hp&&H.cta!=null) hp.textContent=H.cta;
      var hc=document.getElementById('headCall'); if(hc&&H.button!=null) hc.textContent=H.button;
      var _hcw=document.querySelector('.head-call'); if(_hcw) _hcw.style.display=(H.on===false)?'none':'';
      var _hph=document.querySelector('.head-phone'); if(_hph) _hph.style.display=(H.showPhone===false)?'none':'';
      if(hc){ if(H.action==='form'){ hc.setAttribute('href','#quote'); } else { hc.setAttribute('href','tel:'+(C.phone||((typeof SITE_CONFIG!=='undefined'&&SITE_CONFIG.phone)||''))); }
        (function(){ function _hx(v){ var m=/^#([0-9a-fA-F]{6})$/.exec(String(v||'').trim()); if(!m) return null; var n=parseInt(m[1],16); return [(n>>16)&255,(n>>8)&255,n&255]; }
          if(H.glowOn===true){ var _g=_hx(H.glowColor)||_hx((C.theme&&C.theme.hivis)||'')||[0,0,0]; hc.style.setProperty('--btn-call-glow','rgba('+_g[0]+','+_g[1]+','+_g[2]+',.4)'); hc.classList.add('has-glow'); hc.style.boxShadow=''; }
          else { hc.classList.remove('has-glow'); hc.style.removeProperty('--btn-call-glow'); hc.style.boxShadow='none'; }
        })();
      }
      var Q=S.quote||{}; var qs=document.querySelector('[data-sec="quote"]');
      if(qs){
        if(Q.formTitle!=null){ var qh=qs.querySelector('.qcard h3'); if(qh) qh.textContent=Q.formTitle; }
        var lmap={name:'lblName',phone:'lblPhone',job:'lblJob',suburb:'lblSuburb',detail:'lblDetail'};
        Object.keys(lmap).forEach(function(k){ var v=Q[lmap[k]]; if(v!=null){ var lb=qs.querySelector('label[for="'+k+'"]'); if(lb) lb.textContent=v; } });
        if(Array.isArray(Q.jobOptions)){ var sel=qs.querySelector('#job'); if(sel) sel.innerHTML=Q.jobOptions.filter(function(o){return o&&o.text&&o.on!==false;}).map(function(o){return '<option>'+esc(o.text)+'</option>';}).join(''); }
        if(Q.successTitle!=null){ var bg=qs.querySelector('.q-success .big'); if(bg) bg.textContent=Q.successTitle; } if(Q.successSub!=null){ var _bs=qs.querySelector('.q-success p'); if(_bs) _bs.textContent=Q.successSub; }
      }
      ;(function(){ var SE=(C.sections&&C.sections.seoTokens)||{};
        var bn=document.querySelector('a.brand .nm'); var _SCn=(typeof SITE_CONFIG!=='undefined'&&SITE_CONFIG)||{}; var brand=(_SCn.business||_SCn.name||_SCn.business_name||_SCn.businessName||(bn&&bn.textContent.trim())||'');
        var phone=((typeof SITE_CONFIG!=='undefined'&&SITE_CONFIG.phone)||(C&&(C.phoneText||C.phone))||'');
        var areas=(C.sections&&C.sections.serviceAreas&&Array.isArray(C.sections.serviceAreas.areas))?C.sections.serviceAreas.areas.filter(function(a){return a&&a.on!==false&&a.name;}).map(function(a){return String(a.name).trim();}):[];
        var suburb=(SE.suburb||SE.city||'');
        if(SE.enableUrlSuburb){ try{ var qp=new URLSearchParams(window.location.search); var rq=qp.get('suburb'); if(rq){ var mt=areas.filter(function(n){return n.toLowerCase()===String(rq).toLowerCase();})[0]; if(mt) suburb=mt; } }catch(_e){} }
        var tok={business:brand,trade:(SE.trade||''),city:(SE.city||''),region:(SE.region||''),suburb:suburb,suburbs:areas.join(', '),phone:phone,year:String(new Date().getFullYear())};
        function mg(str){ return String(str).replace(/\{(\w+)\}/g,function(m,k){ return (k in tok)?tok[k]:m; }); }
        var root=document.getElementById('top');
        if(root){ var wk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null); var nn,ls=[]; while(nn=wk.nextNode()){ if(nn.nodeValue&&/\{\w+\}/.test(nn.nodeValue)) ls.push(nn); } ls.forEach(function(nd){ var v=nd.nodeValue,nv=mg(v); if(nv!==v) nd.nodeValue=nv; }); }
        if(SE.updateTitle){ var tt=mg(SE.titleTemplate||'{trade} in {suburb} | {business}').replace(/\s*\|\s*$/,'').replace(/^\s*\|\s*/,'').replace(/\s{2,}/g,' ').trim(); if(tt) document.title=tt; }
      })();
    })();
    try{ var __OPTV=['navMenu','beforeAfter','responseCards','projectStats','serviceAreas','reviewHighlights','featuredProjects','featureStrip','specialOffer','heroBeforeAfter','heroSlider','splitHero','activityCounter','proofStream','projectFeed','jobsFeed','beforeAfterFeed','videoReels','activityTimeline','customerReactions','textBox']; var __OS=C.sections||{}; __OPTV.forEach(function(__id){ var __n=document.querySelector('[data-sec="'+__id+'"]'); if(!__n) return; var __s=__OS[__id]; if(__s&&__s.on===true){ __n.style.setProperty('display','block','important'); } else if(__s&&__s.on===false){ __n.style.setProperty('display','none','important'); } }); }catch(e){}
    try{ applySectionAppearances(C); }catch(e){}
    /* preview-only section name labels (backend preview iframe carries ?preview=; never the live site) */
    try{
      var __PV=false; try{ __PV=/[?&]preview=/.test(location.search); }catch(_p){}
      var __LB={emerg:'Top Bar',hero:'Hero',heroSlider:'Hero Slider',heroBeforeAfter:'Hero Before/After Slider',trustBar:'Trust Bar',services:'Services',serviceProcess:'Service Process',featureStrip:'Feature Strip',why:'Why Us',area:'Service Area',reviews:'Reviews',promotions:'Promotions',certifications:'Certifications',finance:'Finance Options',estimateBuilder:'Estimate Builder',onlineQuote:'Online Quote',serviceAreaMap:'Service Area Map',emergencyAvailability:'Emergency Availability',crew:'Team Members',quote:'Quote Form',faq:'FAQ',footer:'Footer',beforeAfter:'Before & After',responseCards:'Response Cards',projectStats:'Project Stats',serviceAreas:'Service Areas',reviewHighlights:'Review Highlights',featuredProjects:'Project Portfolio',specialOffer:'Special Offer',splitHero:'Split Hero',activityCounter:'Activity Counter',proofStream:'Proof Stream',projectFeed:'Project Feed',jobsFeed:'Jobs Feed',beforeAfterFeed:'Before/After Feed',videoReels:'Video Reels',activityTimeline:'Activity Timeline',customerReactions:'Customer Reactions',textBox:'Text Box'};
      if(!__PV){ document.querySelectorAll('.lp-seclabel').forEach(function(__x){ __x.remove(); }); }
      else{
        if(!document.getElementById('lp-seclabel-css')){ var __st=document.createElement('style'); __st.id='lp-seclabel-css'; __st.textContent='.lp-seclabel{position:absolute;top:0;left:0;z-index:99999;background:#111;color:#fff;font:700 11px/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.04em;text-transform:uppercase;padding:4px 9px;border-radius:0 0 9px 0;pointer-events:none;opacity:.94;box-shadow:0 2px 8px rgba(0,0,0,.35);max-width:92%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'; document.head.appendChild(__st); }
        document.querySelectorAll('[data-sec]').forEach(function(__sec){
          var __id=__sec.getAttribute('data-sec'); if(!__id) return;
          var __vis=true; try{ var __cs=getComputedStyle(__sec); if(__cs.display==='none'||__cs.visibility==='hidden') __vis=false; }catch(_v){}
          var __old=__sec.querySelector(':scope > .lp-seclabel');
          if(!__vis){ if(__old) __old.remove(); return; }
          if(getComputedStyle(__sec).position==='static') __sec.style.position='relative';
          if(!__old){ __old=document.createElement('div'); __old.className='lp-seclabel'; __sec.appendChild(__old); }
          __old.textContent=(__LB[__id]||__id);
        });
      }
    }catch(e){}
}
  function _lpMd(t){ return esc(t).replace(/^### (.*)$/gm,'<h3>$1</h3>').replace(/^## (.*)$/gm,'<h2>$1</h2>').replace(/^# (.*)$/gm,'<h2>$1</h2>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/^- (.*)$/gm,'<li>$1</li>').replace(/(<li>[\s\S]*?<\/li>)/g,'<ul>$1</ul>').replace(/\n{2,}/g,'</p><p>').replace(/^(?!<[hul])(.+)$/gm,'$1'); }
  function _lpIsPreview(){ try{ return /[?&]preview=/.test(location.search); }catch(e){ return false; } }
  function _lpLiveCfg(){ return window.__lpLiveCfg||SITE_CONFIG; }
  function _lpActivePage(cfg){ try{ cfg=cfg||_lpLiveCfg(); var pages=(cfg&&cfg.pages)||[]; if(!pages.length) return null; var qp=''; try{ qp=new URLSearchParams(location.search).get('page')||''; }catch(e){} var seg=location.pathname.replace(/\/+$/,'').split('/').pop()||''; var slug=String(qp||seg||'').toLowerCase(); if(!slug) return null; var prev=_lpIsPreview(); for(var i=0;i<pages.length;i++){ var p=pages[i]; if(!p||String(p.slug||'').toLowerCase()!==slug) continue; if(p.status==='published'||prev) return p; } return null; }catch(e){ return null; } }
  function _lpPageHasApps(p){ return !!(p&&Array.isArray(p.pageApps)&&p.pageApps.length); }
  function _lpTopTemplate(){ if(!window.__lpTopTpl){ var m=document.getElementById('top'); if(m) window.__lpTopTpl=m.innerHTML; } return window.__lpTopTpl||''; }
  function _lpPageStyleOnce(){ if(document.getElementById('lp-page-style')) return; var st=document.createElement('style'); st.id='lp-page-style'; st.textContent='.lp-page{padding:52px 0 72px;background:var(--light,#eef2f6)}.lp-wrap{max-width:var(--maxw,1440px);margin:0 auto;padding:0 22px;color:var(--ink,#141a24)}.lp-text{max-width:880px;margin:0 auto}.lp-img-wrap-left .lp-text,.lp-img-wrap-right .lp-text{max-width:none;margin:0;overflow:hidden}.lp-page h1{font-size:clamp(28px,5vw,44px);line-height:1.12;margin:0 0 20px;color:var(--lp-h1,var(--ink,#141a24))}.lp-body{font-size:17px;line-height:1.7;color:var(--lp-p,inherit)}.lp-body h2{font-size:25px;margin:30px 0 10px;color:var(--lp-h2,inherit)}.lp-body h3{font-size:19px;margin:22px 0 8px;color:var(--lp-h2,inherit)}.lp-body p,.lp-body li{color:var(--lp-p,inherit)}.lp-body ul{padding-left:20px;margin:12px 0}.lp-body li{margin:6px 0}.lp-body p{margin:14px 0}.lp-figure{margin:0 0 22px}.lp-figure img{max-width:100%;height:auto;display:block;border-radius:12px}.lp-img-center .lp-figure img{margin-left:auto;margin-right:auto}.lp-img-right .lp-figure img{margin-left:auto}.lp-img-wrap-left .lp-figure{float:left;max-width:46%}.lp-img-wrap-right .lp-figure{float:right;max-width:46%}.lp-cta{display:flex;gap:12px;flex-wrap:wrap;margin:34px 0 0;clear:both}.lp-btn{display:inline-block;padding:14px 24px;border-radius:11px;font-weight:800;text-decoration:none;font-size:16px}.lp-call{background:var(--hivis,#ff6a1f);color:#fff}.lp-quote{background:transparent;border:2px solid var(--brand,#1f7bb8);color:var(--brand,#1f7bb8)}.lp-clear{clear:both;height:0}@media(max-width:760px){.lp-img-wrap-left .lp-figure,.lp-img-wrap-right .lp-figure{float:none;max-width:100%;margin:0 0 18px}.lp-text{max-width:none}}'; document.head.appendChild(st); }
  function _lpPageMeta(p){ if(p.title) document.title=p.title; if(p.meta){ var m=document.querySelector('meta[name=\"description\"]'); if(!m){ m=document.createElement('meta'); m.setAttribute('name','description'); document.head.appendChild(m); } m.setAttribute('content',p.meta); } }
  function _lpArticleBlock(p){ _lpPageStyleOnce(); var cfg=_lpLiveCfg(), phone=(cfg&&cfg.phone)||''; var _sc=(p.showCall!==false)&&!!phone; var _sq=(p.showQuote!==false); var _ctaIn=(_sc?'<a class=\"lp-btn lp-call\" href=\"tel:'+esc(String(phone).replace(/[^0-9+]/g,''))+'\">Call '+esc(phone)+'</a>':'')+(_sq?'<a class=\"lp-btn lp-quote\" href=\"'+esc(_siteBase()||'/')+'\">Get a free quote</a>':''); var cta=_ctaIn?('<div class=\"lp-cta\">'+_ctaIn+'</div>'):''; var _im=(p.imgMode||'center'); var _ip=(p.imgPad!=null?p.imgPad:16); var _fm=(_im==='wrap-left')?('0 '+_ip+'px '+_ip+'px 0'):(_im==='wrap-right')?('0 0 '+_ip+'px '+_ip+'px'):('0 0 '+_ip+'px'); var _fig=p.img?('<figure class=\"lp-figure\" style=\"margin:'+_fm+'\"><img src=\"'+esc(p.img)+'\" alt=\"'+esc(p.h1||p.title||'')+'\"></figure>'):''; var _cls='lp-img-'+(p.img?_im:'none'); function _lpHex(v){ v=String(v||'').trim(); if(/^#?[0-9a-fA-F]{3}$/.test(v)){ v=v.charAt(0)==='#'?v:'#'+v; return '#'+v.charAt(1)+v.charAt(1)+v.charAt(2)+v.charAt(2)+v.charAt(3)+v.charAt(3); } if(/^#?[0-9a-fA-F]{6}$/.test(v)) return v.charAt(0)==='#'?v:'#'+v; return ''; } var _st=[]; var _h1=_lpHex(p.h1Color); if(_h1) _st.push('--lp-h1:'+_h1); var _h2=_lpHex(p.h2Color); if(_h2) _st.push('--lp-h2:'+_h2); var _pc=_lpHex(p.paragraphColor); if(_pc) _st.push('--lp-p:'+_pc); var _style=_st.length?(' style=\"'+_st.join(';')+'\"'):''; return '<section class=\"lp-page '+_cls+'\"'+_style+' data-sec=\"__lpArticle\"><div class=\"lp-wrap\"><div class=\"lp-text\">'+(p.h1?'<h1>'+esc(p.h1)+'</h1>':'')+_fig+'<div class=\"lp-body\"><p>'+_lpMd(p.body||'')+'</p></div></div>'+cta+'<div class=\"lp-clear\"></div></div></section>'; }
  function _lpPageLayoutOrder(p){ var apps=(p.pageApps||[]).map(function(a){ return a.key||a.section_key; }).filter(Boolean); var ord=p.pageLayoutOrder; if(!Array.isArray(ord)||!ord.length){ ord=apps.slice(); if(p.h1||p.body) ord.push('__lpArticle'); return ord; } var valid={}; apps.forEach(function(k){ valid[k]=true; }); if(p.h1||p.body) valid['__lpArticle']=true; ord=ord.filter(function(id){ return valid[id]; }); apps.forEach(function(k){ if(ord.indexOf(k)<0) ord.push(k); }); if((p.h1||p.body)&&ord.indexOf('__lpArticle')<0) ord.push('__lpArticle'); return ord; }
  function _lpDeepMergeSec(home, page){
    if(!page||typeof page!=='object') return JSON.parse(JSON.stringify(home||{}));
    if(!home||typeof home!=='object') return JSON.parse(JSON.stringify(page||{}));
    var out=JSON.parse(JSON.stringify(home));
    Object.keys(page).forEach(function(k){
      var pv=page[k], hv=out[k];
      if(Array.isArray(pv)){
        if(pv.length) out[k]=JSON.parse(JSON.stringify(pv));
      } else if(pv&&typeof pv==='object'&&hv&&typeof hv==='object'&&!Array.isArray(hv)){
        out[k]=_lpDeepMergeSec(hv,pv);
      } else if(pv!==undefined&&pv!==null&&pv!=='') out[k]=pv;
    });
    return out;
  }
  function _lpMergedPageConfig(p){ var base=JSON.parse(JSON.stringify(_lpLiveCfg()||{})); if(!base.sections) base.sections={}; (p.pageApps||[]).forEach(function(a){ var k=a.key||a.section_key; if(!k) return; var home=(_lpLiveCfg()&&_lpLiveCfg().sections&&_lpLiveCfg().sections[k])||{}; if(a.mode==='unique'){ var page=(p.pageSections&&p.pageSections[k])||{}; base.sections[k]=Object.keys(page).length?_lpDeepMergeSec(home,page):JSON.parse(JSON.stringify(home)); } else if(Object.keys(home).length){ base.sections[k]=JSON.parse(JSON.stringify(home)); } if(!base.sections[k]) base.sections[k]={}; base.sections[k].on=true; }); base.sectionOrder=_lpPageLayoutOrder(p); return base; }
  function _lpRenderPageHybrid(p){ var main=document.getElementById('top')||document.querySelector('main'); if(!main) return; _lpPageMeta(p); var tpl=_lpTopTemplate(); if(!tpl){ main.innerHTML='<section data-sec=\"navMenu\"></section>'+_lpArticleBlock(p); try{_navMenuRender(_lpMergedPageConfig(p));}catch(e){} try{ window.scrollTo(0,0); }catch(e){} return; } var tmp=document.createElement('div'); tmp.innerHTML=tpl; var html=''; var nm=tmp.querySelector('[data-sec=\"navMenu\"]'); if(nm) html+=nm.outerHTML; _lpPageLayoutOrder(p).forEach(function(id){ if(id==='__lpArticle'){ if(p.h1||p.body) html+=_lpArticleBlock(p); } else { var node=tmp.querySelector('[data-sec=\"'+id+'\"]'); if(node) html+=node.outerHTML; } }); main.innerHTML=html||tpl; var C=_lpMergedPageConfig(p); applyCfg(C); try{_navMenuRender(C);}catch(e){} try{ applySectionAppearances(C); }catch(e){} try{ window.scrollTo(0,0); }catch(e){} }
  function _lpRenderPage(p){ var main=document.getElementById('top')||document.querySelector('main'); if(!main) return; _lpPageMeta(p); if(_lpPageHasApps(p)) return _lpRenderPageHybrid(p); main.innerHTML='<section data-sec=\"navMenu\"></section>'+_lpArticleBlock(p); try{ _navMenuRender(_lpLiveCfg()); }catch(e){} try{ window.scrollTo(0,0); }catch(e){} }
  function _lpFooterApply(C){
    var F=(C&&C.sections&&C.sections.lpFooter)||{};
    var fn=document.getElementById('lpFooter'); if(!fn) return;
    // LeadPages branded strip is always on — logo cannot be removed.
    if(C&&C.sections){ if(!C.sections.lpFooter) C.sections.lpFooter={}; C.sections.lpFooter.on=true; }
    fn.style.display='';
    var accent='';
    if(/^#[0-9a-fA-F]{6}$/.test(F.accent||'')) accent=F.accent;
    else {
      accent=((C&&C.theme&&(C.theme.hivis||C.theme.pipe))||'')+'';
      if(!/^#[0-9a-fA-F]{6}$/.test(accent)) accent='';
    }
    if(!accent) accent='#ff6a1f';
    var ink=(/^#[0-9a-fA-F]{6}$/.test(F.ink||''))?F.ink:'#ffffff';
    var src='/assets/leadpages-logo.svg';
    var host=fn.querySelector('a.lp-foot-link')||fn;
    function _sizeLogo(el){ var sz=(F.size!=null?+F.size:30); if(isNaN(sz))sz=30; sz=Math.max(10,Math.min(200,sz)); if(el){ el.style.height=sz+'px'; el.style.width='auto'; el.style.maxHeight=sz+'px'; } }
    function _paint(el){
      if(!el) return;
      el.classList.add('lp-foot-logo');
      el.setAttribute('data-lp-logo-accent',accent);
      el.setAttribute('data-lp-logo-ink','light');
      el.style.setProperty('--lp-logo-accent',accent);
      el.style.setProperty('--lp-logo-ink',ink);
      _sizeLogo(el);
    }
    function _ensureMounted(done){
      var logo=fn.querySelector('.lp-foot-logo, a.lp-foot-link .lp-logo-wrap, a.lp-foot-link img');
      if(!logo){
        var img=document.createElement('img');
        img.className='lp-foot-logo'; img.alt='LeadPages'; img.src=src;
        img.setAttribute('data-lp-logo','auto'); img.setAttribute('data-lp-logo-pulse','');
        host.appendChild(img); logo=img;
      }
      _paint(logo);
      if(window.LPLogo&&window.LPLogo.mountLogo){
        // Remount if still an <img> so CSS variables actually drive fills.
        if(logo.tagName==='IMG'){
          try{ delete logo.dataset.lpLogoMounted; }catch(_e){}
          window.LPLogo.mountLogo(logo,{pulse:true,ink:ink,accent:accent}).then(function(wrap){
            _paint(wrap||fn.querySelector('.lp-logo-wrap, .lp-foot-logo'));
            if(typeof done==='function') done();
          });
          return;
        }
        _paint(logo);
        // Force tokens again in case a workspace refresh overwrote them.
        window.LPLogo.mountLogo(logo,{pulse:true,ink:ink,accent:accent}).then(function(wrap){ _paint(wrap||logo); if(typeof done==='function') done(); });
        return;
      }
      if(typeof done==='function') done();
    }
    _ensureMounted();
    var bg=(/^#[0-9a-fA-F]{6}$/.test(F.bg||''))?F.bg:'#0e1217';
    var op=(F.bgOpacity!=null?+F.bgOpacity:100); if(isNaN(op))op=100; op=Math.max(0,Math.min(100,op))/100;
    var r=parseInt(bg.slice(1,3),16),g=parseInt(bg.slice(3,5),16),b=parseInt(bg.slice(5,7),16);
    fn.style.background='rgba('+r+','+g+','+b+','+op+')';
    fn.classList.remove('lpf-left','lpf-center','lpf-right'); fn.classList.add('lpf-'+(F.align==='left'?'left':F.align==='right'?'right':'center'));
    fn.style.setProperty('--lp-logo-accent',accent);
    fn.style.setProperty('--lp-logo-ink',ink);
    var txt=fn.querySelector('.lp-foot-txt'); if(txt){ if(F.text&&String(F.text).trim()){ txt.textContent=F.text; txt.style.display=''; txt.style.color='#ffffff'; } else { txt.textContent=''; txt.style.display='none'; } }
  }
  function _lpBoot(){ applyCfg(SITE_CONFIG); window.__lpLiveCfg=SITE_CONFIG; _lpTopTemplate(); try{_lpFooterApply(SITE_CONFIG);}catch(_e){} try{ var _p=_lpActivePage(); if(_p) _lpRenderPage(_p); }catch(e){}  try{_lpRichWalk(document.body);}catch(e){} }
  function _siteBase(){ try{ var path=location.pathname.replace(/\/+$/,''); var seg=path.split('/').pop()||''; var pgs=(SITE_CONFIG&&SITE_CONFIG.pages)||[]; var onPage=pgs.some(function(p){ return p&&p.status==='published'&&String(p.slug||'').toLowerCase()===seg.toLowerCase(); }); if(onPage){ return path.slice(0,path.length-seg.length).replace(/\/+$/,''); } return path; }catch(e){ return ''; } }
  function _navMenuRender(c){ var node=document.querySelector('[data-sec=\"navMenu\"]'); var nm=(c&&c.sections&&c.sections.navMenu)||{}; var _nmBar=document.querySelector('header.site .bar'); function _nmHeaderClear(){ if(!_nmBar) return; _nmBar.classList.remove('hnav-left','hnav-center','hnav-right'); var _ex=_nmBar.querySelectorAll('.head-nav'); for(var _k=_ex.length-1;_k>=0;_k--){ _ex[_k].parentNode.removeChild(_ex[_k]); } } try{ console.log('[navMenu JUN28-R] style:',nm.style,'icons:',nm.icons,'bg:',nm.bg); }catch(_e){} if(!node) return; if(nm.on!==true){ _nmHeaderClear(); node.style.setProperty('display','none','important'); node.innerHTML=''; return; } function _nmIc(v){ if(!v) return ''; v=String(v); var _i=(window.LP_ICONS&&window.LP_ICONS[v]); if(!_i) return ''; return '<svg class=\"lp-ic\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\">'+_i+'</svg>'; } var items=(Array.isArray(nm.items)?nm.items:[]); var base=_siteBase(); var _imode=(nm.icons||'text'); if((nm.placement||'bar')==='header'){ node.style.setProperty('display','none','important'); node.innerHTML=''; if(_nmBar){ _nmHeaderClear(); var _lpos=(c&&c.logo&&c.logo.position)||'left'; var _brand=_nmBar.querySelector('a.brand'); if(_brand){ _brand.style.marginLeft=''; _brand.style.marginRight=''; } var _hbld=function(arr){ return arr.map(function(it){ if(!it) return ''; var label=esc(it.label||''); var ic=(_imode!=='text')?_nmIc(it.icon):''; if(!label&&!ic) return ''; var href='#',ext=false; if(it.target==='external'){ href=esc(it.url||'#'); ext=true; } else if(it.target&&it.target.indexOf('page:')===0){ href=esc((base+'/'+it.target.slice(5)).replace(/\/+/g,'/')); } else { href=esc(base||'/'); } var txt=((_imode==='icon'&&ic)?'':'<span class=\"hn-txt\">'+label+'</span>'); return '<a class=\"hn-link\" href=\"'+href+'\" title=\"'+label+'\"'+(ext?' target=\"_blank\" rel=\"noopener\"':'')+'>'+ic+txt+'</a>'; }).join(''); }; var _hvis=items.filter(function(it){ return it && (it.label||it.icon); }); var _ico=(_imode==='icon')?' nm-icononly':''; _nmBar.classList.add('hnav-'+_lpos); if(_lpos==='center'){ var _mid=Math.ceil(_hvis.length/2); var _nl=document.createElement('nav'); _nl.className='head-nav head-nav-l'+_ico; _nl.innerHTML=_hbld(_hvis.slice(0,_mid)); var _nr=document.createElement('nav'); _nr.className='head-nav head-nav-r'+_ico; _nr.innerHTML=_hbld(_hvis.slice(_mid)); if(_brand){ _nmBar.insertBefore(_nl,_brand); if(_brand.nextSibling){ _nmBar.insertBefore(_nr,_brand.nextSibling); } else { _nmBar.appendChild(_nr); } } } else { var _nv=document.createElement('nav'); _nv.className='head-nav'+_ico; _nv.innerHTML=_hbld(_hvis); if(_lpos==='right'){ _nmBar.insertBefore(_nv,_nmBar.firstChild); } else if(_brand){ if(_brand.nextSibling){ _nmBar.insertBefore(_nv,_brand.nextSibling); } else { _nmBar.appendChild(_nv); } } else { _nmBar.insertBefore(_nv,_nmBar.firstChild); } } } return; } _nmHeaderClear(); var html=items.map(function(it){ if(!it) return ''; var label=esc(it.label||''); var ic=(_imode!=='text')?_nmIc(it.icon):''; if(!label&&!ic) return ''; var href='#', ext=false; if(it.target==='external'){ href=esc(it.url||'#'); ext=true; } else if(it.target&&it.target.indexOf('page:')===0){ href=esc((base+'/'+it.target.slice(5)).replace(/\/+/g,'/')); } else { href=esc(base||'/'); } var txt=((_imode==='icon'&&ic)?'':'<span class=\"nm-txt\">'+label+'</span>'); return '<a class=\"nm-link\" href=\"'+href+'\" title=\"'+label+'\"'+(ext?' target=\"_blank\" rel=\"noopener\"':'')+'>'+ic+txt+'</a>'; }).join(''); var _io=(_imode==='icon'?' nm-icononly':''); node.className='nav-menu-sec nm-'+(nm.style||'pills')+' nm-al-'+(nm.align||'left')+_io; var _bg=(nm.bg||'').trim(); if(_bg){ node.style.setProperty('background',_bg,'important'); } else { node.style.removeProperty('background'); } var _lt=false; if(_bg){ var _hx=_bg.replace('#',''); if(_hx.length===3){ _hx=_hx.charAt(0)+_hx.charAt(0)+_hx.charAt(1)+_hx.charAt(1)+_hx.charAt(2)+_hx.charAt(2); } if(/^[0-9a-fA-F]{6}$/.test(_hx)){ var _r=parseInt(_hx.slice(0,2),16),_g=parseInt(_hx.slice(2,4),16),_b=parseInt(_hx.slice(4,6),16); _lt=(0.2126*_r+0.7152*_g+0.0722*_b)>165; } } node.style.setProperty('--nm-fg',_lt?'#1a2230':'#fff'); node.style.setProperty('--nm-fill',(nm.fill&&nm.fill.trim())?nm.fill.trim():(_lt?'rgba(0,0,0,.07)':'rgba(255,255,255,.13)')); var _stk=(nm.stroke||'').trim(); node.style.setProperty('--nm-stroke',_stk?_stk:(_lt?'rgba(0,0,0,.22)':'rgba(255,255,255,.4)')); node.innerHTML='<nav class=\"nm-inner\">'+html+'</nav>'; node.style.setProperty('display','block','important'); }
    function _lpRich(s){ s=(s==null?'':String(s)); var d=document.createElement('div'); d.textContent=s; return d.innerHTML.replace(/&lt;(\/?)(br|p|b|strong|i|em|u|small|sup|sub|mark)( ?\/?)&gt;/gi,function(m,a,b){ return '<'+a+b.toLowerCase()+'>'; }); }
    function _lpRichWalk(root){ try{ if(!root||!document.createTreeWalker) return; var re=/<\/?(br|p|b|strong|i|em|u|small|sup|sub|mark)\b/i; var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null); var hits=[],n; while((n=w.nextNode())){ var v=n.nodeValue; if(v&&v.indexOf('<')>=0&&re.test(v)){ var pn=n.parentNode, t=pn&&pn.nodeName; if(t&&t!=='SCRIPT'&&t!=='STYLE'&&t!=='TEXTAREA') hits.push(n); } } for(var i=0;i<hits.length;i++){ var tn=hits[i], sp=document.createElement('span'); sp.innerHTML=_lpRich(tn.nodeValue); var fr=document.createDocumentFragment(); while(sp.firstChild) fr.appendChild(sp.firstChild); if(tn.parentNode) tn.parentNode.replaceChild(fr,tn); } }catch(_e){} }
    function _lpSecAppearanceCss(){
      if(document.getElementById('lp-sec-appearance-css')) return;
      var st=document.createElement('style'); st.id='lp-sec-appearance-css';
      st.textContent='[data-sec].lp-sec-has-edge{position:relative;overflow:visible}[data-sec]>.lp-sec-edge{position:absolute;left:0;right:0;height:52px;pointer-events:none;z-index:3;line-height:0}[data-sec]>.lp-sec-edge-top{top:0;margin-top:-1px}[data-sec]>.lp-sec-edge-bottom{bottom:0;margin-bottom:-1px}[data-sec]>.lp-sec-edge svg{width:100%;height:100%;display:block}[data-sec]>.lp-sec-edge-fade.lp-sec-edge-top{background:linear-gradient(to bottom,var(--lp-edge-from),var(--lp-edge-to))}[data-sec]>.lp-sec-edge-fade.lp-sec-edge-bottom{background:linear-gradient(to bottom,var(--lp-edge-from),var(--lp-edge-to))}[data-sec]>.lp-sec-edge-angle.lp-sec-edge-top{background:var(--lp-edge-to);clip-path:polygon(0 100%,100% 0,100% 100%)}[data-sec]>.lp-sec-edge-angle.lp-sec-edge-bottom{background:var(--lp-edge-from);clip-path:polygon(0 0,100% 100%,100% 0)}[data-sec]>.lp-sec-edge-curve.lp-sec-edge-top{background:var(--lp-edge-to);clip-path:ellipse(120% 100% at 50% 100%)}[data-sec]>.lp-sec-edge-curve.lp-sec-edge-bottom{background:var(--lp-edge-from);clip-path:ellipse(120% 100% at 50% 0)}';
      document.head.appendChild(st);
    }
    function _secAppHex(v){ v=String(v||'').trim(); if(!v) return ''; if(/^#[0-9a-fA-F]{3}$/.test(v)) return '#'+v[1]+v[1]+v[2]+v[2]+v[3]+v[3]; return /^#[0-9a-fA-F]{6}$/.test(v)?v:''; }
    function _secAppRgb(node){
      try{ var cs=getComputedStyle(node), bg=cs.backgroundColor; if(bg&&bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent') return bg; }catch(e){}
      return '#eef2f6';
    }
    function _secAppEdge(node,pos,type,fromCol,toCol){
      if(!type||type==='none') return;
      var el=document.createElement('div');
      el.className='lp-sec-edge lp-sec-edge-'+pos+' lp-sec-edge-'+type;
      el.setAttribute('aria-hidden','true');
      el.style.setProperty('--lp-edge-from',fromCol||'transparent');
      el.style.setProperty('--lp-edge-to',toCol||'transparent');
      if(type==='wave'){
        var fc=fromCol||'#eef2f6', tc=toCol||'#eef2f6';
        var d=(pos==='top')
          ?'<svg viewBox="0 0 1200 52" preserveAspectRatio="none" aria-hidden="true"><path fill="'+fc+'" d="M0,0 H1200 V18 C900,52 700,0 500,26 C300,52 120,10 0,30 Z"/><path fill="'+tc+'" d="M0,30 C120,10 300,52 500,26 C700,0 900,52 1200,18 V52 H0 Z"/></svg>'
          :'<svg viewBox="0 0 1200 52" preserveAspectRatio="none" aria-hidden="true"><path fill="'+fc+'" d="M0,0 H1200 V34 C900,0 700,52 500,26 C300,0 120,42 0,22 Z"/><path fill="'+tc+'" d="M0,22 C120,42 300,0 500,26 C700,52 900,0 1200,34 V52 H0 Z"/></svg>';
        el.innerHTML=d;
      }
      if(pos==='top') node.insertBefore(el,node.firstChild); else node.appendChild(el);
      node.classList.add('lp-sec-has-edge');
    }
    function applySectionAppearances(C){
      _lpSecAppearanceCss();
      C=C||{}; var SEC=C.sections||{}, main=document.querySelector('main#top')||document.body;
      var ordered=[];
      if(main){ main.querySelectorAll(':scope > [data-sec]').forEach(function(n){ var id=n.getAttribute('data-sec'); if(id) ordered.push({node:n,id:id}); }); }
      if(!ordered.length) document.querySelectorAll('[data-sec]').forEach(function(n){ var id=n.getAttribute('data-sec'); if(id) ordered.push({node:n,id:id}); });
      var bgs={};
      ordered.forEach(function(it){ bgs[it.id]=_secAppRgb(it.node); });
      ordered.forEach(function(it,idx){
        var n=it.node, id=it.id, ap=(SEC[id]&&SEC[id].appearance)||{};
        n.classList.remove('lp-sec-has-edge');
        n.style.removeProperty('background');
        n.style.removeProperty('border');
        n.style.removeProperty('border-top');
        n.style.removeProperty('border-bottom');
        n.style.removeProperty('border-left');
        n.style.removeProperty('border-right');
        n.removeAttribute('data-lp-sec-bg');
        var edges=n.querySelectorAll(':scope > .lp-sec-edge');
        for(var ei=edges.length-1;ei>=0;ei--) edges[ei].remove();
        if(!ap.custom){ bgs[id]=_secAppRgb(n); return; }
        var bg=_secAppHex(ap.containerBg);
        if(bg){ n.style.setProperty('background',bg,'important'); n.setAttribute('data-lp-sec-bg',bg); bgs[id]=bg; }
        else bgs[id]=_secAppRgb(n);
        var sc=_secAppHex(ap.strokeColor), sw=(ap.strokeWidth!=null?+ap.strokeWidth:0);
        if(isNaN(sw)) sw=0;
        var sides=ap.strokeSides||'both';
        if(sc&&sw>0){
          if(sides==='all') n.style.border=sw+'px solid '+sc;
          else {
            if(sides==='both'||sides==='top') n.style.borderTop=sw+'px solid '+sc;
            if(sides==='both'||sides==='bottom') n.style.borderBottom=sw+'px solid '+sc;
          }
        }
        var prevBg=idx>0?bgs[ordered[idx-1].id]:_secAppRgb(document.body);
        var nextBg=idx<ordered.length-1?bgs[ordered[idx+1].id]:_secAppRgb(document.body);
        var curBg=bgs[id];
        _secAppEdge(n,'top',ap.transitionTop||'none',prevBg,curBg);
        _secAppEdge(n,'bottom',ap.transitionBottom||'none',curBg,nextBg);
      });
    }
    function applyVisitorAppearance(C){
    C=C||{}; var va=C.visitorAppearance||{}, de=document.documentElement;
    if(!va||typeof va!=='object') return;
    var st=va.siteTheme||'classic-light';
    if(!st||st==='classic-light'||st==='match-brand') de.removeAttribute('data-lp-site-theme');
    else de.setAttribute('data-lp-site-theme', st);
    var scheme=va.colorScheme||'brand';
    if(va.allowColorSchemes===false) scheme='brand';
    try{ var _scs=JSON.parse(localStorage.getItem('leadpages_visitor_colour_scheme')||'null'); if(_scs&&va.allowColorSchemes!==false) scheme=_scs; }catch(e){}
    if(scheme==='seasonal'){ var _sm=new Date().getMonth(); scheme=(_sm<=1)?'summer':(_sm<=4)?'autumn':(_sm<=7)?'winter':(_sm<=10)?'spring':'festive'; }
    if(!scheme||scheme==='brand'){ de.removeAttribute('data-lp-visitor-scheme'); de.removeAttribute('data-lp-visitor-scheme-choice'); }
    else { de.setAttribute('data-lp-visitor-scheme', scheme); de.setAttribute('data-lp-visitor-scheme-choice', scheme); }
    var stored=null;
    try{ stored=JSON.parse(localStorage.getItem('leadpages_visitor_accessibility')||'null'); }catch(e){}
    if(!stored){
      de.dataset.lpVisitorText=(va.defaultTextSize==='large')?'large':'standard';
      de.dataset.lpVisitorContrast=(va.defaultContrast==='high')?'high':'standard';
      if(va.reducedMotionSupport!==false) de.dataset.lpVisitorMotion='standard';
    }
  }
    window.__applyTradeConfig=function(_c){ window.__lpLiveCfg=_c; applyCfg(_c); try{applyVisitorAppearance(_c);}catch(_e){} try{if(window.LPVisitorAccessibility&&window.LPVisitorAccessibility.syncFromSiteConfig){window.LPVisitorAccessibility.syncFromSiteConfig(_c);}else if(window.LPVisitorAccessibility&&window.LPVisitorAccessibility.ensureAssets){window.LPVisitorAccessibility.ensureAssets(function(){if(window.LPVisitorAccessibility.syncFromSiteConfig)window.LPVisitorAccessibility.syncFromSiteConfig(_c);});}}catch(_e){} try{_lpFooterApply(_c);}catch(_e){} try{ var _p=_lpActivePage(_c); if(_p) _lpRenderPage(_p); else { var _m=document.getElementById('top'); if(_m&&window.__lpTopTpl) _m.innerHTML=window.__lpTopTpl; applyCfg(_c); } }catch(_e){} _lpRichWalk(document.body); try{ if(window.__lpPreviewChromeHide) window.__lpSetPreviewChrome({hideHeader:window.__lpPreviewChromeHide}); }catch(_e){} };
    window.__lpSetPreviewChrome=function(opts){
      opts=opts||{};
      var hide=!!opts.hideHeader;
      window.__lpPreviewChromeHide=hide;
      var h=document.querySelector('header.site')||document.querySelector('header.nav');
      if(h) h.style.display=hide?'none':'';
      var em=document.querySelector('.emerg');
      if(em) em.style.display=hide?'none':'';
      var st=document.getElementById('lp-prev-chrome-hide-css');
      if(!st&&document.head){ st=document.createElement('style'); st.id='lp-prev-chrome-hide-css'; document.head.appendChild(st); }
      if(st) st.textContent=hide?'header.site,header.nav,.site-header,.emerg{display:none!important}':'';
    };
  if(typeof SITE_CONFIG!=='undefined'&&SITE_CONFIG&&SITE_CONFIG.theme){ try{ applyThemeVars(SITE_CONFIG.theme); }catch(e){} }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',_lpBoot); else _lpBoot();
})();