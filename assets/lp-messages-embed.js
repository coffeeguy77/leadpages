/**
 * Embeddable messaging UI — partner console + site manage.
 *
 * Roles:
 * - client: primary chat with provider; can add LeadPages Team to that chat,
 *   or open a private LeadPages thread after the first provider chat exists.
 * - partner: clients + LeadPages account manager; can add LeadPages Team.
 * - super: when siteId is set, mirrors that site's provider thread.
 *
 * New simply starts the partner/client chat — no escalation discussion.
 */
(function (global) {
  'use strict';

  var LP_JOIN_MARKER = '[lp-team-joined]';

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function actorLabel(role) {
    if (role === 'client') return 'Client';
    if (role === 'partner') return 'Partner';
    if (role === 'super' || role === 'leadpages') return 'LeadPages Team';
    return 'Someone';
  }

  function isJoinMessage(body) {
    var raw = String(body || '');
    return raw.indexOf(LP_JOIN_MARKER) !== -1 || /added LeadPages Team to the chat/i.test(raw);
  }

  function joinMessageText(body) {
    var raw = String(body || '');
    var idx = raw.indexOf(LP_JOIN_MARKER);
    var text = (idx >= 0 ? raw.slice(idx + LP_JOIN_MARKER.length) : raw).trim();
    return text || 'LeadPages Team joined the chat.';
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
    var siteId = opts.siteId || null;
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
    var chipsWired = false;
    var lastCreateError = '';
    var creating = false;

    // Prefer manage's known site row — client RLS often cannot re-fetch servicing_partner_id.
    var siteContext = opts.siteContext || null;
    if (siteContext && siteContext.id) {
      sitesById[String(siteContext.id)] = {
        id: siteContext.id,
        business_name: siteContext.business_name || '',
        owner_user_id: siteContext.owner_user_id || null,
        servicing_partner_id: siteContext.servicing_partner_id || null,
        referring_partner_id: siteContext.referring_partner_id || null,
        status: siteContext.status || ''
      };
    }

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
      + '<div class="lme-footer-actions hidden" id="' + prefix + 'footer"></div>'
      + '<div class="lme-composer">'
      + '<textarea id="' + prefix + 'text" placeholder="Write a message…" rows="1"></textarea>'
      + '<button type="button" class="btn btn-brand" id="' + prefix + 'send">Send</button>'
      + '</div></div></div></div>';

    function $(id) { return document.getElementById(prefix + id); }

    function scopedSite() {
      if (!siteId) return null;
      return sitesById[siteId] || null;
    }

    function convLabel(c) {
      if (me.role === 'client') {
        return c.kind === 'partner_client' ? 'My provider' : 'LeadPages (private)';
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
      if (c.kind === 'client_support') {
        var sPriv = sitesById[c.client_site_id];
        return 'LeadPages (private): ' + ((sPriv && sPriv.business_name) || 'Client');
      }
      var s2 = sitesById[c.client_site_id];
      return 'Provider ↔ ' + ((s2 && s2.business_name) || 'client');
    }

    function convKindText(c) {
      if (c.kind === 'partner_lp') return 'Partner ↔ LeadPages';
      if (c.kind === 'partner_client') {
        return isLpJoined(c) ? 'Provider ↔ client · LeadPages Team' : 'Provider ↔ client';
      }
      return 'Client ↔ LeadPages (private)';
    }

    function hasProviderChat() {
      return convos.some(function (c) { return c && c.kind === 'partner_client'; });
    }

    function isLpJoined(c) {
      if (!c) return false;
      if (c.leadpages_joined || c.leadpages_joined_at) return true;
      if (c.id === activeId) {
        return activeMsgs.some(function (m) { return isJoinMessage(m && m.body); });
      }
      return false;
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

    function chipDefs() {
      if (me.role === 'client') {
        var defs = [{ k: '', label: 'All' }, { k: 'clients', label: 'My provider' }];
        if (convos.some(function (c) { return c.kind === 'client_support'; })) {
          defs.push({ k: 'support', label: 'Private LeadPages' });
        }
        return defs;
      }
      if (me.role === 'partner') {
        return [
          { k: '', label: 'All' },
          { k: 'clients', label: 'Clients' },
          { k: 'lp', label: 'LeadPages' }
        ];
      }
      // super
      if (siteId) {
        var siteDefs = [{ k: '', label: 'All' }, { k: 'clients', label: 'Provider' }];
        if (convos.some(function (c) { return c.kind === 'client_support'; })) {
          siteDefs.push({ k: 'support', label: 'Private LeadPages' });
        }
        return siteDefs;
      }
      return [
        { k: '', label: 'All' },
        { k: 'clients', label: 'Clients' },
        { k: 'lp', label: 'LeadPages' },
        { k: 'support', label: 'Support' }
      ];
    }

    function renderChips() {
      var chips = $('chips');
      if (!chips) return;
      var prev = '';
      try {
        var on = chips.querySelector('.lme-chip.on');
        if (on) prev = on.getAttribute('data-kind') || '';
      } catch (_e) {}
      var defs = chipDefs();
      var valid = defs.some(function (d) { return d.k === prev; });
      if (!valid) prev = '';
      chips.innerHTML = defs.map(function (d) {
        return '<button type="button" class="lme-chip' + (d.k === prev ? ' on' : '') + '" data-kind="' + esc(d.k) + '">' + esc(d.label) + '</button>';
      }).join('');
      if (!chipsWired) {
        chipsWired = true;
        chips.addEventListener('click', function (e) {
          var b = e.target.closest('.lme-chip');
          if (!b) return;
          chips.querySelectorAll('.lme-chip').forEach(function (x) { x.classList.toggle('on', x === b); });
          renderConvos();
        });
      }
    }

    function filterBySiteScope(list) {
      if (!siteId) return list;
      var site = scopedSite();
      var ownerId = site && site.owner_user_id;
      return list.filter(function (c) {
        if (c.client_site_id && String(c.client_site_id) === String(siteId)) return true;
        if (c.kind === 'client_support' && ownerId && c.client_user_id === ownerId) return true;
        // Partner ↔ LeadPages is account-level — keep for partners in manage
        if (me.role === 'partner' && c.kind === 'partner_lp' && me.partnerId && c.partner_id === me.partnerId) return true;
        // Super on a customer site: provider + private LeadPages only (not every partner_lp thread)
        return false;
      });
    }

    async function loadLookups() {
      var ps = await sb.from('partners').select('id,display_name').limit(1000);
      partnersById = {};
      (ps.data || []).forEach(function (p) { partnersById[p.id] = p; });
      var ss = await sb.from('sites').select('id,business_name,owner_user_id,servicing_partner_id,referring_partner_id,status').limit(2000);
      var fetched = {};
      (ss.data || []).forEach(function (s) { fetched[s.id] = s; });
      // Keep manage-provided site context (may include partner ids clients cannot SELECT).
      if (siteContext && siteContext.id) {
        var sid = String(siteContext.id);
        fetched[sid] = Object.assign({}, fetched[sid] || {}, {
          id: siteContext.id,
          business_name: siteContext.business_name || (fetched[sid] && fetched[sid].business_name) || '',
          owner_user_id: siteContext.owner_user_id || (fetched[sid] && fetched[sid].owner_user_id) || null,
          servicing_partner_id: siteContext.servicing_partner_id || (fetched[sid] && fetched[sid].servicing_partner_id) || null,
          referring_partner_id: siteContext.referring_partner_id || (fetched[sid] && fetched[sid].referring_partner_id) || null,
          status: siteContext.status || (fetched[sid] && fetched[sid].status) || ''
        });
      }
      sitesById = fetched;
    }

    function providerPartnerId(site) {
      if (!site) return null;
      return site.servicing_partner_id || site.referring_partner_id || null;
    }

    function showNewMessage(title, body) {
      var box = $('newbox');
      if (!box) return;
      box.classList.remove('hidden');
      box.innerHTML = '<h4>' + esc(title || 'Start a conversation') + '</h4>'
        + '<p class="muted" style="font-size:13px;margin:0;line-height:1.45">' + esc(body) + '</p>';
    }

    function setNewBusy(on) {
      creating = !!on;
      var btn = $('new');
      if (btn) {
        btn.disabled = !!on;
        btn.textContent = on ? 'Starting…' : 'New';
      }
    }

    async function loadConvos() {
      var r = await sb.from('conversations').select('*').order('last_message_at', { ascending: false });
      if (r.error) {
        $('convs').innerHTML = '<div class="lme-empty">Could not load messages.</div>';
        return;
      }
      convos = filterBySiteScope(r.data || []);
      var rd = await sb.from('conversation_reads').select('conversation_id,last_read_at').eq('user_id', me.uid);
      reads = {};
      (rd.data || []).forEach(function (x) { reads[x.conversation_id] = x.last_read_at; });
      renderChips();
      renderConvos();
      notifyUnread();
    }

    function renderConvos() {
      var box = $('convs');
      if (!convos.length) {
        var hint = me.role === 'client'
          ? '<p>No conversations yet.</p><p>Tap <strong>New</strong> to message your provider.</p>'
          : '<p>No conversations yet.</p><p>Tap <strong>New</strong> to start one.</p>';
        box.innerHTML = '<div class="lme-empty">' + hint + '</div>';
        return;
      }
      var list = convos;
      var kind = '';
      try {
        var chip = $('chips') && $('chips').querySelector('.lme-chip.on');
        kind = chip ? chip.getAttribute('data-kind') : '';
      } catch (_e) {}

      if (convFilter) {
        var qf = convFilter.toLowerCase();
        list = convos.filter(function (c) { return convLabel(c).toLowerCase().indexOf(qf) >= 0; });
      }
      if (kind) {
        list = list.filter(function (c) { return convKindGroup(c) === kind; });
      }
      if (!list.length) {
        box.innerHTML = '<div class="lme-empty">No conversations match.</div>';
        return;
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
        if (isJoinMessage(m.body) || m.sender_role === 'system') {
          return '<div class="lme-b system" role="status">'
            + '<div class="lme-bub">' + esc(joinMessageText(m.body)) + '</div>'
            + '<div class="lme-meta muted">' + fmt(m.created_at) + '</div></div>';
        }
        var mine = m.sender_id === me.uid;
        var who = mine ? 'You' : (m.sender_role === 'super' ? 'LeadPages' : (m.sender_role === 'partner' ? 'Partner' : 'Client'));
        return '<div class="lme-b ' + (mine ? 'me' : 'them') + '">'
          + '<div class="lme-meta muted">' + esc(who) + ' · ' + fmt(m.created_at) + '</div>'
          + '<div class="lme-bub">' + esc(m.body) + '</div></div>';
      }).join('');
      box.scrollTop = box.scrollHeight;
    }

    function updateFooterActions(c) {
      var el = $('footer');
      if (!el) return;
      if (!c || c.kind !== 'partner_client') {
        el.classList.add('hidden');
        el.innerHTML = '';
        return;
      }
      var joined = isLpJoined(c);
      var parts = [];
      if (!joined) {
        parts.push('<button type="button" class="lme-footer-link" data-act="add-lp">Add LeadPages Team to this chat</button>');
      } else {
        parts.push('<p class="lme-footer-note">LeadPages Team is in this chat.</p>');
      }
      if (me.role === 'client' && hasProviderChat()) {
        parts.push('<button type="button" class="lme-footer-link" data-act="private-lp">Contact LeadPages team privately</button>');
        parts.push('<p class="lme-footer-note">Report a partner or client issue directly with the LeadPages team for a private conversation.</p>');
      }
      el.innerHTML = parts.join('');
      el.classList.toggle('hidden', !parts.length);
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
      updateFooterActions(c);
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
      lastCreateError = '';
      var qy = sb.from('conversations').select('*').eq('kind', kind);
      Object.keys(match).forEach(function (k) { qy = qy.eq(k, match[k]); });
      var ex = await qy.limit(1);
      if (ex.data && ex.data.length) return ex.data[0];
      var ins = await sb.from('conversations').insert(Object.assign({
        kind: kind,
        created_by: me.uid,
        last_message_at: new Date().toISOString()
      }, insertRow)).select('*').single();
      if (!ins.error) return ins.data;
      lastCreateError = (ins.error && ins.error.message) || 'Could not create conversation';
      // Race / unique: another row may already exist
      var retry = await qy.limit(1);
      if (retry.data && retry.data.length) return retry.data[0];
      return null;
    }

    async function startConv(conv, prefill) {
      if (!conv) return;
      $('newbox').classList.add('hidden');
      if (!convos.find(function (x) { return x.id === conv.id; })) convos.unshift(conv);
      renderChips();
      renderConvos();
      await selectConv(conv.id);
      if (prefill) await sendMsg(prefill);
    }

    function openNewBox() {
      if (creating) return;
      // Client / site-scoped super: New simply opens the provider chat.
      if (me.role === 'client') {
        openProvider().catch(function (err) {
          showNewMessage('Could not start conversation', (err && err.message) || 'Please try again.');
          setNewBusy(false);
        });
        return;
      }
      if (me.role === 'super' && siteId) {
        openSiteProvider().catch(function (err) {
          showNewMessage('Could not start conversation', (err && err.message) || 'Please try again.');
          setNewBusy(false);
        });
        return;
      }

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
      } else if (me.role === 'super') {
        html += '<p class="muted" style="font-size:13px;margin:0">Select a site in manage to open that customer’s support threads.</p>';
      }
      box.innerHTML = html;
    }

    async function openClient(siteIdArg, prefill) {
      var s = sitesById[siteIdArg];
      if (!s || !me.partnerId) return;
      var conv = await findOrCreate('partner_client', {
        partner_id: me.partnerId,
        client_site_id: siteIdArg
      }, {
        partner_id: me.partnerId,
        client_site_id: siteIdArg,
        client_user_id: s.owner_user_id
      });
      if (!conv) {
        showNewMessage('Could not start conversation', lastCreateError || 'Please try again.');
        return;
      }
      await startConv(conv, prefill);
    }

    async function openLeadPages(prefill) {
      if (!me.partnerId) return;
      var conv = await findOrCreate('partner_lp', { partner_id: me.partnerId }, { partner_id: me.partnerId });
      if (!conv) {
        showNewMessage('Could not start conversation', lastCreateError || 'Please try again.');
        return;
      }
      await startConv(conv, prefill);
    }

    async function openProvider() {
      setNewBusy(true);
      try {
        var site = siteId ? sitesById[siteId] : Object.keys(sitesById).map(function (k) { return sitesById[k]; })
          .find(function (s) { return s.owner_user_id === me.uid; });
        if (!site) {
          showNewMessage('Start a conversation', 'Could not load this site. Refresh the page and try again.');
          return;
        }
        var pid = providerPartnerId(site);
        if (!pid) {
          showNewMessage('Start a conversation', 'No provider is linked to this site yet. Ask LeadPages or your agency to assign a servicing partner, then try again.');
          return;
        }
        var conv = await findOrCreate('partner_client', {
          partner_id: pid,
          client_site_id: site.id
        }, {
          partner_id: pid,
          client_site_id: site.id,
          client_user_id: site.owner_user_id || me.uid
        });
        if (!conv) {
          showNewMessage('Could not start conversation', lastCreateError || 'Please try again or contact support.');
          return;
        }
        await startConv(conv);
      } finally {
        setNewBusy(false);
      }
    }

    async function openSiteProvider() {
      setNewBusy(true);
      try {
        var site = scopedSite();
        if (!site) {
          showNewMessage('Start a conversation', 'Could not load this site. Refresh the page and try again.');
          return;
        }
        var pid = providerPartnerId(site);
        if (!pid) {
          showNewMessage('Start a conversation', 'No provider is linked to this site yet. Assign a servicing partner in Ops / partner settings, then try again.');
          return;
        }
        var conv = await findOrCreate('partner_client', {
          partner_id: pid,
          client_site_id: site.id
        }, {
          partner_id: pid,
          client_site_id: site.id,
          client_user_id: site.owner_user_id || null
        });
        if (!conv) {
          showNewMessage('Could not start conversation', lastCreateError || 'Please try again or contact support.');
          return;
        }
        await startConv(conv);
      } finally {
        setNewBusy(false);
      }
    }

    async function openClientSupport() {
      var site = siteId ? sitesById[siteId] : Object.keys(sitesById).map(function (k) { return sitesById[k]; })
        .find(function (s) { return s.owner_user_id === me.uid; });
      var ownerId = (site && site.owner_user_id) || me.uid;
      var conv = await findOrCreate('client_support', { client_user_id: ownerId }, {
        client_user_id: ownerId,
        client_site_id: site ? site.id : null
      });
      await startConv(conv);
    }

    async function addLeadpagesToChat() {
      var c = convos.find(function (x) { return x.id === activeId; });
      if (!c || c.kind !== 'partner_client' || isLpJoined(c)) return;
      var label = actorLabel(me.role) + ' added LeadPages Team to the chat';
      var body = LP_JOIN_MARKER + ' ' + label;
      var btn = $('footer') && $('footer').querySelector('[data-act="add-lp"]');
      if (btn) btn.disabled = true;
      try {
        await sb.from('conversations').update({
          leadpages_joined: true,
          leadpages_joined_by: me.role,
          leadpages_joined_at: new Date().toISOString()
        }).eq('id', activeId);
      } catch (_e) { /* columns may not exist yet */ }
      var r = await sb.from('messages').insert({
        conversation_id: activeId,
        sender_id: me.uid,
        sender_role: me.role,
        body: body
      }).select('*').single();
      if (btn) btn.disabled = false;
      if (r.error) {
        alert(r.error.message || 'Could not add LeadPages Team');
        return;
      }
      c.leadpages_joined = true;
      activeMsgs.push(r.data);
      renderMsgs();
      updateFooterActions(c);
      notifyApi(activeId);
      await loadConvos();
    }

    $('new').addEventListener('click', openNewBox);
    var filterEl = $('filter');
    if (filterEl) {
      filterEl.addEventListener('input', function () {
        convFilter = (this.value || '').trim();
        renderConvos();
      });
    }

    renderChips();

    $('newbox').addEventListener('click', async function (e) {
      var b = e.target.closest('[data-new]');
      if (!b) return;
      var kind = b.getAttribute('data-new');
      if (kind === 'lp') await openLeadPages();
      if (kind === 'provider') await openProvider();
      if (kind === 'site-provider') await openSiteProvider();
      if (kind === 'support' && me.role !== 'client') await openClientSupport();
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
    var footerEl = $('footer');
    if (footerEl) {
      footerEl.addEventListener('click', function (e) {
        var a = e.target.closest('[data-act]');
        if (!a) return;
        var act = a.getAttribute('data-act');
        if (act === 'add-lp') addLeadpagesToChat();
        if (act === 'private-lp') openClientSupport();
      });
    }
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
      updateFooterActions(null);
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
        else if (o.kind === 'support' && me.role !== 'client') await openClientSupport();
        else if (o.kind === 'support' && me.role === 'client') await openClientSupport();
        else if (o.convId) await selectConv(o.convId);
      } else if (me.role === 'client' || (me.role === 'super' && siteId)) {
        // Prefer the provider thread so LeadPages is never the first view
        var provider = convos.find(function (c) { return c.kind === 'partner_client'; });
        if (provider) await selectConv(provider.id);
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
