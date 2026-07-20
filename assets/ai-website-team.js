/**
 * AI Website Team — Phase 1 Atlas advisory panel for manage.html.
 * Advisory only. Never publishes or mutates live config from this panel.
 */
(function () {
  'use strict';

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  async function token() {
    if (!window.sb) return null;
    var r = await window.sb.auth.getSession();
    return (r && r.data && r.data.session && r.data.session.access_token) || null;
  }

  async function api(path, body) {
    var tok = await token();
    var res = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: tok ? 'Bearer ' + tok : ''
      },
      body: JSON.stringify(body || {})
    });
    var j = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      var err = new Error(j.message || j.error || 'HTTP ' + res.status);
      err.payload = j;
      err.status = res.status;
      throw err;
    }
    if (j.persisted === false) {
      var e2 = new Error(j.message || j.error || 'Not persisted');
      e2.payload = j;
      throw e2;
    }
    return j;
  }

  function editorContext() {
    return {
      siteId: window.currentSiteId || null,
      pageId: window.lpCur && (window.lpCur.id || window.lpCur.slug) || null,
      pageSlug: window.lpCur && window.lpCur.slug || null,
      pageTitle: window.lpCur && (window.lpCur.title || window.lpCur.h1) || null,
      pagePurpose: window.activeView === 'landing' ? 'landing' : 'homepage',
      editorTab: window.activeView || null,
      selectedSection: window.landingSub || null,
      selectedApp: null
    };
  }

  function setMsg(el, text, cls) {
    if (!el) return;
    el.textContent = text || '';
    el.className = 'ai-team-msg' + (cls ? ' ' + cls : '');
  }

  function renderBootstrapForm(review) {
    var r = review || {};
    var services = Array.isArray(r.mainServices) ? r.mainServices.join('\n') : r.mainServices || '';
    var areas = Array.isArray(r.serviceAreas) ? r.serviceAreas.join('\n') : r.serviceAreas || '';
    return (
      '<div class="card ai-team-bootstrap" style="margin-bottom:18px">' +
      '<h2 style="margin:0 0 6px">Site Knowledge review</h2>' +
      '<p class="lede" style="margin:0 0 14px">Confirm or correct these details. Interpretive fields stay unconfirmed until you save.</p>' +
      '<div class="grid2" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      field('ai-br-name', 'Business name', r.businessName) +
      field('ai-br-industry', 'Industry', r.industry) +
      field('ai-br-audience', 'Target audience', r.targetAudience) +
      field('ai-br-goal', 'Primary goal', r.primaryGoal) +
      field('ai-br-cta', 'Preferred CTA', r.preferredCta) +
      field('ai-br-tone', 'Brand tone', r.brandTone) +
      '</div>' +
      '<div style="margin-top:12px">' +
      '<label for="ai-br-services">Main services <span style="font-weight:500">(one per line)</span></label>' +
      '<textarea id="ai-br-services" rows="4" style="width:100%">' +
      esc(services) +
      '</textarea></div>' +
      '<div style="margin-top:12px">' +
      '<label for="ai-br-areas">Service areas <span style="font-weight:500">(one per line)</span></label>' +
      '<textarea id="ai-br-areas" rows="3" style="width:100%">' +
      esc(areas) +
      '</textarea></div>' +
      '<div style="margin-top:12px">' +
      '<label for="ai-br-restrict">Content restrictions</label>' +
      '<textarea id="ai-br-restrict" rows="2" style="width:100%">' +
      esc(r.contentRestrictions || '') +
      '</textarea></div>' +
      '<div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">' +
      '<button type="button" class="btn" id="ai-br-save">Save Site Knowledge</button>' +
      '<span id="ai-br-msg" class="ai-team-msg"></span></div></div>'
    );
  }

  function field(id, label, value) {
    return (
      '<div><label for="' +
      id +
      '">' +
      esc(label) +
      '</label><input id="' +
      id +
      '" type="text" style="width:100%" value="' +
      esc(value || '') +
      '"></div>'
    );
  }

  function renderRec(r) {
    var gap = r.capability_gap || r.capabilityGap ? ' · capability gap' : '';
    var exec = r.executable ? '' : ' · advisory';
    return (
      '<article class="card" style="margin:0 0 10px;padding:14px 16px">' +
      '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">' +
      '<strong>' +
      esc(r.title) +
      '</strong>' +
      '<span style="font-size:12px;opacity:.75">' +
      esc(r.specialist || 'atlas') +
      ' · ' +
      esc(r.status || '') +
      esc(exec) +
      esc(gap) +
      '</span></div>' +
      '<p style="margin:8px 0 0;font-size:14px">' +
      esc(r.problem || '') +
      '</p>' +
      '<p style="margin:6px 0 0;font-size:13px;opacity:.85">' +
      esc(r.reason || '') +
      '</p>' +
      '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">' +
      '<button type="button" class="btn ghost sm ai-rec-approve" data-id="' +
      esc(r.id) +
      '">Approve</button>' +
      '<button type="button" class="btn ghost sm ai-rec-reject" data-id="' +
      esc(r.id) +
      '">Reject</button>' +
      '</div></article>'
    );
  }

  async function loadPanel() {
    var box = $('av-ai-team');
    if (!box) return;
    if (!window.currentSiteId) {
      box.innerHTML = '<div class="card"><p class="lede">Select a site to open the AI Website Team.</p></div>';
      return;
    }

    box.innerHTML =
      '<div class="card"><p class="lede">Loading Site Brain…</p><span id="ai-team-load-msg"></span></div>';

    var state = { brain: null, review: null, needsReview: false, recommendations: [] };

    try {
      var got = await api('/api/site-brain/get', { siteId: window.currentSiteId });
      state.brain = got.brain;
      state.review = got.review;
      state.needsReview = !!got.needsBootstrapReview;
    } catch (e) {
      if (e.status === 404 || (e.payload && e.payload.error === 'not_found')) {
        try {
          var synced = await api('/api/site-brain/sync', { siteId: window.currentSiteId });
          state.brain = synced.brain;
          state.review = synced.review;
          state.needsReview = !!synced.needsBootstrapReview;
        } catch (e2) {
          box.innerHTML =
            '<div class="card"><h2>Site Brain unavailable</h2><p class="lede">' +
            esc(e2.message || String(e2)) +
            '</p><p class="lede">If this is production, apply <code>db/site_brain.sql</code>. Nothing was saved.</p></div>';
          return;
        }
      } else {
        box.innerHTML =
          '<div class="card"><h2>Site Brain unavailable</h2><p class="lede">' +
          esc(e.message || String(e)) +
          '</p><p class="lede">Nothing was saved.</p></div>';
        return;
      }
    }

    try {
      var listed = await api('/api/ai-team/recommendations', {
        siteId: window.currentSiteId,
        action: 'list'
      });
      state.recommendations = listed.recommendations || [];
    } catch (_e) {
      state.recommendations = [];
    }

    paint(state);
  }

  function paint(state) {
    var box = $('av-ai-team');
    if (!box) return;
    var snap = (state.brain && state.brain.snapshot) || {};
    var summaryName =
      (snap.business && snap.business.name && snap.business.name.value) ||
      window.currentSiteName ||
      'This website';
    var goal =
      (snap.goals && snap.goals.primary && snap.goals.primary.value) || 'Not set yet';
    var bootstrap = (state.brain && state.brain.bootstrap_status) || 'pending';
    var openTasks = (snap.openTasks || []).filter(function (t) {
      return t && t.status !== 'completed';
    });
    var recs = state.recommendations || [];

    var html = '';
    html +=
      '<div class="card" style="margin-bottom:16px">' +
      '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">' +
      '<div><h2 style="margin:0 0 6px">AI Website Team</h2>' +
      '<p class="lede" style="margin:0">Practical advice for <strong>' +
      esc(summaryName) +
      '</strong> — advisory only. Nothing publishes automatically.</p></div>' +
      '<div style="font-size:12.5px;text-align:right">' +
      '<div>Site Brain: <strong>' +
      esc(bootstrap) +
      '</strong></div>' +
      '<div>Primary goal: <strong>' +
      esc(goal || 'Not set') +
      '</strong></div></div></div></div>';

    if (state.needsReview) {
      html += renderBootstrapForm(state.review || {});
    }

    html +=
      '<div class="card" style="margin-bottom:16px">' +
      '<h3 style="margin:0 0 8px">Atlas — Website Strategist</h3>' +
      '<p class="lede" style="margin:0 0 12px">Ask for a coordinated review of this site. Atlas uses Site Brain plus your current editor context.</p>' +
      '<textarea id="ai-ask" rows="3" style="width:100%" placeholder="e.g. Help me get more commercial rendering enquiries"></textarea>' +
      '<div style="margin-top:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
      '<button type="button" class="btn" id="ai-ask-go">Ask the Team</button>' +
      '<button type="button" class="btn ghost" id="ai-resync">Refresh from website</button>' +
      '<span id="ai-ask-msg" class="ai-team-msg"></span></div>' +
      '<p class="lede" style="margin:10px 0 0;font-size:12.5px">Context: tab <code>' +
      esc((window.activeView || 'details') + '') +
      '</code>' +
      (window.landingSub ? ' · section <code>' + esc(window.landingSub) + '</code>' : '') +
      '</p></div>';

    html +=
      '<div class="card" style="margin-bottom:16px;padding:14px 16px">' +
      '<strong>Specialist Team</strong>' +
      '<p class="lede" style="margin:6px 0 0;font-size:13px">Nova, Scout, Pulse, Forge, Lens, Echo, Guardian and Beacon are registered and will appear here as their workflows are enabled. Phase 1 focuses on Atlas.</p></div>';

    html += '<div style="display:grid;grid-template-columns:1.2fr .8fr;gap:14px">';
    html += '<div><h3 style="margin:0 0 10px">Recommended next actions</h3>';
    if (!recs.length) {
      html += '<p class="lede">No recommendations yet — ask Atlas for a review.</p>';
    } else {
      html += recs
        .slice(0, 12)
        .map(renderRec)
        .join('');
    }
    html += '</div>';

    html +=
      '<div><h3 style="margin:0 0 10px">Open tasks</h3>' +
      (openTasks.length
        ? '<ul style="margin:0;padding-left:18px">' +
          openTasks
            .slice(0, 8)
            .map(function (t) {
              return '<li>' + esc(t.title || t.label || 'Task') + '</li>';
            })
            .join('') +
          '</ul>'
        : '<p class="lede">No open tasks.</p>') +
      '<h3 style="margin:18px 0 10px">Recent recommendations</h3>' +
      '<p class="lede" style="font-size:13px">' +
      esc(String(recs.length)) +
      ' on file · approve/reject updates status only (no auto-apply).</p></div>';

    html += '</div>';
    box.innerHTML = html;
    bind(state);
  }

  function bind(state) {
    var saveBtn = $('ai-br-save');
    if (saveBtn) {
      saveBtn.onclick = async function () {
        var msg = $('ai-br-msg');
        try {
          setMsg(msg, 'Saving…', '');
          var answers = {
            businessName: $('ai-br-name') && $('ai-br-name').value,
            industry: $('ai-br-industry') && $('ai-br-industry').value,
            targetAudience: $('ai-br-audience') && $('ai-br-audience').value,
            primaryGoal: $('ai-br-goal') && $('ai-br-goal').value,
            preferredCta: $('ai-br-cta') && $('ai-br-cta').value,
            brandTone: $('ai-br-tone') && $('ai-br-tone').value,
            mainServices: $('ai-br-services') && $('ai-br-services').value,
            serviceAreas: $('ai-br-areas') && $('ai-br-areas').value,
            contentRestrictions: $('ai-br-restrict') && $('ai-br-restrict').value
          };
          var j = await api('/api/site-brain/bootstrap-review', {
            siteId: window.currentSiteId,
            answers: answers
          });
          if (!j.persisted) throw new Error('Save was not persisted');
          setMsg(msg, 'Saved', 'ok');
          if (window.toast) window.toast('Site Knowledge saved');
          loadPanel();
        } catch (e) {
          setMsg(msg, e.message || String(e), 'bad');
        }
      };
    }

    var ask = $('ai-ask-go');
    if (ask) {
      ask.onclick = async function () {
        var msg = $('ai-ask-msg');
        try {
          setMsg(msg, 'Atlas is reviewing…', '');
          var j = await api('/api/ai-team/atlas-review', {
            siteId: window.currentSiteId,
            requestText: ($('ai-ask') && $('ai-ask').value) || '',
            editorContext: editorContext()
          });
          if (!j.persisted) throw new Error('Recommendations were not persisted');
          setMsg(msg, 'Review ready', 'ok');
          loadPanel();
        } catch (e) {
          setMsg(msg, e.message || String(e), 'bad');
        }
      };
    }

    var resync = $('ai-resync');
    if (resync) {
      resync.onclick = async function () {
        try {
          await api('/api/site-brain/sync', {
            siteId: window.currentSiteId,
            forceResync: true
          });
          if (window.toast) window.toast('Site Brain refreshed from website');
          loadPanel();
        } catch (e) {
          if (window.toast) window.toast(e.message || String(e));
        }
      };
    }

    document.querySelectorAll('.ai-rec-approve').forEach(function (btn) {
      btn.onclick = async function () {
        try {
          await api('/api/ai-team/recommendations', {
            siteId: window.currentSiteId,
            action: 'approve',
            recommendationId: btn.getAttribute('data-id')
          });
          loadPanel();
        } catch (e) {
          if (window.toast) window.toast(e.message || String(e));
        }
      };
    });
    document.querySelectorAll('.ai-rec-reject').forEach(function (btn) {
      btn.onclick = async function () {
        try {
          await api('/api/ai-team/recommendations', {
            siteId: window.currentSiteId,
            action: 'reject',
            recommendationId: btn.getAttribute('data-id')
          });
          loadPanel();
        } catch (e) {
          if (window.toast) window.toast(e.message || String(e));
        }
      };
    });
  }

  window.renderAiWebsiteTeam = loadPanel;
})();
