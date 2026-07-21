/**
 * LeadPages Online Quote — customer portal (/quote-portal?t=... or ?c=...).
 *   t = single-quote portal token (after SMS)
 *   c = customer jobs portal (all quotes for that email)
 *   c + job = one job detail with edit / accept / email
 */
(function() {
  'use strict';

  var API = '/api/quote-system';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function formatMoney(cents) {
    return '$' + (Math.round(cents) / 100).toLocaleString('en-AU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
  function params() {
    try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(); }
  }
  function tokenT() { return (params().get('t') || '').trim(); }
  function tokenC() { return (params().get('c') || '').trim(); }
  function jobId() { return (params().get('job') || '').trim(); }

  function setRoot(html, cls) {
    var root = $('qp-root');
    if (!root) return;
    root.className = cls || '';
    root.innerHTML = html;
  }

  function renderError(msg) {
    setRoot('<p>' + esc(msg || 'We could not load this quote. The link may have expired.') + '</p>', 'error');
  }

  function renderJobs(data) {
    var jobs = data.jobs || [];
    var html = '<div class="card">';
    html += '<span class="badge">Your jobs</span>';
    html += '<h1>' + esc(data.businessName || 'Your quotes') + '</h1>';
    html += '<p class="sub">Signed in as ' + esc((data.contact && data.contact.email) || 'you') +
      '. Open a job to adjust numbers, accept, or email yourself a PDF.</p>';

    if (!jobs.length) {
      html += '<p class="empty">No quotes yet. Complete a quote on the website and verify by SMS to see it here.</p>';
    } else {
      html += '<ul class="jobs">';
      jobs.forEach(function(job) {
        var href = '?c=' + encodeURIComponent(data.accessToken) + '&job=' + encodeURIComponent(job.id);
        html += '<li class="job">';
        html += '<a class="job-link" href="' + esc(href) + '">';
        html += '<div class="job-top"><strong>' + esc(job.title || 'Quote') + '</strong>';
        html += job.accepted
          ? '<span class="pill accepted">Accepted</span>'
          : (job.smsVerified ? '<span class="pill">Open</span>' : '<span class="pill muted">Pending SMS</span>');
        html += '</div>';
        html += '<div class="job-meta">';
        if (job.eventDate) html += '<span>' + esc(job.eventDate) + '</span>';
        if (job.totalFormatted) html += '<span class="job-total">' + esc(job.totalFormatted) + '</span>';
        html += '</div></a></li>';
      });
      html += '</ul>';
    }
    html += '</div>';
    setRoot(html);
  }

  function renderJob(data) {
    var q = data.quote || {};
    var progress = data.progress || {};
    var lines = progress.beverageLines || [];
    var html = '<div class="card">';
    if (data.jobsPortalUrl) {
      html += '<p class="back"><a href="' + esc(data.jobsPortalUrl) + '">← All jobs</a></p>';
    }
    html += data.accepted
      ? '<span class="badge accepted">Quote accepted</span>'
      : '<span class="badge">Verified quote</span>';
    html += '<h1>' + esc(data.businessName || 'Your quote') + '</h1>';
    html += '<p class="sub">Prepared for ' + esc((data.contact && data.contact.name) || 'you') + '</p>';
    html += '<p class="total">' + esc(q.totalFormatted || '') +
      ' <small style="font-size:14px;font-weight:500;color:#6b7280">inc GST</small></p>';
    html += '<ul class="lines">';
    (q.breakdown || []).forEach(function(row) {
      html += '<li><span>' + esc(row.label) + '</span><span>' + esc(formatMoney(row.totalCents)) + '</span></li>';
    });
    html += '</ul>';

    if (data.canEdit) {
      html += '<div class="edit">';
      html += '<h2>Adjust numbers</h2>';
      html += '<p class="hint">Update quantities and we will recalculate your total. Accept when you are happy.</p>';
      if (progress.eventDate != null || true) {
        html += '<label class="field"><span>Event date</span>' +
          '<input type="date" id="qp-event-date" value="' + esc(progress.eventDate || '') + '"></label>';
      }
      html += '<label class="field"><span>Hours</span>' +
        '<input type="number" min="1" max="48" id="qp-hours" value="' + esc(progress.hours != null ? progress.hours : '') + '"></label>';
      if (lines.length) {
        html += '<div class="qty-list">';
        lines.forEach(function(line, i) {
          html += '<label class="field"><span>Package qty</span>' +
            '<input type="number" min="0" class="qp-bev-qty" data-bev="' + esc(line.beverageId) +
            '" data-idx="' + i + '" value="' + esc(line.quantity != null ? line.quantity : 0) + '"></label>';
        });
        html += '</div>';
      } else if (progress.guestCount != null) {
        html += '<label class="field"><span>Guests / units</span>' +
          '<input type="number" min="0" id="qp-guests" value="' + esc(progress.guestCount) + '"></label>';
      }
      html += '<button type="button" class="btn btn-ghost" id="qp-save">Update quote</button>';
      html += '</div>';
    }

    html += '<div class="actions">';
    if (data.pdfUrl) {
      html += '<a class="btn btn-ghost" href="' + esc(data.pdfUrl) + '" target="_blank" rel="noopener">Download PDF</a>';
    }
    html += '<button type="button" class="btn btn-ghost" id="qp-email">Email me this quote</button>';
    if (data.canAccept) {
      html += '<button type="button" class="btn btn-primary" id="qp-accept">Accept this quote</button>';
    } else if (data.accepted) {
      html += '<button type="button" class="btn btn-primary" disabled>Accepted</button>';
    }
    html += '</div><p class="msg" id="qp-msg"></p></div>';
    setRoot(html);
    wireJob(data);
  }

  function renderSingle(data) {
    // Legacy ?t= single-quote portal — same detail view without jobs chrome.
    renderJob(Object.assign({}, data, {
      canEdit: false,
      jobsPortalUrl: null,
      accessToken: null,
      sessionId: null
    }));
  }

  function wireJob(data) {
    var msg = $('qp-msg');
    function setMsg(text, isErr) {
      if (!msg) return;
      msg.className = isErr ? 'msg err' : 'msg';
      msg.textContent = text || '';
    }

    var accept = $('qp-accept');
    if (accept) {
      accept.addEventListener('click', function() {
        if (!confirm('Accept this quote? The business will be notified.')) return;
        accept.disabled = true;
        var body = data.accessToken && data.sessionId
          ? null
          : { token: tokenT(), confirm: true };
        // Accept still uses session portal token endpoint.
        var acceptToken = tokenT();
        if (!acceptToken && data.portalUrl) {
          try {
            acceptToken = new URL(data.portalUrl, location.origin).searchParams.get('t') || '';
          } catch (e) { acceptToken = ''; }
        }
        if (!acceptToken) {
          setMsg('Could not accept — missing quote link.', true);
          accept.disabled = false;
          return;
        }
        fetch(API + '/portal-accept', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: acceptToken, confirm: true })
        }).then(function(r) { return r.json(); }).then(function(res) {
          if (res.ok) {
            setMsg('Thank you — your acceptance has been recorded.');
            setTimeout(function() { location.reload(); }, 1000);
          } else {
            setMsg('Could not accept. Please try again.', true);
            accept.disabled = false;
          }
        }).catch(function() {
          setMsg('Network error.', true);
          accept.disabled = false;
        });
      });
    }

    var emailBtn = $('qp-email');
    if (emailBtn) {
      emailBtn.addEventListener('click', function() {
        emailBtn.disabled = true;
        var payload = data.accessToken && data.sessionId
          ? { c: data.accessToken, job: data.sessionId }
          : { t: tokenT() };
        fetch(API + '/portal-email', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(function(r) { return r.json(); }).then(function(res) {
          emailBtn.disabled = false;
          if (res.ok && res.sent) setMsg('Quote emailed to you.');
          else setMsg('Could not send email. Try again shortly.', true);
        }).catch(function() {
          emailBtn.disabled = false;
          setMsg('Network error.', true);
        });
      });
    }

    var save = $('qp-save');
    if (save && data.canEdit && data.accessToken && data.sessionId) {
      save.addEventListener('click', function() {
        save.disabled = true;
        var progress = {};
        var hours = $('qp-hours');
        if (hours && hours.value !== '') progress.hours = hours.value;
        var eventDate = $('qp-event-date');
        if (eventDate) progress.eventDate = eventDate.value;
        var guests = $('qp-guests');
        if (guests && guests.value !== '') progress.guestCount = guests.value;
        var bevInputs = document.querySelectorAll('.qp-bev-qty');
        if (bevInputs.length) {
          progress.beverageLines = Array.prototype.map.call(bevInputs, function(inp) {
            return {
              beverageId: inp.getAttribute('data-bev'),
              quantity: parseInt(inp.value, 10) || 0
            };
          });
        }
        fetch(API + '/portal-update', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            c: data.accessToken,
            job: data.sessionId,
            progress: progress
          })
        }).then(function(r) { return r.json(); }).then(function(res) {
          save.disabled = false;
          if (res.ok) {
            setMsg('Quote updated.');
            setTimeout(function() { location.reload(); }, 600);
          } else {
            setMsg('Could not update quote.', true);
          }
        }).catch(function() {
          save.disabled = false;
          setMsg('Network error.', true);
        });
      });
    }
  }

  function boot() {
    var c = tokenC();
    var t = tokenT();
    var job = jobId();

    if (c) {
      var url = API + '/portal-jobs?c=' + encodeURIComponent(c);
      if (job) url += '&job=' + encodeURIComponent(job);
      fetch(url)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (!data || !data.ok) return renderError();
          if (data.mode === 'job') renderJob(data);
          else renderJobs(data);
        })
        .catch(function() { renderError(); });
      return;
    }

    if (!t) {
      renderError('Missing quote link.');
      return;
    }

    fetch(API + '/portal?t=' + encodeURIComponent(t))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data || !data.ok) return renderError();
        renderSingle(data);
      })
      .catch(function() { renderError(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
