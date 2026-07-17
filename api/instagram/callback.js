// api/instagram/callback.js — relay page. Does NOT exchange the code itself.
// Returns a tiny HTML page whose JS POSTs code+state to /api/instagram/exchange.
// Link-preview scanners and prefetchers don't execute JS, so they can't burn
// the one-time code before the real browser does.
// Post-login redirect uses APP_URL (app.leadpages.com.au in production) — not Host.

const { appPath } = require('../../lib/app-url');

module.exports = async (req, res) => {
  const manageBase = appPath('/manage');
  const exchangeUrl = appPath('/api/instagram/exchange');
  res.setHeader('cache-control','no-store');
  res.setHeader('x-robots-tag','noindex');
  res.setHeader('content-type','text/html; charset=utf-8');
  res.status(200).send(`<!doctype html>
<html><head><meta name="robots" content="noindex"><title>Connecting Instagram…</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#1a2230}</style>
</head><body>
<div id="msg">Finishing Instagram connection…</div>
<script>
(function(){
  var p=new URLSearchParams(location.search);
  var code=p.get('code'), state=p.get('state'), err=p.get('error');
  var manageBase=${JSON.stringify(manageBase)};
  var exchangeUrl=${JSON.stringify(exchangeUrl)};
  function go(status, site, detail){
    var u=manageBase+(manageBase.indexOf('?')>=0?'&':'?')+'ig='+encodeURIComponent(status)
      +(site?'&site='+encodeURIComponent(site):'')
      +(detail?'&ig_detail='+encodeURIComponent(String(detail).slice(0,200)):'');
    location.replace(u);
  }
  if(err){ go('denied','', p.get('error_description')||err); return; }
  if(!code||!state){ go('error','','missing_code_or_state'); return; }
  fetch(exchangeUrl,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    credentials:'same-origin',
    body:JSON.stringify({code:code,state:state})
  }).then(function(r){return r.json();})
  .then(function(j){
    if(j&&j.ok) go('connected', j.slug||'');
    else go('error', j&&j.slug||'', (j&&j.error)||'unknown');
  })
  .catch(function(e){ go('error','','network:'+e); });
})();
</script></body></html>`);
};
