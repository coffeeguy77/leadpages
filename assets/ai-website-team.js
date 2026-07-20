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
  /** @type {object|null} */
  var discussSession = null;
  /** @type {object|null} */
  var askSession = null;

  /** Topic pills — mirrors lib/ai-team/ask-topics.js (browser cannot require). */
  var ASK_TOPICS = [
    {
      id: 'landing',
      label: 'Landing Page',
      specialist: 'atlas',
      specialistName: 'Atlas',
      specialistRole: 'Website Strategist',
      question: 'What would you like a landing page on?',
      placeholder: 'e.g. cold coffee options',
      hint: 'Builds one live suggestion card — Answer, Discuss, or Draft in Forge.',
      prefix: 'landing page'
    },
    {
      id: 'seo',
      label: 'SEO',
      specialist: 'scout',
      specialistName: 'Scout',
      specialistRole: 'SEO Specialist',
      question: 'What service or area should we target in search?',
      placeholder: 'e.g. coffee cart hire Canberra',
      hint: 'Atlas coordinates; Scout owns the SEO angle on the card.',
      prefix: 'seo'
    },
    {
      id: 'cta',
      label: 'CTA',
      specialist: 'pulse',
      specialistName: 'Pulse',
      specialistRole: 'Conversion Specialist',
      question: 'What should the main button ask visitors to do?',
      placeholder: 'e.g. Get a free quote',
      hint: 'Conversion card — Draft in Forge can apply the CTA.',
      prefix: 'cta'
    },
    {
      id: 'quote',
      label: 'Quote Form',
      specialist: 'pulse',
      specialistName: 'Pulse',
      specialistRole: 'Conversion Specialist',
      question: 'What should people request when they contact you?',
      placeholder: 'e.g. a coffee cart quote for weddings',
      hint: 'Pulse conversion brief. Discuss now; Forge quote ops expand later.',
      prefix: 'quote form'
    },
    {
      id: 'slider',
      label: 'Slider',
      specialist: 'nova',
      specialistName: 'Nova',
      specialistRole: 'Design Specialist',
      question: 'What should the hero slider showcase?',
      placeholder: 'e.g. wedding setups, corporate carts, iced drinks',
      hint: 'Nova design brief. Discuss now; Forge slider ops expand later.',
      prefix: 'slider'
    },
    {
      id: 'faq',
      label: 'FAQ',
      specialist: 'echo',
      specialistName: 'Echo',
      specialistRole: 'Content Specialist',
      question: 'What objections do customers raise before they enquire?',
      placeholder: 'e.g. price, travel fees, weather backup',
      hint: 'Echo content angle — Draft in Forge can enable FAQ.',
      prefix: 'faq'
    },
    {
      id: 'services',
      label: 'Services',
      specialist: 'echo',
      specialistName: 'Echo',
      specialistRole: 'Content Specialist',
      question: 'What are the main services you sell?',
      placeholder: 'e.g. Weddings, Corporate, Private parties',
      hint: 'Saved as Site Knowledge — Echo can write public copy later.',
      prefix: 'services'
    }
  ];

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

  function notify(msg, kind) {
    if (typeof window.toast === 'function') {
      window.toast(msg, kind);
      return;
    }
    var el = $('toast');
    if (el) {
      el.textContent = msg;
      el.classList.add('show');
      setTimeout(function () {
        el.classList.remove('show');
      }, 2200);
      return;
    }
    if (kind === 'warn') console.warn(msg);
    else console.log(msg);
  }

  function isPendingRecommendation(r) {
    var s = String((r && r.status) || '').toLowerCase();
    return !s || s === 'proposed' || s === 'awaiting-review' || s === 'awaiting_review';
  }

  function fieldDef(key) {
    for (var i = 0; i < FIELDS.length; i++) if (FIELDS[i].key === key) return FIELDS[i];
    return null;
  }

  function activeSiteId() {
    return (panelCtx && panelCtx.siteId) || window.currentSiteId || null;
  }

  function ensureStyles() {
    var st = $('ai-team-styles');
    if (!st) {
      st = document.createElement('style');
      st.id = 'ai-team-styles';
      document.head.appendChild(st);
    }
    st.textContent =
      '.ai-team-msg.ok{color:#0a7d33}.ai-team-msg.bad{color:#b42318}' +
      '.ai-field-help{display:block;margin:4px 0 6px;font-size:12.5px;line-height:1.45;opacity:.82}' +
      '.ai-field-eg{margin-top:2px;font-size:12px;opacity:.7}' +
      '.ai-rec-card{margin:0 0 12px;padding:14px 16px}' +
      '.ai-rec-meta{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12px;opacity:.75;margin:0 0 10px}' +
      '.ai-rec-block{margin:0 0 8px}' +
      '.ai-rec-label{display:block;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;opacity:.7;margin:0 0 3px}' +
      '.ai-rec-issue{margin:0;font-size:14px;line-height:1.45}' +
      '.ai-rec-suggestion{margin:0;font-size:15px;font-weight:600;line-height:1.35}' +
      '.ai-rec-reason{margin:0;font-size:13px;line-height:1.45;opacity:.88}' +
      '.ai-rec-outline{margin:4px 0 0;padding-left:1.2em;font-size:13px;line-height:1.45}' +
      '.ai-rec-outline li{margin:0 0 8px}' +
      '.ai-rec-suggestion-steps .ai-step-label{font-weight:600}' +
      '.ai-step-badge{display:inline-block;font-size:11px;font-weight:700;padding:1px 7px;border-radius:999px;margin-left:6px;vertical-align:middle}' +
      '.ai-step-badge.ask{background:rgba(236,72,153,.18);color:var(--accent,#ec4899)}' +
      '.ai-step-badge.done{background:rgba(10,125,51,.18);color:#3ecf8e}' +
      '.ai-step-badge.ready{background:rgba(56,189,248,.16);color:#38bdf8}' +
      '.ai-step-answer{margin-top:6px}' +
      '.ai-rec-actions{margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}' +
      '.ai-rec-hint{margin:8px 0 0;font-size:12px;opacity:.8}' +
      /* Mobile-first: stack plans/tasks under recommendations; side-by-side on wide screens */
      '.ai-team-layout{display:grid;grid-template-columns:1fr;gap:18px;align-items:start}' +
      '@media(min-width:900px){.ai-team-layout{grid-template-columns:1.2fr .8fr;gap:14px}}' +
      '.ai-team-layout-main,.ai-team-layout-side{min-width:0}' +
      '.ai-preview-diff{display:grid;grid-template-columns:1fr;gap:10px;font-size:13px}' +
      '@media(min-width:520px){.ai-preview-diff{grid-template-columns:1fr 1fr}}' +
      '.ai-ask-shell{margin-bottom:16px;padding:0;overflow:hidden;border:1px solid var(--line,rgba(255,255,255,.1));background:linear-gradient(165deg,rgba(255,255,255,.05),rgba(255,255,255,.02));box-shadow:0 18px 40px rgba(0,0,0,.22);border-radius:var(--radius,12px)}' +
      '.ai-ask-head{display:flex;gap:12px;align-items:flex-start;padding:16px 16px 12px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.18)}' +
      '.ai-ask-avatar{width:42px;height:42px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;letter-spacing:.02em;color:#fff;background:linear-gradient(135deg,var(--accent,#ec4899),#fb7185);box-shadow:0 8px 20px rgba(236,72,153,.28);flex:0 0 auto}' +
      '.ai-ask-avatar.scout{background:linear-gradient(135deg,#0ea5e9,#38bdf8)}' +
      '.ai-ask-avatar.nova{background:linear-gradient(135deg,#a855f7,#c084fc)}' +
      '.ai-ask-avatar.pulse{background:linear-gradient(135deg,#f59e0b,#fb923c)}' +
      '.ai-ask-avatar.echo{background:linear-gradient(135deg,#14b8a6,#2dd4bf)}' +
      '.ai-ask-head h3{margin:0 0 4px;font-size:17px}' +
      '.ai-ask-head .lede{margin:0;font-size:13px;opacity:.84;line-height:1.45}' +
      '.ai-ask-pills{display:flex;flex-wrap:wrap;gap:8px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.06)}' +
      '.ai-ask-pill{appearance:none;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:inherit;border-radius:999px;padding:7px 12px;font-size:12.5px;font-weight:650;cursor:pointer;line-height:1.2}' +
      '.ai-ask-pill:hover{border-color:rgba(255,255,255,.28);background:rgba(255,255,255,.07)}' +
      '.ai-ask-pill.active{border-color:var(--accent,#ec4899);background:rgba(236,72,153,.16);color:var(--accent,#ec4899)}' +
      '.ai-ask-pill small{display:block;font-size:10px;font-weight:600;opacity:.7;margin-top:2px;letter-spacing:.02em;text-transform:uppercase}' +
      '.ai-ask-thread{min-height:168px;max-height:280px;overflow:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px;background:rgba(0,0,0,.14)}' +
      '.ai-ask-bubble{max-width:92%;padding:10px 12px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap}' +
      '.ai-ask-bubble.team{align-self:flex-start;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-bottom-left-radius:6px}' +
      '.ai-ask-bubble.you{align-self:flex-end;background:rgba(236,72,153,.16);border:1px solid rgba(236,72,153,.4);border-bottom-right-radius:6px}' +
      '.ai-ask-bubble .who{display:block;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;opacity:.7;margin:0 0 4px}' +
      '.ai-ask-composer{padding:12px 16px 14px;border-top:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.12)}' +
      '.ai-ask-composer textarea{min-height:74px;resize:vertical}' +
      '.ai-ask-composer-actions{margin-top:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}' +
      '.ai-discuss-context{font-size:13px;line-height:1.45;margin:0 0 12px;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}' +
      '.ai-discuss-context p{margin:0 0 6px}.ai-discuss-context p:last-child{margin:0}' +
      '.ai-step-field{display:block;margin:0 0 12px}' +
      '.ai-step-field > span{display:block;font-size:13px;font-weight:700;margin:0 0 3px}' +
      '.ai-step-help{display:block;font-size:12.5px;line-height:1.4;opacity:.78;margin:0 0 6px;font-weight:400}' +
      '.ai-step-example{display:block;font-size:12px;opacity:.62;margin:4px 0 0}' +
      /* Newsletter-matching controls: 8px radius, no filled wash — all AI inputs/modals */
      '#av-ai-team .ai-tin,.ai-chat-backdrop .ai-tin,' +
      '#av-ai-team input.ai-tin,#av-ai-team textarea.ai-tin,' +
      '.ai-chat-backdrop input.ai-tin,.ai-chat-backdrop textarea.ai-tin,' +
      '#av-ai-team textarea,#av-ai-team input[type=text],' +
      '.ai-chat-backdrop textarea,.ai-chat-backdrop input[type=text]{' +
      'width:100%;box-sizing:border-box;border-radius:8px !important;' +
      'border:1px solid var(--line-strong,rgba(255,255,255,.18)) !important;' +
      'background:transparent !important;background-color:transparent !important;' +
      'color:var(--text,var(--ink,#f4f4f6)) !important;padding:10px 12px;font:inherit;outline:none;' +
      'box-shadow:none !important;-webkit-appearance:none;appearance:none}' +
      '#av-ai-team .ai-tin:focus,.ai-chat-backdrop .ai-tin:focus,' +
      '#av-ai-team textarea:focus,#av-ai-team input[type=text]:focus,' +
      '.ai-chat-backdrop textarea:focus,.ai-chat-backdrop input[type=text]:focus{' +
      'border-color:var(--accent,#ec4899) !important;outline:2px solid var(--focus,var(--accent,#ec4899));outline-offset:-1px}' +
      '#av-ai-team .ai-tin::placeholder,.ai-chat-backdrop .ai-tin::placeholder,' +
      '#av-ai-team textarea::placeholder,.ai-chat-backdrop textarea::placeholder{opacity:.55}' +
      '#ai-team-busy{position:fixed;inset:0;z-index:10050;background:rgba(6,10,18,.62);display:flex;align-items:center;justify-content:center;padding:16px}' +
      '#ai-team-busy .ai-busy-card{max-width:360px;width:100%;padding:22px 20px;border-radius:14px;background:var(--panel,#12141c);border:1px solid rgba(255,255,255,.12);box-shadow:0 18px 50px rgba(0,0,0,.45);text-align:center;color:var(--ink,#f4f4f6)}' +
      '#ai-team-busy .ai-busy-spin{width:36px;height:36px;margin:0 auto 14px;border-radius:50%;border:3px solid rgba(255,255,255,.14);border-top-color:var(--accent,#3b82f6);animation:ai-busy-spin .7s linear infinite}' +
      '@keyframes ai-busy-spin{to{transform:rotate(360deg)}}' +
      '#ai-team-busy .ai-busy-msg{font-size:15px;font-weight:700;margin:0 0 6px}' +
      '#ai-team-busy .ai-busy-sub{font-size:12.5px;opacity:.78;line-height:1.45;margin:0}' +
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
        '" class="tin ai-tin" rows="3" placeholder="' +
        esc(def.examples[0] || '') +
        '">' +
        esc(value || '') +
        '</textarea>'
      : '<input id="' +
        id +
        '" class="tin ai-tin" type="text" value="' +
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
    if (change.outcome === 'confirm_business_goal' || change.path === 'goals.primary') return 'primaryGoal';
    if (change.outcome === 'clarify_preferred_cta' || change.path === 'goals.preferredCta') return 'preferredCta';
    if (change.outcome === 'expand_main_services' || change.path === 'offers.mainServices') return 'mainServices';
    if (rec && rec.interactive === 'site_knowledge_chat') return change.fieldKey || null;
    return null;
  }

  function isForgeOutcome(rec) {
    var change = (rec && (rec.proposed_change || rec.proposedChange)) || {};
    if (change.type === 'forge_draft') return true;
    return (
      change.outcome === 'strengthen_primary_cta' ||
      change.outcome === 'enable_faq_for_objections' ||
      change.outcome === 'plan_seo_landing'
    );
  }

  function withSpecialistOf(rec) {
    var change = (rec && (rec.proposed_change || rec.proposedChange)) || {};
    return change.withSpecialist || change.with_specialist || '';
  }

  function specialistLabel(id) {
    var map = {
      atlas: 'Atlas',
      scout: 'Scout',
      nova: 'Nova',
      pulse: 'Pulse',
      echo: 'Echo',
      lens: 'Lens',
      forge: 'Forge',
      guardian: 'Guardian'
    };
    return map[id] || id;
  }

  function planOutlineOf(rec) {
    var change = (rec && (rec.proposed_change || rec.proposedChange)) || {};
    return Array.isArray(change.planOutline) ? change.planOutline : [];
  }

  function planStepsOf(rec) {
    var change = (rec && (rec.proposed_change || rec.proposedChange)) || {};
    var steps = Array.isArray(change.planSteps) ? change.planSteps.slice() : [];
    var outcome = change.outcome || '';
    // Migrate legacy landing cards (brief / keywords jargon) → Write with AI fields.
    if (
      outcome === 'plan_seo_landing' &&
      steps.some(function (s) {
        return s && (s.id === 'brief' || s.id === 'keywords');
      })
    ) {
      var focusStep = steps.find(function (s) {
        return s && s.id === 'focus';
      });
      var topic =
        (focusStep && focusStep.value) ||
        parseLandingFocusClient(change.promptSummary || rec.problem || '') ||
        '';
      var seoDone = steps.some(function (s) {
        return s && (s.id === 'seo_inputs' || s.id === 'keywords') && s.status === 'done';
      });
      var draft = steps.find(function (s) {
        return s && s.id === 'draft';
      });
      var publish = steps.find(function (s) {
        return s && s.id === 'publish';
      });
      steps = [
        focusStep || {
          id: 'focus',
          status: topic ? 'done' : 'needs_answer',
          label: topic
            ? 'Focus this landing page on: “' + topic.slice(0, 100) + '”.'
            : 'Confirm what this landing page is about.',
          value: topic || '',
          fields: []
        },
        {
          id: 'seo_inputs',
          status: seoDone ? 'done' : 'needs_answer',
          label:
            'Fill the same fields as Landing pages → Write with AI: Primary keyword, Location, plus optional Extra information and Negative keywords.',
          value: '',
          fields: seoDone
            ? []
            : [
                {
                  key: 'primaryKeyword',
                  label: 'Primary keyword',
                  help: 'Main Google phrase to rank for — same field as Write with AI.',
                  placeholder: topic ? topic.slice(0, 80) : 'e.g. pumpkin carving Canberra',
                  example: 'pumpkin carving Canberra',
                  required: true
                },
                {
                  key: 'location',
                  label: 'Location',
                  help: 'Suburb or city this page targets — same field as Write with AI.',
                  placeholder: 'e.g. Canberra',
                  example: 'Canberra',
                  required: true
                },
                {
                  key: 'extraInfo',
                  label: 'Extra information',
                  help: 'Optional — anything else Write with AI should know.',
                  placeholder: 'e.g. Family workshops only — no corporate events.',
                  example: 'Family workshops only — no corporate events.',
                  optional: true,
                  multiline: true
                },
                {
                  key: 'negativeKeywords',
                  label: 'Negative keywords',
                  help: 'Optional — hard ban words (comma-separated).',
                  placeholder: 'e.g. coffee, barista, wedding',
                  example: 'coffee, barista, wedding',
                  optional: true
                }
              ]
        },
        draft || {
          id: 'draft',
          status: seoDone ? 'ready' : 'pending',
          label:
            'Open Landing pages → Write with AI (SEO mode), paste those fields, then Generate draft.',
          value: '',
          fields: []
        },
        publish || {
          id: 'publish',
          status: 'pending',
          label: 'Review the draft, refine copy, then you Publish Live Site yourself.',
          value: '',
          fields: []
        }
      ];
    }
    return steps;
  }

  function parseLandingFocusClient(raw) {
    var t = String(raw || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!t) return '';
    t = t.replace(/^landing\s*pages?\s*[:\-–]\s*/i, '');
    t = t.replace(/^plan a landing page for:\s*/i, '');
    return t.trim();
  }

  function promptSummaryOf(rec) {
    var change = (rec && (rec.proposed_change || rec.proposedChange)) || {};
    if (change.promptSummary) return change.promptSummary;
    return rec.problem || rec.issue || rec.title || '';
  }

  function renderSuggestionSteps(rec) {
    var steps = planStepsOf(rec);
    var outline = planOutlineOf(rec);
    if (!steps.length && outline.length) {
      steps = outline.map(function (label, i) {
        return { id: 's' + i, label: label, status: 'pending', fields: [] };
      });
    }
    if (!steps.length) return '<p class="ai-rec-suggestion">' + esc(rec.title || '') + '</p>';
    return (
      '<ol class="ai-rec-outline ai-rec-suggestion-steps">' +
      steps
        .map(function (s, i) {
          var needs = s.status === 'needs_answer' && s.fields && s.fields.length;
          var badge =
            s.status === 'done'
              ? ' <span class="ai-step-badge done">done</span>'
              : needs
                ? ' <span class="ai-step-badge ask">needs answer</span>'
                : s.status === 'ready'
                  ? ' <span class="ai-step-badge ready">ready</span>'
                  : '';
          var btn = needs
            ? '<button type="button" class="btn sm ai-step-answer" data-id="' +
              esc(rec.id) +
              '" data-step="' +
              esc(s.id) +
              '">Answer</button>'
            : '';
          return (
            '<li data-step="' +
            esc(s.id || '') +
            '"><span class="ai-step-label">' +
            esc(s.label || 'Step ' + (i + 1)) +
            '</span>' +
            badge +
            (btn ? ' ' + btn : '') +
            '</li>'
          );
        })
        .join('') +
      '</ol>'
    );
  }

  function renderRec(r) {
    var gap = r.capability_gap || r.capabilityGap ? ' · capability gap' : '';
    var exec = r.executable ? '' : ' · advisory';
    var fieldKey = knowledgeFieldKey(r);
    var forgeable = isForgeOutcome(r);
    var summary = promptSummaryOf(r);
    var withSpec = withSpecialistOf(r);
    var metaExtra =
      withSpec && withSpec !== 'atlas' ? ' · with ' + specialistLabel(withSpec) : '';
    var answerBtn = fieldKey
      ? '<button type="button" class="btn sm ai-rec-answer" data-id="' +
        esc(r.id) +
        '" data-field="' +
        esc(fieldKey) +
        '">Answer with Atlas</button>'
      : '';
    var check =
      forgeable || fieldKey
        ? '<label style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;margin-right:8px">' +
          '<input type="checkbox" class="ai-rec-pick" data-id="' +
          esc(r.id) +
          '"' +
          (forgeable ? ' data-forge="1"' : '') +
          '> Select</label>'
        : '';
    var draftLabel = forgeable ? 'Draft in Forge' : 'Approve';
    var landingBlocked = forgeable && !landingReadyForForge(r);
    var draftDisabled = landingBlocked ? ' disabled aria-disabled="true"' : '';
    var draftTitle = landingBlocked
      ? ' title="Answer Primary keyword + Location first"'
      : '';
    return (
      '<article class="card ai-rec-card" data-rec-id="' +
      esc(r.id) +
      '">' +
      '<div class="ai-rec-meta"><span>' +
      esc(r.specialist || 'atlas') +
      esc(metaExtra) +
      ' · ' +
      esc(r.status || '') +
      esc(exec) +
      esc(gap) +
      '</span></div>' +
      (summary
        ? '<div class="ai-rec-block"><span class="ai-rec-label">Summary</span><p class="ai-rec-issue">' +
          esc(summary) +
          '</p></div>'
        : '') +
      '<div class="ai-rec-block"><span class="ai-rec-label">Suggestion</span>' +
      renderSuggestionSteps(r) +
      '</div>' +
      '<div class="ai-rec-actions">' +
      check +
      answerBtn +
      '<button type="button" class="btn sm ai-rec-approve" data-id="' +
      esc(r.id) +
      '"' +
      draftDisabled +
      draftTitle +
      '>' +
      esc(draftLabel) +
      '</button>' +
      '<button type="button" class="btn ghost sm ai-rec-discuss" data-id="' +
      esc(r.id) +
      '">Discuss</button>' +
      '<button type="button" class="btn ghost sm ai-rec-reject" data-id="' +
      esc(r.id) +
      '">Reject</button>' +
      '</div>' +
      '<p class="lede ai-rec-hint">Answer steps that need your input. Discuss stays on this card. Draft in Forge builds the preview. AI never publishes.</p></article>'
    );
  }

  function renderTask(t) {
    var previewBtn =
      (t.kind === 'execution_plan' || t.kind === 'forge_draft') && (t.planId || t.executionPlanId || t.patch)
        ? '<button type="button" class="btn sm ai-task-preview" data-id="' +
          esc(t.id) +
          '" data-plan="' +
          esc(t.planId || t.executionPlanId || '') +
          '">Preview changes</button>'
        : '';
    var openBtn =
      t.editorTab || t.editorSection
        ? '<button type="button" class="btn ghost sm ai-task-open" data-tab="' +
          esc(t.editorTab || 'details') +
          '" data-section="' +
          esc(t.editorSection || '') +
          '">Open in editor</button>'
        : '';
    var chatBtn =
      t.kind === 'site_knowledge' && t.fieldKey
        ? '<button type="button" class="btn ghost sm ai-task-chat" data-field="' +
          esc(t.fieldKey) +
          '">Answer with Atlas</button>'
        : '';
    var rollbackBtn =
      t.kind === 'execution_plan' && t.status === 'applied'
        ? ''
        : '';
    return (
      '<article class="card" style="margin:0 0 10px;padding:12px 14px">' +
      '<strong style="display:block">' +
      esc(t.title || 'Task') +
      '</strong>' +
      (t.message
        ? '<p class="lede" style="margin:6px 0 0;font-size:13px">' + esc(t.message) + '</p>'
        : '') +
      '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">' +
      previewBtn +
      openBtn +
      chatBtn +
      rollbackBtn +
      '</div></article>'
    );
  }

  function renderPlanCard(plan) {
    if (!plan) return '';
    var status = plan.status || '';
    var steps = plan.steps || [];
    var previewBtn =
      status === 'preview_ready' || status === 'guardian_validated' || status === 'draft'
        ? '<button type="button" class="btn sm ai-plan-preview" data-plan="' +
          esc(plan.id) +
          '">Change Preview</button>'
        : '';
    var rollbackBtn =
      status === 'applied'
        ? '<button type="button" class="btn ghost sm ai-plan-rollback" data-plan="' +
          esc(plan.id) +
          '">Rollback</button>'
        : '';
    var stepList = steps.length
      ? '<ol class="ai-rec-outline" style="margin-top:8px">' +
        steps
          .slice(0, 12)
          .map(function (s) {
            return '<li>' + esc(s.label || s.title || 'Step') + '</li>';
          })
          .join('') +
        '</ol>'
      : '';
    return (
      '<article class="card" style="margin:0 0 10px;padding:12px 14px">' +
      '<strong style="display:block">' +
      esc(plan.title || 'Execution Plan') +
      '</strong>' +
      '<p class="lede" style="margin:6px 0 0;font-size:12.5px">' +
      esc(String(steps.length)) +
      ' step(s) · ' +
      esc(status) +
      ' · risk ' +
      esc(plan.risk || 'low') +
      '</p>' +
      stepList +
      '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">' +
      previewBtn +
      rollbackBtn +
      '</div></article>'
    );
  }

  function showChangePreview(preview, planId) {
    closeChat();
    var p = preview || {};
    var changes = p.changes || [];
    var rows = changes
      .map(function (c) {
        return (
          '<div style="border-top:1px solid var(--line,var(--border));padding:12px 0">' +
          '<div style="font-weight:700;margin-bottom:6px">✓ ' +
          esc(c.label || c.operation || 'Change') +
          '</div>' +
          '<div class="ai-preview-diff">' +
          '<div><div style="opacity:.7;font-size:11px;text-transform:uppercase;letter-spacing:.04em">Before</div>' +
          esc(c.before == null ? '—' : String(c.before)) +
          '</div>' +
          '<div><div style="opacity:.7;font-size:11px;text-transform:uppercase;letter-spacing:.04em">After</div>' +
          esc(c.after == null ? '—' : String(c.after)) +
          '</div></div></div>'
        );
      })
      .join('');
    var backdrop = document.createElement('div');
    backdrop.id = 'ai-preview-backdrop';
    backdrop.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    backdrop.innerHTML =
      '<div class="card" style="max-width:520px;width:100%;max-height:85vh;overflow:auto;padding:20px 22px">' +
      '<h3 style="margin:0 0 4px">' +
      esc(p.title || 'Changes Ready') +
      '</h3>' +
      '<p class="lede" style="margin:0 0 12px;font-size:13px">Confidence checkpoint before Forge writes site config. AI never publishes.</p>' +
      (rows || '<p class="lede">No configuration steps in this plan.</p>') +
      '<div style="margin-top:14px;font-size:13px;opacity:.9">' +
      '<div><strong>Affected pages</strong> · ' +
      esc((p.affectedPages || ['Home']).join(', ')) +
      '</div>' +
      '<div><strong>Risk</strong> · ' +
      esc(p.risk || 'Low') +
      '</div>' +
      '<div><strong>Estimated time</strong> · ' +
      esc(p.estimatedTime || 'Instant') +
      '</div></div>' +
      '<div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">' +
      '<button type="button" class="btn" id="ai-preview-apply" data-plan="' +
      esc(planId || p.planId || '') +
      '">Apply Changes</button>' +
      '<button type="button" class="btn ghost" id="ai-preview-cancel" data-plan="' +
      esc(planId || p.planId || '') +
      '">Cancel</button>' +
      '</div></div>';
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) backdrop.remove();
    });
    var apply = backdrop.querySelector('#ai-preview-apply');
    var cancel = backdrop.querySelector('#ai-preview-cancel');
    if (apply) {
      apply.onclick = async function () {
        apply.disabled = true;
        if (cancel) cancel.disabled = true;
        showBusy('Applying changes…');
        try {
          var j = await api('/api/ai-team/execution-plan', {
            siteId: activeSiteId(),
            action: 'apply',
            planId: apply.getAttribute('data-plan')
          });
          closeBusy();
          backdrop.remove();
          notify(j.notice || j.summary || 'Changes applied to site config.');
          openAppliedResult(j);
          loadPanel(panelCtx);
        } catch (e) {
          closeBusy();
          notify(e.message || String(e), 'warn');
          apply.disabled = false;
          if (cancel) cancel.disabled = false;
        }
      };
    }
    if (cancel) {
      cancel.onclick = async function () {
        try {
          await api('/api/ai-team/execution-plan', {
            siteId: activeSiteId(),
            action: 'cancel',
            planId: cancel.getAttribute('data-plan')
          });
          backdrop.remove();
          notify('Execution Plan cancelled.');
          loadPanel(panelCtx);
        } catch (e) {
          backdrop.remove();
          notify(e.message || String(e), 'warn');
        }
      };
    }
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

  function closeBusy() {
    var el = $('ai-team-busy');
    if (el) el.remove();
  }

  /** Instant busy overlay — call synchronously on click before any await. */
  function showBusy(message) {
    closeBusy();
    ensureStyles();
    var el = document.createElement('div');
    el.id = 'ai-team-busy';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML =
      '<div class="ai-busy-card">' +
      '<div class="ai-busy-spin" aria-hidden="true"></div>' +
      '<div class="ai-busy-msg">' +
      esc(message || 'Working…') +
      '</div>' +
      '<div class="ai-busy-sub">Please wait — Forge is updating site config. AI never publishes.</div>' +
      '</div>';
    document.body.appendChild(el);
    return el;
  }

  function landingReadyForForge(rec) {
    var change = (rec && (rec.proposed_change || rec.proposedChange)) || {};
    if (change.outcome !== 'plan_seo_landing') return true;
    var inputs = change.landingAiInputs || change.landing_ai_inputs;
    if (inputs && String(inputs.primaryKeyword || '').trim() && String(inputs.location || '').trim()) {
      return true;
    }
    var steps = planStepsOf(rec);
    return steps.some(function (s) {
      return (
        s &&
        (s.id === 'seo_inputs' || s.id === 'keywords') &&
        s.status === 'done' &&
        s.answers &&
        String(s.answers.primaryKeyword || s.answers.phrase || '').trim() &&
        String(s.answers.location || '').trim()
      );
    });
  }

  function forgeBlockReason(rec) {
    if (!rec) return 'Recommendation not found.';
    if (!isForgeOutcome(rec)) return null;
    var change = (rec.proposed_change || rec.proposedChange) || {};
    if (change.outcome === 'plan_seo_landing' && !landingReadyForForge(rec)) {
      return 'Answer Primary keyword + Location first (Write with AI fields), then Draft in Forge.';
    }
    return null;
  }

  function openAppliedResult(j) {
    if (j && j.pageId && typeof window.lpOpenLandingPage === 'function') {
      window.lpOpenLandingPage(j.pageId);
      return;
    }
    if (j && j.editorSection && typeof window.lpOpenEditorSection === 'function') {
      window.lpOpenEditorSection(j.editorTab || 'details', j.editorSection);
    }
  }

  function closeChat() {
    var el = $('ai-chat-backdrop');
    if (el) el.remove();
    chatSession = null;
    discussSession = null;
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

  function renderDiscussOutline(outline) {
    var box = $('ai-discuss-outline');
    if (!box) return;
    if (!outline || !outline.length) {
      box.innerHTML = '';
      return;
    }
    box.innerHTML =
      '<span class="ai-rec-label">Suggestion</span><ol class="ai-rec-outline">' +
      outline
        .map(function (s) {
          return '<li>' + esc(s) + '</li>';
        })
        .join('') +
      '</ol>';
  }

  function paintDiscussMessages(messages) {
    var log = $('ai-chat-log');
    if (!log) return;
    log.innerHTML = '';
    (messages || []).forEach(function (m) {
      appendChatBubble(m.role === 'user' ? 'you' : 'atlas', m.body || '');
    });
  }

  async function openDiscussChat(rec) {
    ensureStyles();
    closeChat();
    if (!rec || !rec.id) return;
    discussSession = { recommendationId: rec.id, recommendation: rec };
    var summary = promptSummaryOf(rec);
    var outline = planOutlineOf(rec);
    var forgeable = isForgeOutcome(rec);
    var backdrop = document.createElement('div');
    backdrop.className = 'ai-chat-backdrop';
    backdrop.id = 'ai-chat-backdrop';
    backdrop.innerHTML =
      '<div class="ai-chat-modal" role="dialog" aria-modal="true" aria-label="Discuss recommendation with Atlas">' +
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">' +
      '<div><h2 style="margin:0 0 4px">Discuss with Atlas</h2>' +
      '<p class="lede" style="margin:0;font-size:13px">Same suggestion — refine the plan here. Ask the Team will not create a duplicate.</p></div>' +
      '<button type="button" class="btn ghost sm" id="ai-chat-x">✕</button></div>' +
      '<div class="ai-discuss-context">' +
      (summary ? '<p><strong>Summary:</strong> ' + esc(summary) + '</p>' : '') +
      '<div id="ai-discuss-outline"></div></div>' +
      '<div class="ai-chat-log" id="ai-chat-log"></div>' +
      '<textarea id="ai-discuss-input" class="tin ai-tin" rows="3" placeholder="Ask a question or refine the plan…"></textarea>' +
      '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      '<button type="button" class="btn" id="ai-discuss-send">Send</button>' +
      (forgeable
        ? '<button type="button" class="btn" id="ai-discuss-draft">Draft in Forge</button>'
        : '') +
      '<button type="button" class="btn ghost" id="ai-discuss-close">Close</button>' +
      '<span id="ai-chat-msg" class="ai-team-msg"></span></div>' +
      '<p class="lede" style="margin:10px 0 0;font-size:12px">When you agree, Draft in Forge builds the exact steps for Change Preview. AI never publishes.</p></div>';
    document.body.appendChild(backdrop);
    renderDiscussOutline(outline);
    backdrop.addEventListener('click', function (ev) {
      if (ev.target === backdrop) {
        closeChat();
        softRefresh(panelCtx);
      }
    });
    $('ai-chat-x').onclick = function () {
      closeChat();
      softRefresh(panelCtx);
    };
    $('ai-discuss-close').onclick = function () {
      closeChat();
      softRefresh(panelCtx);
    };

    async function loadThread() {
      try {
        var j = await api('/api/ai-team/recommendations', {
          siteId: activeSiteId(),
          action: 'discuss',
          recommendationId: rec.id,
          message: ''
        });
        if (j.recommendation) {
          discussSession.recommendation = j.recommendation;
          if (lastState && lastState.recommendations) {
            lastState.recommendations = lastState.recommendations.map(function (r) {
              return String(r.id) === String(j.recommendation.id) ? j.recommendation : r;
            });
          }
        }
        paintDiscussMessages(j.messages || []);
        renderDiscussOutline(j.planOutline || planOutlineOf(j.recommendation || rec));
      } catch (e) {
        appendChatBubble(
          'atlas',
          'Here is the current plan. Tell me what to change.\n\n' +
            outline.map(function (s, i) {
              return i + 1 + '. ' + s;
            }).join('\n')
        );
      }
    }

    $('ai-discuss-send').onclick = async function () {
      var input = $('ai-discuss-input');
      var msg = $('ai-chat-msg');
      var text = input ? String(input.value || '').trim() : '';
      if (!text) {
        setMsg(msg, 'Type a message first.', 'bad');
        return;
      }
      try {
        setMsg(msg, 'Atlas is thinking…', '');
        var j = await api('/api/ai-team/recommendations', {
          siteId: activeSiteId(),
          action: 'discuss',
          recommendationId: discussSession.recommendationId,
          message: text
        });
        if (input) input.value = '';
        if (j.recommendation) {
          discussSession.recommendation = j.recommendation;
          if (lastState && lastState.recommendations) {
            lastState.recommendations = lastState.recommendations.map(function (r) {
              return String(r.id) === String(j.recommendation.id) ? j.recommendation : r;
            });
          }
        }
        paintDiscussMessages(j.messages || []);
        renderDiscussOutline(j.planOutline || []);
        var intent = j.intent || '';
        if (intent === 'question') setMsg(msg, 'Answered — plan unchanged until you give an edit.', 'ok');
        else if (intent === 'edit') setMsg(msg, 'Plan updated on this same suggestion.', 'ok');
        else setMsg(msg, 'Noted.', 'ok');
      } catch (e) {
        setMsg(msg, e.message || String(e), 'bad');
      }
    };

    var draftBtn = $('ai-discuss-draft');
    if (draftBtn) {
      draftBtn.onclick = async function () {
        var msg = $('ai-chat-msg');
        var block = forgeBlockReason(discussSession && discussSession.recommendation);
        if (block) {
          setMsg(msg, block, 'bad');
          return;
        }
        draftBtn.disabled = true;
        showBusy('Building Change Preview…');
        try {
          setMsg(msg, 'Drafting in Forge…', '');
          var j = await api('/api/ai-team/execution-plan', {
            siteId: activeSiteId(),
            action: 'create',
            recommendationIds: [discussSession.recommendationId],
            editorContext: editorContext()
          });
          closeBusy();
          closeChat();
          notify(j.nextStep || 'Execution Plan ready — open Change Preview.');
          if (j.preview && j.plan && j.plan.id) {
            showChangePreview(j.preview, j.plan.id);
          } else {
            softRefresh(panelCtx);
          }
        } catch (e) {
          closeBusy();
          draftBtn.disabled = false;
          setMsg(msg, e.message || String(e), 'bad');
        }
      };
    }

    await loadThread();
  }

  function openStepAnswer(rec, stepId) {
    ensureStyles();
    closeChat();
    if (!rec || !stepId) return;
    var steps = planStepsOf(rec);
    var step = steps.find(function (s) {
      return String(s.id) === String(stepId);
    });
    if (!step || !step.fields || !step.fields.length) {
      notify('This step does not need an answer right now.', 'warn');
      return;
    }
    var fieldsHtml = step.fields
      .map(function (f) {
        var multiline = !!(f.multiline || f.key === 'proofPoints' || f.key === 'objections' || f.key === 'extraInfo' || f.key === 'slides');
        var opt = f.optional ? ' <em style="font-weight:500;opacity:.7">(optional)</em>' : '';
        return (
          '<label class="ai-step-field"><span>' +
          esc(f.label || f.key) +
          opt +
          '</span>' +
          (f.help ? '<span class="ai-step-help">' + esc(f.help) + '</span>' : '') +
          (multiline
            ? '<textarea id="ai-step-' +
              esc(f.key) +
              '" class="tin ai-tin" rows="3" placeholder="' +
              esc(f.placeholder || '') +
              '"></textarea>'
            : '<input id="ai-step-' +
              esc(f.key) +
              '" class="tin ai-tin" type="text" placeholder="' +
              esc(f.placeholder || '') +
              '">') +
          (f.example
            ? '<span class="ai-step-example">Example: ' + esc(f.example) + '</span>'
            : '') +
          '</label>'
        );
      })
      .join('');
    var backdrop = document.createElement('div');
    backdrop.className = 'ai-chat-backdrop';
    backdrop.id = 'ai-chat-backdrop';
    backdrop.innerHTML =
      '<div class="ai-chat-modal" role="dialog" aria-modal="true" aria-label="Answer plan step">' +
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">' +
      '<div><h2 style="margin:0 0 4px">Answer this step</h2>' +
      '<p class="lede" style="margin:0;font-size:13px">' +
      esc(step.label || 'Step') +
      '</p></div>' +
      '<button type="button" class="btn ghost sm" id="ai-chat-x">✕</button></div>' +
      '<div style="margin-top:14px">' +
      fieldsHtml +
      '</div>' +
      '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      '<button type="button" class="btn" id="ai-step-save">Save &amp; update plan</button>' +
      '<button type="button" class="btn ghost" id="ai-step-cancel">Cancel</button>' +
      '<span id="ai-chat-msg" class="ai-team-msg"></span></div>' +
      '<p class="lede" style="margin:10px 0 0;font-size:12px">Same fields as Landing pages → Write with AI. Saves on this card — does not publish.</p></div>';
    document.body.appendChild(backdrop);
    function shut() {
      closeChat();
    }
    backdrop.addEventListener('click', function (ev) {
      if (ev.target === backdrop) shut();
    });
    $('ai-chat-x').onclick = shut;
    $('ai-step-cancel').onclick = shut;
    $('ai-step-save').onclick = async function () {
      var msg = $('ai-chat-msg');
      var answers = {};
      var missing = [];
      step.fields.forEach(function (f) {
        var el = $('ai-step-' + f.key);
        answers[f.key] = el ? el.value : '';
        if (f.required && !String(answers[f.key] || '').trim()) missing.push(f.label || f.key);
      });
      if (missing.length) {
        setMsg(msg, 'Please fill: ' + missing.join(', '), 'bad');
        return;
      }
      try {
        setMsg(msg, 'Saving…', '');
        var j = await api('/api/ai-team/recommendations', {
          siteId: activeSiteId(),
          action: 'answer_step',
          recommendationId: rec.id,
          stepId: stepId,
          answers: answers
        });
        if (!j.persisted) throw new Error('Not persisted');
        if (j.recommendation && lastState && lastState.recommendations) {
          lastState.recommendations = lastState.recommendations.map(function (r) {
            return String(r.id) === String(j.recommendation.id) ? j.recommendation : r;
          });
        }
        closeChat();
        notify('Step answered — checklist updated.');
        softRefresh(panelCtx);
      } catch (e) {
        setMsg(msg, e.message || String(e), 'bad');
      }
    };
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
        ? '<textarea id="ai-chat-input" class="tin ai-tin" rows="4" placeholder="' +
          esc(def.examples[0] || '') +
          '">' +
          esc(cur) +
          '</textarea>'
        : '<input id="ai-chat-input" class="tin ai-tin" type="text" value="' +
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
      softRefresh(panelCtx);
    };
    renderChatQuestion();
  }

  function findAskTopic(id) {
    for (var i = 0; i < ASK_TOPICS.length; i++) {
      if (ASK_TOPICS[i].id === id) return ASK_TOPICS[i];
    }
    return null;
  }

  function appendAskBubble(role, who, text) {
    var thread = $('ai-ask-thread');
    if (!thread) return;
    var div = document.createElement('div');
    div.className = 'ai-ask-bubble ' + (role === 'you' ? 'you' : 'team');
    div.innerHTML =
      '<span class="who">' +
      esc(who || (role === 'you' ? 'You' : 'Atlas')) +
      '</span>' +
      esc(text || '');
    thread.appendChild(div);
    thread.scrollTop = thread.scrollHeight;
    if (!askSession) askSession = { topicId: null, topic: null, messages: [] };
    askSession.messages = askSession.messages || [];
    askSession.messages.push({ role: role, who: who, body: text });
  }

  function paintAskThread() {
    var thread = $('ai-ask-thread');
    if (!thread) return;
    thread.innerHTML = '';
    var msgs =
      askSession && askSession.messages && askSession.messages.length
        ? askSession.messages
        : [
            {
              role: 'team',
              who: 'Atlas',
              body:
                'Pick a topic pill to start a guided ask — or type freely below. Each Send builds a live suggestion card you can Answer, Discuss, or Draft in Forge.'
            }
          ];
    msgs.forEach(function (m) {
      var div = document.createElement('div');
      div.className = 'ai-ask-bubble ' + (m.role === 'you' ? 'you' : 'team');
      div.innerHTML =
        '<span class="who">' +
        esc(m.who || (m.role === 'you' ? 'You' : 'Atlas')) +
        '</span>' +
        esc(m.body || '');
      thread.appendChild(div);
    });
    thread.scrollTop = thread.scrollHeight;
  }

  function setAskSpecialist(topic) {
    var avatar = $('ai-ask-avatar');
    var title = $('ai-ask-title');
    var sub = $('ai-ask-sub');
    var input = $('ai-ask');
    var spec = topic || {
      specialist: 'atlas',
      specialistName: 'Atlas',
      specialistRole: 'Website Strategist',
      placeholder: 'Type freely, or pick a topic above…',
      hint:
        'Pick a popular topic or type freely. Atlas coordinates — specialists advise on their cards.'
    };
    if (avatar) {
      avatar.className = 'ai-ask-avatar ' + (spec.specialist || 'atlas');
      avatar.textContent = String(spec.specialistName || 'A').charAt(0);
    }
    if (title) {
      title.textContent = topic
        ? spec.specialistName + ' — ' + spec.specialistRole
        : 'Ask the Team';
    }
    if (sub) {
      sub.textContent = topic
        ? spec.hint ||
          'Atlas coordinates this card with ' + spec.specialistName + '.'
        : 'Pick a popular topic or type freely. Atlas coordinates — Scout, Nova, Pulse, and Echo advise on their cards. Builds a live suggestion you can save, Discuss, or Draft in Forge.';
    }
    if (input && spec.placeholder) input.placeholder = spec.placeholder;
    document.querySelectorAll('.ai-ask-pill').forEach(function (btn) {
      var active = topic && btn.getAttribute('data-topic') === topic.id;
      btn.classList.toggle('active', !!active);
    });
  }

  function selectAskTopic(topicId) {
    var topic = findAskTopic(topicId);
    if (!topic) return;
    askSession = {
      topicId: topic.id,
      topic: topic,
      messages: askSession && askSession.messages ? askSession.messages.slice() : []
    };
    setAskSpecialist(topic);
    appendAskBubble(
      'team',
      topic.specialistName,
      topic.question + (topic.hint ? '\n\n' + topic.hint : '')
    );
    var input = $('ai-ask');
    if (input) {
      input.value = '';
      try {
        input.focus();
      } catch (_e) {}
    }
    setMsg($('ai-ask-msg'), 'Answer in the chat box, then Send.', 'ok');
  }

  function composeAskRequestText(raw) {
    var text = String(raw || '').trim();
    if (!text) return '';
    if (askSession && askSession.topic && askSession.topic.prefix) {
      var prefix = askSession.topic.prefix;
      var re = new RegExp('^' + prefix.replace(/\s+/g, '\\s*') + '\\s*[:\\-–]', 'i');
      if (!re.test(text)) return prefix + ': ' + text;
    }
    return text;
  }

  async function softRefresh(opts) {
    opts = opts || {};
    mergeOpts(opts);
    var box = $('av-ai-team');
    if (!box || !lastState) return loadPanel(opts);
    var siteId = activeSiteId();
    if (!siteId) return loadPanel(opts);

    var askEl = $('ai-ask');
    var preservedAsk = askEl ? askEl.value : '';
    var preservedSession = askSession;
    var scrollY = box.scrollTop || 0;
    var statusEl = $('ai-ask-msg');
    var statusText = statusEl ? statusEl.textContent : '';
    var statusCls = statusEl && statusEl.classList.contains('ok') ? 'ok' : statusEl && statusEl.classList.contains('bad') ? 'bad' : '';

    try {
      if (!opts.skipBrain) {
        var got = await api('/api/site-brain/get', { siteId: siteId });
        lastState.brain = got.brain;
        lastState.review = got.review;
        lastState.needsReview = !!got.needsBootstrapReview;
      }
      if (opts.recommendations) {
        lastState.recommendations = opts.recommendations;
      } else {
        var listed = await api('/api/ai-team/recommendations', {
          siteId: siteId,
          action: 'list'
        });
        lastState.recommendations = listed.recommendations || [];
      }
    } catch (_e) {
      return loadPanel(opts);
    }

    askSession = preservedSession;
    if (lastState) lastState._siteId = siteId;
    paint(lastState);
    paintAskThread();
    setAskSpecialist(askSession && askSession.topic ? askSession.topic : null);
    var ask2 = $('ai-ask');
    if (ask2 && preservedAsk != null) ask2.value = preservedAsk;
    if (opts.focusAsk && ask2) {
      try {
        ask2.focus();
        ask2.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (_e2) {}
    }
    box.scrollTop = scrollY;
    if (opts.quiet) return;
    if (opts.statusText) setMsg($('ai-ask-msg'), opts.statusText, opts.statusCls || 'ok');
    else if (statusText) setMsg($('ai-ask-msg'), statusText, statusCls);
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

    // Instant paint from cache for this site — refresh in background (no blank "Loading…").
    var cached =
      lastState &&
      lastState.brain &&
      String(lastState._siteId || '') === String(siteId) &&
      !opts.forceReload;
    if (cached) {
      paint(lastState);
      paintAskThread();
      setAskSpecialist(askSession && askSession.topic ? askSession.topic : null);
      softRefresh({ quiet: true });
      return;
    }

    // Lightweight shell while first fetch runs (parallel brain + recommendations).
    box.innerHTML =
      '<div class="card" style="margin-bottom:16px"><h2 style="margin:0 0 6px">AI Website Team</h2>' +
      '<p class="lede" style="margin:0">Opening…</p></div>' +
      '<div class="card ai-ask-shell"><div class="ai-ask-head"><div class="ai-ask-avatar">A</div>' +
      '<div><h3>Ask the Team</h3><p class="lede">Loading your Site Brain and suggestions…</p></div></div></div>';

    var state = {
      brain: null,
      review: null,
      needsReview: false,
      recommendations: [],
      _siteId: siteId
    };

    var brainPromise = api('/api/site-brain/get', { siteId: siteId }).catch(function (e) {
      return { __err: e };
    });
    var listPromise = api('/api/ai-team/recommendations', {
      siteId: siteId,
      action: 'list'
    }).catch(function () {
      return { recommendations: [] };
    });

    var gotWrap = await brainPromise;
    if (gotWrap && gotWrap.__err) {
      var e = gotWrap.__err;
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
    } else {
      state.brain = gotWrap.brain;
      state.review = gotWrap.review;
      state.needsReview = !!gotWrap.needsBootstrapReview;
    }

    var listed = await listPromise;
    state.recommendations = (listed && listed.recommendations) || [];

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
      '</strong>. Ask Atlas for recommendations — it does <em>not</em> build pages or change the live site until you Approve → Forge → Apply → you Publish.</p></div>' +
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
      '<div class="card ai-ask-shell" id="ai-ask-shell">' +
      '<div class="ai-ask-head">' +
      '<div class="ai-ask-avatar" id="ai-ask-avatar">A</div>' +
      '<div><h3 id="ai-ask-title">Ask the Team</h3>' +
      '<p class="lede" id="ai-ask-sub">Pick a popular topic or type freely. Atlas coordinates — Scout, Nova, Pulse, and Echo advise on their cards. Builds a live suggestion you can save, Discuss, or Draft in Forge.</p></div></div>' +
      '<div class="ai-ask-pills" id="ai-ask-pills">' +
      ASK_TOPICS.map(function (t) {
        return (
          '<button type="button" class="ai-ask-pill" data-topic="' +
          esc(t.id) +
          '" title="' +
          esc(t.hint || '') +
          '">' +
          esc(t.label) +
          '<small>' +
          esc(t.specialistName) +
          '</small></button>'
        );
      }).join('') +
      '</div>' +
      '<div class="ai-ask-thread" id="ai-ask-thread" aria-live="polite"></div>' +
      '<div class="ai-ask-composer">' +
      '<textarea id="ai-ask" class="tin ai-tin" rows="3" placeholder="Type freely, or pick a topic above…"></textarea>' +
      '<div class="ai-ask-composer-actions">' +
      '<button type="button" class="btn" id="ai-ask-go">Send</button>' +
      '<button type="button" class="btn ghost" id="ai-ask-chat">Fill gaps with Atlas</button>' +
      '<button type="button" class="btn ghost" id="ai-resync">Refresh from website</button>' +
      '<span id="ai-ask-msg" class="ai-team-msg"></span></div>' +
      '<p class="lede" style="margin:10px 0 0;font-size:12.5px">Context: tab <code>' +
      esc((ctx.editorTab || 'details') + '') +
      '</code>' +
      (ctx.selectedSection ? ' · section <code>' + esc(ctx.selectedSection) + '</code>' : '') +
      ' · refine an existing card with Discuss, not Ask again.</p></div></div>';

    html +=
      '<div class="card" style="margin-bottom:16px;padding:14px 16px">' +
      '<strong>Specialist Team</strong>' +
      '<p class="lede" style="margin:6px 0 0;font-size:13px">Atlas (strategy) · Echo (copy) · Scout (SEO) · Pulse (conversion) · Nova (design) · Lens (images) · Guardian (validation) · Forge (execution — sole config writer). Topic pills route the conversation to the right advisor; Atlas still coordinates every card. Only Forge mutates website configuration.</p></div>';

    var pendingRecs = recs.filter(isPendingRecommendation);
    var doneRecs = recs.filter(function (r) {
      return !isPendingRecommendation(r);
    });
    var plans = (snap.executionPlans || []).filter(function (p) {
      return p && p.status !== 'cancelled';
    });

    html += '<div class="ai-team-layout">';
    html +=
      '<div class="ai-team-layout-main"><h3 style="margin:0 0 6px">Recommended next actions</h3>' +
      '<p class="lede" style="margin:0 0 10px;font-size:12.5px;opacity:.85">Each card shows a Summary and numbered Suggestion steps. Answer steps that need your input, or Discuss to refine.</p>';
    if (!pendingRecs.length) {
      html += '<p class="lede">No pending recommendations — ask Atlas for a review.</p>';
    } else {
      html +=
        '<div style="margin:0 0 10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
        '<button type="button" class="btn sm" id="ai-batch-plan">Build Execution Plan from selected</button>' +
        '<span class="lede" style="margin:0;font-size:12px;opacity:.8">Batch into one plan, one preview, one apply, one rollback.</span></div>';
      html += pendingRecs
        .slice(0, 12)
        .map(renderRec)
        .join('');
    }
    if (doneRecs.length) {
      html +=
        '<p class="lede" style="margin:14px 0 6px;font-size:12.5px;opacity:.85">Completed decisions (' +
        esc(String(doneRecs.length)) +
        ')</p>';
      html += doneRecs
        .slice(0, 6)
        .map(function (r) {
          return (
            '<p class="lede" style="margin:0 0 6px;font-size:13px"><strong>' +
            esc(r.title) +
            '</strong> · ' +
            esc(r.status) +
            '</p>'
          );
        })
        .join('');
    }
    html += '</div>';

    html += '<div class="ai-team-layout-side"><h3 style="margin:0 0 10px">Execution Plans</h3>';
    if (!plans.length) {
      html +=
        '<p class="lede">No plans yet — select recommendations and build an Execution Plan.</p>';
    } else {
      html += plans
        .slice(0, 6)
        .map(renderPlanCard)
        .join('');
    }

    html += '<h3 style="margin:16px 0 10px">Open tasks</h3>';
    if (!openTasks.length) {
      html +=
        '<p class="lede">No open tasks.</p>';
    } else {
      html += openTasks
        .slice(0, 8)
        .map(renderTask)
        .join('');
    }
    html +=
      '<p class="lede" style="margin:14px 0 0;font-size:12px;opacity:.85">Pipeline: Recommendation → Execution Plan → Guardian → Preview → Apply → Editor → <strong>you</strong> Publish Live Site.</p></div>';

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
        notify(def.label + ': ' + def.explain);
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
          notify('Site Knowledge saved');
          softRefresh(panelCtx);
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
        var askBtn = ask;
        var input = $('ai-ask');
        var raw = input ? String(input.value || '').trim() : '';
        if (!raw) {
          setMsg(msg, askSession && askSession.topic ? 'Answer the question first.' : 'Type a question or pick a topic.', 'bad');
          return;
        }
        var requestText = composeAskRequestText(raw);
        var who =
          (askSession && askSession.topic && askSession.topic.specialistName) || 'Atlas';
        try {
          askBtn.disabled = true;
          appendAskBubble('you', 'You', raw);
          if (input) input.value = '';
          appendAskBubble(
            'team',
            who,
            'Building a live suggestion card… Atlas coordinates; nothing is published yet.'
          );
          setMsg(msg, who + ' is reviewing…', '');
          var j = await api('/api/ai-team/atlas-review', {
            siteId: siteId,
            requestText: requestText,
            editorContext: editorContext()
          });
          if (!j.persisted) throw new Error('Recommendations were not persisted');
          var count = (j.recommendations || []).length;
          appendAskBubble(
            'team',
            who,
            count
              ? 'Done — ' +
                  count +
                  ' live card' +
                  (count === 1 ? '' : 's') +
                  ' below. Use Answer / Discuss / Draft in Forge on the card.'
              : 'Review finished — check Recommended next actions below.'
          );
          await softRefresh({
            statusText:
              'Live card ready — Summary plus numbered steps. Nothing was published.',
            statusCls: 'ok'
          });
        } catch (e) {
          appendAskBubble('team', 'Atlas', 'Could not build the card: ' + (e.message || String(e)));
          setMsg(msg, e.message || String(e), 'bad');
        } finally {
          askBtn.disabled = false;
        }
      };
    }

    document.querySelectorAll('.ai-ask-pill').forEach(function (btn) {
      btn.onclick = function () {
        selectAskTopic(btn.getAttribute('data-topic'));
      };
    });

    paintAskThread();
    setAskSpecialist(askSession && askSession.topic ? askSession.topic : null);

    var resync = $('ai-resync');
    if (resync) {
      resync.onclick = async function () {
        try {
          await api('/api/site-brain/sync', {
            siteId: siteId,
            forceResync: true
          });
          notify('Site Brain refreshed from website');
          loadPanel(panelCtx);
        } catch (e) {
          notify(e.message || String(e), 'warn');
        }
      };
    }

    document.querySelectorAll('.ai-rec-answer').forEach(function (btn) {
      btn.onclick = function () {
        startChat([btn.getAttribute('data-field')], btn.getAttribute('data-id'));
      };
    });

    document.querySelectorAll('.ai-rec-discuss').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-id');
        var rec = ((lastState && lastState.recommendations) || []).find(function (r) {
          return String(r.id) === String(id);
        });
        if (rec) openDiscussChat(rec);
      };
    });

    document.querySelectorAll('.ai-step-answer').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-id');
        var stepId = btn.getAttribute('data-step');
        var rec = ((lastState && lastState.recommendations) || []).find(function (r) {
          return String(r.id) === String(id);
        });
        if (rec) openStepAnswer(rec, stepId);
      };
    });

    document.querySelectorAll('.ai-rec-approve').forEach(function (btn) {
      btn.onclick = async function () {
        if (btn.disabled) return;
        var id = btn.getAttribute('data-id');
        var rec = ((lastState && lastState.recommendations) || []).find(function (r) {
          return String(r.id) === String(id);
        });
        var block = forgeBlockReason(rec);
        if (block) {
          notify(block, 'warn');
          return;
        }
        btn.disabled = true;
        showBusy('Building Change Preview…');
        try {
          var j = await api('/api/ai-team/execution-plan', {
            siteId: siteId,
            action: 'create',
            recommendationIds: [id],
            editorContext: editorContext()
          });
          closeBusy();
          notify(j.nextStep || 'Execution Plan ready — open Change Preview.');
          if (j.preview && j.plan && j.plan.id) {
            showChangePreview(j.preview, j.plan.id);
          } else {
            softRefresh(panelCtx);
          }
        } catch (e) {
          closeBusy();
          btn.disabled = false;
          notify(e.message || String(e), 'warn');
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
          notify('Recommendation rejected.');
          softRefresh(panelCtx);
        } catch (e) {
          notify(e.message || String(e), 'warn');
        }
      };
    });

    var batch = $('ai-batch-plan');
    if (batch) {
      batch.onclick = async function () {
        var ids = [];
        document.querySelectorAll('.ai-rec-pick:checked').forEach(function (el) {
          ids.push(el.getAttribute('data-id'));
        });
        if (!ids.length) {
          notify('Select one or more recommendations first.', 'warn');
          return;
        }
        batch.disabled = true;
        showBusy('Building Change Preview…');
        try {
          var j = await api('/api/ai-team/execution-plan', {
            siteId: siteId,
            action: 'create',
            recommendationIds: ids,
            editorContext: editorContext()
          });
          closeBusy();
          notify(j.nextStep || 'Batched Execution Plan ready.');
          if (j.preview && j.plan && j.plan.id) showChangePreview(j.preview, j.plan.id);
          else softRefresh(panelCtx);
        } catch (e) {
          closeBusy();
          notify(e.message || String(e), 'warn');
          batch.disabled = false;
        }
      };
    }

    async function openPreviewForPlan(planId) {
      var j = await api('/api/ai-team/execution-plan', {
        siteId: siteId,
        action: 'preview',
        planId: planId,
        editorContext: editorContext()
      });
      showChangePreview(j.preview || (j.plan && j.plan.preview), planId);
    }

    document.querySelectorAll('.ai-task-preview, .ai-plan-preview').forEach(function (btn) {
      btn.onclick = async function () {
        try {
          var planId = btn.getAttribute('data-plan');
          if (!planId) {
            // Legacy forge_draft task — apply path still works via forge-apply
            var j = await api('/api/ai-team/forge-apply', {
              siteId: siteId,
              taskId: btn.getAttribute('data-id')
            });
            notify(j.notice || j.summary || 'Draft applied.');
            loadPanel(panelCtx);
            return;
          }
          await openPreviewForPlan(planId);
        } catch (e) {
          notify(e.message || String(e), 'warn');
        }
      };
    });

    document.querySelectorAll('.ai-plan-rollback').forEach(function (btn) {
      btn.onclick = async function () {
        if (!window.confirm('Roll back this Execution Plan to the pre-apply config snapshot?')) return;
        try {
          var j = await api('/api/ai-team/execution-plan', {
            siteId: siteId,
            action: 'rollback',
            planId: btn.getAttribute('data-plan')
          });
          notify(j.notice || 'Rolled back.');
          loadPanel(panelCtx);
        } catch (e) {
          notify(e.message || String(e), 'warn');
        }
      };
    });

    document.querySelectorAll('.ai-task-open').forEach(function (btn) {
      btn.onclick = function () {
        if (typeof window.lpOpenEditorSection === 'function') {
          window.lpOpenEditorSection(
            btn.getAttribute('data-tab') || 'details',
            btn.getAttribute('data-section') || null
          );
        } else {
          var nav = $('nav-details');
          if (nav) nav.click();
        }
      };
    });

    document.querySelectorAll('.ai-task-chat').forEach(function (btn) {
      btn.onclick = function () {
        startChat([btn.getAttribute('data-field')], null);
      };
    });
  }

  window.renderAiWebsiteTeam = loadPanel;
})();
