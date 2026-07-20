/**
 * AI Website Team — Phase 1 Atlas advisory panel for manage.html.
 * Advisory only for live site mutation. Site Knowledge (Site Brain) can be saved/edited.
 */
(function () {
  'use strict';

  /** @type {object} */
  var panelCtx = {};
  /** @type {object|null} */
  var lastState = null;
  /** @type {object|null} */
  var chatSession = null;

  var FIELDS = [
    {
      key: 'businessName',
      label: 'Business name',
      question: 'What is the business name customers should see?',
      help: 'The trading name on the website — usually what people already know you by.',
      explain:
        'This is simply the name of the business. Use the name customers search for or see on your van, invoice, or shopfront. Example: “Bean Culture” — not a long legal company name unless that is your brand.',
      examples: ['Bean Culture', 'Luke’s Security', 'Canberra Hot Water'],
      multiline: false
    },
    {
      key: 'industry',
      label: 'Industry',
      question: 'What kind of business is this?',
      help: 'A short plain description of the trade or industry (not a slogan).',
      explain:
        'Industry means the type of work you do. If a stranger asked “what does your business do?”, what would you say in a few words?',
      examples: ['Café / specialty coffee', 'Security systems', 'Architectural 3D rendering'],
      multiline: false
    },
    {
      key: 'mainServices',
      label: 'Main services',
      question: 'What are the main things you sell or do for customers?',
      help: 'List the top services or offers, one per line.',
      explain:
        'Services are the jobs or products people hire you for. Write them the way a customer would say them. One service per line — you can edit this any time.',
      examples: ['Commercial renders', 'Emergency lockouts', 'Espresso coffee & brunch'],
      multiline: true
    },
    {
      key: 'targetAudience',
      label: 'Target audience',
      question: 'Who are you mainly trying to attract?',
      help: 'The kind of customer you want more of — not “everyone”.',
      explain:
        'Your target audience is the people most likely to buy. Be specific: homeowners, builders, offices, tourists. “Anyone” is too vague for good website advice.',
      examples: ['Canberra homeowners', 'Commercial builders', 'Office workers near Civic'],
      multiline: false
    },
    {
      key: 'primaryGoal',
      label: 'Primary goal',
      question: 'What is the main result you want this website to achieve?',
      help: 'One clear outcome — more enquiries, bookings, quotes, or foot traffic.',
      explain:
        'A primary goal is the #1 job of the website. Pick one main outcome so we know what “better” means. You can still care about other things — this is just the priority.',
      examples: [
        'Get more quote requests each week',
        'Book more tables for weekend brunch',
        'Win more commercial rendering jobs'
      ],
      multiline: false
    },
    {
      key: 'serviceAreas',
      label: 'Service areas',
      question: 'Where do you serve customers?',
      help: 'Suburbs, cities, or regions you cover — one per line.',
      explain:
        'Service areas are the places you actually work. This helps local search advice and stops the site promising areas you do not cover.',
      examples: ['Canberra', 'Queanbeyan', 'Belconnen'],
      multiline: true
    },
    {
      key: 'preferredCta',
      label: 'Preferred call to action (CTA)',
      question: 'What should the main button on your website say?',
      help: 'The short action phrase on your main button — what visitors should do next.',
      explain:
        'CTA means “call to action” — the words on your main button. It tells visitors what to do next. Avoid vague lines like “Contact us” or “Learn more”. Use something specific that matches your goal, such as “Get a free quote” or “Book a table”.',
      examples: ['Get a free quote', 'Book a table', 'Request a site visit', 'Order online'],
      multiline: false
    },
    {
      key: 'brandTone',
      label: 'Brand tone',
      question: 'How should the website sound when it talks to customers?',
      help: 'A few words describing the voice — friendly, premium, no-nonsense, etc.',
      explain:
        'Brand tone is the personality of your writing. Imagine how you want to sound on the phone with a new customer, then write that in a few words.',
      examples: ['Warm and local', 'Premium and precise', 'Straight-talking and reliable'],
      multiline: false
    },
    {
      key: 'contentRestrictions',
      label: 'Content restrictions',
      question: 'Is there anything the website must never say or claim?',
      help: 'Optional. Things to avoid — competitor names, promises you cannot keep, banned phrases.',
      explain:
        'Restrictions are guardrails. If there are claims you must not make (or words you hate), list them here so we do not suggest them.',
      examples: ['No competitor names', 'Do not promise same-day if we cannot deliver'],
      multiline: true,
      optional: true
    }
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fieldDef(key) {
    for (var i = 0; i < FIELDS.length; i++) if (FIELDS[i].key === key) return FIELDS[i];
    return null;
  }

  function activeSiteId() {
    return (panelCtx && panelCtx.siteId) || window.currentSiteId || null;
  }

  function ensureStyles() {
    if ($('ai-team-styles')) return;
    var st = document.createElement('style');
    st.id = 'ai-team-styles';
    st.textContent =
      '.ai-team-msg.ok{color:#0a7d33}.ai-team-msg.bad{color:#b42318}' +
      '.ai-field-help{display:block;margin:4px 0 6px;font-size:12.5px;line-height:1.45;opacity:.82}' +
      '.ai-field-eg{margin-top:2px;font-size:12px;opacity:.7}' +
      '.ai-chat-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9998;display:flex;align-items:center;justify-content:center;padding:16px}' +
      '.ai-chat-modal{width:min(560px,100%);max-height:min(88vh,720px);overflow:auto;border-radius:14px;background:var(--panel,#12141c);color:var(--ink,#f4f4f6);border:1px solid var(--line,rgba(255,255,255,.12));box-shadow:0 18px 50px rgba(0,0,0,.45);padding:18px 18px 16px}' +
      '.ai-chat-log{display:flex;flex-direction:column;gap:10px;margin:12px 0 14px}' +
      '.ai-chat-bubble{padding:10px 12px;border-radius:12px;font-size:14px;line-height:1.45;max-width:95%}' +
      '.ai-chat-bubble.atlas{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);align-self:flex-start}' +
      '.ai-chat-bubble.you{background:var(--accent-soft,rgba(236,72,153,.16));border:1px solid var(--accent,rgba(236,72,153,.45));align-self:flex-end}' +
      '.ai-chat-examples{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 0}' +
      '.ai-chat-examples button{font-size:12.5px}' +
      '.ai-sk-summary{font-size:13px;line-height:1.5;margin:0 0 10px}' +
      '.ai-sk-summary dt{font-weight:600;margin-top:8px}.ai-sk-summary dd{margin:2px 0 0;opacity:.88}';
    document.head.appendChild(st);
  }

  async function token() {
    try {
      if (typeof window.cwToken === 'function') {
        var t = await window.cwToken();
        if (t) return t;
      }
    } catch (_e) {}
    try {
      if (window.sb && window.sb.auth) {
        var r = await window.sb.auth.getSession();
        return (r && r.data && r.data.session && r.data.session.access_token) || null;
      }
    } catch (_e2) {}
    try {
      if (window.supabase && window.__LP && window.__LP.url && window.__LP.anon) {
        var client = window.supabase.createClient(window.__LP.url, window.__LP.anon);
        var r2 = await client.auth.getSession();
        return (r2 && r2.data && r2.data.session && r2.data.session.access_token) || null;
      }
    } catch (_e3) {}
    return null;
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
      siteId: activeSiteId(),
      pageId: panelCtx.pageId || (window.lpCur && (window.lpCur.id || window.lpCur.slug)) || null,
      pageSlug: panelCtx.pageSlug || (window.lpCur && window.lpCur.slug) || null,
      pageTitle:
        panelCtx.pageTitle ||
        (window.lpCur && (window.lpCur.title || window.lpCur.h1)) ||
        null,
      pagePurpose:
        panelCtx.pagePurpose ||
        (window.activeView === 'landing' || panelCtx.editorTab === 'landing'
          ? 'landing'
          : 'homepage'),
      editorTab: panelCtx.editorTab || window.activeView || null,
      selectedSection: panelCtx.selectedSection || window.landingSub || null,
      selectedApp: panelCtx.selectedApp || null,
      userRole: panelCtx.userRole || null
    };
  }

  function setMsg(el, text, cls) {
    if (!el) return;
    el.textContent = text || '';
    el.className = 'ai-team-msg' + (cls ? ' ' + cls : '');
  }

  function reviewValue(review, key) {
    var r = review || {};
    var v = r[key];
    if (Array.isArray(v)) return v.join('\n');
    return v == null ? '' : String(v);
  }

  function isMissing(review, key) {
    var def = fieldDef(key);
    var raw = reviewValue(review, key).trim();
    if (!raw) return !def || !def.optional;
    if (key === 'preferredCta' && /^(get in touch|contact us|learn more)$/i.test(raw)) return true;
    return false;
  }

  function missingFieldKeys(review) {
    return FIELDS.filter(function (f) {
      return isMissing(review, f.key);
    }).map(function (f) {
      return f.key;
    });
  }

  function fieldHtml(def, value) {
    var id = 'ai-br-' + def.key;
    var input = def.multiline
      ? '<textarea id="' +
        id +
        '" rows="3" style="width:100%" placeholder="' +
        esc(def.examples[0] || '') +
        '">' +
        esc(value || '') +
        '</textarea>'
      : '<input id="' +
        id +
        '" type="text" style="width:100%" value="' +
        esc(value || '') +
        '" placeholder="' +
        esc(def.examples[0] || '') +
        '">';
    return (
      '<div style="margin-bottom:12px">' +
      '<label for="' +
      id +
      '">' +
      esc(def.label) +
      '</label>' +
      '<span class="ai-field-help">' +
      esc(def.help) +
      '</span>' +
      input +
      '<div class="ai-field-eg">Example: ' +
      esc((def.examples || []).slice(0, 2).join(' · ')) +
      ' · <button type="button" class="btn ghost sm ai-field-explain" data-key="' +
      esc(def.key) +
      '">What does this mean?</button></div></div>'
    );
  }

  function renderBootstrapForm(review, opts) {
    var o = opts || {};
    var r = review || {};
    var open = o.forceOpen || o.needsReview || missingFieldKeys(r).length > 0;
    var body =
      '<div id="ai-sk-body"' +
      (open ? '' : ' hidden') +
      '>' +
      '<p class="lede" style="margin:0 0 12px">Fill these in plain English. You can edit them any time — nothing here publishes the live website by itself.</p>' +
      FIELDS.map(function (f) {
        return fieldHtml(f, reviewValue(r, f.key));
      }).join('') +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:8px">' +
      '<button type="button" class="btn" id="ai-br-save">Save Site Knowledge</button>' +
      '<button type="button" class="btn ghost" id="ai-sk-chat">Ask Atlas to fill the gaps</button>' +
      '<span id="ai-br-msg" class="ai-team-msg"></span></div></div>';

    return (
      '<div class="card ai-team-bootstrap" style="margin-bottom:18px">' +
      '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">' +
      '<div><h2 style="margin:0 0 4px">Site Knowledge</h2>' +
      '<p class="lede" style="margin:0;font-size:13px">The facts Atlas uses. Edit anytime.</p></div>' +
      '<button type="button" class="btn ghost sm" id="ai-sk-toggle">' +
      (open ? 'Hide' : 'Edit') +
      '</button></div>' +
      (o.needsReview
        ? '<p class="lede" style="margin:10px 0 0;font-size:13px">Please confirm the details below — some were imported and still need your OK.</p>'
        : '') +
      body +
      '</div>'
    );
  }

  function knowledgeFieldKey(rec) {
    var change = (rec && (rec.proposed_change || rec.proposedChange)) || {};
    if (change.fieldKey) return change.fieldKey;
    if (change.path === 'goals.primary') return 'primaryGoal';
    if (change.path === 'goals.preferredCta') return 'preferredCta';
    if (change.path === 'offers.mainServices') return 'mainServices';
    if (rec && rec.interactive === 'site_knowledge_chat') return change.fieldKey || null;
    return null;
  }

  function renderRec(r) {
    var gap = r.capability_gap || r.capabilityGap ? ' · capability gap' : '';
    var exec = r.executable ? '' : ' · advisory';
    var fieldKey = knowledgeFieldKey(r);
    var answerBtn = fieldKey
      ? '<button type="button" class="btn sm ai-rec-answer" data-id="' +
        esc(r.id) +
        '" data-field="' +
        esc(fieldKey) +
        '">Answer with Atlas</button>'
      : '';
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
      answerBtn +
      '<button type="button" class="btn ghost sm ai-rec-approve" data-id="' +
      esc(r.id) +
      '">Approve</button>' +
      '<button type="button" class="btn ghost sm ai-rec-reject" data-id="' +
      esc(r.id) +
      '">Reject</button>' +
      '</div></article>'
    );
  }

  function mergeOpts(opts) {
    var o = opts && typeof opts === 'object' ? opts : {};
    panelCtx = {
      siteId: o.siteId || window.currentSiteId || null,
      siteName: o.siteName || window.currentSiteName || null,
      editorTab: o.editorTab || window.activeView || null,
      selectedSection: o.selectedSection || window.landingSub || null,
      selectedApp: o.selectedApp || null,
      pageId: o.pageId || null,
      pageSlug: o.pageSlug || null,
      pageTitle: o.pageTitle || null,
      pagePurpose: o.pagePurpose || null,
      userRole: o.userRole || null
    };
    if (panelCtx.siteId) {
      window.currentSiteId = panelCtx.siteId;
      if (panelCtx.siteName) window.currentSiteName = panelCtx.siteName;
    }
  }

  function closeChat() {
    var el = $('ai-chat-backdrop');
    if (el) el.remove();
    chatSession = null;
  }

  function appendChatBubble(who, text) {
    var log = $('ai-chat-log');
    if (!log) return;
    var div = document.createElement('div');
    div.className = 'ai-chat-bubble ' + (who === 'you' ? 'you' : 'atlas');
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function renderChatQuestion() {
    if (!chatSession) return;
    var def = fieldDef(chatSession.queue[chatSession.index]);
    var body = $('ai-chat-body');
    if (!def || !body) {
      body.innerHTML =
        '<p class="lede">All done — thanks. You can edit anything later in Site Knowledge.</p>' +
        '<button type="button" class="btn" id="ai-chat-done">Close</button>';
      var done = $('ai-chat-done');
      if (done) done.onclick = function () {
        closeChat();
        loadPanel(panelCtx);
      };
      return;
    }

    var cur = reviewValue(chatSession.review, def.key);
    body.innerHTML =
      '<div class="ai-chat-log" id="ai-chat-log"></div>' +
      '<label for="ai-chat-input" style="font-weight:600">' +
      esc(def.question) +
      '</label>' +
      '<p class="lede" style="margin:6px 0 8px;font-size:13px">' +
      esc(def.help) +
      '</p>' +
      (def.multiline
        ? '<textarea id="ai-chat-input" rows="4" style="width:100%" placeholder="' +
          esc(def.examples[0] || '') +
          '">' +
          esc(cur) +
          '</textarea>'
        : '<input id="ai-chat-input" type="text" style="width:100%" value="' +
          esc(cur) +
          '" placeholder="' +
          esc(def.examples[0] || '') +
          '">') +
      '<div class="ai-chat-examples" id="ai-chat-examples"></div>' +
      '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      '<button type="button" class="btn" id="ai-chat-save">Save &amp; continue</button>' +
      '<button type="button" class="btn ghost" id="ai-chat-explain">What does this mean?</button>' +
      '<button type="button" class="btn ghost" id="ai-chat-skip">Skip</button>' +
      '<button type="button" class="btn ghost" id="ai-chat-close">Close</button>' +
      '<span id="ai-chat-msg" class="ai-team-msg"></span></div>' +
      '<p class="lede" style="margin:10px 0 0;font-size:12px">Step ' +
      (chatSession.index + 1) +
      ' of ' +
      chatSession.queue.length +
      ' · Saves to Site Knowledge only (does not publish the live site).</p>';

    appendChatBubble(
      'atlas',
      'Hi — I need a couple of plain-English details so I can advise properly. ' + def.question
    );

    var ex = $('ai-chat-examples');
    (def.examples || []).forEach(function (example) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ghost sm';
      b.textContent = example;
      b.onclick = function () {
        var input = $('ai-chat-input');
        if (input) input.value = example;
      };
      ex.appendChild(b);
    });

    $('ai-chat-explain').onclick = function () {
      appendChatBubble('atlas', def.explain);
      if (def.examples && def.examples.length) {
        appendChatBubble(
          'atlas',
          'Examples that work well: “' + def.examples.join('”, “') + '”.'
        );
      }
    };
    $('ai-chat-close').onclick = function () {
      closeChat();
      loadPanel(panelCtx);
    };
    $('ai-chat-skip').onclick = function () {
      appendChatBubble('you', '(skipped)');
      chatSession.index += 1;
      renderChatQuestion();
    };
    $('ai-chat-save').onclick = async function () {
      var input = $('ai-chat-input');
      var msg = $('ai-chat-msg');
      var value = input ? String(input.value || '').trim() : '';
      if (!value && !(def.optional)) {
        setMsg(msg, 'Please enter something, or tap Skip.', 'bad');
        return;
      }
      try {
        setMsg(msg, 'Saving…', '');
        var answers = {};
        answers[def.key] = value;
        var j = await api('/api/site-brain/bootstrap-review', {
          siteId: activeSiteId(),
          answers: answers
        });
        if (!j.persisted) throw new Error('Save was not persisted');
        chatSession.review = j.review || chatSession.review;
        if (chatSession.recommendationId) {
          try {
            await api('/api/ai-team/recommendations', {
              siteId: activeSiteId(),
              action: 'approve',
              recommendationId: chatSession.recommendationId
            });
          } catch (_e) {}
          chatSession.recommendationId = null;
        }
        appendChatBubble('you', value || '(cleared)');
        appendChatBubble('atlas', 'Got it — saved. You can change this later in Site Knowledge.');
        setMsg(msg, 'Saved', 'ok');
        chatSession.index += 1;
        setTimeout(renderChatQuestion, 350);
      } catch (e) {
        setMsg(msg, e.message || String(e), 'bad');
      }
    };
  }

  function openGuidedChat(opts) {
    ensureStyles();
    closeChat();
    var o = opts || {};
    var review = (lastState && lastState.review) || {};
    var queue = o.fieldKeys && o.fieldKeys.length ? o.fieldKeys.slice() : missingFieldKeys(review);
    if (!queue.length) {
      queue = ['primaryGoal', 'preferredCta'];
    }
    chatSession = {
      queue: queue,
      index: 0,
      review: review,
      recommendationId: o.recommendationId || null
    };
    var backdrop = document.createElement('div');
    backdrop.className = 'ai-chat-backdrop';
    backdrop.id = 'ai-chat-backdrop';
    backdrop.innerHTML =
      '<div class="ai-chat-modal" role="dialog" aria-modal="true" aria-label="Atlas guided questions">' +
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">' +
      '<div><h2 style="margin:0 0 4px">Chat with Atlas</h2>' +
      '<p class="lede" style="margin:0;font-size:13px">Plain questions. Short answers. Saved to Site Knowledge.</p></div>' +
      '<button type="button" class="btn ghost sm" id="ai-chat-x">✕</button></div>' +
      '<div id="ai-chat-body"></div></div>';
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', function (ev) {
      if (ev.target === backdrop) {
        closeChat();
        loadPanel(panelCtx);
      }
    });
    $('ai-chat-x').onclick = function () {
      closeChat();
      loadPanel(panelCtx);
    };
    renderChatQuestion();
  }

  async function loadPanel(opts) {
    ensureStyles();
    mergeOpts(opts);
    var box = $('av-ai-team');
    if (!box) return;
    var siteId = activeSiteId();
    if (!siteId) {
      box.innerHTML =
        '<div class="card"><p class="lede">Select a site to open the AI Website Team.</p></div>';
      return;
    }

    box.innerHTML =
      '<div class="card"><p class="lede">Loading Site Brain…</p><span id="ai-team-load-msg"></span></div>';

    var state = { brain: null, review: null, needsReview: false, recommendations: [] };

    try {
      var got = await api('/api/site-brain/get', { siteId: siteId });
      state.brain = got.brain;
      state.review = got.review;
      state.needsReview = !!got.needsBootstrapReview;
    } catch (e) {
      if (e.status === 404 || (e.payload && e.payload.error === 'not_found')) {
        try {
          var synced = await api('/api/site-brain/sync', { siteId: siteId });
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
        siteId: siteId,
        action: 'list'
      });
      state.recommendations = listed.recommendations || [];
    } catch (_e) {
      state.recommendations = [];
    }

    lastState = state;
    paint(state);
  }

  function paint(state) {
    var box = $('av-ai-team');
    if (!box) return;
    var snap = (state.brain && state.brain.snapshot) || {};
    var review = state.review || {};
    var summaryName =
      review.businessName ||
      (snap.business && snap.business.name && snap.business.name.value) ||
      panelCtx.siteName ||
      window.currentSiteName ||
      'This website';
    var goal = String(review.primaryGoal || '').trim() || 'Not set yet';
    var cta = String(review.preferredCta || '').trim() || 'Not set yet';
    var bootstrap = (state.brain && state.brain.bootstrap_status) || 'pending';
    var openTasks = (snap.openTasks || []).filter(function (t) {
      return t && t.status !== 'completed';
    });
    var recs = state.recommendations || [];
    var ctx = editorContext();
    var missing = missingFieldKeys(review);

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
      esc(goal) +
      '</strong></div>' +
      '<div>Main CTA: <strong>' +
      esc(cta) +
      '</strong></div></div></div>' +
      (missing.length
        ? '<p class="lede" style="margin:12px 0 0;font-size:13px">' +
          esc(String(missing.length)) +
          ' Site Knowledge detail' +
          (missing.length === 1 ? '' : 's') +
          ' still need a plain answer. ' +
          '<button type="button" class="btn sm" id="ai-open-chat">Chat with Atlas</button></p>'
        : '') +
      '</div>';

    html += renderBootstrapForm(review, {
      needsReview: state.needsReview,
      forceOpen: state.needsReview || missing.length > 0
    });

    html +=
      '<div class="card" style="margin-bottom:16px">' +
      '<h3 style="margin:0 0 8px">Atlas — Website Strategist</h3>' +
      '<p class="lede" style="margin:0 0 12px">Ask for a coordinated review, or let Atlas interview you about missing details in plain English.</p>' +
      '<textarea id="ai-ask" rows="3" style="width:100%" placeholder="e.g. Help me get more coffee customers at lunchtime"></textarea>' +
      '<div style="margin-top:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
      '<button type="button" class="btn" id="ai-ask-go">Ask the Team</button>' +
      '<button type="button" class="btn ghost" id="ai-ask-chat">Fill gaps with Atlas</button>' +
      '<button type="button" class="btn ghost" id="ai-resync">Refresh from website</button>' +
      '<span id="ai-ask-msg" class="ai-team-msg"></span></div>' +
      '<p class="lede" style="margin:10px 0 0;font-size:12.5px">Context: tab <code>' +
      esc((ctx.editorTab || 'details') + '') +
      '</code>' +
      (ctx.selectedSection ? ' · section <code>' + esc(ctx.selectedSection) + '</code>' : '') +
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
      ' on file · “Answer with Atlas” saves Site Knowledge; Approve/Reject only updates status.</p></div>';

    html += '</div>';
    box.innerHTML = html;
    bind(state);
  }

  function collectFormAnswers() {
    var answers = {};
    FIELDS.forEach(function (f) {
      var el = $('ai-br-' + f.key);
      if (el) answers[f.key] = el.value;
    });
    return answers;
  }

  function bind(state) {
    var siteId = activeSiteId();

    var toggle = $('ai-sk-toggle');
    if (toggle) {
      toggle.onclick = function () {
        var body = $('ai-sk-body');
        if (!body) return;
        var hide = !body.hidden;
        body.hidden = hide;
        toggle.textContent = hide ? 'Edit' : 'Hide';
      };
    }

    document.querySelectorAll('.ai-field-explain').forEach(function (btn) {
      btn.onclick = function () {
        var def = fieldDef(btn.getAttribute('data-key'));
        if (!def) return;
        var tip =
          def.explain +
          (def.examples && def.examples.length
            ? '\n\nExamples: ' + def.examples.join(' · ')
            : '');
        if (window.toast) window.toast(def.label + ': ' + def.explain);
        else window.alert(tip);
      };
    });

    var saveBtn = $('ai-br-save');
    if (saveBtn) {
      saveBtn.onclick = async function () {
        var msg = $('ai-br-msg');
        try {
          setMsg(msg, 'Saving…', '');
          var j = await api('/api/site-brain/bootstrap-review', {
            siteId: siteId,
            answers: collectFormAnswers()
          });
          if (!j.persisted) throw new Error('Save was not persisted');
          setMsg(msg, 'Saved', 'ok');
          if (window.toast) window.toast('Site Knowledge saved');
          loadPanel(panelCtx);
        } catch (e) {
          setMsg(msg, e.message || String(e), 'bad');
        }
      };
    }

    function startChat(fieldKeys, recommendationId) {
      openGuidedChat({ fieldKeys: fieldKeys, recommendationId: recommendationId });
    }

    var openChat = $('ai-open-chat');
    if (openChat) openChat.onclick = function () {
      startChat(null, null);
    };
    var skChat = $('ai-sk-chat');
    if (skChat) skChat.onclick = function () {
      startChat(null, null);
    };
    var askChat = $('ai-ask-chat');
    if (askChat) askChat.onclick = function () {
      startChat(null, null);
    };

    var ask = $('ai-ask-go');
    if (ask) {
      ask.onclick = async function () {
        var msg = $('ai-ask-msg');
        try {
          setMsg(msg, 'Atlas is reviewing…', '');
          var j = await api('/api/ai-team/atlas-review', {
            siteId: siteId,
            requestText: ($('ai-ask') && $('ai-ask').value) || '',
            editorContext: editorContext()
          });
          if (!j.persisted) throw new Error('Recommendations were not persisted');
          setMsg(msg, 'Review ready', 'ok');
          loadPanel(panelCtx);
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
            siteId: siteId,
            forceResync: true
          });
          if (window.toast) window.toast('Site Brain refreshed from website');
          loadPanel(panelCtx);
        } catch (e) {
          if (window.toast) window.toast(e.message || String(e));
        }
      };
    }

    document.querySelectorAll('.ai-rec-answer').forEach(function (btn) {
      btn.onclick = function () {
        startChat([btn.getAttribute('data-field')], btn.getAttribute('data-id'));
      };
    });

    document.querySelectorAll('.ai-rec-approve').forEach(function (btn) {
      btn.onclick = async function () {
        try {
          await api('/api/ai-team/recommendations', {
            siteId: siteId,
            action: 'approve',
            recommendationId: btn.getAttribute('data-id')
          });
          loadPanel(panelCtx);
        } catch (e) {
          if (window.toast) window.toast(e.message || String(e));
        }
      };
    });
    document.querySelectorAll('.ai-rec-reject').forEach(function (btn) {
      btn.onclick = async function () {
        try {
          await api('/api/ai-team/recommendations', {
            siteId: siteId,
            action: 'reject',
            recommendationId: btn.getAttribute('data-id')
          });
          loadPanel(panelCtx);
        } catch (e) {
          if (window.toast) window.toast(e.message || String(e));
        }
      };
    });
  }

  window.renderAiWebsiteTeam = loadPanel;
})();
