'use strict';

/**
 * GET /api/integrations/tag-manager/callback
 * HTML relay that posts code+state to exchange (same pattern as Google Ads).
 */

module.exports = async (req, res) => {
  const q = req.query || {};
  const code = String(q.code || '');
  const state = String(q.state || '');
  const err = String(q.error || '');
  const html =
    '<!doctype html><meta charset="utf-8"><title>Connecting Tag Manager…</title>' +
    '<body style="font-family:system-ui;padding:40px;text-align:center">' +
    '<p id="m">Finishing Tag Manager connection…</p>' +
    '<script>(function(){' +
    'var err=' +
    JSON.stringify(err) +
    ';var code=' +
    JSON.stringify(code) +
    ';var state=' +
    JSON.stringify(state) +
    ';' +
    'if(err){document.getElementById("m").textContent="Connection cancelled: "+err;return;}' +
    'fetch("/api/integrations/tag-manager/exchange",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code:code,state:state})})' +
    '.then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};});})' +
    '.then(function(x){' +
    'if(!x.ok){document.getElementById("m").textContent=(x.j&&x.j.message)||x.j.error||"Exchange failed";return;}' +
    'location.href=(x.j&&x.j.returnPath)||"/settings/integrations/tag-manager?gtm=connected";' +
    '}).catch(function(e){document.getElementById("m").textContent=String(e&&e.message||e);});' +
    '})();</script></body>';
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(html);
};
