'use strict';

/**
 * Rebuild landing-shell-neutral-v1 from trade.template.json WITHOUT
 * stripping theme token substrings like "hivis" (that previously broke applyCfg).
 *
 * Empties trade/plumbing fallback arrays and static copy so Website Studio
 * Composer drafts never paint unrelated trade defaults.
 *
 * Live trade.template.json is never written.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TRADE = path.join(ROOT, 'trade.template.json');
const OUT = path.join(ROOT, 'landing-shell-neutral-v1.template.json');

const CONTENT_REPLACEMENTS = [
  [/Blocked drain\?/gi, ''],
  [/Blocked [Dd]rains?/gi, ''],
  [/blocked drains?/gi, ''],
  [/We'll clear it today\.?/gi, ''],
  [/Fast, fixed-price[\s\S]*?before we start\./gi, ''],
  [/burst pipes?/gi, ''],
  [/Burst pipes?/gi, ''],
  [/Burst pipe at midnight\.?/gi, ''],
  [/Burst pipe or flooding\?/gi, ''],
  [/Licensed Canberra plumber/gi, ''],
  [/24\/7 Emergency Plumber/gi, ''],
  [/24\/7 line for genuine emergencies/gi, ''],
  [/Get a fast quote/gi, 'Get in touch'],
  [/Fully licensed ACT plumbers[^.]*\./gi, ''],
  [/Canberra-based, Canberra-owned\. We know the suburbs, the soil and the old pipework\./gi, ''],
  [/Two minutes now saves you a flooded weekend\.[^<]*/gi, ''],
  [/What's the problem\?/gi, 'How can we help?'],
  [/Burst or leaking pipe/gi, ''],
  [/Hidden leak \/ high water bill/gi, ''],
  [/24\/7 emergency line/gi, ''],
  [/Leak detection/gi, ''],
  [/Drain cleared in Belconnen/gi, ''],
  [/Burst pipe repaired in Gungahlin/gi, ''],
  [/Emergency callout in Woden/gi, ''],
  [/Drain fixed by 10am/gi, ''],
  [/How we clear a blocked drain/gi, ''],
  [/Canberra(&#39;|')s most active drain cleaning team/gi, ''],
  [/drain cleaning team/gi, ''],
  [/Active across the ACT today/gi, ''],
  [/old pipework/gi, ''],
  [/flooded weekend/gi, ''],
  [/flooded laundry/gi, ''],
  [/No call-out games\. No surprise bills\./gi, ''],
  [/Upfront fixed price, no call-out surprises/gi, ''],
  [/ACT\s+Licence 0000000 \(placeholder\)\./gi, ''],
  [/no-hot-water jobs?/gi, ''],
  [/\bplumber\b/gi, ''],
  [/\bplumbing\b/gi, ''],
  [/\bhi-vis\b/gi, ''],
  [/\bhi vis\b/gi, ''],
  [/\bGungahlin\b/gi, ''],
  [/\bBelconnen\b/gi, ''],
  [/\bTuggeranong\b/gi, ''],
  [/\bWoden\b/gi, ''],
  [/\bQueanbeyan\b/gi, ''],
  [/\bMolonglo\b/gi, ''],
  [/\btradie\b/gi, ''],
  // Neutralise trade FAQ JSON-LD answers (Composer drafts inject their own FAQ section)
  [/"text":"Yes\. For[^"]*"/gi, '"text":""'],
  [/"text":"Always\. We quote a fixed price[^"]*"/gi, '"text":""'],
  [/"text":"Yes —[^"]*invoice\."/gi, '"text":""']
];

const FALLBACK_ARRAY_VARS = [
  '_hd',
  '_spfd',
  '_rd',
  '_sd',
  '_pd',
  '_acd',
  '_atd',
  '_jfd',
  '_bfd',
  '_pfd',
  '_crd',
  '_opd',
  '_cwd'
];

const WS_NEW_APPS_APPLY = `
<script id="ws-new-apps-apply">
(function(){
  function on(sec){ return sec && sec.on !== false; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function applyNewApps(cfg){
    if(!cfg || !cfg.sections) return;
    ['productCollection','clientLogos','bookingCta','brandStory','packageCompare','featureStrip','textBox'].forEach(function(key){
      var el = document.querySelector('[data-sec="'+key+'"]');
      var s = cfg.sections[key];
      if(!el) return;
      if(!on(s)){ el.style.display='none'; el.hidden=true; return; }
      el.style.display=''; el.hidden=false; el.removeAttribute('aria-hidden');
      var h = el.querySelector('h2'); if(h && (s.heading||s.title)) h.textContent = s.heading||s.title;
      var lead = el.querySelector('.lead'); if(lead) lead.textContent = s.intro||s.sub||s.body||'';
      var cta = el.querySelector('a.btn'); if(cta && s.cta) cta.textContent = s.cta;
      var body = el.querySelector('.story-body'); if(body && (s.body||s.text)) body.textContent = s.body||s.text||'';
      var grid = el.querySelector('.grid');
      if(grid && Array.isArray(s.items) && s.items.length){
        grid.innerHTML = s.items.map(function(it){
          var img = it.image||it.imageUrl;
          return '<article class="card">'+(img?'<img src="'+String(img).replace(/"/g,'')+'" alt="">':'')+'<h3>'+esc(it.title||'')+'</h3><p>'+esc(it.text||it.body||'')+'</p></article>';
        }).join('');
      }
      if(grid && Array.isArray(s.packages) && s.packages.length){
        grid.innerHTML = s.packages.map(function(it){
          var inc = (it.inclusions||[]).map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('');
          return '<article class="card"><h3>'+esc(it.title||'')+'</h3><p>'+esc(it.text||'')+'</p><ul>'+inc+'</ul><p class="price">'+esc(it.priceLabel||'')+'</p></article>';
        }).join('');
      }
      var logos = el.querySelector('.logo-row');
      if(logos && Array.isArray(s.logos)){
        logos.innerHTML = s.logos.map(function(L){
          return L.image ? '<img src="'+String(L.image).replace(/"/g,'')+'" alt="'+esc(L.label||'')+'">' : '<span>'+esc(L.label||'')+'</span>';
        }).join('');
      }
    });
    // Footer links when Composer provides serviceLinks
    var F = cfg.sections.footer||{};
    var ft = document.querySelector('footer.site,footer[data-sec="footer"]');
    if(ft && on(F)){
      if(F.emergencyLabel===''){
        var emergLinks = ft.querySelectorAll('.foot-call a');
        for(var ei=0;ei<emergLinks.length;ei++){
          var t=(emergLinks[ei].textContent||'').toLowerCase();
          if(/emergency|24\\/7|leak/.test(t)){ emergLinks[ei].textContent=''; emergLinks[ei].style.display='none'; }
        }
      }
      if(Array.isArray(F.serviceLinks) && F.serviceLinks.length){
        var col = ft.querySelector('.foot-grid > div:last-child') || ft.querySelector('.foot-grid div:nth-child(3)');
        if(col){
          var h4 = col.querySelector('h4');
          var heading = F.servicesHeading || (h4 && h4.textContent) || 'Services';
          col.innerHTML = '<h4>'+esc(heading)+'</h4>'+F.serviceLinks.map(function(L){
            return '<a href="'+esc(L.href||'#quote')+'">'+esc(L.label||'')+'</a>';
          }).join('');
        }
      }
    }
  }
  var _prev = window.applyCfg;
  window.applyCfg = function(cfg){
    if(typeof _prev === 'function') _prev(cfg);
    applyNewApps(cfg || window.__SITE_CONFIG__ || window.SITE_CONFIG);
  };
  function boot(){
    try { applyNewApps(window.__SITE_CONFIG__ || window.SITE_CONFIG); } catch(e) {}
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
</script>
`;

function emptyFallbackArrays(html) {
  for (const name of FALLBACK_ARRAY_VARS) {
    const re = new RegExp('var\\s+' + name + '\\s*=\\s*\\[[\\s\\S]*?\\];', 'g');
    html = html.replace(re, 'var ' + name + '=[];');
  }
  // Prefer empty arrays over named trade fallbacks in ternaries
  html = html.replace(/(\?\s*[\w.]+\s*:\s*)_hd\b/g, '$1[]');
  html = html.replace(/(\?\s*[\w.]+\s*:\s*)_spfd\b/g, '$1[]');
  html = html.replace(/(\?\s*[\w.]+\s*:\s*)_rd\b/g, '$1[]');
  html = html.replace(/(\?\s*[\w.]+\s*:\s*)_sd\b/g, '$1[]');
  html = html.replace(/(\?\s*[\w.]+\s*:\s*)_pd\b/g, '$1[]');
  html = html.replace(/(\?\s*[\w.]+\s*:\s*)_acd\b/g, '$1[]');
  html = html.replace(/(\?\s*[\w.]+\s*:\s*)_atd\b/g, '$1[]');
  html = html.replace(/(\?\s*[\w.]+\s*:\s*)_jfd\b/g, '$1[]');
  html = html.replace(/(\?\s*[\w.]+\s*:\s*)_bfd\b/g, '$1[]');
  html = html.replace(/(\?\s*[\w.]+\s*:\s*)_pfd\b/g, '$1[]');
  html = html.replace(/(\?\s*[\w.]+\s*:\s*)_crd\b/g, '$1[]');
  html = html.replace(/(\?\s*[\w.]+\s*:\s*)_opd\b/g, '$1[]');
  html = html.replace(/(\?\s*[\w.]+\s*:\s*)_cwd\b/g, '$1[]');
  return html;
}

function neutralizeStringDefaults(html) {
  html = html.replace(
    /SP\.heading!=null\?SP\.heading:"[^"]*"/g,
    'SP.heading!=null?SP.heading:""'
  );
  html = html.replace(
    /SP\.eyebrow!=null\?SP\.eyebrow:'[^']*'/g,
    "SP.eyebrow!=null?SP.eyebrow:''"
  );
  html = html.replace(
    /SP\.eyebrow!=null\?SP\.eyebrow:"[^"]*"/g,
    'SP.eyebrow!=null?SP.eyebrow:""'
  );
  return html;
}

