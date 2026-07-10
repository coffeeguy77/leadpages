#!/usr/bin/env python3
"""Patch manage.html for Online Quote admin (Stage 7)."""
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "manage.html"
text = path.read_text(encoding="utf-8")

replacements = [
    (
        '    <button class="anav-btn" id="nav-apps" aria-selected="false">App Marketplace</button>\n',
        '    <button class="anav-btn" id="nav-apps" aria-selected="false">App Marketplace</button>\n'
        '    <button class="anav-btn" id="nav-onlinequotes" aria-selected="false" style="display:none">Online quotes</button>\n',
    ),
    (
        '  <div id="av-apps" hidden></div>\n\n  <div id="av-mailer" hidden></div>',
        '  <div id="av-apps" hidden></div>\n\n  <div id="av-onlinequotes" hidden></div>\n\n  <div id="av-mailer" hidden></div>',
    ),
    (
        "['mailer','av-mailer',renderMailer],['messages','av-messages',renderMessages],['apps','av-apps',renderAppsMarketplace]];",
        "['mailer','av-mailer',renderMailer],['messages','av-messages',renderMessages],['apps','av-apps',renderAppsMarketplace],['onlinequotes','av-onlinequotes',renderOnlineQuoteAdmin]];",
    ),
    (
        "const ALLOWED={ super:['rates','landing','appearance','contact','logo','users','demothemes','details','mailer','messages','apps','dashboard'], broker:['appearance','contact','logo','landing','details','mailer','messages','apps','dashboard'], leads:['rates'] };",
        "const ALLOWED={ super:['rates','landing','appearance','contact','logo','users','demothemes','details','mailer','messages','apps','onlinequotes','dashboard'], broker:['appearance','contact','logo','landing','details','mailer','messages','apps','onlinequotes','dashboard'], leads:['rates'] };",
    ),
    (
        "'trade':['dashboard','details','landing','apps','mailer','messages']",
        "'trade':['dashboard','details','landing','apps','onlinequotes','mailer','messages']",
    ),
    (
        "'emergencyAvailability','estimateBuilder','finance','serviceAreaMap'",
        "'emergencyAvailability','onlineQuote','estimateBuilder','finance','serviceAreaMap'",
    ),
    (
        "['crew','Team Members'],['quote','Quote'],['faq','FAQ']",
        "['crew','Team Members'],['onlineQuote','Online Quote'],['quote','Quote'],['faq','FAQ']",
    ),
    (
        "estimateBuilder:{on:false,eyebrow:'Instant estimate'",
        "onlineQuote:{on:false,eyebrow:'Online quote',heading:'Get your verified quote',intro:'Answer a few questions — verify your email to see your total, then SMS for the full breakdown.'},\n    estimateBuilder:{on:false,eyebrow:'Instant estimate'",
    ),
    (
        "['Lead Capture & Conversion',['quote','promotions','faq','estimateBuilder'",
        "['Lead Capture & Conversion',['quote','onlineQuote','promotions','faq','estimateBuilder'",
    ),
    (
        "'estimateBuilder':'calculator','emergencyAvailability':'alert-circle',",
        "'onlineQuote':'calculator','estimateBuilder':'calculator','emergencyAvailability':'alert-circle',",
    ),
    (
        "    var sub=l.message || [det.job,det.suburb].filter(Boolean).join(' · ') || (l.kind||'');",
        "    var sub=l.message || [det.job,det.suburb].filter(Boolean).join(' · ') || (l.kind||'');\n"
        "    if((l.kind||'')==='quote') sub=(det.totalFormatted?('Quote: '+det.totalFormatted):'Online quote')+(sub?' · '+sub:'');",
    ),
]

marker = "    } else if(sub==='estimateBuilder'){"
insert_block = r"""    } else if(sub==='onlineQuote'){
      body.innerHTML=secCard(c,'onlineQuote','Online Quote wizard',true,[['eyebrow','Eyebrow'],['heading','Heading'],['intro','Intro','ta']])
        +'<div class="card" style="margin-bottom:22px;"><h2>How it works</h2><p class="lede">Visitors complete the wizard on your live site. Prices are calculated server-side — email verification reveals the total inc GST; SMS unlocks the itemised breakdown. Quote submissions appear in <strong>Dashboard → Captured leads</strong> with kind <code>quote</code>.</p>'
        +'<p class="hint" style="margin:0;">Turn this section on, publish, then manage sessions under the <strong>Online quotes</strong> tab. Embed slug: <code>'+esc(currentSiteSlug||'your-slug')+'</code></p></div>';
      wireSec(c,'onlineQuote',true,[['eyebrow'],['heading'],['intro']]);
"""

