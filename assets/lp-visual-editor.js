/* LeadPages visual page editor — edit a landing page's content right on the live preview.
 *
 * Landing pages → Page content has a Visual / Code switch.
 *  - Visual: click any text in the preview and type over it. Bold, Italic and Link are on a
 *    small toolbar. Every change is written back into the exact characters of the page code
 *    it came from (lp-layouts.js marks them while window.__lpbEdit is on), so boxes, columns,
 *    tabs and icons can't be broken by typing.
 *  - Advanced level (default; super admins always): the toolbar also moves, copies and
 *    deletes items (cards, steps, list items, FAQ entries, table rows, lines) and whole
 *    sections, and adds new sections from templates. The Code view stays available.
 *  - Simple level (set per site by a super admin, data.pageEditor = 'simple'): text and
 *    formatting only; no Code view, no section/item changes, no layout switches.
 *
 * manage.html provides window.LPVisualHost (page, frame, level, setBody, redraw, openPreview,
 * toast, pages) and calls LPVisual.pageOpened(), LPVisual.pageClosed(), LPVisual.frameReady().
 * The structure helpers (LPVisual.struct) are pure functions on the page code, unit-tested.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ structure helpers */
  var SOLO = { image: 1, consent: 1 };
  var RE_OPEN = /^\s*:::\s*([a-z][\w-]*)/i, RE_CLOSE = /^\s*:::\s*$/;

  function lines(body) {
    var L = [], pos = 0;
    String(body || '').split('\n').forEach(function (t) { L.push({ t: t, s: pos, e: pos + t.length }); pos += t.length + 1; });
    var stack = [];
    L.forEach(function (l, i) {
      var o = RE_OPEN.exec(l.t), c = RE_CLOSE.test(l.t);
      l.parent = stack.length ? stack[stack.length - 1] : null;
      l.depth = stack.length;
      l.open = o ? o[1].toLowerCase() : null;
      l.close = c;
      if (o && !SOLO[l.open]) { var blk = { type: l.open, line: i, end: null }; l.block = blk; stack.push(blk); }
      else if (o) { l.block = { type: l.open, line: i, end: i }; }
      else if (c) { var top = stack.pop(); if (top) { top.end = i; l.closes = top; l.parent = top; l.depth = stack.length + 1; } }
    });
    stack.forEach(function (b) { b.end = L.length - 1; });   // unclosed blocks run to the end
    return L;
  }
  function lineAt(L, at) {
    for (var i = 0; i < L.length; i++) if (at >= L[i].s && at <= L[i].e) return i;
    return L.length - 1;
  }
  function blank(l) { return !l || !String(l.t).trim(); }
  var RE_LI = /^\s*[-*]\s+/, RE_OL = /^\s*\d+[.)]\s+/, RE_ROW = /^\s*\|/, RE_SEP = /^\s*\|?\s*:?-{2,}/, RE_Q = /^\s*\?\s+/, RE_Q3 = /^\?\?\?\s+/, RE_H = /^#{1,4}\s/;

  /** The item (one thing in a list) a line belongs to: { kind, a, b, parent } or null. */
  function itemAt(L, i) {
    var l = L[i];
    if (!l || l.open || l.close || blank(l)) return null;
    var par = l.parent, ptype = par && par.type;
    if (ptype === 'faq') {
      var a = i; while (a > 0 && !RE_Q.test(L[a].t) && L[a - 1].parent === par && !L[a - 1].open) a--;
      if (!RE_Q.test(L[a].t)) return { kind: 'line', a: i, b: i, parent: par };
      var b = a + 1; while (b < L.length && L[b].parent === par && !L[b].close && !RE_Q.test(L[b].t) && !L[b].open) b++;
      b--; while (b > a && blank(L[b])) b--;
      return { kind: 'faq', a: a, b: b, parent: par };
    }
    if (!par) {
      // Plain-text pages: "??? Question" plus its answer lines.
      var q = i; while (q > 0 && !RE_Q3.test(L[q].t) && !RE_H.test(L[q].t) && !L[q - 1].open && !L[q - 1].close && L[q - 1].depth === 0 && !RE_H.test(L[q - 1].t) && !(blank(L[q - 1]) && q - 2 >= 0 && blank(L[q - 2]))) q--;
      if (RE_Q3.test(L[q].t) && !RE_H.test(l.t)) {
        var e = q + 1; while (e < L.length && !RE_Q3.test(L[e].t) && !RE_H.test(L[e].t) && !L[e].open && L[e].depth === 0) e++;
        e--; while (e > q && blank(L[e])) e--;
        if (i <= e) return { kind: 'faq3', a: q, b: e, parent: null };
      }
    }
    if (RE_ROW.test(l.t)) {
      var ts = i; while (ts > 0 && RE_ROW.test(L[ts - 1].t) && L[ts - 1].parent === par) ts--;
      if (i === ts) return null;                                   // header row
      if (i === ts + 1 && RE_SEP.test(l.t)) return null;           // |---| line
      return { kind: 'row', a: i, b: i, parent: par };
    }
    if (RE_LI.test(l.t)) return { kind: 'li', a: i, b: i, parent: par };
    if (RE_OL.test(l.t)) return { kind: 'ol', a: i, b: i, parent: par };
    if (par && /\|/.test(l.t)) return { kind: 'cell', a: i, b: i, parent: par };
    return { kind: 'line', a: i, b: i, parent: par };
  }
  function sameKind(x, y) { return x && y && x.kind === y.kind && x.parent === y.parent; }
  function prevItem(L, it) {
    var j = it.a - 1;
    if (it.kind === 'line' || it.kind === 'faq' || it.kind === 'faq3') while (j >= 0 && blank(L[j])) j--;
    if (j < 0) return null;
    var p = itemAt(L, j); return sameKind(p, it) ? p : null;
  }
  function nextItem(L, it) {
    var j = it.b + 1;
    if (it.kind === 'line' || it.kind === 'faq' || it.kind === 'faq3') while (j < L.length && blank(L[j])) j++;
    if (j >= L.length) return null;
    var n = itemAt(L, j); return sameKind(n, it) ? n : null;
  }
  /** Top-level sections: { a, b } line ranges, in order. */
  function sections(L) {
    var out = [], i = 0;
    while (i < L.length) {
      var l = L[i];
      if (blank(l) || l.close) { i++; continue; }
      if (l.depth === 0 && l.block) { var end = l.block.end == null ? i : l.block.end; out.push({ a: i, b: end }); i = end + 1; continue; }
      if (l.depth !== 0) { i++; continue; }
      var j = i, hm = /^(#{1,4})\s/.exec(l.t);
      if (hm) {
        // A heading's section: the heading and everything under it, up to the next heading
        // of the same or a higher level (or a designed section).
        var lv = hm[1].length;
        while (j + 1 < L.length) {
          var nx = L[j + 1], nm = /^(#{1,4})\s/.exec(nx.t);
          if (nx.block || nx.close || nx.depth !== 0 || (nm && nm[1].length <= lv)) break;
          j++;
        }
        while (j > i && blank(L[j])) j--;
      } else {
        while (j + 1 < L.length && !blank(L[j + 1]) && !L[j + 1].block && L[j + 1].depth === 0 && !L[j + 1].close && !RE_H.test(L[j + 1].t)) j++;
      }
      out.push({ a: i, b: j }); i = j + 1;
    }
    return out;
  }
  function sectionAt(L, i) {
    var S = sections(L);
    for (var k = 0; k < S.length; k++) if (i >= S[k].a && i <= S[k].b) return { list: S, k: k, a: S[k].a, b: S[k].b };
    return null;
  }
  function join(L) { return L.map(function (l) { return l.t; }).join('\n'); }
  function texts(L) { return L.map(function (l) { return l.t; }); }
  function renumber(T) {
    var i = 0;
    while (i < T.length) {
      if (RE_OL.test(T[i])) {
        var n = parseInt(/\d+/.exec(T[i])[0], 10) || 1, j = i;
        while (j < T.length && RE_OL.test(T[j])) { T[j] = T[j].replace(/^(\s*)\d+/, '$1' + n); n++; j++; }
        i = j;
      } else i++;
    }
    return T;
  }
  function swap(T, x, y) {           // x before y: [x.a..x.b] gap [y.a..y.b]
    var before = T.slice(0, x.a), A = T.slice(x.a, x.b + 1), gap = T.slice(x.b + 1, y.a), B = T.slice(y.a, y.b + 1), after = T.slice(y.b + 1);
    return before.concat(B, gap, A, after);
  }
  /** Item operations on the item holding character `at`: 'up' | 'down' | 'copy' | 'delete'. Returns new body or null. */
  function itemOp(body, at, op) {
    var L = lines(body), i = lineAt(L, at), it = itemAt(L, i);
    if (!it) return null;
    var T = texts(L), out;
    if (op === 'up') { var p = prevItem(L, it); if (!p) return null; out = swap(T, p, it); }
    else if (op === 'down') { var n = nextItem(L, it); if (!n) return null; out = swap(T, it, n); }
    else if (op === 'copy') { var cp = T.slice(it.a, it.b + 1); if (it.kind === 'faq' || it.kind === 'faq3' || it.kind === 'line') cp = (it.kind === 'line' ? [''] : []).concat(cp); out = T.slice(0, it.b + 1).concat(cp, T.slice(it.b + 1)); }
    else if (op === 'delete') { out = T.slice(0, it.a).concat(T.slice(it.b + 1)); }
    else return null;
    if (it.kind === 'ol') {
      // Keep the list's own starting number (deleting or moving item 1 must not start the list at 2).
      var r = it.a; while (r > 0 && RE_OL.test(T[r - 1])) r--;
      var n0 = /\d+/.exec(T[r])[0];
      if (out[r] != null && RE_OL.test(out[r])) out[r] = out[r].replace(/^(\s*)\d+/, '$1' + n0);
    }
    return renumber(out).join('\n');
  }
  function itemInfo(body, at) {
    var L = lines(body), it = itemAt(L, lineAt(L, at));
    if (!it) return null;
    return { kind: it.kind, up: !!prevItem(L, it), down: !!nextItem(L, it) };
  }
  /** Section operations: 'up' | 'down' | 'copy' | 'delete'. */
  function sectionOp(body, at, op) {
    var L = lines(body), sec = sectionAt(L, lineAt(L, at));
    if (!sec) return null;
    var T = texts(L), S = sec.list, k = sec.k, out;
    if (op === 'up') { if (k === 0) return null; out = swap(T, S[k - 1], S[k]); }
    else if (op === 'down') { if (k >= S.length - 1) return null; out = swap(T, S[k], S[k + 1]); }
    else if (op === 'copy') { out = T.slice(0, sec.b + 1).concat([''], T.slice(sec.a, sec.b + 1), T.slice(sec.b + 1)); }
    else if (op === 'delete') {
      var a = sec.a, b = sec.b;
      if (b + 1 < T.length && !String(T[b + 1]).trim()) b++; else if (a > 0 && !String(T[a - 1]).trim()) a--;
      out = T.slice(0, a).concat(T.slice(b + 1));
    } else return null;
    return renumber(out).join('\n');
  }
  function sectionInfo(body, at) {
    var L = lines(body), sec = sectionAt(L, lineAt(L, at));
    if (!sec) return null;
    return { up: sec.k > 0, down: sec.k < sec.list.length - 1, count: sec.list.length };
  }
  /** Insert a section (template text) after the section holding `at` (or at the end when at < 0). */
  function insertSection(body, at, text) {
    var T = String(body || '').split('\n'), pos = T.length;
    if (at >= 0 && String(body || '').trim()) { var L = lines(body), sec = sectionAt(L, lineAt(L, at)); if (sec) pos = sec.b + 1; }
    var add = String(text).split('\n');
    var before = T.slice(0, pos), after = T.slice(pos);
    while (before.length && !String(before[before.length - 1]).trim()) before.pop();
    while (after.length && !String(after[0]).trim()) after.shift();
    var out = before.length ? before.concat(['']) : [];
    out = out.concat(add);
    if (after.length) out = out.concat([''], after);
    return out.join('\n');
  }

  var TEMPLATES_BLOCKS = [
    { id: 'heading', label: 'Heading', text: ':::heading New heading\nA short introduction.\n:::' },
    { id: 'text', label: 'Paragraph', text: 'New paragraph text.' },
    { id: 'list', label: 'Bullet list', text: '- First point\n- Second point\n- Third point' },
    { id: 'cards', label: 'Three cards', text: ':::cards cols=3\nstar | Card title | Card text.\nstar | Card title | Card text.\nstar | Card title | Card text.\n:::' },
    { id: 'steps', label: 'Steps', text: ':::steps\nusers | First step | What happens.\nclipboard-list | Second step | What happens.\nfile-text | Third step | What happens.\n:::' },
    { id: 'panel', label: 'Box with title', text: ':::panel icon=info title="Box title" tone=white ticks=no\nBox text.\n:::' },
    { id: 'notice', label: 'Highlighted note', text: ':::notice tone=info\nPlease note: your note here.\n:::' },
    { id: 'faq', label: 'Questions & answers', text: ':::faq\n? info | Your question?\nThe answer.\n:::' },
    { id: 'table', label: 'Table', text: '| Column | Column |\n| --- | --- |\n| Text | Text |' }
  ];
  var TEMPLATES_RICH = [
    { id: 'heading', label: 'Heading', text: '## New heading' },
    { id: 'text', label: 'Paragraph', text: 'New paragraph text.' },
    { id: 'list', label: 'Bullet list', text: '- First point\n- Second point\n- Third point' },
    { id: 'faq', label: 'Question & answer', text: '??? Your question?\nThe answer.' },
    { id: 'table', label: 'Table', text: '| Column | Column |\n| --- | --- |\n| Text | Text |' }
  ];

  /** Typed text → the page code's inline format (**bold**, *italic*, [link](address)). */
  function toMd(el, inAttr) {
    function mark(s, m) { var x = /^(\s*)([\s\S]*?)(\s*)$/.exec(s); return x[2] ? x[1] + m + x[2] + m + x[3] : s; }
    function walk(n) {
      var out = '';
      for (var c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) { out += c.nodeValue; continue; }
        if (c.nodeType !== 1) continue;
        var t = c.tagName, st = c.getAttribute('style') || '';
        if (t === 'BR') { out += ' '; continue; }
        var inner = walk(c);
        if (t === 'STRONG' || t === 'B' || (t === 'SPAN' && /font-weight:\s*(bold|[6-9]00)/i.test(st))) out += mark(inner, '**');
        else if (t === 'EM' || t === 'I' || (t === 'SPAN' && /font-style:\s*italic/i.test(st))) out += mark(inner, '*');
        else if (t === 'A') { var u = c.getAttribute('data-lpb-href') || c.getAttribute('href') || ''; out += (u && inner.trim()) ? '[' + inner.trim() + '](' + u + ')' : inner; }
        else out += inner;
      }
      return out;
    }
    var md = walk(el).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
    md = md.replace(/\*\*\*\*/g, '').replace(/\|/g, '/').replace(/^:::/, '::');
    if (inAttr) md = md.replace(/"/g, '”');
    return md;
  }
  /** What someone typed into the link box → a link address. */
  function linkAddr(v) {
    v = String(v || '').trim();
    if (!v) return '';
    if (/^(https?:\/\/|mailto:|tel:|#)/i.test(v)) return v.replace(/\s/g, '');
    if (/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(v)) return 'mailto:' + v;
    if (/^\+?[\d\s()-]{6,}$/.test(v)) return 'tel:' + v.replace(/[^\d+]/g, '');
    if (/^www\./i.test(v) || /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(v) && /\.[a-z]{2,}(\/|$)/i.test(v)) return 'https://' + v.replace(/\s/g, '');
    return '/' + v.replace(/^\/+/, '').replace(/\s+/g, '-').toLowerCase();
  }

  /* ------------------------------------------------------------------ editor UI */
  var VIEW_KEY = 'lpPageEditView';
  var H = function () { return window.LPVisualHost || null; };
  var S = { dirty: false, focusEl: null, range: null, boundDoc: null };

  function level() { var h = H(); return (h && h.level && h.level()) || 'advanced'; }
  function pageMode(p) { return p && p.blocks === true ? 'blocks' : (p && p.rich === true ? 'rich' : ''); }
  function wantView() {
    if (level() === 'simple') return 'visual';
    try { var v = localStorage.getItem(VIEW_KEY); if (v === 'code' || v === 'visual') return v; } catch (e) {}
    return 'visual';
  }
  function active() { var h = H(), p = h && h.page && h.page(); return !!(p && pageMode(p) && wantView() === 'visual'); }
  function $(id) { return document.getElementById(id); }
  function rowOf(id) { var el = $(id); return el ? (el.closest('.f') || el.parentElement) : null; }

  /** Show the right controls for this page, level and view. */
  function syncUi() {
    var h = H(), p = h && h.page && h.page(); if (!p) return;
    var lv = level(), mode = pageMode(p), vis = active();
    var bar = $('lpv-bar'); if (bar) bar.hidden = false;
    var code = $('lpv-code'), visual = $('lpv-visual');
    if (code) { code.hidden = lv === 'simple'; code.classList.toggle('on', !vis); code.setAttribute('aria-pressed', String(!vis)); }
    if (visual) { visual.classList.toggle('on', vis); visual.setAttribute('aria-pressed', String(vis)); visual.disabled = !mode; }
    var wrap = $('lp-body-wrap'); if (wrap) wrap.hidden = vis;
    var sw = $('lpv-surface-wrap'); if (sw) sw.hidden = !vis;
    var hint = $('lpv-hint');
    if (hint) hint.textContent = !mode ? 'This page is plain text — edit it in the box below.' :
      vis ? (lv === 'simple' ? 'Click any text below to change it. Select words for Bold, Italic or Link.' :
        'Click any text below to change it. The toolbar also moves, copies, deletes and adds items and sections.') :
        'Editing the page code. Switch to Visual to edit on the page.';
    var add = $('lpv-add'); if (add) add.hidden = !(vis && lv === 'advanced');
    ['lp-rich', 'lp-blocks'].forEach(function (id) { var r = rowOf(id); if (r) r.hidden = lv === 'simple'; });
    var sup = $('lpv-super'); if (sup) sup.hidden = !(h.isSuper && h.isSuper());
    var sel = $('lpv-level'); if (sel && h.siteLevel) sel.value = h.siteLevel();
    fillAddMenu($('lpv-add-menu'), mode);
  }
  function setView(v) {
    try { localStorage.setItem(VIEW_KEY, v); } catch (e) {}
    syncUi(); applyFrame(true);
    if (v === 'visual' && active()) showSurface();
  }

  /* ------------------------------------------------------------------ in-panel surface
   * The page drawn with the site's own styles, right in the Page content box: an iframe of
   * the page preview with everything but the page body hidden. Falls back to the side
   * preview when the host page has no #lpv-surface (older manage.html). */
  var SURF = { ready: false, key: '', ro: null };
  function surf() { var h = H(); return (h && h.surfaceUrl && $('lpv-surface')) || null; }
  function F() { var s = surf(); if (s) return s; var h = H(); return h && h.frame && h.frame(); }
  function showSurface() {
    var s = surf(), h = H();
    if (!s) { if (h && h.openPreview) h.openPreview(); return; }
    var key = h.surfaceKey ? h.surfaceKey() : '';
    if (!SURF.ready || SURF.key !== key || !s.getAttribute('src')) loadSurface(); else applySurface();
  }
  function loadSurface() {
    var s = surf(), h = H(); if (!s) return;
    SURF.ready = false; SURF.key = h.surfaceKey ? h.surfaceKey() : '';
    var ld = $('lpv-surface-load'); if (ld) ld.hidden = false;
    s.onload = function () {
      var w = s.contentWindow; if (!w) return;
      SURF.ready = true;
      try { w.__lpbEdit = active(); bind(w); } catch (e) {}
      var d = w.document;
      try {
        var st = d.createElement('style'); st.id = 'lpv-surf-css';
        st.textContent = 'html,body{min-height:0!important;height:auto!important;overflow:hidden!important}' +
          '.lpv-hide{display:none!important}' +
          'body>*:not(main):not(#lpv-tb){display:none!important}' +
          'main#top>*:not(section.lp-page){display:none!important}' +
          '#top>section.lp-page{margin:0!important;min-height:0!important;padding-top:20px!important;padding-bottom:28px!important}';
        d.head.appendChild(st);
      } catch (e) {}
      try {
        if (w.ResizeObserver) { SURF.ro = new w.ResizeObserver(function () { fit(); }); SURF.ro.observe(d.body); }
        new w.MutationObserver(function () { isolate(); }).observe(d.body, { childList: true });
      } catch (e) {}
      applySurface();
      if (ld) ld.hidden = true;
      setTimeout(fit, 300); setTimeout(fit, 1200);
    };
    s.src = h.surfaceUrl();
  }
  /** Re-draw the surface from the current draft (after a structural change, or on reopen). */
  function applySurface() {
    var s = surf(), h = H(); if (!s || !SURF.ready) return;
    var w = s.contentWindow; if (!w) return;
    try { w.__lpbEdit = active(); if (h.applyTo) h.applyTo(w); } catch (e) {}
    isolate(); fit();
  }
  /** Hide everything except the page body (header, hero, footer, widgets). */
  function isolate() {
    var s = surf(); if (!s || !SURF.ready) return;
    var d; try { d = s.contentWindow.document; } catch (e) { return; }
    var body = d && d.querySelector('#top > section.lp-page .lp-body'); if (!body) return;
    for (var n = body; n && n !== d.body && n.parentNode; n = n.parentNode) {
      Array.prototype.forEach.call(n.parentNode.children, function (sib) {
        if (sib === n || /^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(sib.tagName) || sib.id === 'lpv-tb') return;
        sib.classList.add('lpv-hide');
        // Some sections force display:block !important inline; only an inline rule beats that.
        if (sib.style && sib.style.getPropertyValue('display') !== 'none') sib.style.setProperty('display', 'none', 'important');
      });
    }
  }
  function fit() {
    var s = surf(); if (!s || !SURF.ready) return;
    isolate();
    var d; try { d = s.contentWindow.document; } catch (e) { return; }
    // Measure the page section itself: the document can't report less than the frame's height.
    var art = d.querySelector('#top > section.lp-page'), tb = d.getElementById('lpv-tb');
    var hgt = art ? Math.ceil(art.getBoundingClientRect().bottom + (d.defaultView.scrollY || 0)) : 0;
    if (tb && !tb.hidden) hgt = Math.max(hgt, Math.ceil(tb.getBoundingClientRect().bottom + 8));
    if (hgt > 40 && Math.abs(hgt - (parseInt(s.style.height, 10) || 0)) > 4) s.style.height = hgt + 'px';
  }
  /** Redraw after an edit: the surface now, the side preview a moment later. */
  var _prevT = null;
  function redrawAll(now) {
    var h = H();
    if (surf()) { applySurface(); if (_prevT) clearTimeout(_prevT); _prevT = setTimeout(function () { if (h && h.redraw) h.redraw(); }, now ? 0 : 900); }
    else if (h && h.redraw) h.redraw();
  }

  /** Turn the preview's edit marks on or off to match. */
  function applyFrame(redraw) {
    var h = H(), fr = F(), w = fr && fr.contentWindow;
    if (!w) return;
    var want = active();
    try {
      bind(w);
      if (w.__lpbEdit !== want) { w.__lpbEdit = want; if (redraw !== false) redrawAll(true); }
      decorate();
    } catch (e) {}
  }

  function frameDoc() { var fr = F(); try { return fr && fr.contentWindow && fr.contentWindow.document; } catch (e) { return null; } }

  var CSS = '.lp-body .lpb-ed[contenteditable="true"]{cursor:text;border-radius:3px;outline:1px dashed transparent;outline-offset:2px;transition:outline-color .15s,background-color .15s}' +
    '.lp-body .lpb-ed[contenteditable="true"]:hover{outline-color:rgba(21,101,216,.55)}' +
    '.lp-body .lpb-ed[contenteditable="true"]:focus{outline:2px solid #1565d8;background:rgba(21,101,216,.07)}' +
    '.lpv-sel{box-shadow:0 0 0 2px rgba(21,101,216,.35);border-radius:6px}' +
    '#lpv-tb{position:absolute;z-index:2147483000;display:flex;flex-wrap:wrap;gap:4px;align-items:center;max-width:calc(100vw - 16px);padding:6px;border-radius:10px;background:#1e293b;color:#f8fafc;box-shadow:0 10px 30px rgba(15,23,42,.35);font:500 13px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif}' +
    '#lpv-tb[hidden],#lpv-tb [hidden]{display:none!important}' +
    '#lpv-tb button{all:unset;box-sizing:border-box;min-width:32px;height:32px;padding:0 8px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;gap:4px;cursor:pointer;color:#f8fafc;font:inherit}' +
    '#lpv-tb button:hover,#lpv-tb button:focus-visible{background:rgba(255,255,255,.14)}' +
    '#lpv-tb button[disabled]{opacity:.35;cursor:default;background:none}' +
    '#lpv-tb button.del:hover{background:#b91c1c}' +
    '#lpv-tb .sep{width:1px;height:22px;background:rgba(255,255,255,.22);margin:0 3px}' +
    '#lpv-tb .lbl{opacity:.7;font-size:12px;padding:0 2px 0 4px}' +
    '#lpv-tb .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;width:100%}' +
    '#lpv-tb .row[hidden]{display:none}' +
    '#lpv-tb input{all:unset;box-sizing:border-box;flex:1 1 200px;min-width:0;height:32px;padding:0 10px;border-radius:7px;background:#f8fafc;color:#0f172a;font:inherit}' +
    '#lpv-tb .menu{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:4px;width:100%}' +
    '#lpv-tb .menu button{justify-content:flex-start;background:rgba(255,255,255,.08)}' +
    '#lpv-tb .tip{font-size:12px;opacity:.75;padding:2px 4px;width:100%}';

  function ensureUi(d) {
    if (!d.getElementById('lpv-style')) { var st = d.createElement('style'); st.id = 'lpv-style'; st.textContent = CSS; d.head.appendChild(st); }
    var tb = d.getElementById('lpv-tb');
    if (!tb) {
      tb = d.createElement('div'); tb.id = 'lpv-tb'; tb.hidden = true; tb.setAttribute('role', 'toolbar'); tb.setAttribute('aria-label', 'Text tools');
      tb.innerHTML =
        '<div class="row" data-r="main">' +
          '<button type="button" data-a="bold" title="Bold (Ctrl+B)" aria-label="Bold"><b>B</b></button>' +
          '<button type="button" data-a="italic" title="Italic (Ctrl+I)" aria-label="Italic"><i style="font-family:Georgia,serif">I</i></button>' +
          '<button type="button" data-a="link" title="Link (Ctrl+K)" aria-label="Link">🔗 Link</button>' +
          '<span class="adv sep"></span><span class="adv lbl">Item</span>' +
          '<button type="button" class="adv" data-a="item-up" title="Move this item up" aria-label="Move item up">↑</button>' +
          '<button type="button" class="adv" data-a="item-down" title="Move this item down" aria-label="Move item down">↓</button>' +
          '<button type="button" class="adv" data-a="item-copy" title="Copy this item (add another like it)" aria-label="Copy item">⧉ Copy</button>' +
          '<button type="button" class="adv del" data-a="item-delete" title="Delete this item" aria-label="Delete item">✕</button>' +
          '<span class="adv sep"></span><span class="adv lbl">Section</span>' +
          '<button type="button" class="adv" data-a="sec-up" title="Move this section up" aria-label="Move section up">↑</button>' +
          '<button type="button" class="adv" data-a="sec-down" title="Move this section down" aria-label="Move section down">↓</button>' +
          '<button type="button" class="adv" data-a="sec-copy" title="Copy this section" aria-label="Copy section">⧉</button>' +
          '<button type="button" class="adv del" data-a="sec-delete" title="Delete this section" aria-label="Delete section">✕</button>' +
          '<button type="button" class="adv" data-a="sec-add" title="Add a section below" aria-label="Add section below">＋ Add</button>' +
        '</div>' +
        '<div class="row" data-r="link" hidden><input type="text" data-k="url" placeholder="Page (e.g. fees), web address, email or phone" aria-label="Link address"><button type="button" data-a="link-ok">Apply</button><button type="button" data-a="link-off">Remove link</button></div>' +
        '<div class="row" data-r="add" hidden><span class="tip">Add a section below this one:</span><div class="menu" data-k="menu"></div></div>' +
        '<div class="row" data-r="confirm" hidden><span class="tip" data-k="ask"></span><button type="button" class="del" data-a="yes">Delete</button><button type="button" data-a="no">Cancel</button></div>';
      d.body.appendChild(tb);
      tb.addEventListener('mousedown', function (e) { if (!e.target.closest('input')) e.preventDefault(); });
      tb.addEventListener('click', onToolbar);
      tb.querySelector('[data-k="url"]').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); act('link-ok'); }
        if (e.key === 'Escape') { e.preventDefault(); showRow('main'); refocus(); }
      });
    }
    return tb;
  }
  function fillAddMenu(host, mode, inFrame) {
    if (!host) return;
    var list = mode === 'rich' ? TEMPLATES_RICH : TEMPLATES_BLOCKS;
    var sig = mode + list.length;
    if (host.__sig === sig) return; host.__sig = sig;
    host.innerHTML = list.map(function (t) { return '<button type="button" class="' + (inFrame ? '' : 'btn ghost sm') + '" data-a="add-tpl" data-t="' + t.id + '">' + t.label + '</button>'; }).join('');
  }

  function decorate() {
    var d = frameDoc(); if (!d || !d.body) return;
    var on = active(), h = H(), p = h && h.page(), body = p ? String(p.body || '').replace(/\r/g, '') : '';
    var eds = d.querySelectorAll('.lp-body .lpb-ed');
    Array.prototype.forEach.call(eds, function (el) {
      if (!on) { el.removeAttribute('contenteditable'); return; }
      var at = +el.getAttribute('data-lpb-at'), len = +el.getAttribute('data-lpb-len');
      el.__raw = body.substr(at, len);
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'true');
    });
    if (on && S.focusAt) {
      var fa = S.focusAt; S.focusAt = null;
      var t = d.querySelector('.lp-body .lpb-ed[data-lpb-at="' + fa.at + '"]');
      if (t) setTimeout(function () {
        try {
          t.focus(); var sel = d.getSelection(), r = d.createRange(); r.selectNodeContents(t);
          if (!fa.select) r.collapse(true);
          sel.removeAllRanges(); sel.addRange(r);
          if (t.scrollIntoView) t.scrollIntoView({ block: 'nearest' });
        } catch (_f) {}
      }, 0);
    }
    if (on) { ensureUi(d); var tb = d.getElementById('lpv-tb'); tb.classList.toggle('simple', level() === 'simple'); Array.prototype.forEach.call(tb.querySelectorAll('.adv'), function (x) { x.hidden = level() === 'simple'; }); fillAddMenu(tb.querySelector('[data-k="menu"]'), pageMode(p), true); }
    else { var t = d.getElementById('lpv-tb'); if (t) t.hidden = true; }
  }

  function bind(w) {
    var d = w.document; if (!d || d.__lpvBound) return; d.__lpvBound = true;
    d.addEventListener('lpb:edit-render', function () { S.focusEl = null; decorate(); if (surf()) setTimeout(fit, 0); });
    // Clicking page text edits it: no link opens, no section settings pop up.
    w.addEventListener('click', function (e) {
      if (!active()) return;
      var t = e.target; if (!t || !t.closest) return;
      if (t.closest('#lpv-tb')) return;
      var inBody = t.closest('.lp-page .lp-body');
      if (!inBody) return;
      var a = t.closest('a[href]');
      if (a || t.closest('.lpb-ed')) { if (a) e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); }
    }, true);
    d.addEventListener('input', function (e) { var el = e.target && e.target.closest && e.target.closest('.lpb-ed[contenteditable="true"]'); if (el) write(el); });
    d.addEventListener('keydown', function (e) {
      var el = e.target && e.target.closest && e.target.closest('.lpb-ed[contenteditable="true"]'); if (!el) return;
      if (e.key === 'Enter') { e.preventDefault(); onEnter(el); }
      else if (e.key === 'Escape') { e.preventDefault(); el.blur(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); act('link'); }
    });
    // Phone keyboards may send Return as an input event rather than a key press.
    d.addEventListener('beforeinput', function (e) {
      if (e.inputType !== 'insertParagraph' && e.inputType !== 'insertLineBreak') return;
      var el = e.target && e.target.closest && e.target.closest('.lpb-ed[contenteditable="true"]'); if (!el) return;
      e.preventDefault(); onEnter(el);
    });
    d.addEventListener('paste', function (e) {
      var el = e.target && e.target.closest && e.target.closest('.lpb-ed[contenteditable="true"]'); if (!el) return;
      e.preventDefault();
      var txt = ''; try { txt = (e.clipboardData || w.clipboardData).getData('text/plain') || ''; } catch (_p) {}
      d.execCommand('insertText', false, txt.replace(/\s+/g, ' '));
    });
    d.addEventListener('focusin', function (e) {
      var el = e.target && e.target.closest && e.target.closest('.lpb-ed[contenteditable="true"]'); if (!el) return;
      S.focusEl = el; showToolbar(el);
    });
    d.addEventListener('focusout', function (e) {
      var el = e.target && e.target.closest && e.target.closest('.lpb-ed'); if (!el) return;
      var to = e.relatedTarget;
      if (to && to.closest && to.closest('#lpv-tb')) return;
      setTimeout(function () {
        var ae = d.activeElement;
        if (ae && ae.closest && (ae.closest('#lpv-tb') || ae.closest('.lpb-ed[contenteditable="true"]'))) return;
        hideToolbar();
        if (S.dirty) { S.dirty = false; redrawAll(); }
      }, 120);
    });
    w.addEventListener('scroll', function () { if (S.focusEl && d.getElementById('lpv-tb') && !d.getElementById('lpv-tb').hidden) place(S.focusEl); }, { passive: true });
    w.addEventListener('resize', function () { if (S.focusEl) place(S.focusEl); });
  }

  function showRow(name) {
    var d = frameDoc(), tb = d && d.getElementById('lpv-tb'); if (!tb) return;
    Array.prototype.forEach.call(tb.querySelectorAll('.row'), function (r) { r.hidden = r.getAttribute('data-r') !== name; });
  }
  function showToolbar(el) {
    var d = frameDoc(); if (!d) return; var tb = ensureUi(d);
    showRow('main'); tb.hidden = false; updateButtons(el); place(el);
    markItem(el);
  }
  function hideToolbar() { var d = frameDoc(), tb = d && d.getElementById('lpv-tb'); if (tb) tb.hidden = true; markItem(null); S.focusEl = null; }
  function place(el) {
    var d = frameDoc(), w = d && d.defaultView, tb = d && d.getElementById('lpv-tb'); if (!tb || !el) return;
    // The site may zoom the whole page (Text size): measure on screen, position in page units.
    var z = 1; try { z = parseFloat(w.getComputedStyle(d.documentElement).zoom) || 1; } catch (e) {}
    var r = el.getBoundingClientRect(), vw = w.innerWidth, th = tb.offsetHeight * z, tw = tb.offsetWidth * z;
    var top = r.top + w.scrollY - th - 10;
    if (r.top - th - 10 < 4) top = r.bottom + w.scrollY + 10;
    var left = Math.max(w.scrollX + 8, Math.min(r.left + w.scrollX, w.scrollX + vw - tw - 8));
    tb.style.top = (top / z) + 'px'; tb.style.left = (left / z) + 'px';
  }
  function markItem(el) {
    var d = frameDoc(); if (!d) return;
    Array.prototype.forEach.call(d.querySelectorAll('.lpv-sel'), function (x) { x.classList.remove('lpv-sel'); });
    if (!el || level() === 'simple') return;
    var box = el.closest('li,tr,.lpb-card,.lpb-step,.lpb-row,details,.lpb-faq-i,.lpb-member,.lpb-contact,p,h2,h3,h4');
    if (box && !box.classList.contains('lp-body')) box.classList.add('lpv-sel');
  }
  function updateButtons(el) {
    var d = frameDoc(), tb = d && d.getElementById('lpv-tb'); if (!tb || level() === 'simple') return;
    var h = H(), p = h.page(), body = String(p.body || '').replace(/\r/g, ''), at = +el.getAttribute('data-lpb-at');
    var ii = itemInfo(body, at), si = sectionInfo(body, at);
    var set = function (a, on) { var b = tb.querySelector('[data-a="' + a + '"]'); if (b) b.disabled = !on; };
    set('item-up', ii && ii.up); set('item-down', ii && ii.down); set('item-copy', !!ii); set('item-delete', !!ii);
    set('sec-up', si && si.up); set('sec-down', si && si.down); set('sec-copy', !!si); set('sec-delete', !!si); set('sec-add', true);
  }

  /** Write what was typed back into the page code, at the exact spot it came from. */
  function write(el) {
    var h = H(), p = h && h.page(); if (!p) return;
    var body = String(p.body || '').replace(/\r/g, '');
    var at = +el.getAttribute('data-lpb-at'), len = +el.getAttribute('data-lpb-len');
    if (body.substr(at, len) !== el.__raw) { if (h.toast) h.toast('That text changed somewhere else — the preview has been refreshed.', 'warn'); S.dirty = false; redrawAll(true); return; }
    var q = body.charAt(at - 1);
    var md = toMd(el, q === '"' || q === "'");
    if (md === el.__raw) return;
    var nb = body.slice(0, at) + md + body.slice(at + len), delta = md.length - len;
    el.setAttribute('data-lpb-len', String(md.length)); el.__raw = md;
    var d = frameDoc();
    Array.prototype.forEach.call(d.querySelectorAll('.lp-body .lpb-ed'), function (x) {
      if (x === el) return; var xa = +x.getAttribute('data-lpb-at'); if (xa > at) x.setAttribute('data-lpb-at', String(xa + delta));
    });
    S.dirty = true;
    h.setBody(nb, { history: true });
    if (surf()) { if (_prevT) clearTimeout(_prevT); _prevT = setTimeout(function () { if (h.redraw) h.redraw(); }, 1200); fit(); }
  }
  /** Enter: a new paragraph in text, a new item in a list; elsewhere a one-off tip (never leaves). */
  function onEnter(el) {
    if (enterSplit(el)) return;
    var h = H();
    if (!S.enterTip && h && h.toast) { S.enterTip = true; h.toast('Return can\u2019t add a new line in a title, card or table cell. Use \u29C9 Copy or \uFF0B Add on the toolbar for another one.', 'warn'); }
  }
  /** How Enter can split this piece of text: { kind:'p'|'li'|'ol', sep } or null. */
  function splitPlan(body, at, len, el) {
    var L = lines(body), i = lineAt(L, at), l = L[i];
    var lead = l.t.slice(0, at - l.s), tail = l.t.slice(at + len - l.s);
    if (tail.trim()) return null;                         // the text isn't the end of its line
    var m = RE_LI.exec(lead);
    if (m && m[0] === lead && el.closest('li')) return { kind: 'li', sep: '\n' + lead, line: i };
    m = RE_OL.exec(lead);
    if (m && m[0] === lead && el.closest('li')) return { kind: 'ol', sep: '\n' + lead, line: i };
    var par = el.parentElement;
    if (!lead.trim() && par && par.tagName === 'P' && par.textContent.trim() === el.textContent.trim() &&
        !l.open && !l.close && !RE_H.test(l.t) && !RE_Q.test(l.t) && !RE_Q3.test(l.t) && !RE_ROW.test(l.t) && !RE_LI.test(l.t) && !RE_OL.test(l.t)) {
      return { kind: 'p', sep: '\n\n', line: i };
    }
    return null;
  }
  function enterSplit(el) {
    var h = H(), d = frameDoc(); if (!h || !d) return false;
    var sel = d.getSelection(); if (!sel || !sel.rangeCount) return false;
    var r = sel.getRangeAt(0); if (!el.contains(r.startContainer)) return false;
    write(el);                                            // the code matches what's on screen first
    var p = h.page(), body = String(p.body || '').replace(/\r/g, '');
    var at = +el.getAttribute('data-lpb-at'), len = +el.getAttribute('data-lpb-len');
    if (body.substr(at, len) !== el.__raw) return false;
    var plan = splitPlan(body, at, len, el); if (!plan) return false;
    if (!r.collapsed) r.deleteContents();
    var rb = d.createRange(); rb.selectNodeContents(el); rb.setEnd(r.startContainer, r.startOffset);
    var ra = d.createRange(); ra.selectNodeContents(el); ra.setStart(r.startContainer, r.startOffset);
    var db = d.createElement('span'); db.appendChild(rb.cloneContents());
    var da = d.createElement('span'); da.appendChild(ra.cloneContents());
    var q = body.charAt(at - 1), inAttr = q === '"' || q === "'";
    var mb = toMd(db, inAttr).replace(/\s+$/, ''), ma = toMd(da, inAttr).replace(/^\s+/, '');
    var word = plan.kind === 'p' ? 'New paragraph' : 'New item';
    var newEmpty = !ma.trim(), atStart = !mb.trim() && !newEmpty;
    if (newEmpty) ma = word;
    if (!mb.trim()) mb = word;                            // Return at the very start: a new one above
    var nb = body.slice(0, at) + mb + plan.sep + ma + body.slice(at + len);
    if (plan.kind === 'ol') nb = renumber(nb.split('\n')).join('\n');
    // Where the second half starts once redrawn (renumbering can change a number's width).
    var L2 = lines(nb), li2 = plan.line + (plan.kind === 'p' ? 2 : 1), t2 = L2[li2];
    var target = plan.kind === 'p' ? t2.s : t2.s + ((plan.kind === 'li' ? RE_LI : RE_OL).exec(t2.t) || [''])[0].length;
    if (atStart) target = at;                             // keep the cursor on the placeholder above
    S.focusAt = { at: target, select: newEmpty || atStart };
    S.dirty = false; hideToolbar();
    h.setBody(nb, { history: true, redraw: !surf() });
    if (surf()) redrawAll();
    return true;
  }
  function refocus() { var el = S.focusEl; if (!el) return; try { el.focus(); var d = frameDoc(), sel = d.getSelection(); if (S.range) { sel.removeAllRanges(); sel.addRange(S.range); } } catch (e) {} }
  function selectionIn(el) { var d = frameDoc(), sel = d && d.getSelection(); if (!sel || !sel.rangeCount) return null; var r = sel.getRangeAt(0); return el.contains(r.commonAncestorContainer) ? r : null; }

  function structural(nb, msg) {
    var h = H(); if (!nb) return;
    S.dirty = false; hideToolbar();
    h.setBody(nb, { history: true, redraw: !surf() });
    if (surf()) redrawAll();
    if (msg && h.toast) h.toast(msg);
  }
  var pendingConfirm = null;
  function confirmThen(text, fn) {
    var d = frameDoc(), tb = d && d.getElementById('lpv-tb'); if (!tb) return;
    tb.querySelector('[data-k="ask"]').textContent = text; pendingConfirm = fn; showRow('confirm'); place(S.focusEl);
  }

  function act(a, btn) {
    var d = frameDoc(), el = S.focusEl, h = H(); if (!d || !el || !h) return;
    var p = h.page(), body = String(p.body || '').replace(/\r/g, ''), at = +el.getAttribute('data-lpb-at');
    if (a === 'bold' || a === 'italic') { refocus(); d.execCommand('styleWithCSS', false, false); d.execCommand(a, false, null); write(el); return; }
    if (a === 'link') {
      var r = selectionIn(el); S.range = r ? r.cloneRange() : null;
      var cur = r && (r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement).closest('a');
      if ((!r || r.collapsed) && !cur) { if (h.toast) h.toast('Select the words you want to link first.', 'warn'); return; }
      var inp = d.querySelector('#lpv-tb [data-k="url"]'); inp.value = cur ? (cur.getAttribute('data-lpb-href') || cur.getAttribute('href') || '') : '';
      showRow('link'); place(el); setTimeout(function () { try { inp.focus(); inp.select(); } catch (e) {} }, 0); return;
    }
    if (a === 'link-ok' || a === 'link-off') {
      var url = a === 'link-off' ? '' : linkAddr(d.querySelector('#lpv-tb [data-k="url"]').value);
      refocus();
      if (!url) d.execCommand('unlink', false, null);
      else {
        d.execCommand('createLink', false, url);
        Array.prototype.forEach.call(el.querySelectorAll('a'), function (x) { if (x.getAttribute('href') === url) x.setAttribute('data-lpb-href', url); });
      }
      write(el); showRow('main'); place(el); return;
    }
    if (level() === 'simple') return;
    var m = /^(item|sec)-(up|down|copy|delete)$/.exec(a);
    if (m) {
      var run = function () { structural(m[1] === 'item' ? itemOp(body, at, m[2]) : sectionOp(body, at, m[2]), m[2] === 'delete' ? (m[1] === 'item' ? 'Item deleted.' : 'Section deleted.') : ''); };
      if (m[2] === 'delete') { confirmThen(m[1] === 'item' ? 'Delete this item?' : 'Delete this whole section?', run); return; }
      run(); return;
    }
    if (a === 'sec-add') { showRow('add'); place(el); return; }
    if (a === 'add-tpl') { var t = tpl(btn && btn.getAttribute('data-t'), pageMode(p)); if (t) structural(insertSection(body, at, t.text), 'Section added — click its text to change it.'); return; }
    if (a === 'yes') { var f = pendingConfirm; pendingConfirm = null; if (f) f(); return; }
    if (a === 'no') { pendingConfirm = null; showRow('main'); place(el); refocus(); return; }
  }
  function tpl(id, mode) { var list = mode === 'rich' ? TEMPLATES_RICH : TEMPLATES_BLOCKS; for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function onToolbar(e) { var b = e.target.closest && e.target.closest('button[data-a]'); if (!b || b.disabled) return; e.preventDefault(); act(b.getAttribute('data-a'), b); }

  /* ------------------------------------------------------------------ panel wiring */
  function wirePanel() {
    if (wirePanel.done) return; wirePanel.done = true;
    var v = $('lpv-visual'), c = $('lpv-code'), sel = $('lpv-level'), menu = $('lpv-add-menu'), tog = $('lpv-add-btn');
    if (v) v.addEventListener('click', function () { setView('visual'); });
    if (c) c.addEventListener('click', function () { setView('code'); });
    if (sel) sel.addEventListener('change', function () { var h = H(); if (h && h.setSiteLevel) h.setSiteLevel(sel.value); syncUi(); applyFrame(true); });
    if (tog && menu) tog.addEventListener('click', function () { menu.hidden = !menu.hidden; tog.setAttribute('aria-expanded', String(!menu.hidden)); });
    if (menu) menu.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-a="add-tpl"]'); if (!b) return;
      var h = H(), p = h.page(), t = tpl(b.getAttribute('data-t'), pageMode(p)); if (!t) return;
      structural(insertSection(String(p.body || '').replace(/\r/g, ''), -1, t.text), 'Section added at the end of the page — click its text to change it.');
      menu.hidden = true; if (tog) tog.setAttribute('aria-expanded', 'false');
    });
  }

  window.LPVisual = {
    pageOpened: function () { wirePanel(); syncUi(); if (active()) showSurface(); else applyFrame(true); },
    pageClosed: function () { hideToolbar(); SURF.key = ''; var fr = F(); try { if (fr && fr.contentWindow && fr.contentWindow.__lpbEdit) { fr.contentWindow.__lpbEdit = false; } } catch (e) {} },
    frameReady: function () { if (surf()) return; var fr = F(); try { if (fr && fr.contentWindow) { fr.contentWindow.__lpbEdit = active(); bind(fr.contentWindow); } } catch (e) {} },
    sync: function () { syncUi(); applyFrame(true); if (active() && surf()) applySurface(); },
    struct: { lines: lines, itemAt: itemAt, sections: sections, itemOp: itemOp, itemInfo: itemInfo, sectionOp: sectionOp, sectionInfo: sectionInfo, insertSection: insertSection, toMd: toMd, linkAddr: linkAddr, TEMPLATES_BLOCKS: TEMPLATES_BLOCKS, TEMPLATES_RICH: TEMPLATES_RICH }
  };
})();