function fixFooterSelector(html) {
  html = html.replace(
    /document\.querySelector\('footer\.site'\)/g,
    "document.querySelector('footer.site,footer[data-sec=\"footer\"]')"
  );
  html = html.replace(
    /document\.querySelector\("footer\.site"\)/g,
    'document.querySelector("footer.site,footer[data-sec=\\"footer\\"]")'
  );
  html = html.replace('<footer data-sec="footer">', '<footer class="site" data-sec="footer">');
  return html;
}

function blankStaticTradeBlocks(html) {
  // Why grid body
  html = html.replace(
    /(<div class="why-grid">)[\s\S]*?(<\/div>\s*<\/div>\s*<\/section>)/i,
    '$1$2'
  );
  // Services cards
  html = html.replace(/(<div class="svcs">)[\s\S]*?(<\/div>\s*<\/div>\s*<\/section>)/i, '$1$2');
  // Reviews cards
  html = html.replace(/(<div class="reviews">)[\s\S]*?(<\/div>\s*<\/div>\s*<\/section>)/i, '$1$2');
  // FAQ details
  html = html.replace(/(<div class="faqs?">)[\s\S]*?(<\/div>\s*<\/div>\s*<\/section>)/i, '$1$2');
  // Quote lead-sub + points (keep structure, empty copy)
  html = html.replace(/(<p class="lead-sub">)[\s\S]*?(<\/p>)/i, '$1$2');
  html = html.replace(/(<ul class="q-points">)[\s\S]*?(<\/ul>)/i, '$1$2');
  // Job select options
  html = html.replace(/(<select id="job">)[\s\S]*?(<\/select>)/i, '$1<option></option>$2');
  // Footer blurb / legal / emergency leftovers
  html = html.replace(/(<p class="foot-blurb">)[\s\S]*?(<\/p>)/i, '$1$2');
  html = html.replace(/(<p class="foot-legal">)[\s\S]*?(<\/p>)/i, '$1$2');
  // Split hero static feed list if present
  html = html.replace(/(<div class="sph-feed"[^>]*>)[\s\S]*?(<\/div>)/i, '$1$2');
  // Review highlights grid
  html = html.replace(/(<div class="rh-grid">)[\s\S]*?(<\/div>)/i, '$1$2');
  return html;
}