admin_fn = r"""
  /* ============================ ONLINE QUOTE ADMIN ============================ */
  var LPONLINEQUOTE={ siteId:null, config:null, sessions:[] };
  async function _oqAuthHeaders(){
    var se=await sb.auth.getSession();
    var tk=se&&se.data&&se.data.session&&se.data.session.access_token;
    return tk?{Authorization:'Bearer '+tk}:{};
  }
  function _oqMoney(cents){
    if(cents==null||isNaN(cents)) return '—';
    return '$'+(Math.round(cents)/100).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  async function renderOnlineQuoteAdmin(){
    var box=$('av-onlinequotes'); if(!box) return;
    if(currentSiteTemplate!=='trade'){
      box.innerHTML='<div class="card"><p class="lede">Online quotes are available on trade sites only.</p></div>';
      return;
    }
    if(!currentSiteId){ box.innerHTML='<div class="card"><p class="lede">Select a site first.</p></div>'; return; }
    if(LPONLINEQUOTE.siteId!==currentSiteId){ LPONLINEQUOTE.siteId=currentSiteId; LPONLINEQUOTE.config=null; LPONLINEQUOTE.sessions=[]; }
    box.innerHTML='<div class="card"><h2>Online Quote System</h2><p class="lede">Loading…</p></div>';
    try{
      var hdr=await _oqAuthHeaders();
      var cfgR=await fetch('/api/quote-system/admin/config?site_id='+encodeURIComponent(currentSiteId),{headers:hdr});
      var cfgJ=await cfgR.json();
      var sesR=await fetch('/api/quote-system/admin/sessions?site_id='+encodeURIComponent(currentSiteId)+'&limit=30',{headers:hdr});
      var sesJ=await sesR.json();
      LPONLINEQUOTE.config=cfgJ;
      LPONLINEQUOTE.sessions=(sesJ&&sesJ.sessions)||[];
      var isSuper=currentRole==='super';
      var slug=currentSiteSlug||'';
      var admin=cfgJ.admin;
      var restricted=cfgJ.error==='classification_restricted';
      var notConfigured=!admin||cfgJ.message==='not_configured';
      var html='<div class="card"><h2>Online Quote System</h2>'
        +'<p class="lede">Verified quote wizard with email and SMS gating. Pricing is calculated server-side — never in page source until verification.</p>';
      if(notConfigured){
        html+='<div class="hint" style="margin:12px 0;padding:14px;border-radius:12px;background:var(--panel-soft);">No quote system binding yet. '
          +(isSuper?'Enable below or run <code>node scripts/seed-bean-culture-quote.js</code> for Bean Culture.':'Contact your platform administrator to provision pricing.')
          +'</div>';
      } else if(restricted){
        html+='<div class="hint" style="margin:12px 0;padding:14px;border-radius:12px;background:var(--panel-soft);">Configuration is restricted (<code>'+esc(cfgJ.classification||'private')+'</code>). '
          +(isSuper?'Run the SQL migrations and Bean Culture seed, then refresh.':'Your workspace stays blank until an administrator sets up pricing.')
          +'</div>';
      } else if(admin){
        html+='<div style="display:flex;flex-wrap:wrap;gap:16px;margin:16px 0;">'
          +'<div><span style="font-size:11px;color:var(--ink-soft);display:block;">Status</span><b>'+(admin.enabled?'Enabled':'Disabled')+'</b></div>'
          +'<div><span style="font-size:11px;color:var(--ink-soft);display:block;">Classification</span><b>'+esc(admin.classification||'—')+'</b></div>'
          +(admin.activeVersion?'<div><span style="font-size:11px;color:var(--ink-soft);display:block;">Config</span><b>v'+admin.activeVersion.versionNumber+'</b></div>':'')
          +'</div>';
        if(isSuper&&admin.activeVersion&&admin.activeVersion.config){
          var qc=admin.activeVersion.config;
          html+='<p class="hint">'+(qc.products||[]).length+' products · labour min '+((qc.labour&&qc.labour.minimumHours)||3)+' hr @ '+_oqMoney(qc.labour&&qc.labour.hourlyCents)+'/hr</p>';
        }
      }
      html+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin:16px 0;">'
        +(slug?'<a class="btn ghost" href="/'+esc(slug)+'" target="_blank" rel="noopener" style="text-decoration:none">Live site ↗</a>':'')
        +'<button type="button" class="btn ghost" id="oq-refresh">Refresh</button>'
        +'</div>';
      html+='<div class="card" style="margin-top:18px;"><h3 style="margin:0 0 8px;">Page section</h3>'
        +'<p class="lede" style="margin:0 0 10px;">Enable <strong>Online Quote</strong> in Page editor → Lead Capture, then publish. The wizard appears above your quote form on the live site.</p>'
        +'<button type="button" class="btn ghost" id="oq-goto-editor">Open Page editor</button></div>';
      if(isSuper){
        html+='<div class="card" style="margin-top:18px;border:1px solid var(--accent-soft);"><h3 style="margin:0 0 8px;">Super admin</h3>'
          +'<p class="lede" style="margin:0 0 12px;">Create or enable the quote_systems row for this site (does not copy private pricing to other tenants).</p>'
          +'<button type="button" class="btn" id="oq-enable">'+(admin&&admin.enabled?'Re-save enabled':'Enable quote system')+'</button></div>';
      }
      html+='<div class="card" style="margin-top:18px;"><h3 style="margin:0 0 8px;">Recent sessions</h3>';
      var sessions=LPONLINEQUOTE.sessions||[];
      if(!sessions.length){
        html+='<p class="hint">No wizard sessions yet.</p>';
      } else {
        html+='<div style="display:flex;flex-direction:column;gap:8px">';
        sessions.forEach(function(s){
          var lq=s.latestQuote||{};
          var total=_oqMoney(lq.total_cents);
          html+='<div class="lp-dash-row" style="padding:12px 14px;"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;">'
            +'<span style="font-weight:600;">'+esc((s.contact&&s.contact.name)||'Visitor')+'</span>'
            +'<span style="font-size:11px;color:var(--ink-soft);">'+esc(s.verificationLevel||s.status||'')+'</span></div>'
            +'<div style="font-size:13px;color:var(--ink-soft);margin-top:4px;">'+esc((s.contact&&s.contact.email)||'')+' · '+total+'</div></div>';
        });
        html+='</div>';
      }
      html+='</div></div>';
      box.innerHTML=html;
      var ref=$('oq-refresh'); if(ref) ref.addEventListener('click',renderOnlineQuoteAdmin);
      var ed=$('oq-goto-editor'); if(ed) ed.addEventListener('click',function(){ showView('details'); landingSub='onlineQuote'; renderDetails(); });
      var en=$('oq-enable'); if(en) en.addEventListener('click',async function(){
        try{
          var h=await _oqAuthHeaders(); h['Content-Type']='application/json';
          var r=await fetch('/api/quote-system/admin/config',{method:'POST',headers:h,body:JSON.stringify({site_id:currentSiteId,enabled:true})});
          var j=await r.json();
          if(j.ok){ if(typeof toast==='function') toast('Quote system enabled'); renderOnlineQuoteAdmin(); }
          else if(typeof toast==='function') toast('Failed: '+(j.error||'unknown'));
        }catch(e){ if(typeof toast==='function') toast('Network error'); }
      });
    }catch(e){
      box.innerHTML='<div class="card"><p class="lede">Could not load: '+esc(String(e&&e.message||e))+'</p></div>';
    }
  }

"""

for old, new in replacements:
    if old not in text:
        raise SystemExit(f"Missing patch anchor:\n{old[:80]}...")
    text = text.replace(old, new, 1)

if marker not in text:
    raise SystemExit("Missing estimateBuilder subtab marker")
text = text.replace(marker, insert_block + marker, 1)

nav_marker = "  /* ═══════════════════════════════════════════════════════\n     APP MARKETPLACE — Phase A2"
if nav_marker not in text:
    raise SystemExit("Missing marketplace marker")
text = text.replace(nav_marker, admin_fn + nav_marker, 1)

path.write_text(text, encoding="utf-8")
print("Patched manage.html")
