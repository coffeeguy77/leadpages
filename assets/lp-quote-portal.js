/**
 * LeadPages Online Quote — customer portal page (/quote-portal?t=...).
 */
(function() {
  'use strict';

  var API = '/api/quote-system';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function tokenFromUrl() {
    try {
      return (new URLSearchParams(location.search).get('t') || '').trim();
    } catch (e) { return ''; }
  }

  function render(data) {
    var root = $('qp-root');
    if (!root) return;

    if (!data || !data.ok) {
      root.className = 'error';
      root.innerHTML = '<p>We could not load this quote. The link may have expired.</p>';
      return;
    }

    var q = data.quote || {};
    var accepted = data.accepted;
    var html = '<div class="card">';
    html += accepted
      ? '<span class="badge accepted">Quote accepted</span>'
      : '<span class="badge">Verified quote</span>';
    html += '<h1>' + esc(data.businessName || 'Your quote') + '</h1>';
    html += '<p class="sub">Prepared for ' + esc((data.contact && data.contact.name) || 'you') + '</p>';
    html += '<p class="total">' + esc(q.totalFormatted || '') + ' <small style="font-size:14px;font-weight:500;color:#6b7280">inc GST</small></p>';
    html += '<ul class="lines">';
    (q.breakdown || []).forEach(function(row) {
      html += '<li><span>' + esc(row.label) + '</span><span>' + esc(formatMoney(row.totalCents)) + '</span></li>';
    });
    html += '</ul>';
    html += '<div class="actions">';
    if (data.pdfUrl) {
      html += '<a class="btn btn-ghost" href="' + esc(data.pdfUrl) + '" target="_blank" rel="noopener">Download PDF</a>';
    }
    if (data.canAccept) {
      html += '<button type="button" class="btn btn-primary" id="qp-accept">Accept this quote</button>';
    } else if (accepted) {
      html += '<button type="button" class="btn btn-primary" disabled>Accepted</button>';
    }
    html += '</div><p class="msg" id="qp-msg"></p></div>';
    root.className = '';
    root.innerHTML = html;

    var btn = $('qp-accept');
    if (btn) {
      btn.addEventListener('click', function() {
        if (!confirm('Accept this quote? The business will be notified.')) return;
        btn.disabled = true;
        var msg = $('qp-msg');
        fetch(API + '/portal-accept', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: tokenFromUrl(), confirm: true })
        }).then(function(r) { return r.json(); }).then(function(res) {
          if (res.ok) {
            if (msg) msg.textContent = 'Thank you — your acceptance has been recorded.';
            setTimeout(function() { location.reload(); }, 1200);
          } else {
            if (msg) { msg.className = 'msg err'; msg.textContent = 'Could not accept. Please try again.'; }
            btn.disabled = false;
          }
        }).catch(function() {
          if (msg) { msg.className = 'msg err'; msg.textContent = 'Network error.'; }
          btn.disabled = false;
        });
      });
    }
  }

  function formatMoney(cents) {
    return '$' + (Math.round(cents) / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function boot() {
    var token = tokenFromUrl();
    if (!token) {
      var root = $('qp-root');
      if (root) { root.className = 'error'; root.innerHTML = '<p>Missing quote link.</p>'; }
      return;
    }
    fetch(API + '/portal?t=' + encodeURIComponent(token))
      .then(function(r) { return r.json(); })
      .then(render)
      .catch(function() { render({ ok: false }); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