function rebuild() {
  const trade = JSON.parse(fs.readFileSync(TRADE, 'utf8'));
  let html = String(trade.html || '');

  html = html.replace(/<html([^>]*)>/i, '<html$1 data-ws-shell="landing-shell-neutral-v1">');
  if (!/data-ws-shell="landing-shell-neutral-v1"/.test(html)) {
    html = html.replace('<html', '<html data-ws-shell="landing-shell-neutral-v1"');
  }

  const boot = `
<script id="ws-neutral-boot">
(function(){
  document.documentElement.setAttribute('data-ws-shell','landing-shell-neutral-v1');
})();
</script>
`;
  if (!html.includes('id="ws-neutral-boot"')) {
    html = html.includes('<body')
      ? html.replace(/<body([^>]*)>/i, '<body$1>' + boot)
      : boot + html;
  }

  if (!html.includes('name="ws-renderer-shell"')) {
    html = html.replace(
      '</head>',
      '<meta name="ws-renderer-shell" content="landing-shell-neutral-v1">\n</head>'
    );
  }

  html = emptyFallbackArrays(html);
  html = neutralizeStringDefaults(html);
  html = fixFooterSelector(html);
  html = blankStaticTradeBlocks(html);

  for (const [re, to] of CONTENT_REPLACEMENTS) {
    html = html.replace(re, to);
  }

  if (!html.includes('id="ws-new-apps-apply"')) {
    html = html.includes('</body>')
      ? html.replace('</body>', WS_NEW_APPS_APPLY + '\n</body>')
      : html + WS_NEW_APPS_APPLY;
  }

  // Guarantee theme token "hivis" remains intact in CSS/JS
  if (!/th\.hivis/.test(html) || !/--hivis/.test(html)) {
    throw new Error('rebuild failed: hivis theme token missing after content scrub');
  }
  if (/setv\(th\.,'--'/.test(html) || /var\(---600/.test(html) || /var\(--\)/.test(html)) {
    throw new Error('rebuild failed: broken empty CSS/JS tokens present');
  }

  const residual =
    /We'll clear it today|burst pipes?|Blocked drain|plumber|Gungahlin|Belconnen|Drain fixed|flooded weekend|Leak detection|24\/7 emergency|drain cleaning team|old pipework/i;
  if (residual.test(html)) {
    const m = html.match(residual);
    throw new Error('rebuild failed: trade residual still present: ' + (m && m[0]));
  }

  const out = {
    html,
    shellId: 'landing-shell-neutral-v1',
    generatedFrom: 'trade.template.json',
    generatedAt: new Date().toISOString(),
    note:
      'Content-neutral Website Studio shell. Trade fallbacks emptied. Theme tokens (including hivis) preserved. Live trade.template.json is untouched.'
  };
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('Wrote', OUT, 'htmlBytes', html.length);
}

rebuild();
