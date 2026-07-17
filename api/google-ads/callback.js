// GET /api/google-ads/callback — OAuth redirect landing (relay to exchange)
// Mirrors Instagram: return a tiny HTML page that POSTs the code so scrapers
// cannot burn the one-time code before the browser does.

module.exports = async (req, res) => {
  const q = req.query || {};
  const code = String(q.code || '');
  const state = String(q.state || '');
  const err = String(q.error || '');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Connecting Google Ads…</title>
<style>body{font:15px/1.45 system-ui,sans-serif;max-width:420px;margin:48px auto;padding:0 16px;color:#1a2230}
.card{border:1px solid #e5e7eb;border-radius:12px;padding:22px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.06)}
h1{font-size:18px;margin:0 0 8px}p{margin:0;color:#5b6878}</style></head><body>
<div class="card"><h1>Connecting Google Ads…</h1><p id="m">Please wait.</p></div>
<script>
(function(){
  var err=${JSON.stringify(err)};
  var code=${JSON.stringify(code)};
  var state=${JSON.stringify(state)};
  var m=document.getElementById('m');
  if(err){ m.textContent='Google returned an error: '+err; return; }
  if(!code||!state){ m.textContent='Missing OAuth code. You can close this window and try again.'; return; }
  fetch('/api/google-ads/exchange',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({code:code,state:state})
  }).then(function(r){ return r.json().then(function(j){ return {ok:r.ok,j:j}; }); })
  .then(function(x){
    if(!x.ok){ m.textContent=(x.j&&x.j.error)||'Connection failed.'; return; }
    var slug=(x.j&&x.j.slug)||'';
    var url='/manage?gads=connected'+(slug?('&site='+encodeURIComponent(slug)):'');
    m.textContent='Connected. Redirecting…';
    location.replace(url);
  }).catch(function(e){ m.textContent='Connection failed: '+(e&&e.message||e); });
})();
</script></body></html>`;

  res.statusCode = 200;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(html);
};
