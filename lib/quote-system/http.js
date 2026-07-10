/**
 * Online Quote System — shared HTTP helpers.
 */

function readBody(req) {
  return new Promise(function(resolve) {
    if (req.body) {
      if (typeof req.body === 'string') {
        try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); }
      }
      return resolve(req.body);
    }
    var raw = '';
    req.on('data', function(c) { raw += c; });
    req.on('end', function() {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
    req.on('error', function() { resolve({}); });
  });
}

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(obj));
}

function clean(s, n) {
  return (s == null ? '' : String(s)).trim().slice(0, n || 400);
}

module.exports = { readBody, json, clean };
