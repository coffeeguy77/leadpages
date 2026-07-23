/**
 * Premium Gallery renderer — injected into demo-shared.js (IIFE scope with esc()).
 */
function _pgDefaults(){
  return {
    structureMode:'simple', eyebrow:'Our work', heading:'A gallery of completed projects',
    intro:'Browse a selection of recent work — mixed portrait and landscape photography arranged for a premium finish.',
    supporting:'', badge:'', headerLayout:'centred', showEyebrow:true, showTitle:true, showIntro:true,
    showSupporting:false, showBadge:false, showCount:true, showBreadcrumb:true, showBack:true, showCta:false,
    ctaText:'Get a quote', ctaAction:'quote', coverImage:'', layout:'smart-mosaic', density:'balanced',
    imageSize:'standard', ratio:'original', columnsDesktop:4, columnsTablet:3, columnsMobile:2, gap:12, radius:12,
    hover:'zoom', overlay:'bottom-gradient', loadMoreCount:16, lightboxOn:true, lightboxStyle:'dark',
    lightboxCaptions:true, lightboxThumbnails:true, filtersEnabled:true, filterStyle:'pills', filterSource:'tags',
    filterMultiple:false, showAllTab:true, showFilterCounts:false, autoplay:false, autoplayDelay:5000,
    cardLayout:'overlay', smartPreset:'dynamic', mosaicLocked:true, mosaicSeed:7, mosaicRandomize:'locked',
    mosaicLayout:[], collageRotation:4, collageOverlap:12, virtualizeAt:48, urlMode:'hash', seoTitle:'',
    seoDescription:'', seoIndex:true, analyticsOn:true, categories:[], albums:[], images:[]
  };
}
function _pgSmartPresets(){
  return {
    clean:{layout:'grid',density:'airy',ratio:'square',hover:'none',radius:8,gap:18,headerLayout:'centred',mosaicLocked:true},
    editorial:{layout:'editorial',density:'editorial',ratio:'original',hover:'caption',radius:4,gap:20,headerLayout:'split',mosaicLocked:true},
    dynamic:{layout:'smart-mosaic',density:'balanced',ratio:'original',hover:'zoom',radius:12,gap:12,headerLayout:'centred',mosaicLocked:false,mosaicRandomize:'once'},
    minimal:{layout:'grid',density:'compact',ratio:'original',hover:'none',radius:0,gap:8,headerLayout:'minimal',mosaicLocked:true},
    cinematic:{layout:'feature-grid',density:'edge',ratio:'21:9',hover:'zoom',radius:0,gap:4,headerLayout:'hero',lightboxStyle:'dark',mosaicLocked:true},
    collage:{layout:'collage',density:'balanced',ratio:'original',hover:'lift',radius:10,gap:10,headerLayout:'centred',mosaicLocked:true,collageRotation:4,collageOverlap:12}
  };
}
function _pgApplySmartPreset(PG){
  var id=String(PG.smartPreset||'').toLowerCase();
  var p=_pgSmartPresets()[id];
  if(!p) return PG;
  Object.keys(p).forEach(function(k){ if(PG[k]==null||PG._presetApplied!==id) PG[k]=p[k]; });
  PG._presetApplied=id;
  return PG;
}
function _pgTrack(PG, name, props){
  if(PG&&PG.analyticsOn===false) return;
  try{
    if(typeof trackEvent==='function') trackEvent(name, Object.assign({location:'premiumGallery'}, props||{}));
  }catch(_e){}
}
function _pgSeed(PG){
  var d=_pgDefaults();
  Object.keys(d).forEach(function(k){ if(PG[k]==null) PG[k]=d[k]; });
  if(!Array.isArray(PG.images)||!PG.images.length){
    try{
      PG.images=[
        {id:'pg-img-1',on:true,src:'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&h=800&fit=crop&q=80',alt:'Modern open-plan living space',title:'Open-plan living',orientation:'landscape',ratio:1.5,categoryId:'cat-extensions',albumId:'alb-living',tags:['Modern','Residential'],featured:true,size:'wide'},
        {id:'pg-img-2',on:true,src:'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&h=1200&fit=crop&q=80',alt:'Ensuite with freestanding bath',title:'Ensuite bath',orientation:'portrait',ratio:0.67,categoryId:'cat-bathrooms',albumId:'alb-ensuite',tags:['Luxury','Residential'],featured:false,size:'tall'},
        {id:'pg-img-3',on:true,src:'https://images.unsplash.com/photo-1556912173-46c336c7fd55?w=1200&h=900&fit=crop&q=80',alt:'Kitchen with island bench',title:'Island kitchen',orientation:'landscape',ratio:1.33,categoryId:'cat-kitchens',albumId:'alb-kitchen',tags:['Modern','Residential'],featured:true,size:'large'},
        {id:'pg-img-4',on:true,src:'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=900&h=900&fit=crop&q=80',alt:'Detail of timber joinery',title:'Timber detail',orientation:'square',ratio:1,categoryId:'cat-kitchens',albumId:'alb-kitchen',tags:['Luxury'],featured:false,size:'standard'},
        {id:'pg-img-5',on:true,src:'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1600&h=700&fit=crop&q=80',alt:'Wide view of landscaped courtyard',title:'Courtyard panorama',orientation:'panoramic',ratio:2.28,categoryId:'cat-outdoor',albumId:'alb-outdoor',tags:['Outdoor','Residential'],featured:true,size:'full'},
        {id:'pg-img-6',on:true,src:'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&h=1100&fit=crop&q=80',alt:'Family bathroom vanity',title:'Family bathroom',orientation:'portrait',ratio:0.73,categoryId:'cat-bathrooms',albumId:'alb-family',tags:['Modern','Small Space'],featured:false,size:'tall'},
        {id:'pg-img-7',on:true,src:'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&h=800&fit=crop&q=80',alt:'Living room with natural light',title:'Natural light living',orientation:'landscape',ratio:1.5,categoryId:'cat-extensions',albumId:'alb-living',tags:['Modern','Residential'],featured:false,size:'standard'},
        {id:'pg-img-8',on:true,src:'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1000&h=750&fit=crop&q=80',alt:'Outdoor entertaining deck',title:'Entertaining deck',orientation:'landscape',ratio:1.33,categoryId:'cat-outdoor',albumId:'alb-outdoor',tags:['Outdoor','Luxury'],featured:false,size:'wide'},
        {id:'pg-img-9',on:true,src:'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=900&h=1200&fit=crop&q=80',alt:'Kitchen shelving detail',title:'Open shelving',orientation:'portrait',ratio:0.75,categoryId:'cat-kitchens',albumId:'alb-kitchen',tags:['Modern'],featured:false,size:'tall'},
        {id:'pg-img-10',on:true,src:'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=1200&h=800&fit=crop&q=80',alt:'Spa-style bathroom',title:'Spa bathroom',orientation:'landscape',ratio:1.5,categoryId:'cat-bathrooms',albumId:'alb-ensuite',tags:['Luxury','Accessible'],featured:false,size:'standard'},
        {id:'pg-img-11',on:true,src:'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdbc?w=1100&h=900&fit=crop&q=80',alt:'Extension exterior at dusk',title:'Dusk exterior',orientation:'landscape',ratio:1.22,categoryId:'cat-extensions',albumId:'alb-living',tags:['Residential'],featured:false,size:'standard'},
        {id:'pg-img-12',on:true,src:'https://images.unsplash.com/photo-1416331108676-a22ccb276e35?w=900&h=900&fit=crop&q=80',alt:'Stone path through garden',title:'Garden path',orientation:'square',ratio:1,categoryId:'cat-outdoor',albumId:'alb-outdoor',tags:['Outdoor'],featured:false,size:'standard'}
      ];
      PG.categories=[
        {id:'cat-bathrooms',on:true,name:'Bathrooms',eyebrow:'Renovations',intro:'Ensuites, family bathrooms and accessible upgrades.',cover:PG.images[1].src,slug:'bathrooms'},
        {id:'cat-kitchens',on:true,name:'Kitchens',eyebrow:'Renovations',intro:'Island benches, joinery and lighting that make the room work harder.',cover:PG.images[2].src,slug:'kitchens'},
        {id:'cat-extensions',on:true,name:'Extensions',eyebrow:'Additions',intro:'Light-filled living spaces and open-plan connections.',cover:PG.images[0].src,slug:'extensions'},
        {id:'cat-outdoor',on:true,name:'Outdoor Living',eyebrow:'Exteriors',intro:'Decks, courtyards and landscaped entertaining zones.',cover:PG.images[4].src,slug:'outdoor-living'}
      ];
      PG.albums=[
        {id:'alb-ensuite',on:true,categoryId:'cat-bathrooms',title:'Yarralumla Ensuite',intro:'A calm ensuite with freestanding bath and soft lighting.',location:'Yarralumla, ACT',cover:PG.images[1].src,slug:'yarralumla-ensuite',featured:true},
        {id:'alb-family',on:true,categoryId:'cat-bathrooms',title:'Gungahlin Family Bathroom',intro:'Practical family bathroom with durable finishes.',location:'Gungahlin, ACT',cover:PG.images[5].src,slug:'gungahlin-family-bathroom'},
        {id:'alb-kitchen',on:true,categoryId:'cat-kitchens',title:'Red Hill Kitchen',intro:'Island bench, open shelving and integrated appliances.',location:'Red Hill, ACT',cover:PG.images[2].src,slug:'red-hill-kitchen',featured:true},
        {id:'alb-living',on:true,categoryId:'cat-extensions',title:'Campbell Living Extension',intro:'Open-plan living that opens to the garden.',location:'Campbell, ACT',cover:PG.images[0].src,slug:'campbell-living-extension',featured:true},
        {id:'alb-outdoor',on:true,categoryId:'cat-outdoor',title:'Forrest Entertaining Deck',intro:'Hardwood deck and courtyard for year-round entertaining.',location:'Forrest, ACT',cover:PG.images[7].src,slug:'forrest-entertaining-deck'}
      ];
    }catch(_e){}
  }
  return PG;
}
function _pgSlug(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48); }
function _pgSizeClass(it, layout, seed, idx, layoutMap){
  if(layoutMap&&it.id&&layoutMap[it.id]) {
    var sz=layoutMap[it.id];
    if(sz==='standard') return '';
    if(sz==='feature') return 'pg-s-large';
    return 'pg-s-'+sz;
  }
  if(it.size&&['standard','wide','tall','large','feature','full'].indexOf(it.size)>=0){
    if(it.size==='feature') return 'pg-s-large';
    if(it.size==='full') return 'pg-s-full';
    if(it.size==='standard') return '';
    return 'pg-s-'+it.size;
  }
  var o=String(it.orientation||'');
  if(o==='panoramic'||(it.ratio&&it.ratio>=2)) return 'pg-s-full';
  if(o==='portrait'||(it.ratio&&it.ratio<0.9)) return 'pg-s-tall';
  if(o==='landscape'&&it.featured) return 'pg-s-wide';
  if(layout==='random-mosaic'||layout==='smart-mosaic'||layout==='collage'){
    var n=((seed||7)*31+idx*17)%10;
    if(n===0) return 'pg-s-large';
    if(n===1||n===2) return 'pg-s-wide';
    if(n===3||n===4) return 'pg-s-tall';
  }
  if(layout==='editorial'){
    var m=idx%6;
    if(m===0) return 'pg-s-large';
    if(m===3) return 'pg-s-wide';
    if(m===5) return 'pg-s-tall';
  }
  return '';
}
function _pgReadUrlState(PG, cats, albums){
  var mode=String(PG.urlMode||'hash');
  if(mode==='none') return null;
  try{
    var path='', parts=[];
    if(mode==='hash'){
      path=String(location.hash||'').replace(/^#\/?/, '');
      if(path.indexOf('pg/')===0) path=path.slice(3);
      else if(path.indexOf('gallery/')===0) path=path.slice(8);
      else if(path==='pg'||path==='gallery') path='';
      else return null;
      parts=path.split('/').filter(Boolean);
    } else if(mode==='query'){
      var q=new URLSearchParams(location.search);
      var pg=q.get('pg')||q.get('gallery')||'';
      parts=String(pg).split('/').filter(Boolean);
    } else if(mode==='path'){
      var segs=location.pathname.replace(/\/+$/,'').split('/').filter(Boolean);
      var gi=segs.indexOf('gallery');
      if(gi<0) return null;
      parts=segs.slice(gi+1);
    }
    if(!parts.length) return {view:'root'};
    var cat=null, alb=null;
    for(var i=0;i<cats.length;i++){ if(_pgSlug(cats[i].slug||cats[i].name)===parts[0]||cats[i].id===parts[0]){ cat=cats[i]; break; } }
    if(cat&&parts[1]){
      for(var j=0;j<albums.length;j++){ if(albums[j].categoryId===cat.id&&(_pgSlug(albums[j].slug||albums[j].title)===parts[1]||albums[j].id===parts[1])){ alb=albums[j]; break; } }
    }
    if(alb) return {view:'album', categoryId:cat.id, albumId:alb.id};
    if(cat) return {view:'category', categoryId:cat.id};
  }catch(_e){}
  return null;
}
function _pgWriteUrlState(PG, st, cats, albums){
  var mode=String(PG.urlMode||'hash');
  if(mode==='none') return;
  try{
    var cat=null, alb=null;
    for(var i=0;i<cats.length;i++) if(cats[i].id===st.categoryId) cat=cats[i];
    for(var j=0;j<albums.length;j++) if(albums[j].id===st.albumId) alb=albums[j];
    var bits=[];
    if(cat) bits.push(_pgSlug(cat.slug||cat.name||cat.id));
    if(alb) bits.push(_pgSlug(alb.slug||alb.title||alb.id));
    if(mode==='hash'){
      var h=bits.length?('#/gallery/'+bits.join('/')):'#/gallery';
      if(location.hash!==h) history.replaceState(null,'',h);
    } else if(mode==='query'){
      var u=new URL(location.href);
      if(bits.length) u.searchParams.set('pg', bits.join('/')); else u.searchParams.delete('pg');
      history.replaceState(null,'',u.pathname+u.search+u.hash);
    }
  }catch(_e){}
}
function _pgApplySeo(PG, title, intro){
  try{
    if(PG.seoIndex===false){
      var robots=document.querySelector('meta[name="robots"]');
      if(!robots){ robots=document.createElement('meta'); robots.setAttribute('name','robots'); document.head.appendChild(robots); }
      robots.setAttribute('content','noindex,follow');
    }
    var t=PG.seoTitle||title;
    var d=PG.seoDescription||intro||'';
    if(t) document.title=t;
    if(d){
      var m=document.querySelector('meta[name="description"]');
      if(!m){ m=document.createElement('meta'); m.setAttribute('name','description'); document.head.appendChild(m); }
      m.setAttribute('content', String(d).slice(0,160));
    }
  }catch(_e){}
}
function _pgRenderPremiumGallery(PG, node){
  if(!node) return;
  // Off-by-default marketplace app — only show when explicitly enabled.
  if(!PG || PG.on!==true){ node.style.display='none'; return; }
  PG=_pgSeed(PG||{});
  PG=_pgApplySmartPreset(PG);
  node.style.display='';
  var cats=(Array.isArray(PG.categories)?PG.categories:[]).filter(function(c){return c&&c.on!==false;});
  var albums=(Array.isArray(PG.albums)?PG.albums:[]).filter(function(a){return a&&a.on!==false;});
  var imgs=(Array.isArray(PG.images)?PG.images:[]).filter(function(im){return im&&im.on!==false&&im.src&&String(im.src).trim();});
  (function ensureIds(){
    function slug(s){ return _pgSlug(s)||('id'+Math.random().toString(36).slice(2,7)); }
    cats.forEach(function(c,i){ if(c&&!c.id) c.id='cat-'+slug(c.name||i); });
    albums.forEach(function(a,i){ if(a&&!a.id) a.id='alb-'+slug(a.title||i); });
    imgs.forEach(function(im,i){ if(im&&!im.id) im.id='img-'+i+'-'+slug(im.title||''); if(im&&im.featured==='true') im.featured=true; if(im&&typeof im.tags==='string') im.tags=im.tags.split(',').map(function(x){return x.trim();}).filter(Boolean); });
  })();

  var st=node.__pgState||{view:'root', categoryId:null, albumId:null, filter:'all', shown:0, slide:0, impressed:false};
  if(!node.__pgHydrated){
    var fromUrl=_pgReadUrlState(PG, cats, albums);
    if(fromUrl){ st.view=fromUrl.view||'root'; st.categoryId=fromUrl.categoryId||null; st.albumId=fromUrl.albumId||null; }
    node.__pgHydrated=true;
  }
  node.__pgState=st;

  // Mosaic lock / randomize
  var layout=String(PG.layout||'smart-mosaic');
  var randMode=String(PG.mosaicRandomize||(PG.mosaicLocked===false?'once':'locked'));
  if((layout==='smart-mosaic'||layout==='random-mosaic'||layout==='collage')&&randMode==='every-load'&&!st._seeded){
    PG.mosaicSeed=Math.floor(Math.random()*9999)+1;
    st._seeded=true;
  }
  var layoutMap={};
  if(Array.isArray(PG.mosaicLayout)&&PG.mosaicLayout.length&&PG.mosaicLocked!==false){
    PG.mosaicLayout.forEach(function(row){ if(row&&row.id) layoutMap[row.id]=row.size; });
  }

  var mode=String(PG.structureMode||'simple');
  var dens=String(PG.density||'balanced');
  var colsD=parseInt(PG.columnsDesktop,10); if(!(colsD>=2&&colsD<=6)) colsD=4;
  var colsT=parseInt(PG.columnsTablet,10); if(!(colsT>=1&&colsT<=4)) colsT=3;
  var colsM=parseInt(PG.columnsMobile,10); if(!(colsM>=1&&colsM<=3)) colsM=2;
  var gap=parseInt(PG.gap,10); if(isNaN(gap)) gap=(dens==='airy'?22:dens==='compact'?8:dens==='edge'?2:12);
  var radius=parseInt(PG.radius,10); if(isNaN(radius)) radius=12;
  var loadN=parseInt(PG.loadMoreCount,10); if(isNaN(loadN)||loadN<4) loadN=16;
  var virtAt=parseInt(PG.virtualizeAt,10); if(isNaN(virtAt)) virtAt=48;
  node.style.setProperty('--pg-cols', String(colsD));
  node.style.setProperty('--pg-cols-tab', String(colsT));
  node.style.setProperty('--pg-cols-mob', String(colsM));
  node.style.setProperty('--pg-gap', gap+'px');
  node.style.setProperty('--pg-radius', radius+'px');
  node.style.setProperty('--pg-collage-rot', (parseInt(PG.collageRotation,10)||4)+'deg');
  node.style.setProperty('--pg-collage-overlap', (parseInt(PG.collageOverlap,10)||12)+'px');
  function setC(css,val){ val=String(val||'').trim(); if(val) node.style.setProperty(css,val); else node.style.removeProperty(css); }
  setC('--pg-eyebrow', PG.eyebrowColor); setC('--pg-title', PG.titleColor); setC('--pg-intro', PG.introColor);
  setC('--pg-cap', PG.captionColor||''); setC('--pg-filter', PG.filterColor); setC('--pg-filter-active', PG.activeFilterColor);
  setC('--pg-badge-bg', PG.badgeBg); setC('--pg-badge-fg', PG.badgeText);
  node.className=node.className.replace(/\bpg-\S+/g,'').replace(/\s+/g,' ').trim()+' section';
  node.classList.add('pg-dense-'+dens);
  if(dens==='edge') node.classList.add('pg-edge');
  if(PG.hover==='zoom') node.classList.add('pg-hover-zoom');
  if(PG.hover==='lift') node.classList.add('pg-hover-lift');
  if(PG.hover==='caption'||PG.hover==='reveal-caption') node.classList.add('pg-hover-caption');

  function catById(id){ for(var i=0;i<cats.length;i++) if(cats[i].id===id) return cats[i]; return null; }
  function albById(id){ for(var i=0;i<albums.length;i++) if(albums[i].id===id) return albums[i]; return null; }
  var title=PG.heading||'Gallery';
  var intro=PG.intro||'';
  var eyebrow=PG.eyebrow||'';
  var crumb=[];
  var visibleImgs=imgs.slice();
  var cards=null;
  if(mode==='categories'||mode==='categories-albums'){
    if(st.view==='root'){
      cards=cats.map(function(c){
        var n=imgs.filter(function(im){return im.categoryId===c.id;}).length;
        var aN=albums.filter(function(a){return a.categoryId===c.id;}).length;
        return {kind:'category', id:c.id, title:c.name, intro:c.intro, cover:c.cover||'', meta:(mode==='categories-albums'?(aN+' projects · '+n+' photos'):(n+' photos'))};
      });
    } else if(st.view==='category'){
      var cat=catById(st.categoryId);
      if(cat){ title=cat.name; intro=cat.intro||''; eyebrow=cat.eyebrow||eyebrow; crumb=['Gallery', cat.name]; if(cat.seoTitle) title=cat.seoTitle; if(cat.seoDescription) intro=cat.seoDescription; }
      if(mode==='categories-albums'){
        cards=albums.filter(function(a){return a.categoryId===st.categoryId;}).map(function(a){
          var n=imgs.filter(function(im){return im.albumId===a.id;}).length;
          return {kind:'album', id:a.id, title:a.title, intro:a.intro, cover:a.cover||'', meta:(a.location?a.location+' · ':'')+n+' photos'};
        });
      } else {
        visibleImgs=imgs.filter(function(im){return im.categoryId===st.categoryId;});
      }
    } else if(st.view==='album'){
      var alb=albById(st.albumId); var c2=alb?catById(alb.categoryId):null;
      if(alb){ title=alb.title; intro=alb.intro||''; eyebrow=alb.eyebrow||eyebrow; crumb=['Gallery', c2?c2.name:'Category', alb.title]; if(alb.seoTitle) title=alb.seoTitle; if(alb.seoDescription) intro=alb.seoDescription; }
      visibleImgs=imgs.filter(function(im){return im.albumId===st.albumId;});
    }
  }
  if(mode==='filtered'||(mode==='simple'&&PG.filtersEnabled&&PG.filterSource==='tags')){
    if(st.filter&&st.filter!=='all'){
      visibleImgs=visibleImgs.filter(function(im){
        var t=Array.isArray(im.tags)?im.tags:String(im.tags||'').split(',').map(function(x){return x.trim();}).filter(Boolean);
        return t.indexOf(st.filter)>=0 || im.categoryId===st.filter;
      });
    }
  }
  if(!st.shown) st.shown=Math.min(loadN, visibleImgs.length||loadN);
  // Virtualisation: cap rendered DOM window for huge galleries
  var useVirt=visibleImgs.length>=virtAt && (layout==='grid'||layout==='smart-mosaic'||layout==='editorial'||layout==='masonry'||layout==='justified'||layout==='collage');
  if(useVirt&&st.shown>virtAt+loadN){
    // keep a sliding window ending at shown
    st._virtStart=Math.max(0, st.shown-(virtAt+loadN));
  } else {
    st._virtStart=0;
  }

  _pgWriteUrlState(PG, st, cats, albums);
  _pgApplySeo(PG, title, intro);
  if(!st.impressed){ st.impressed=true; _pgTrack(PG,'gallery_impression',{layout:layout, mode:mode, count:visibleImgs.length}); }

  var host=node.querySelector('.pg-root'); if(!host){ host=document.createElement('div'); host.className='pg-root'; node.appendChild(host); }
  var hl=String(PG.headerLayout||'centred');
  var headCls='pg-head pg-h-'+hl;
  var headStyle='';
  if(hl==='hero'&&(PG.coverImage||(visibleImgs[0]&&visibleImgs[0].src))){
    headStyle=' style="background-image:url(\''+esc(PG.coverImage||visibleImgs[0].src)+'\')"';
  }
  var headHtml='<div class="'+headCls+'"'+headStyle+'>';
  if(PG.showBadge!==false&&PG.badge) headHtml+='<div class="pg-badge">'+esc(PG.badge)+'</div>';
  if(PG.showEyebrow!==false&&eyebrow) headHtml+='<div class="pg-eyebrow">'+esc(eyebrow)+'</div>';
  if(PG.showTitle!==false) headHtml+='<h2 class="pg-title">'+esc(title)+'</h2>';
  if(PG.showIntro!==false&&intro) headHtml+='<p class="pg-intro">'+esc(intro)+'</p>';
  if(PG.showSupporting&&PG.supporting) headHtml+='<p class="pg-supporting">'+esc(PG.supporting)+'</p>';
  var metaBits=[];
  if(PG.showBreadcrumb!==false&&crumb.length) metaBits.push('<span class="pg-crumb">'+esc(crumb.join(' / '))+'</span>');
  if(PG.showBack!==false&&st.view!=='root') metaBits.push('<button type="button" class="pg-back" data-pg-back="1">← Back</button>');
  if(PG.showCount!==false){
    if(cards) metaBits.push('<span>'+cards.length+(mode==='categories-albums'&&st.view==='root'?' categories':(st.view==='category'?' projects':' items'))+'</span>');
    else metaBits.push('<span>'+visibleImgs.length+' photos</span>');
  }
  if(metaBits.length) headHtml+='<div class="pg-meta">'+metaBits.join('')+'</div>';
  if(PG.showCta&&PG.ctaText){
    var href=(PG.ctaAction==='call')?'#':'#quote';
    headHtml+='<a class="pg-cta" href="'+esc(href)+'" data-pg-cta="1">'+esc(PG.ctaText)+'</a>';
  }
  headHtml+='</div>';
  var filtersHtml='';
  var showFilters=(mode==='filtered'||(PG.filtersEnabled&&mode==='simple'&&PG.filterSource==='tags'))&&st.view==='root'&&!cards;
  if(showFilters){
    var tags={};
    imgs.forEach(function(im){
      (Array.isArray(im.tags)?im.tags:String(im.tags||'').split(',').map(function(x){return x.trim();}).filter(Boolean)).forEach(function(t){ if(t) tags[t]=(tags[t]||0)+1; });
    });
    if(PG.filterSource==='categories'){ cats.forEach(function(c){ tags[c.name]=imgs.filter(function(im){return im.categoryId===c.id;}).length; }); }
    var keys=Object.keys(tags);
    if(keys.length){
      var fStyle=String(PG.filterStyle||'pills');
      filtersHtml='<div class="pg-filters pg-f-'+esc(fStyle)+'" role="tablist">';
      if(PG.showAllTab!==false) filtersHtml+='<button type="button" class="pg-chip'+(st.filter==='all'?' is-on':'')+'" data-pg-filter="all">All'+(PG.showFilterCounts?' ('+imgs.length+')':'')+'</button>';
      keys.forEach(function(k){
        filtersHtml+='<button type="button" class="pg-chip'+(st.filter===k?' is-on':'')+'" data-pg-filter="'+esc(k)+'">'+esc(k)+(PG.showFilterCounts?' ('+tags[k]+')':'')+'</button>';
      });
      filtersHtml+='</div>';
    }
  }
  var bodyHtml='';
  if(cards&&cards.length){
    var cardLay=String(PG.cardLayout||'overlay');
    bodyHtml='<div class="pg-cards">';
    cards.forEach(function(c){
      var cls='pg-card'+(cardLay==='overlay'?' pg-overlay-card':'');
      bodyHtml+='<div class="'+cls+'" data-pg-open="'+esc(c.kind)+'" data-pg-id="'+esc(c.id)+'">'
        +'<div class="pg-card-shot">'+(c.cover?('<img src="'+esc(c.cover)+'" alt="'+esc(c.title)+'" loading="lazy">'):'<div class="pg-ph"></div>')+'</div>'
        +'<div class="pg-card-body"><h3>'+esc(c.title)+'</h3>'+(c.intro?'<p>'+esc(c.intro)+'</p>':'')+(c.meta?'<div class="pg-card-meta">'+esc(c.meta)+'</div>':'')+'</div></div>';
    });
    bodyHtml+='</div>';
  } else if(!visibleImgs.length){
    bodyHtml='<div class="pg-empty">No images match these filters.</div>';
  } else {
    var start=st._virtStart||0;
    var slice=visibleImgs.slice(start, st.shown||loadN);
    window.__PG_LB=visibleImgs.map(function(im){ return {src:im.src, title:im.title||im.alt||'', caption:im.caption||'', id:im.id||''}; });
    if(layout==='filmstrip'){
      bodyHtml='<div class="pg-film">'+slice.map(function(im,i){ return _pgTile(im,start+i,layout,PG,true,layoutMap); }).join('')+'</div>';
    } else if(layout==='slideshow'){
      var cur=slice[st.slide%slice.length]||slice[0];
      bodyHtml='<div class="pg-slide"><div class="pg-stage"><img src="'+esc(cur.src)+'" alt="'+esc(cur.alt||cur.title||'')+'"></div>'
        +'<div class="pg-slide-nav"><button type="button" data-pg-slide="-1">Prev</button><button type="button" data-pg-slide="1">Next</button></div></div>';
    } else if(layout==='stacked'){
      bodyHtml='<div class="pg-stacked">'+slice.map(function(im,i){ return _pgTile(im,start+i,layout,PG,false,layoutMap); }).join('')+'</div>';
    } else if(layout==='collage'){
      bodyHtml='<div class="pg-collage">'+slice.map(function(im,i){ return _pgTile(im,start+i,layout,PG,true,layoutMap); }).join('')+'</div>';
    } else if(layout==='feature-grid'){
      var feat=slice[0]; var rest=slice.slice(1,5);
      bodyHtml='<div class="pg-feature"><div class="pg-feat">'+_pgTile(feat,start,layout,PG,false,layoutMap)+'</div><div class="pg-side">'+rest.map(function(im,i){return _pgTile(im,start+i+1,layout,PG,false,layoutMap);}).join('')+'</div></div>';
      if(slice.length>5) bodyHtml+='<div class="pg-grid pg-mosaic" style="margin-top:var(--pg-gap)">'+slice.slice(5).map(function(im,i){return _pgTile(im,start+i+5,layout,PG,true,layoutMap);}).join('')+'</div>';
    } else if(layout==='masonry'){
      bodyHtml='<div class="pg-masonry">'+slice.map(function(im,i){ return _pgTile(im,start+i,layout,PG,false,layoutMap); }).join('')+'</div>';
    } else if(layout==='justified'){
      bodyHtml='<div class="pg-justified">'+slice.map(function(im,i){ return _pgTile(im,start+i,layout,PG,false,layoutMap); }).join('')+'</div>';
    } else {
      var ratio=String(PG.ratio||'original');
      var rCls={square:'pg-ratio-square','4:5':'pg-ratio-45','3:4':'pg-ratio-34','4:3':'pg-ratio-43','3:2':'pg-ratio-32','16:9':'pg-ratio-169','21:9':'pg-ratio-219'}[ratio]||'';
      var mosaic=(layout==='smart-mosaic'||layout==='editorial'||layout==='random-mosaic'||layout==='mosaic');
      bodyHtml='<div class="pg-grid'+(mosaic?' pg-mosaic':'')+(rCls?' '+rCls:'')+'">'+slice.map(function(im,i){ return _pgTile(im,start+i,layout,PG,mosaic,layoutMap); }).join('')+'</div>';
    }
    if(visibleImgs.length>(st.shown||loadN)){
      bodyHtml+='<div class="pg-more"><button type="button" data-pg-more="1">Load more</button><div class="pg-sentinel" data-pg-sentinel="1" aria-hidden="true"></div></div>';
    }
  }
  var wrapInner='<div class="wrap">'+headHtml+(hl==='titleFilters'?'':filtersHtml)+bodyHtml+'</div>';
  if(hl==='titleFilters'){
    wrapInner='<div class="wrap">'+headHtml.replace('</div>', filtersHtml+'</div>')+bodyHtml+'</div>';
  }
  host.innerHTML=wrapInner;
  if(!document.getElementById('pg-lightbox')){
    var lb=document.createElement('div'); lb.id='pg-lightbox';
    lb.innerHTML='<div class="pg-lb-inner"><button type="button" class="pg-lb-close" aria-label="Close">×</button>'
      +'<button type="button" class="pg-lb-prev" aria-label="Previous">‹</button>'
      +'<button type="button" class="pg-lb-next" aria-label="Next">›</button>'
      +'<img class="pg-lb-img" alt="">'
      +'<div class="pg-lb-cap"></div><div class="pg-lb-count"></div><div class="pg-lb-thumbs"></div></div>';
    document.body.appendChild(lb);
  }
  // Infinite scroll sentinel
  try{
    var sent=host.querySelector('[data-pg-sentinel]');
    if(sent&&'IntersectionObserver' in window){
      if(node.__pgIO) node.__pgIO.disconnect();
      node.__pgIO=new IntersectionObserver(function(entries){
        entries.forEach(function(en){
          if(!en.isIntersecting) return;
          if(visibleImgs.length<=(st.shown||0)) return;
          st.shown=(st.shown||loadN)+loadN;
          _pgTrack(PG,'gallery_load_more',{shown:st.shown});
          _pgRenderPremiumGallery(PG, node);
        });
      },{root:null, rootMargin:'400px', threshold:0});
      node.__pgIO.observe(sent);
    }
  }catch(_io){}
  if(!node.__pgBound){
    node.__pgBound=true;
    node.addEventListener('click',function(ev){
      var t=ev.target; if(!t||!t.closest) return;
      var back=t.closest('[data-pg-back]');
      if(back){
        if(st.view==='album'){ st.view='category'; st.albumId=null; }
        else { st.view='root'; st.categoryId=null; st.albumId=null; }
        st.shown=0; _pgTrack(PG,'gallery_nav',{action:'back', view:st.view}); _pgRenderPremiumGallery(PG, node); return;
      }
      var filt=t.closest('[data-pg-filter]');
      if(filt){ st.filter=filt.getAttribute('data-pg-filter')||'all'; st.shown=0; _pgTrack(PG,'gallery_filter',{filter:st.filter}); _pgRenderPremiumGallery(PG, node); return; }
      var open=t.closest('[data-pg-open]');
      if(open){
        var kind=open.getAttribute('data-pg-open'); var id=open.getAttribute('data-pg-id');
        if(kind==='category'){ st.view='category'; st.categoryId=id; st.albumId=null; st.shown=0; _pgTrack(PG,'gallery_category',{categoryId:id}); }
        else if(kind==='album'){ st.view='album'; st.albumId=id; st.shown=0; _pgTrack(PG,'gallery_album',{albumId:id}); }
        _pgRenderPremiumGallery(PG, node); return;
      }
      var more=t.closest('[data-pg-more]');
      if(more){ st.shown=(st.shown||loadN)+loadN; _pgTrack(PG,'gallery_load_more',{shown:st.shown}); _pgRenderPremiumGallery(PG, node); return; }
      var sbtn=t.closest('[data-pg-slide]');
      if(sbtn){ st.slide=(st.slide||0)+parseInt(sbtn.getAttribute('data-pg-slide'),10); if(st.slide<0) st.slide=0; _pgTrack(PG,'gallery_slideshow',{slide:st.slide}); _pgRenderPremiumGallery(PG, node); return; }
      var cta=t.closest('[data-pg-cta]');
      if(cta){ _pgTrack(PG,'cta_click',{action:'gallery_cta'}); }
      var tile=t.closest('[data-pg-idx]');
      if(tile && PG.lightboxOn!==false){
        var idx=parseInt(tile.getAttribute('data-pg-idx'),10)||0;
        _pgTrack(PG,'gallery_image_click',{idx:idx});
        _pgOpenLightbox(idx, PG);
      }
    });
  }
}
function _pgTile(im, i, layout, PG, mosaic, layoutMap){
  var sz=mosaic?_pgSizeClass(im, layout, PG.mosaicSeed, i, layoutMap):'';
  var badge=(im.badge?('<span class="pg-ibadge">'+esc(im.badge)+'</span>'):'');
  var cap=esc(im.title||im.caption||im.alt||'');
  var rot='';
  if(layout==='collage'){
    var deg=((i%5)-2)*(parseInt(PG.collageRotation,10)||4);
    rot=' style="--pg-rot:'+deg+'deg"';
  }
  return '<div class="pg-item'+(sz?' '+sz:'')+(layout==='collage'?' pg-collage-item':'')+'" data-pg-idx="'+i+'" role="button" tabindex="0"'+rot+'>'
    +badge+'<img src="'+esc(im.src)+'" alt="'+esc(im.alt||im.title||'')+'" loading="'+(i<6?'eager':'lazy')+'">'
    +'<div class="pg-cap">'+cap+'</div></div>';
}
function _pgOpenLightbox(idx, PG){
  var lb=document.getElementById('pg-lightbox'); if(!lb) return;
  var items=window.__PG_LB||[]; if(!items.length) return;
  lb.classList.toggle('pg-lb-light', PG.lightboxStyle==='light');
  var cur=idx||0;
  _pgTrack(PG,'gallery_lightbox',{idx:cur, imageId:(items[cur]&&items[cur].id)||''});
  function paint(){
    if(cur<0) cur=items.length-1; if(cur>=items.length) cur=0;
    var it=items[cur];
    var img=lb.querySelector('.pg-lb-img'); if(img){ img.src=it.src; img.alt=it.title||''; }
    var cap=lb.querySelector('.pg-lb-cap'); if(cap){ cap.textContent=(PG.lightboxCaptions===false)?'':(it.caption||it.title||''); }
    var ct=lb.querySelector('.pg-lb-count'); if(ct) ct.textContent=(cur+1)+' / '+items.length;
    var th=lb.querySelector('.pg-lb-thumbs');
    if(th){
      if(PG.lightboxThumbnails===false){ th.innerHTML=''; }
      else {
        th.innerHTML=items.map(function(x,i){ return '<button type="button" class="'+(i===cur?'is-on':'')+'" data-pg-lbi="'+i+'"><img src="'+esc(x.src)+'" alt=""></button>'; }).join('');
      }
    }
  }
  paint(); lb.classList.add('open');
  if(!lb.__bound){
    lb.__bound=true;
    lb.addEventListener('click',function(ev){
      var t=ev.target; if(!t||!t.closest) return;
      if(t.closest('.pg-lb-close')||t===lb){ lb.classList.remove('open'); return; }
      if(t.closest('.pg-lb-next')){ cur++; _pgTrack(PG,'gallery_nav',{action:'next'}); paint(); return; }
      if(t.closest('.pg-lb-prev')){ cur--; _pgTrack(PG,'gallery_nav',{action:'prev'}); paint(); return; }
      var b=t.closest('[data-pg-lbi]'); if(b){ cur=parseInt(b.getAttribute('data-pg-lbi'),10)||0; paint(); }
    });
    document.addEventListener('keydown',function(e){
      if(!lb.classList.contains('open')) return;
      if(e.key==='Escape') lb.classList.remove('open');
      else if(e.key==='ArrowRight'){ cur++; paint(); }
      else if(e.key==='ArrowLeft'){ cur--; paint(); }
    });
  }
}
