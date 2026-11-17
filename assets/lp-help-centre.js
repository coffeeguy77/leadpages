/**
 * LeadPages Help Centre — contextual overlay for Manage + standalone /help.
 * API: window.LPHelp.open(topicId), .close(), .toggle(), .bindNeedHelp(el, topicId)
 */
(function (global) {
  'use strict';

  var CATALOGUE_URL = '/assets/help/catalogue.json';
  var state = {
    ready: false,
    loading: null,
    data: null,
    topicId: null,
    query: '',
    navOpen: false
  };
  var root = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function inlineMd(t) {
    t = esc(t);
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    return t;
  }

  function resolveId(raw) {
    if (!raw || !state.data) return null;
    var id = String(raw).trim();
    if (!id) return null;
    var aliases = state.data.aliases || {};
    if (aliases[id]) id = aliases[id];
    var topics = state.data.topics || [];
    for (var i = 0; i < topics.length; i++) {
      if (topics[i].id === id) return id;
      if (topics[i].sectionKey === id) return topics[i].id;
    }
    var lower = id.toLowerCase();
    for (var j = 0; j < topics.length; j++) {
      if (String(topics[j].id).toLowerCase() === lower) return topics[j].id;
      if (String(topics[j].sectionKey || '').toLowerCase() === lower) return topics[j].id;
    }
    return id;
  }

  function getTopic(id) {
    id = resolveId(id);
    var topics = (state.data && state.data.topics) || [];
    for (var i = 0; i < topics.length; i++) if (topics[i].id === id) return topics[i];
    return null;
  }

  function ensureFonts() {
    if (document.getElementById('lph-fonts')) return;
    var l = document.createElement('link');
    l.id = 'lph-fonts';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap';
    document.head.appendChild(l);
  }

  function ensureCss() {
    if (document.getElementById('lph-css')) return;
    var l = document.createElement('link');
    l.id = 'lph-css';
    l.rel = 'stylesheet';
    l.href = '/assets/lp-help-centre.css?v=1';
    document.head.appendChild(l);
  }

  function loadCatalogue() {
    if (state.data) return Promise.resolve(state.data);
    if (state.loading) return state.loading;
    state.loading = fetch(CATALOGUE_URL)
      .then(function (r) {
        if (!r.ok) throw new Error('Could not load help catalogue');
        return r.json();
      })
      .then(function (j) {
        state.data = j;
        state.ready = true;
        state.loading = null;
        return j;
      })
      .catch(function (e) {
        state.loading = null;
        throw e;
      });
    return state.loading;
  }

  function diagramSvg(kind, highlightZone) {
    if (kind === 'nav-map') {
      return (
        '<svg viewBox="0 0 420 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<rect width="420" height="220" rx="14" fill="#0f1714"/>' +
        '<text x="20" y="28" fill="#8fb5a6" font-size="11" font-family="DM Sans,sans-serif" letter-spacing="1">COMMAND CENTRE</text>' +
        [
          ['Dashboard', 20],
          ['Page editor', 92],
          ['Apps', 164],
          ['Publish', 236],
          ['Support', 308]
        ]
          .map(function (b, i) {
            return (
              '<rect x="' +
              b[1] +
              '" y="48" width="64" height="36" rx="8" fill="' +
              (i === 1 ? '#1f7a63' : '#1c2a24') +
              '" stroke="#2f463c"/>' +
              '<text x="' +
              (b[1] + 32) +
              '" y="70" text-anchor="middle" fill="#e8f4ef" font-size="9" font-family="DM Sans,sans-serif">' +
              b[0] +
              '</text>'
            );
          })
          .join('') +
        '<path d="M52 96v28h140v28" stroke="#3d6b58" stroke-width="2" fill="none"/>' +
        '<rect x="160" y="152" width="180" height="44" rx="10" fill="#155c4a"/>' +
        '<text x="250" y="178" text-anchor="middle" fill="#fff" font-size="12" font-family="Archivo,sans-serif" font-weight="700">Live Preview → Publish</text>' +
        '</svg>'
      );
    }
    // page-zones
    var zones = [
      { k: 'Navigation', y: 28, h: 22 },
      { k: 'Hero', y: 56, h: 40 },
      { k: 'Upper', y: 102, h: 28 },
      { k: 'Mid', y: 136, h: 36 },
      { k: 'Lower', y: 178, h: 28 },
      { k: 'Footer', y: 212, h: 20 }
    ];
    var hz = String(highlightZone || '').toLowerCase();
    return (
      '<svg viewBox="0 0 420 250" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<rect width="420" height="250" rx="14" fill="#0f1714"/>' +
      '<text x="20" y="20" fill="#8fb5a6" font-size="11" font-family="DM Sans,sans-serif" letter-spacing="1">PAGE LAYOUT ZONES</text>' +
      zones
        .map(function (z) {
          var on = hz && z.k.toLowerCase() === hz;
          return (
            '<rect x="48" y="' +
            z.y +
            '" width="280" height="' +
            z.h +
            '" rx="8" fill="' +
            (on ? '#1f7a63' : '#1c2a24') +
            '" stroke="' +
            (on ? '#3d9b7e' : '#2f463c') +
            '" stroke-width="' +
            (on ? 2 : 1) +
            '"/>' +
            '<text x="62" y="' +
            (z.y + z.h / 2 + 4) +
            '" fill="#e8f4ef" font-size="12" font-family="Archivo,sans-serif" font-weight="700">' +
            z.k +
            (on ? '  ← this app' : '') +
            '</text>'
          );
        })
        .join('') +
      '<rect x="348" y="56" width="52" height="176" rx="8" fill="#15201b" stroke="#2f463c"/>' +
      '<text x="374" y="140" text-anchor="middle" fill="#8fb5a6" font-size="9" transform="rotate(90 374 140)" font-family="DM Sans,sans-serif">PHONE</text>' +
      '</svg>'
    );
  }

  function groupTopics() {
    var topics = (state.data && state.data.topics) || [];
    var q = (state.query || '').trim().toLowerCase();
    var groups = {};
    var order = [];
    topics.forEach(function (t) {
      if (q) {
        var hay = [t.title, t.summary, t.body, t.category, (t.keywords || []).join(' '), t.sectionKey]
          .join(' ')
          .toLowerCase();
        if (hay.indexOf(q) < 0) return;
      }
      var c = t.category || 'General';
      if (!groups[c]) {
        groups[c] = [];
        order.push(c);
      }
      groups[c].push(t);
    });
    return { groups: groups, order: order };
  }

  function renderNav() {
    var nav = root.querySelector('.lph-nav');
    if (!nav) return;
    var g = groupTopics();
    var html = '';
    g.order.forEach(function (cat) {
      html += '<h3>' + esc(cat) + '</h3>';
      g.groups[cat].forEach(function (t) {
        html +=
          '<a href="#help/' +
          encodeURIComponent(t.id) +
          '" data-lph-topic="' +
          esc(t.id) +
          '" class="' +
          (state.topicId === t.id ? 'on' : '') +
          '">' +
          esc(t.title) +
          '</a>';
      });
    });
    if (!html) html = '<p class="lph-empty" style="padding:12px">No matches.</p>';
    nav.innerHTML = html;
    nav.classList.toggle('is-open', !!state.navOpen);
  }

  function renderHome() {
    var main = root.querySelector('.lph-main');
    var topics = (state.data && state.data.topics) || [];
    var apps = topics.filter(function (t) {
      return t.kind === 'app';
    }).length;
    var guides = topics.length - apps;
    var featured = ['getting-started', 'page-editor', 'marketplace', 'publish', 'backups', 'images', 'support-ticket'];
    var cards = featured
      .map(function (id) {
        return getTopic(id);
      })
      .filter(Boolean);
    main.innerHTML =
      '<div class="lph-hero-card">' +
      '<div><h1>Help Centre</h1><p>' +
      esc((state.data && state.data.intro) || 'Guides for every app and the Manage backend.') +
      '</p></div>' +
      '<div class="lph-kpis">' +
      '<div class="lph-kpi"><div class="n">' +
      topics.length +
      '</div><div class="l">Guides</div></div>' +
      '<div class="lph-kpi"><div class="n">' +
      apps +
      '</div><div class="l">Apps covered</div></div>' +
      '<div class="lph-kpi"><div class="n">' +
      guides +
      '</div><div class="l">How-tos</div></div>' +
      '</div></div>' +
      '<div class="lph-grid-2">' +
      '<div class="lph-card"><h3>How the site is built</h3>' +
      diagramSvg('page-zones') +
      '<p style="margin:12px 0 0;font-size:13px;color:var(--lph-ink-soft)">Apps sit in layout zones. Marketplace turns them on; Page editor writes the copy and images.</p></div>' +
      '<div class="lph-card"><h3>Your workflow</h3>' +
      diagramSvg('nav-map') +
      '</div></div>' +
      '<h3 style="font-family:var(--lph-font-display);margin:8px 0 12px">Start here</h3>' +
      '<div class="lph-home-grid">' +
      cards
        .map(function (t) {
          return (
            '<button type="button" class="lph-home-card" data-lph-topic="' +
            esc(t.id) +
            '"><strong>' +
            esc(t.title) +
            '</strong><span>' +
            esc(t.summary || '') +
            '</span></button>'
          );
        })
        .join('') +
      '</div>' +
      ticketBlock(null);
  }

  function ticketBlock(topic) {
    var topicLabel = topic ? topic.title : 'General help';
    return (
      '<div class="lph-ticket" id="lph-ticket">' +
      '<h3>Need a human? Request paid help</h3>' +
      '<p>Stuck, or want us to do it for you? Send a request — we reply in Support and quote hands-on work when needed.</p>' +
      '<div class="lph-field"><label>Topic</label><input id="lph-t-topic" value="' +
      esc(topicLabel) +
      '" readonly></div>' +
      '<div class="lph-field"><label>Urgency</label><select id="lph-t-urgency"><option value="normal">Normal</option><option value="soon">This week</option><option value="urgent">Urgent</option></select></div>' +
      '<div class="lph-field"><label>What do you need?</label><textarea id="lph-t-body" placeholder="e.g. Can you rebuild my hero slider with 4 new photos and make the CTA call my mobile?"></textarea></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button type="button" class="lph-btn amber" id="lph-t-send">Request paid help</button>' +
      '<button type="button" class="lph-btn" id="lph-t-support">Open Support chat</button>' +
      '</div>' +
      '<p class="lph-msg" id="lph-t-msg"></p></div>'
    );
  }

  function renderTopic(topic) {
    var main = root.querySelector('.lph-main');
    if (!topic) {
      main.innerHTML = '<div class="lph-empty">Guide not found. Try search, or request paid help below.</div>' + ticketBlock(null);
      return;
    }
    var steps = (topic.steps || [])
      .map(function (s) {
        return '<li>' + inlineMd(s) + '</li>';
      })
      .join('');
    var features = (topic.features || [])
      .map(function (f) {
        return '<li>' + inlineMd(f) + '</li>';
      })
      .join('');
    var tips = (topic.tips || [])
      .map(function (t) {
        return '<div style="margin:6px 0">' + inlineMd(t) + '</div>';
      })
      .join('');
    var related = (topic.related || [])
      .map(function (id) {
        var t = getTopic(id);
        if (!t) return '';
        return '<button type="button" data-lph-topic="' + esc(t.id) + '">' + esc(t.title) + '</button>';
      })
      .join('');

    main.innerHTML =
      '<article class="lph-article">' +
      '<div class="lph-meta">' +
      (topic.kind === 'app' ? '<span class="lph-pill">App</span>' : '<span class="lph-pill">Guide</span>') +
      (topic.zone ? '<span class="lph-pill zone">' + esc(topic.zone) + ' zone</span>' : '') +
      (topic.category ? '<span class="lph-pill zone">' + esc(topic.category) + '</span>' : '') +
      '</div>' +
      '<h2>' +
      esc(topic.title) +
      '</h2>' +
      '<p class="lph-lede">' +
      esc(topic.summary || topic.body || '') +
      '</p>' +
      '<div class="lph-grid-2">' +
      '<div class="lph-card"><h3>Do this</h3><ol class="lph-steps">' +
      (steps || '<li>Open this area in Manage and follow the on-screen labels.</li>') +
      '</ol></div>' +
      '<div class="lph-card"><h3>Where it sits</h3>' +
      diagramSvg(topic.diagram || 'page-zones', topic.zone) +
      '</div></div>' +
      (topic.body
        ? '<div class="lph-card" style="margin-bottom:16px"><h3>Overview</h3><p style="margin:0;color:var(--lph-ink-soft);font-size:14.5px">' +
          inlineMd(topic.body) +
          '</p></div>'
        : '') +
      (features
        ? '<div class="lph-card" style="margin-bottom:16px"><h3>What you can control</h3><ul class="lph-features">' +
          features +
          '</ul></div>'
        : '') +
      (tips ? '<div class="lph-tips" style="margin-bottom:16px"><strong>Tips</strong>' + tips + '</div>' : '') +
      (related ? '<div class="lph-card"><h3>Related</h3><div class="lph-related">' + related + '</div></div>' : '') +
      ticketBlock(topic) +
      '</article>';
  }

  function render() {
    if (!root) return;
    renderNav();
    if (!state.topicId || state.topicId === 'home') renderHome();
    else renderTopic(getTopic(state.topicId));
  }

  function setHash(id) {
    try {
      var u = new URL(location.href);
      if (id && id !== 'home') u.hash = 'help/' + encodeURIComponent(id);
      else u.hash = 'help';
      history.replaceState(null, '', u);
    } catch (_e) {}
  }

  function openTopic(id) {
    state.topicId = resolveId(id) || 'home';
    if (state.topicId && state.topicId !== 'home' && !getTopic(state.topicId)) state.topicId = 'home';
    setHash(state.topicId);
    render();
    var main = root && root.querySelector('.lph-main');
    if (main) main.scrollTop = 0;
  }

  async function authHeader() {
    try {
      if (global.supabase && global.__LP) {
        var sb = global.__lpHelpSb;
        if (!sb) {
          sb = global.supabase.createClient(global.__LP.url, global.__LP.anon);
          global.__lpHelpSb = sb;
        }
        var sess = (await sb.auth.getSession()).data.session;
        if (sess && sess.access_token) return { Authorization: 'Bearer ' + sess.access_token };
      }
      if (typeof global.cwToken === 'function') {
        var t = await global.cwToken();
        if (t) return { Authorization: 'Bearer ' + t };
      }
    } catch (_e) {}
    return {};
  }

  async function submitTicket() {
    var msg = root.querySelector('#lph-t-msg');
    var bodyEl = root.querySelector('#lph-t-body');
    var urg = root.querySelector('#lph-t-urgency');
    var topicEl = root.querySelector('#lph-t-topic');
    var text = (bodyEl && bodyEl.value) || '';
    if (!String(text).trim()) {
      if (msg) {
        msg.className = 'lph-msg bad';
        msg.textContent = 'Tell us what you need help with.';
      }
      return;
    }
    if (msg) {
      msg.className = 'lph-msg';
      msg.textContent = 'Sending…';
    }
    var siteId = global.currentSiteId || null;
    var siteName = global.currentBusinessName || global.currentSiteSlug || '';
    var payload = {
      topicId: state.topicId || 'support-ticket',
      topicTitle: (topicEl && topicEl.value) || '',
      urgency: (urg && urg.value) || 'normal',
      message: String(text).trim(),
      siteId: siteId,
      siteName: siteName,
      path: location.pathname + location.search
    };
    try {
      var headers = Object.assign({ 'content-type': 'application/json' }, await authHeader());
      var r = await fetch('/api/help/ticket', { method: 'POST', headers: headers, body: JSON.stringify(payload) });
      var j = await r.json().catch(function () {
        return {};
      });
      if (!r.ok || j.ok === false) throw new Error(j.error || j.message || 'Request failed');
      if (msg) {
        msg.className = 'lph-msg ok';
        msg.textContent = j.message || 'Request sent. Opening Support…';
      }
      openSupportChat(payload);
    } catch (e) {
      if (msg) {
        msg.className = 'lph-msg bad';
        msg.textContent = (e && e.message) || 'Could not send. Opening Support chat instead.';
      }
      openSupportChat(payload);
    }
  }

  function openSupportChat(payload) {
    var prefill =
      'Paid help request' +
      (payload.topicTitle ? ' — ' + payload.topicTitle : '') +
      '\nUrgency: ' +
      (payload.urgency || 'normal') +
      (payload.siteName ? '\nSite: ' + payload.siteName : '') +
      '\n\n' +
      (payload.message || '');
    try {
      close();
      if (typeof global.lpOpenSupportMessage === 'function') {
        global.lpOpenSupportMessage('');
      }
      if (typeof global.showView === 'function') global.showView('messages');
      var embed = global.manageMsgEmbed;
      if (embed && typeof embed.openProvider === 'function') {
        setTimeout(function () {
          try {
            embed.openProvider(prefill);
          } catch (_e) {}
        }, 400);
      }
    } catch (_e2) {}
  }

  function onRootClick(e) {
    var t = e.target;
    if (t.closest && t.closest('[data-lph-close]')) {
      e.preventDefault();
      close();
      return;
    }
    if (t.closest && t.closest('#lph-t-send')) {
      e.preventDefault();
      submitTicket();
      return;
    }
    if (t.closest && t.closest('#lph-t-support')) {
      e.preventDefault();
      var bodyEl = root.querySelector('#lph-t-body');
      openSupportChat({
        topicTitle: state.topicId,
        urgency: 'normal',
        message: (bodyEl && bodyEl.value) || 'Hi — I need help with my site.',
        siteName: global.currentBusinessName || ''
      });
      return;
    }
    if (t.closest && t.closest('[data-lph-nav]')) {
      e.preventDefault();
      state.navOpen = !state.navOpen;
      renderNav();
      return;
    }
    var a = t.closest && t.closest('[data-lph-topic]');
    if (a) {
      e.preventDefault();
      state.navOpen = false;
      openTopic(a.getAttribute('data-lph-topic'));
    }
  }

  function ensureRoot() {
    if (root) return root;
    ensureFonts();
    ensureCss();
    root = document.createElement('div');
    root.id = 'lph-root';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Help Centre');
    root.innerHTML =
      '<div class="lph-backdrop" data-lph-close></div>' +
      '<div class="lph-shell">' +
      '<div class="lph-top">' +
      '<div class="lph-brandmark"><i>?</i> Help Centre</div>' +
      '<button type="button" class="lph-btn" data-lph-nav style="display:none" id="lph-nav-toggle">Topics</button>' +
      '<input class="lph-search" id="lph-search" placeholder="Search apps, publish, backups…" autocomplete="off">' +
      '<div class="lph-top-actions">' +
      '<button type="button" class="lph-btn amber" data-lph-topic="support-ticket">Need a human</button>' +
      '<button type="button" class="lph-btn" data-lph-close>Close</button>' +
      '</div></div>' +
      '<nav class="lph-nav" aria-label="Help topics"></nav>' +
      '<div class="lph-main"></div>' +
      '</div>';
    document.body.appendChild(root);
    root.addEventListener('click', onRootClick);
    var search = root.querySelector('#lph-search');
    if (search) {
      search.addEventListener('input', function () {
        state.query = search.value;
        renderNav();
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('is-open')) close();
    });
    // show Topics toggle on small screens via CSS media — enable button always, CSS can hide shell nav
    var nt = root.querySelector('#lph-nav-toggle');
    if (nt) {
      nt.style.display = '';
      function syncNavBtn() {
        nt.style.display = window.matchMedia('(max-width:900px)').matches ? '' : 'none';
      }
      syncNavBtn();
      window.addEventListener('resize', syncNavBtn);
    }
    return root;
  }

  function open(topicId) {
    ensureRoot();
    loadCatalogue()
      .then(function () {
        root.classList.add('is-open');
        document.documentElement.style.overflow = 'hidden';
        openTopic(topicId || 'home');
        var s = root.querySelector('#lph-search');
        if (s) setTimeout(function () {
          s.focus();
        }, 50);
      })
      .catch(function (e) {
        ensureRoot();
        root.classList.add('is-open');
        root.querySelector('.lph-main').innerHTML =
          '<div class="lph-empty">Could not load help: ' + esc(e.message || e) + '</div>' + ticketBlock(null);
      });
  }

  function close() {
    if (!root) return;
    root.classList.remove('is-open');
    document.documentElement.style.overflow = '';
    try {
      if (/#help/.test(location.hash)) {
        var u = new URL(location.href);
        u.hash = '';
        history.replaceState(null, '', u);
      }
    } catch (_e) {}
  }

  function toggle(topicId) {
    if (root && root.classList.contains('is-open')) close();
    else open(topicId);
  }

  function bindNeedHelp(el, topicId) {
    if (!el) return;
    el.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      open(topicId || el.getAttribute('data-help') || 'home');
    });
  }

  function needHelpButton(topicId, label) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'lph-need-help';
    b.setAttribute('data-help', topicId || 'home');
    b.innerHTML = '<span class="lph-q">?</span> ' + esc(label || 'Need help?');
    bindNeedHelp(b, topicId);
    return b;
  }

  // Deep-link: #help/heroSlider or ?help=heroSlider
  function bootFromUrl() {
    try {
      var params = new URLSearchParams(location.search);
      var q = params.get('help');
      if (q) {
        open(q);
        return;
      }
      var m = String(location.hash || '').match(/^#help\/?([^/]*)$/);
      if (m) open(decodeURIComponent(m[1] || 'home'));
    } catch (_e) {}
  }

  global.LPHelp = {
    open: open,
    close: close,
    toggle: toggle,
    bindNeedHelp: bindNeedHelp,
    needHelpButton: needHelpButton,
    resolveId: resolveId,
    getTopic: function (id) {
      return loadCatalogue().then(function () {
        return getTopic(id);
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootFromUrl);
  } else {
    setTimeout(bootFromUrl, 0);
  }
})(typeof window !== 'undefined' ? window : globalThis);
