/**
 * Embeddable messaging UI — partner console + site manage.
 */
(function (global) {
  'use strict';

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function fmt(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    var diff = (now - d) / 86400000;
    if (diff < 7) {
      return d.toLocaleDateString([], { weekday: 'short' }) + ' ' +
        d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  }

  function mount(opts) {
    opts = opts || {};
    var root = opts.container;
    if (!root || !opts.sb) return null;

    var sb = opts.sb;
    var me = {
      uid: opts.uid,
      role: opts.role || 'partner',
      partnerId: opts.partnerId || null,
      name: opts.name || 'Partner'
    };
    var prefix = opts.idPrefix || 'lme-';
    var convos = [];
    var reads = {};
    var sitesById = {};
    var partnersById = {};
    var activeId = null;
    var activeMsgs = [];
    var poll = null;
    var convFilter = '';
    var pendingOpen = opts.open || null;

    root.classList.add('lp-messages-embed');
    root.innerHTML =
      '<div class="lme-layout">'
      + '<div class="lme-pane lme-list" id="' + prefix + 'list">'
      + '<div class="lme-list-head"><h3>Conversations</h3><button type="button" class="btn btn-brand btn-sm" id="' + prefix + 'new">New</button></div>'
      + '<div class="lme-list-filters">'
      +   '<input id="' + prefix + 'filter" type="text" placeholder="Search…" />'
      +   '<div class="lme-chips" id="' + prefix + 'chips"></div>'
      + '</div>'
      + '<div id="' + prefix + 'newbox" class="lme-newbox hidden"></div>'
      + '<div class="lme-convs" id="' + prefix + 'convs"></div>'
      + '</div>'
      + '<div class="lme-pane lme-thread" id="' + prefix + 'thread">'
      + '<div class="lme-thread-empty" id="' + prefix + 'empty">Select a conversation or start a new one.</div>'
      + '<div class="lme-thread-on hidden" id="' + prefix + 'on">'
      + '<div class="lme-thread-head">'
      + '<button type="button" class="btn btn-sm lme-back hidden" id="' + prefix + 'back">&larr;</button>'
      + '<div style="min-width:0"><div class="lme-thread-title" id="' + prefix + 'title"></div><div class="lme-thread-sub muted" id="' + prefix + 'sub"></div><div class="lme-thread-meta muted" id="' + prefix + 'meta"></div></div>'
      + '<button type="button" class="btn btn-sm" id="' + prefix + 'refresh">Refresh</button>'
      + '</div>'
      + '<div class="lme-bubbles" id="' + prefix + 'bubbles"></div>'
      + '<div class="lme-composer">'
      + '<textarea id="' + prefix + 'text" placeholder="Write a message…" rows="1"></textarea>'
      + '<button type="button" class="btn btn-brand" id="' + prefix + 'send">Send</button>'
      + '</div></div></div></div>';

    function $(id) { return document.getElementById(prefix + id); }

    function convLabel(c) {
      if (me.role === 'client') {
        return c.kind === 'partner_client' ? 'My provider' : 'LeadPages support';
      }
      if (me.role === 'partner') {
        if (c.kind === 'partner_lp') return 'LeadPages account manager';
        var s = sitesById[c.client_site_id];
        return 'Client: ' + ((s && s.business_name) || 'Client');
      }
      if (c.kind === 'partner_lp') {
        var p = partnersById[c.partner_id];
        return 'Partner: ' + ((p && p.display_name) || 'Partner');
      }
      var s2 = sitesById[c.client_site_id];
      return 'Client: ' + ((s2 && s2.business_name) || 'Client');
    }

    function convKindText(c) {
      if (c.kind === 'partner_lp') return 'Partner ↔ LeadPages';
      if (c.kind === 'partner_client') return 'Provider ↔ client';
      return 'Client support';
    }

    function convKindGroup(c) {
      if (c.kind === 'partner_lp') return 'lp';
      if (c.kind === 'partner_client') return 'clients';
      return 'support';
    }

    function isUnread(c) {
      var lr = reads[c.id];
      if (!lr) return true;
      return new Date(c.last_message_at) > new Date(lr);
    }

    async function loadLookups() {
      var ps = await sb.from('partners').select('id,display_name').limit(1000);
      partnersById = {};
      (ps.data || []).forEach(function (p) { partnersById[p.id] = p; });
      var ss = await sb.from('sites').select('id,business_name,owner_user_id,servicing_partner_id,status').limit(2000);
      sitesById = {};
      (ss.data || []).forEach(function (s) { sitesById[s.id] = s; });
    }

    async function loadConvos() {
      var r = await sb.from('conversations').select('*').order('last_message_at', { ascending: false });
      if (r.error) {
        $('convs').innerHTML = '<div class="lme-empty">Could not load messages.</div>';
        return;
      }
      convos = r.data || [];
      var rd = await sb.from('conversation_reads').select('conversation_id,last_read_at').eq('user_id', me.uid);
      reads = {};
      (rd.data || []).forEach(function (x) { reads[x.conversation_id] = x.last_read_at; });
      renderConvos();
      notifyUnread();
    }

    function renderConvos() {
      var box = $('convs');
      if (!convos.length) {
        box.innerHTML = '<div class="lme-empty">No conversations yet.<br>Tap <strong>New</strong> to start one.</div>';
        return;
      }
      var list = convos;
      var kind = (opts.defaultKind || '');
      try {
        var chip = $('chips') && $('chips').querySelector('.lme-chip.on');
        kind = chip ? chip.getAttribute('data-kind') : kind;
      } catch (_e) {}

      if (convFilter) {
        var qf = convFilter.toLowerCase();
        list = convos.filter(function (c) { return convLabel(c).toLowerCase().indexOf(qf) >= 0; });
      }
      if (kind) {
        list = list.filter(function (c) { return convKindGroup(c) === kind; });
      }
      box.innerHTML = list.map(function (c) {
        return '<button type="button" class="lme-conv' + (c.id === activeId ? ' on' : '') + (isUnread(c) ? ' unread' : '') + '" data-id="' + c.id + '">'
          + '<span class="lme-conv-body"><span class="lme-conv-name">' + esc(convLabel(c)) + '</span>'
          + '<span class="lme-conv-kind">' + esc(convKindText(c)) + '</span>'
          + '<span class="lme-conv-time">' + fmt(c.last_message_at) + '</span></span>'
          + '<span class="lme-dot" aria-hidden="true"></span></button>';
      }).join('');
    }

    function notifyUnread() {
      var n = convos.filter(isUnread).length;
      if (typeof opts.onUnread === 'function') opts.onUnread(n);
      try {
        global.dispatchEvent(new CustomEvent('lp-messages-unread', { detail: { count: n } }));
      } catch (_e) { /* ignore */ }
    }

    async function markRead(id) {
      await sb.from('conversation_reads').upsert({
        conversation_id: id,
        user_id: me.uid,
        last_read_at: new Date().toISOString()
      }, { onConflict: 'conversation_id,user_id' });
      reads[id] = new Date().toISOString();
      renderConvos();
      notifyUnread();
    }

    function renderMsgs() {
      var box = $('bubbles');
      if (!activeMsgs.length) {
        box.innerHTML = '<div class="lme-empty">No messages yet — say hello.</div>';
        return;
      }
      box.innerHTML = activeMsgs.map(function (m) {
        var mine = m.sender_id === me.uid;
        var who = mine ? 'You' : (m.sender_role === 'super' ? 'LeadPages' : (m.sender_role === 'partner' ? 'Partner' : 'Client'));
        return '<div class="lme-b ' + (mine ? 'me' : 'them') + '">'
          + '<div class="lme-meta muted">' + esc(who) + ' · ' + fmt(m.created_at) + '</div>'
          + '<div class="lme-bub">' + esc(m.body) + '</div></div>';
      }).join('');
      box.scrollTop = box.scrollHeight;
    }

    async function loadMsgs(id) {
      var r = await sb.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true });
      activeMsgs = r.data || [];
      renderMsgs();
    }

    function stopPoll() {
      if (poll) { clearInterval(poll); poll = null; }
    }

    function startPoll(id) {
      stopPoll();
      poll = setInterval(async function () {
        if (activeId !== id) return;
        var before = activeMsgs.length;
        await loadMsgs(id);
        if (activeMsgs.length !== before) await markRead(id);
      }, 8000);
    }

    async function selectConv(id) {
      activeId = id;
      renderConvos();
      var c = convos.find(function (x) { return x.id === id; });
      if (!c) return;
      $('empty').classList.add('hidden');
      $('on').classList.remove('hidden');
      $('title').textContent = convLabel(c);
      $('sub').textContent = convKindText(c);
      // Context line (site status, when available)
      var meta = '';
      if (c.client_site_id && sitesById[c.client_site_id]) {
        var s = sitesById[c.client_site_id];
        meta = (s.business_name ? (s.business_name + ' · ') : '') + (s.status ? ('Site: ' + s.status) : '');
      }
      var metaEl = $('meta');
      if (metaEl) metaEl.textContent = meta;
      if (global.matchMedia('(max-width:760px)').matches) {
        $('list').classList.add('collapsed');
        $('back').classList.remove('hidden');
      }
      await loadMsgs(id);
      await markRead(id);
      startPoll(id);
    }

    async function notifyApi(convId) {
      try {
        var sess = (await sb.auth.getSession()).data.session;
        var tk = sess && sess.access_token;
        await fetch('/api/notify-message', {
          method: 'POST',
          headers: Object.assign({ 'content-type': 'application/json' }, tk ? { Authorization: 'Bearer ' + tk } : {}),
          body: JSON.stringify({ conversationId: convId })
        });
      } catch (_e) { /* ignore */ }
    }

    async function sendMsg(bodyText) {
      var t = bodyText != null ? String(bodyText).trim() : ($('text').value || '').trim();
      if (!t || !activeId) return false;
      var btn = $('send');
      if (btn) btn.disabled = true;
      var r = await sb.from('messages').insert({
        conversation_id: activeId,
        sender_id: me.uid,
        sender_role: me.role,
        body: t
      }).select('*').single();
      if (btn) btn.disabled = false;
      if (r.error) return false;
      if (bodyText == null) {
        $('text').value = '';
        $('text').style.height = 'auto';
      }
      activeMsgs.push(r.data);
      renderMsgs();
      notifyApi(activeId);
      await markRead(activeId);
      await loadConvos();
      return true;
    }

    async function findOrCreate(kind, match, insertRow) {
      var qy = sb.from('conversations').select('*').eq('kind', kind);
      Object.keys(match).forEach(function (k) { qy = qy.eq(k, match[k]); });
      var ex = await qy.limit(1);
      if (ex.data && ex.data.length) return ex.data[0];
      var ins = await sb.from('conversations').insert(Object.assign({
        kind: kind,
        created_by: me.uid,
        last_message_at: new Date().toISOString()
      }, insertRow)).select('*').single();
      return ins.error ? null : ins.data;
    }

    async function startConv(conv, prefill) {
      if (!conv) return;
      $('newbox').classList.add('hidden');
      if (!convos.find(function (x) { return x.id === conv.id; })) convos.unshift(conv);
      renderConvos();
      await selectConv(conv.id);
      if (prefill) await sendMsg(prefill);
    }

    function openNewBox() {
      var box = $('newbox');
      box.classList.toggle('hidden');
      if (box.classList.contains('hidden')) return;
      var html = '<h4>Start a conversation</h4>';
      if (me.role === 'partner') {
        html += '<button type="button" class="btn btn-sm" data-new="lp" style="width:100%;margin-bottom:8px">Message LeadPages account manager</button>';
        var clients = Object.keys(sitesById).map(function (k) { return sitesById[k]; })
          .filter(function (s) { return s.servicing_partner_id === me.partnerId && s.owner_user_id; });
        if (clients.length) {
          html += '<label class="muted" style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Message a client</label>'
            + '<select id="' + prefix + 'new-client" class="tin"><option value="">Choose a client…</option>'
            + clients.map(function (s) {
              return '<option value="' + s.id + '">' + esc(s.business_name || 'Client') + '</option>';
            }).join('') + '</select>';
        }
      } else if (me.role === 'client') {
        var site = Object.keys(sitesById).map(function (k) { return sitesById[k]; })
          .find(function (s) { return s.owner_user_id === me.uid; });
        if (site && site.servicing_partner_id) {
          html += '<button type="button" class="btn btn-sm" data-new="provider" style="width:100%;margin-bottom:8px">Message my provider</button>';
        }
        html += '<button type="button" class="btn btn-sm" data-new="support" style="width:100%">Contact LeadPages support</button>';
      }
      box.innerHTML = html;
    }

    async function openClient(siteId, prefill) {
      var s = sitesById[siteId];
      if (!s || !me.partnerId) return;
      var conv = await findOrCreate('partner_client', {
        partner_id: me.partnerId,
        client_site_id: siteId
      }, {
        partner_id: me.partnerId,
        client_site_id: siteId,
        client_user_id: s.owner_user_id
      });
      await startConv(conv, prefill);
    }

    async function openLeadPages(prefill) {
      if (!me.partnerId) return;
      var conv = await findOrCreate('partner_lp', { partner_id: me.partnerId }, { partner_id: me.partnerId });
      await startConv(conv, prefill);
    }

    async function openProvider() {
      var site = Object.keys(sitesById).map(function (k) { return sitesById[k]; })
        .find(function (s) { return s.owner_user_id === me.uid; });
      if (!site || !site.servicing_partner_id) return;
      var conv = await findOrCreate('partner_client', {
        partner_id: site.servicing_partner_id,
        client_site_id: site.id
      }, {
        partner_id: site.servicing_partner_id,
        client_site_id: site.id,
        client_user_id: me.uid
      });
      await startConv(conv);
    }

    async function openClientSupport() {
      var site = Object.keys(sitesById).map(function (k) { return sitesById[k]; })
        .find(function (s) { return s.owner_user_id === me.uid; });
      var conv = await findOrCreate('client_support', { client_user_id: me.uid }, {
        client_user_id: me.uid,
        client_site_id: site ? site.id : null
      });
      await startConv(conv);
    }

    $('new').addEventListener('click', openNewBox);
    var filterEl = $('filter');
    if (filterEl) {
      filterEl.addEventListener('input', function () {
        convFilter = (this.value || '').trim();
        renderConvos();
      });
    }

    // Kind chips
    (function () {
      var chips = $('chips');
      if (!chips) return;
      var defs = [
        { k: '', label: 'All' },
        { k: 'clients', label: 'Clients' },
        { k: 'lp', label: 'LeadPages' },
        { k: 'support', label: 'Support' }
      ];
      chips.innerHTML = defs.map(function (d) {
        return '<button type="button" class="lme-chip' + (d.k === '' ? ' on' : '') + '" data-kind="' + esc(d.k) + '">' + esc(d.label) + '</button>';
      }).join('');
      chips.addEventListener('click', function (e) {
        var b = e.target.closest('.lme-chip');
        if (!b) return;
        chips.querySelectorAll('.lme-chip').forEach(function (x) { x.classList.toggle('on', x === b); });
        renderConvos();
      });
    })();
    $('newbox').addEventListener('click', async function (e) {
      var b = e.target.closest('[data-new]');
      if (!b) return;
      var kind = b.getAttribute('data-new');
      if (kind === 'lp') await openLeadPages();
      if (kind === 'provider') await openProvider();
      if (kind === 'support') await openClientSupport();
    });
    $('newbox').addEventListener('change', async function (e) {
      if (e.target.id === prefix + 'new-client') {
        var sid = e.target.value;
        if (sid) await openClient(sid);
      }
    });
    $('convs').addEventListener('click', function (e) {
      var c = e.target.closest('.lme-conv');
      if (c) selectConv(c.getAttribute('data-id'));
    });
    $('send').addEventListener('click', function () { sendMsg(); });
    $('text').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
    });
    $('text').addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 140) + 'px';
    });
    $('refresh').addEventListener('click', function () { if (activeId) loadMsgs(activeId); });
    $('back').addEventListener('click', function () {
      $('list').classList.remove('collapsed');
      stopPoll();
      activeId = null;
      renderConvos();
      $('on').classList.add('hidden');
      $('empty').classList.remove('hidden');
    });

    async function boot() {
      await loadLookups();
      await loadConvos();
      if (pendingOpen) {
        var o = pendingOpen;
        pendingOpen = null;
        if (o.kind === 'client' && o.siteId) await openClient(o.siteId, o.prefill);
        else if (o.kind === 'lp') await openLeadPages(o.prefill);
        else if (o.kind === 'provider') await openProvider();
        else if (o.kind === 'support') await openClientSupport();
        else if (o.convId) await selectConv(o.convId);
      }
    }

    boot();

    return {
      refresh: loadConvos,
      openClient: openClient,
      openLeadPages: openLeadPages,
      openProvider: openProvider,
      openClientSupport: openClientSupport,
      selectConv: selectConv,
      destroy: function () {
        stopPoll();
        try {
          var el = $('filter');
          if (el) el.value = '';
        } catch (_e) { /* ignore */ }
      },
      getUnreadCount: function () { return convos.filter(isUnread).length; },
      getUnreadCountByGroup: function (group) {
        if (!group) return convos.filter(isUnread).length;
        return convos.filter(function (c) { return isUnread(c) && convKindGroup(c) === group; }).length;
      }
    };
  }

  global.LPMessagesEmbed = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
