// GET /api/integrations/google-ads/callback
// Production: https://app.leadpages.com.au/api/integrations/google-ads/callback
// Relays the one-time OAuth code to exchange, then redirects to the fixed settings page.
// Never builds redirect targets from the request Host header.

const { appPath, safeReturnPath, privacyUrl, termsUrl } = require('../../../lib/app-url');
const { parseState } = require('../../../lib/google-ads/oauth');

module.exports = async (req, res) => {
  const q = req.query || {};
  const code = String(q.code || '');
  const stateRaw = String(q.state || '');
  const err = String(q.error || '');

  const state = stateRaw ? parseState(stateRaw) : null;
  const returnPath = safeReturnPath(state && state.returnPath);
  const successBase = appPath(returnPath);
  const exchangeUrl = appPath('/api/integrations/google-ads/exchange');

  const html = `<!DOCTYPE html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connecting Google Ads…</title>
<style>body{font:15px/1.45 system-ui,sans-serif;max-width:440px;margin:48px auto;padding:0 16px;color:#1a2230;background:#f6f7f9}
.card{border:1px solid #e5e7eb;border-radius:12px;padding:22px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.06)}
h1{font-size:18px;margin:0 0 8px}p{margin:0;color:#5b6878}
.foot{margin-top:18px;font-size:12px;color:#9aa3af}
.foot a{color:#5b6878}</style></head><body>
<div class="card"><h1>Connecting Google Ads…</h1><p id="m">Please wait.</p>
<p class="foot"><a href="${privacyUrl()}" target="_blank" rel="noopener">Privacy</a> · <a href="${termsUrl()}" target="_blank" rel="noopener">Terms</a></p>
</div>
<script>
(function(){
  var err=${JSON.stringify(err)};
  var code=${JSON.stringify(code)};
  var state=${JSON.stringify(stateRaw)};
  var exchangeUrl=${JSON.stringify(exchangeUrl)};
  var successBase=${JSON.stringify(successBase)};
  var m=document.getElementById('m');
  if(err){ m.textContent='Google returned an error: '+err; return; }
  if(!code||!state){ m.textContent='Missing OAuth code. You can close this window and try again from Settings.'; return; }
  fetch(exchangeUrl,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    credentials:'same-origin',
    body:JSON.stringify({code:code,state:state})
  }).then(function(r){ return r.json().then(function(j){ return {ok:r.ok,j:j}; }); })
  .then(function(x){
    if(!x.ok){ m.textContent=(x.j&&x.j.error)||'Connection failed.'; return; }
    var slug=(x.j&&x.j.slug)||'';
    var siteId=(x.j&&x.j.siteId)||'';
    var url=successBase+(successBase.indexOf('?')>=0?'&':'?')+'gads=connected'
      +(siteId?('&siteId='+encodeURIComponent(siteId)):'')
      +(slug?('&site='+encodeURIComponent(slug)):'');
    m.textContent='Connected. Redirecting…';
    location.replace(url);
  }).catch(function(e){ m.textContent='Connection failed: '+(e&&e.message||e); });
})();
</script></body></html>`;

  res.statusCode = 200;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  // Host-only session cookies from Supabase remain available on this same app origin.
  res.end(html);
};
