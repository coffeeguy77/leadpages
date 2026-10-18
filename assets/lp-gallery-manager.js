/*!
 * LeadPages Gallery Manager (editor UI for sections.premiumGallery)
 *
 * window.lpGalleryManager(host, {
 *   get:      () => premiumGallery config object (live, mutated in place),
 *   save:     () => void   (persist + preview),
 *   upload:   async (file, onProgress) => {url, publicId, width, height},
 *   pick:     (cb, opts) => void   (file picker; opts.folder / opts.accept),
 *   expand:   async (files) => File[]   (unzips ZIPs, filters images),
 *   toast:    (msg, kind) => void
 * })
 *
 * - Photo grid with thumbnails, drag-to-reorder, multi-select (click, shift-click, ctrl/cmd-click)
 * - Bulk actions: category, album, tags, size, show/hide, delete
 * - Detail panel: title, caption, alt text (warns when missing), category/album dropdowns,
 *   tags, size, badge, featured, focal point (click the preview)
 * - Uploads run 3 at a time with per-file progress and an error list; width/height are kept
 * - Categories and albums keep stable ids (renaming never orphans photos)
 */
(function () {
  'use strict';
  var CONCURRENCY = 3;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60); }
  function rid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function thumb(u, w) {
    var L = window.LPGallery; return L && L.cdn ? L.cdn(u, w || 320) : u;
  }
  function tagsOf(v) { return Array.isArray(v) ? v.slice() : String(v || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean); }
  function ico(d) { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>'; }
  var I = {
    up: 'M12 16V4M7 9l5-5 5 5M5 20h14', folder: 'M3 7h6l2 2h10v10H3z', grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z', off: 'M3 3l18 18M10.6 6.1A10 10 0 0112 6c6 0 10 6 10 6a17 17 0 01-3 3.6M6.6 6.6C3.9 8.4 2 12 2 12s4 6 10 6a9.8 9.8 0 004.4-1',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', x: 'M6 6l12 12M18 6L6 18', warn: 'M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
    plus: 'M12 5v14M5 12h14', star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z', link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1'
  };

  var CSS = '' +
    '.lgm{--lgm-line:var(--line,#e3e6ea);--lgm-ink:var(--ink,#141a24);--lgm-muted:#667085;--lgm-acc:var(--brand,#1f6f4a);--lgm-bg:var(--card,#fff);font-size:14px}' +
    '.lgm svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}' +
    '.lgm-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}' +
    '.lgm-bar .grow{flex:1}' +
    '.lgm-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid var(--lgm-line);border-radius:9px;background:var(--lgm-bg);color:var(--lgm-ink);font:inherit;font-weight:600;cursor:pointer;white-space:nowrap}' +
    '.lgm-btn:hover{border-color:var(--lgm-acc)}.lgm-btn.pri{background:var(--lgm-acc);border-color:var(--lgm-acc);color:#fff}.lgm-btn.danger{color:#b42318}.lgm-btn[disabled]{opacity:.45;cursor:not-allowed}' +
    '.lgm-in,.lgm-sel{padding:8px 10px;border:1px solid var(--lgm-line);border-radius:9px;font:inherit;background:var(--input-bg,#fff);color:inherit;min-width:0;box-sizing:border-box}' +
    '.lgm-bulk{display:none;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 12px;margin-bottom:12px;border-radius:12px;background:color-mix(in srgb,var(--lgm-acc) 9%,transparent);border:1px solid color-mix(in srgb,var(--lgm-acc) 30%,transparent)}' +
    '.lgm-bulk.on{display:flex}.lgm-bulk b{margin-right:4px}' +
    '.lgm-main{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;align-items:start}' +
    '.lgm-main.has-detail{grid-template-columns:minmax(0,1fr) minmax(300px,380px)}' +
    '@media (max-width:1100px){.lgm-main.has-detail{grid-template-columns:minmax(0,1fr)}}' +
    '.lgm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:10px;min-height:120px;padding:2px}' +
    '.lgm-drop{position:relative}.lgm-drop.drag-over::after{content:"Drop photos to upload";position:absolute;inset:0;display:grid;place-items:center;border:2px dashed var(--lgm-acc);border-radius:14px;background:color-mix(in srgb,var(--lgm-acc) 8%,rgba(255,255,255,.85));font-weight:800;color:var(--lgm-acc);z-index:5}' +
    '.lgm-tile{position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;background:#eef1f4;cursor:pointer;outline:2px solid transparent;outline-offset:2px;user-select:none;transition:outline-color .15s,transform .15s}' +
    '.lgm-tile img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}' +
    '.lgm-tile.sel{outline-color:var(--lgm-acc)}.lgm-tile.cur{outline-color:var(--lgm-acc);outline-width:3px}' +
    '.lgm-tile.hid img{opacity:.35;filter:grayscale(1)}' +
    '.lgm-tile.dragging{opacity:.4}.lgm-tile.drop-before{box-shadow:-4px 0 0 var(--lgm-acc)}.lgm-tile.drop-after{box-shadow:4px 0 0 var(--lgm-acc)}' +
    '.lgm-ck{position:absolute;top:6px;left:6px;width:22px;height:22px;border-radius:6px;background:rgba(255,255,255,.92);border:1.5px solid rgba(20,26,36,.25);display:grid;place-items:center;color:#fff}' +
    '.lgm-tile.sel .lgm-ck{background:var(--lgm-acc);border-color:var(--lgm-acc)}' +
    '.lgm-tile:not(.sel):not(:hover) .lgm-ck{opacity:0}.lgm-has-sel .lgm-tile .lgm-ck{opacity:1}' +
    '.lgm-flags{position:absolute;right:6px;top:6px;display:flex;gap:4px}' +
    '.lgm-flag{display:grid;place-items:center;width:22px;height:22px;border-radius:6px;background:rgba(20,26,36,.72);color:#fff}' +
    '.lgm-flag.warn{background:#f79009}' +
    '.lgm-meta{position:absolute;left:0;right:0;bottom:0;padding:16px 7px 5px;background:linear-gradient(transparent,rgba(10,14,20,.7));color:#fff;font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.lgm-up-tile{display:grid;place-items:center;align-content:center;gap:6px;aspect-ratio:1;border:2px dashed var(--lgm-line);border-radius:10px;color:var(--lgm-muted);font-weight:700;cursor:pointer;background:transparent;font:inherit;font-size:13px}' +
    '.lgm-up-tile:hover{border-color:var(--lgm-acc);color:var(--lgm-acc)}' +
    '.lgm-progress{display:none;margin-bottom:12px;padding:10px 12px;border:1px solid var(--lgm-line);border-radius:12px;background:var(--lgm-bg)}' +
    '.lgm-progress.on{display:block}.lgm-pbar{height:6px;border-radius:9px;background:#eef1f4;overflow:hidden;margin:6px 0}.lgm-pbar i{display:block;height:100%;background:var(--lgm-acc);width:0;transition:width .2s}' +
    '.lgm-perr{color:#b42318;font-size:12.5px;margin:4px 0 0}' +
    '.lgm-detail{position:sticky;top:12px;border:1px solid var(--lgm-line);border-radius:14px;background:var(--lgm-bg);padding:14px;display:flex;flex-direction:column;gap:10px}' +
    '.lgm-detail h3{margin:0;font-size:15px;display:flex;align-items:center;justify-content:space-between;gap:8px}' +
    '.lgm-prev{position:relative;border-radius:10px;overflow:hidden;background:#eef1f4;cursor:crosshair}' +
    '.lgm-prev img{display:block;width:100%;max-height:300px;object-fit:contain;background:#111}' +
    '.lgm-focus{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 2px rgba(0,0,0,.4);pointer-events:none}' +
    '.lgm-f{display:flex;flex-direction:column;gap:4px}.lgm-f label{font-size:12px;font-weight:700;color:var(--lgm-muted)}' +
    '.lgm-row2{display:grid;grid-template-columns:1fr 1fr;gap:8px}' +
    '.lgm-hint{font-size:12px;color:var(--lgm-muted)}.lgm-warn{font-size:12px;color:#b54708;display:flex;gap:6px;align-items:center}' +
    '.lgm-empty{grid-column:1/-1;padding:28px;text-align:center;color:var(--lgm-muted);border:2px dashed var(--lgm-line);border-radius:12px}' +
    '.lgm-sets{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;margin-top:4px}' +
    '.lgm-set{border:1px solid var(--lgm-line);border-radius:14px;padding:12px;background:var(--lgm-bg)}' +
    '.lgm-set h4{margin:0 0 4px;font-size:14px}.lgm-set p{margin:0 0 10px}' +
    '.lgm-item{display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:10px;align-items:start;padding:10px 0;border-top:1px solid var(--lgm-line)}' +
    '.lgm-item:first-of-type{border-top:0}' +
    '.lgm-cov{width:52px;height:52px;border-radius:8px;object-fit:cover;background:#eef1f4;display:block;cursor:pointer}' +
    '.lgm-item .lgm-fields{display:grid;gap:6px}.lgm-item .lgm-two{display:grid;grid-template-columns:1fr 1fr;gap:6px}' +
    '.lgm-count{font-size:12px;color:var(--lgm-muted);white-space:nowrap}' +
    '.lgm-coverpick{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:6px;max-height:220px;overflow:auto;margin-top:6px}' +
    '.lgm-coverpick button{padding:0;border:2px solid transparent;border-radius:8px;overflow:hidden;aspect-ratio:1;cursor:pointer;background:#eef1f4}.lgm-coverpick button.on{border-color:var(--lgm-acc)}' +
    '.lgm-coverpick img{width:100%;height:100%;object-fit:cover;display:block}';

  function injectCss() {
    if (document.getElementById('lgm-css')) return;
    var s = document.createElement('style'); s.id = 'lgm-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  function lpGalleryManager(host, o) {
    if (!host) return;
    injectCss();
    if (host.__lgmAbort) try { host.__lgmAbort.abort(); } catch (e) {}
    var ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    host.__lgmAbort = ac;
    function on(el, t, fn, cap) { el.addEventListener(t, fn, ac ? { signal: ac.signal, capture: !!cap } : !!cap); }

    var sel = {}, cur = null, lastClick = null, view = { cat: '', q: '' };
    var saveT = null;
    function PG() { var g = o.get(); if (!Array.isArray(g.images)) g.images = []; if (!Array.isArray(g.categories)) g.categories = []; if (!Array.isArray(g.albums)) g.albums = []; return g; }
    function save(now) { clearTimeout(saveT); if (now) o.save(); else saveT = setTimeout(o.save, 280); }

    // Make sure everything has a stable id (once; old editor stripped them)
    (function ensureIds() {
      var g = PG(), changed = false, used = {};
      g.categories.forEach(function (c) { if (!c.id) { c.id = 'cat-' + (slug(c.name) || rid('')); changed = true; } });
      g.albums.forEach(function (a) { if (!a.id) { a.id = 'alb-' + (slug(a.title) || rid('')); changed = true; } });
      g.images.forEach(function (im) { if (!im.id || used[im.id]) { im.id = rid('img-'); changed = true; } used[im.id] = 1; });
      // Re-link refs that point at names/slugs (what the old renderer derived)
      function relink(list, key, items, nameKey, prefix) {
        list.forEach(function (it) {
          var ref = it[key]; if (!ref) return;
          if (items.some(function (x) { return x.id === ref; })) return;
          var s = slug(String(ref).replace(new RegExp('^' + prefix), ''));
          var hit = items.filter(function (x) { return slug(x[nameKey]) === s || slug(x.slug) === s; })[0];
          if (hit) { it[key] = hit.id; changed = true; }
        });
      }
      relink(g.images, 'categoryId', g.categories, 'name', 'cat-');
      relink(g.images, 'albumId', g.albums, 'title', 'alb-');
      relink(g.albums, 'categoryId', g.categories, 'name', 'cat-');
      if (changed) save(true);
    })();

    host.innerHTML =
      '<div class="lgm">' +
      '<div class="lgm-bar">' +
      '<button type="button" class="lgm-btn pri" data-a="upload">' + ico(I.up) + 'Upload photos</button>' +
      '<button type="button" class="lgm-btn" data-a="folder">' + ico(I.folder) + 'Folder / ZIP</button>' +
      '<button type="button" class="lgm-btn" data-a="url">' + ico(I.link) + 'Add by URL</button>' +
      '<span class="grow"></span>' +
      '<select class="lgm-sel" data-v="cat" aria-label="Show photos in"></select>' +
      '<input class="lgm-in" data-v="q" type="search" placeholder="Search titles, tags…" style="width:180px">' +
      '<button type="button" class="lgm-btn" data-a="selall">Select all</button>' +
      '</div>' +
      '<div class="lgm-progress"><div class="lgm-ptext"></div><div class="lgm-pbar"><i></i></div><div class="lgm-perrs"></div></div>' +
      '<div class="lgm-bulk"><b class="lgm-bulk-n"></b>' +
      '<select class="lgm-sel" data-b="cat"></select><select class="lgm-sel" data-b="alb"></select>' +
      '<input class="lgm-in" data-b="tags" placeholder="Add tags (comma separated)" style="width:200px"><button type="button" class="lgm-btn" data-a="addtags">Add tags</button>' +
      '<select class="lgm-sel" data-b="size"><option value="">Size…</option><option value="standard">Standard</option><option value="wide">Wide</option><option value="tall">Tall</option><option value="large">Large</option><option value="full">Full width</option></select>' +
      '<button type="button" class="lgm-btn" data-a="show">' + ico(I.eye) + 'Show</button><button type="button" class="lgm-btn" data-a="hide">' + ico(I.off) + 'Hide</button>' +
      '<button type="button" class="lgm-btn danger" data-a="del">' + ico(I.trash) + 'Delete</button>' +
      '<span class="grow"></span><button type="button" class="lgm-btn" data-a="clear">Clear selection</button></div>' +
      '<div class="lgm-main"><div class="lgm-drop"><div class="lgm-grid" role="listbox" aria-multiselectable="true" aria-label="Gallery photos"></div></div><div class="lgm-detail-host"></div></div>' +
      '<div class="lgm-sets"><div class="lgm-set" data-set="cats"></div><div class="lgm-set" data-set="albs"></div></div>' +
      '</div>';
    var root = host.querySelector('.lgm'), grid = host.querySelector('.lgm-grid'), main = host.querySelector('.lgm-main');
    var detailHost = host.querySelector('.lgm-detail-host');

    function catName(id) { var c = PG().categories.filter(function (x) { return x.id === id; })[0]; return c ? (c.name || 'Untitled') : ''; }
    function albTitle(id) { var a = PG().albums.filter(function (x) { return x.id === id; })[0]; return a ? (a.title || 'Untitled') : ''; }
    function catOptions(selected, blank) {
      return '<option value="">' + esc(blank || 'No category') + '</option>' + PG().categories.map(function (c) {
        return '<option value="' + esc(c.id) + '"' + (c.id === selected ? ' selected' : '') + '>' + esc(c.name || 'Untitled') + '</option>';
      }).join('');
    }
    function albOptions(selected, catId, blank) {
      return '<option value="">' + esc(blank || 'No album') + '</option>' + PG().albums.filter(function (a) { return !catId || !a.categoryId || a.categoryId === catId; }).map(function (a) {
        return '<option value="' + esc(a.id) + '"' + (a.id === selected ? ' selected' : '') + '>' + esc((a.title || 'Untitled') + (a.categoryId && !catId ? ' — ' + catName(a.categoryId) : '')) + '</option>';
      }).join('');
    }
    function visible() {
      var g = PG(), q = view.q.toLowerCase();
      return g.images.map(function (im, i) { return { im: im, i: i }; }).filter(function (x) {
        var im = x.im;
        if (view.cat === '__none' && im.categoryId) return false;
        if (view.cat && view.cat !== '__none' && im.categoryId !== view.cat) return false;
        if (q && [im.title, im.caption, im.alt, tagsOf(im.tags).join(' '), catName(im.categoryId), albTitle(im.albumId)].join(' ').toLowerCase().indexOf(q) < 0) return false;
        return true;
      });
    }

    function renderFilters() {
      var g = PG(), s = root.querySelector('[data-v="cat"]');
      s.innerHTML = '<option value="">All photos (' + g.images.length + ')</option>' + g.categories.map(function (c) {
        var n = g.images.filter(function (im) { return im.categoryId === c.id; }).length;
        return '<option value="' + esc(c.id) + '"' + (view.cat === c.id ? ' selected' : '') + '>' + esc(c.name || 'Untitled') + ' (' + n + ')</option>';
      }).join('') + (g.categories.length ? '<option value="__none"' + (view.cat === '__none' ? ' selected' : '') + '>No category</option>' : '');
      root.querySelector('[data-b="cat"]').innerHTML = catOptions('', 'Move to category…').replace('<option value="">Move to category…</option>', '<option value="">Move to category…</option><option value="__clear">— Remove category</option>');
      root.querySelector('[data-b="alb"]').innerHTML = albOptions('', '', 'Move to album…').replace('<option value="">Move to album…</option>', '<option value="">Move to album…</option><option value="__clear">— Remove album</option>');
    }

    function renderGrid() {
      var list = visible();
      var html = list.map(function (x) {
        var im = x.im, id = esc(im.id);
        var flags = '';
        if (im.featured === true || im.featured === 'true') flags += '<span class="lgm-flag" title="Featured">' + ico(I.star) + '</span>';
        if (!String(im.alt || '').trim() || /\.(jpe?g|png|webp|heic)$/i.test(im.alt)) flags += '<span class="lgm-flag warn" title="Missing alt text">' + ico(I.warn) + '</span>';
        var label = im.title || catName(im.categoryId) || 'Untitled';
        return '<div class="lgm-tile' + (sel[im.id] ? ' sel' : '') + (cur === im.id ? ' cur' : '') + (im.on === false ? ' hid' : '') + '" role="option" aria-selected="' + (!!sel[im.id]) + '" tabindex="0" draggable="true" data-id="' + id + '" title="' + esc(label) + '">' +
          '<img src="' + esc(thumb(im.src, 320)) + '" alt="" loading="lazy" decoding="async"><span class="lgm-ck">' + (sel[im.id] ? '<svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>' : '') + '</span>' +
          '<span class="lgm-flags">' + flags + '</span><span class="lgm-meta">' + esc(label) + (im.size && im.size !== 'standard' ? ' · ' + esc(im.size) : '') + '</span></div>';
      }).join('');
      html += '<button type="button" class="lgm-up-tile" data-a="upload">' + ico(I.plus) + 'Add photos<span class="lgm-hint">or drop them here</span></button>';
      if (!PG().images.length) html = '<div class="lgm-empty"><strong>No photos yet.</strong><br>Upload photos, a folder or a ZIP — or drag them onto this box. Mixed portrait and landscape is perfect.</div>' + html;
      grid.innerHTML = html;
      root.classList.toggle('lgm-has-sel', Object.keys(sel).length > 0);
      renderBulk();
    }

    function renderBulk() {
      var n = Object.keys(sel).length, b = root.querySelector('.lgm-bulk');
      b.classList.toggle('on', n > 0);
      root.querySelector('.lgm-bulk-n').textContent = n + (n === 1 ? ' photo selected' : ' photos selected');
      root.querySelector('[data-a="selall"]').textContent = n && n >= visible().length ? 'Select none' : 'Select all';
    }

    function byId(id) { return PG().images.filter(function (im) { return im.id === id; })[0]; }

    function renderDetail() {
      var im = cur && byId(cur);
      main.classList.toggle('has-detail', !!im);
      if (!im) { detailHost.innerHTML = ''; return; }
      var fx = im.focalX == null ? 50 : im.focalX, fy = im.focalY == null ? 50 : im.focalY;
      var altBad = !String(im.alt || '').trim() || /\.(jpe?g|png|webp|heic)$/i.test(im.alt);
      detailHost.innerHTML = '<div class="lgm-detail">' +
        '<h3>Photo details<button type="button" class="lgm-btn" data-a="closedetail" aria-label="Close details">' + ico(I.x) + '</button></h3>' +
        '<div class="lgm-prev" data-a="focal" title="Click to set the focal point used when photos are cropped"><img src="' + esc(thumb(im.src, 900)) + '" alt=""><span class="lgm-focus" style="left:' + fx + '%;top:' + fy + '%"></span></div>' +
        '<div class="lgm-hint">Click the photo to set what stays in view when it is cropped.' + (im.width && im.height ? ' · ' + im.width + '×' + im.height + 'px' : '') + '</div>' +
        '<div class="lgm-f"><label>Title</label><input class="lgm-in" data-f="title" value="' + esc(im.title || '') + '" placeholder="e.g. Exposed aggregate driveway, Gungahlin"></div>' +
        '<div class="lgm-f"><label>Caption</label><textarea class="lgm-in" data-f="caption" rows="2" placeholder="Optional — shown in the lightbox">' + esc(im.caption || '') + '</textarea></div>' +
        '<div class="lgm-f"><label>Alt text (describes the photo for Google and screen readers)</label><input class="lgm-in" data-f="alt" value="' + esc(im.alt || '') + '" placeholder="What is in the photo?">' +
        (altBad ? '<span class="lgm-warn">' + ico(I.warn) + 'Add a short description — it helps search rankings and accessibility.</span>' : '') + '</div>' +
        '<div class="lgm-row2"><div class="lgm-f"><label>Category</label><select class="lgm-sel" data-f="categoryId">' + catOptions(im.categoryId) + '</select></div>' +
        '<div class="lgm-f"><label>Album / job</label><select class="lgm-sel" data-f="albumId">' + albOptions(im.albumId, im.categoryId) + '</select></div></div>' +
        '<div class="lgm-f"><label>Tags (power the filter buttons)</label><input class="lgm-in" data-f="tags" value="' + esc(tagsOf(im.tags).join(', ')) + '" placeholder="Driveway, Exposed aggregate"></div>' +
        '<div class="lgm-row2"><div class="lgm-f"><label>Tile size (mosaic layouts)</label><select class="lgm-sel" data-f="size">' +
        [['', 'Automatic'], ['standard', 'Standard'], ['wide', 'Wide'], ['tall', 'Tall'], ['large', 'Large'], ['full', 'Full width']].map(function (o) { return '<option value="' + o[0] + '"' + ((im.size || '') === o[0] || (o[0] === 'large' && im.size === 'feature') ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
        '</select></div><div class="lgm-f"><label>Badge</label><input class="lgm-in" data-f="badge" value="' + esc(im.badge || '') + '" placeholder="e.g. New"></div></div>' +
        '<label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" data-f="featured"' + (im.featured === true || im.featured === 'true' ? ' checked' : '') + '> Featured (bigger tile)</label>' +
        '<label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" data-f="on"' + (im.on !== false ? ' checked' : '') + '> Show on the website</label>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="lgm-btn" data-a="replace">' + ico(I.up) + 'Replace photo</button><button type="button" class="lgm-btn danger" data-a="delone">' + ico(I.trash) + 'Delete</button></div>' +
        '</div>';
    }

    function setsHtml() {
      var g = PG();
      var cats = '<h4>Categories</h4><p class="lgm-hint">Group photos (e.g. Driveways, Exposed aggregate). Used by filter buttons and the categories layout.</p>' +
        g.categories.map(function (c) {
          var n = g.images.filter(function (im) { return im.categoryId === c.id; }).length;
          var cov = c.cover || (g.images.filter(function (im) { return im.categoryId === c.id; })[0] || {}).src || '';
          return '<div class="lgm-item" data-cat="' + esc(c.id) + '">' +
            (cov ? '<img class="lgm-cov" src="' + esc(thumb(cov, 120)) + '" alt="" data-a="cover" title="Choose cover">' : '<span class="lgm-cov" data-a="cover" title="Choose cover"></span>') +
            '<div class="lgm-fields"><input class="lgm-in" data-cf="name" value="' + esc(c.name || '') + '" placeholder="Category name">' +
            '<textarea class="lgm-in" data-cf="intro" rows="2" placeholder="Short intro (optional)">' + esc(c.intro || '') + '</textarea>' +
            '<div class="lgm-two"><input class="lgm-in" data-cf="eyebrow" value="' + esc(c.eyebrow || '') + '" placeholder="Eyebrow (optional)"><input class="lgm-in" data-cf="slug" value="' + esc(c.slug || '') + '" placeholder="Link name, e.g. ' + esc(slug(c.name) || 'driveways') + '"></div>' +
            '<div class="lgm-two"><input class="lgm-in" data-cf="seoTitle" value="' + esc(c.seoTitle || '') + '" placeholder="Page title when open (optional)"><input class="lgm-in" data-cf="seoDescription" value="' + esc(c.seoDescription || '') + '" placeholder="Description (optional)"></div><div class="lgm-cover-host"></div></div>' +
            '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end"><span class="lgm-count">' + n + ' photo' + (n === 1 ? '' : 's') + '</span>' +
            '<label class="lgm-hint" style="display:flex;gap:5px;align-items:center"><input type="checkbox" data-cf="on"' + (c.on !== false ? ' checked' : '') + '>Show</label>' +
            '<button type="button" class="lgm-btn danger" data-a="delcat" aria-label="Delete category">' + ico(I.trash) + '</button></div></div>';
        }).join('') + '<button type="button" class="lgm-btn" data-a="addcat" style="margin-top:8px">' + ico(I.plus) + 'Add category</button>';
      var albs = '<h4>Albums / jobs</h4><p class="lgm-hint">Optional: individual projects inside a category (Structure: Categories → albums → photos).</p>' +
        g.albums.map(function (a) {
          var n = g.images.filter(function (im) { return im.albumId === a.id; }).length;
          var cov = a.cover || (g.images.filter(function (im) { return im.albumId === a.id; })[0] || {}).src || '';
          return '<div class="lgm-item" data-alb="' + esc(a.id) + '">' +
            (cov ? '<img class="lgm-cov" src="' + esc(thumb(cov, 120)) + '" alt="" data-a="cover" title="Choose cover">' : '<span class="lgm-cov" data-a="cover" title="Choose cover"></span>') +
            '<div class="lgm-fields"><input class="lgm-in" data-af="title" value="' + esc(a.title || '') + '" placeholder="Album / job name">' +
            '<div class="lgm-two"><select class="lgm-sel" data-af="categoryId">' + catOptions(a.categoryId, 'Choose category') + '</select><input class="lgm-in" data-af="location" value="' + esc(a.location || '') + '" placeholder="Suburb, e.g. Fadden ACT"></div>' +
            '<textarea class="lgm-in" data-af="intro" rows="2" placeholder="Short intro (optional)">' + esc(a.intro || '') + '</textarea><div class="lgm-cover-host"></div></div>' +
            '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end"><span class="lgm-count">' + n + ' photo' + (n === 1 ? '' : 's') + '</span>' +
            '<label class="lgm-hint" style="display:flex;gap:5px;align-items:center"><input type="checkbox" data-af="on"' + (a.on !== false ? ' checked' : '') + '>Show</label>' +
            '<button type="button" class="lgm-btn danger" data-a="delalb" aria-label="Delete album">' + ico(I.trash) + '</button></div></div>';
        }).join('') + '<button type="button" class="lgm-btn" data-a="addalb" style="margin-top:8px">' + ico(I.plus) + 'Add album</button>';
      root.querySelector('[data-set="cats"]').innerHTML = cats;
      root.querySelector('[data-set="albs"]').innerHTML = albs;
    }

    function renderAll() { renderFilters(); renderGrid(); renderDetail(); setsHtml(); }

    /* ---------------- uploads ---------------- */
    var prog = root.querySelector('.lgm-progress');
    async function uploadFiles(files, replaceId) {
      var imgs = [];
      try { imgs = await o.expand(files); } catch (e) { imgs = Array.prototype.slice.call(files || []); }
      imgs = imgs.filter(function (f) { return f && (/^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|heic|avif)$/i.test(f.name || '')); });
      if (!imgs.length) { o.toast('No images found in that selection', 'warn'); return; }
      if (replaceId) imgs = imgs.slice(0, 1);
      var total = imgs.length, done = 0, failed = [], pct = {};
      prog.classList.add('on');
      var errs = prog.querySelector('.lgm-perrs'); errs.innerHTML = '';
      function paint() {
        var sum = 0; Object.keys(pct).forEach(function (k) { sum += pct[k]; });
        prog.querySelector('.lgm-ptext').textContent = 'Uploading ' + Math.min(done + 1, total) + ' of ' + total + (failed.length ? ' · ' + failed.length + ' failed' : '');
        prog.querySelector('.lgm-pbar i').style.width = Math.round(((done * 100) + sum) / total) + '%';
      }
      var queue = imgs.map(function (f, i) { return { f: f, i: i }; }), g = PG();
      var category = view.cat && view.cat !== '__none' ? view.cat : '';
      var results = new Array(total);
      async function worker() {
        while (queue.length) {
          var job = queue.shift();
          pct[job.i] = 0; paint();
          try {
            var r = await o.upload(job.f, function (p) { pct[job.i] = p; paint(); });
            var nice = String(job.f.name || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
            if (/^(img|dsc|pxl|photo|image)?\s*\d{3,}/i.test(nice) || /^\d+$/.test(nice)) nice = '';
            results[job.i] = { r: r, nice: nice };
          } catch (e) {
            failed.push(job.f.name || 'file');
            var p = document.createElement('div'); p.className = 'lgm-perr'; p.textContent = (job.f.name || 'file') + ': ' + ((e && e.message) || 'upload failed');
            errs.appendChild(p);
          }
          delete pct[job.i]; done++; paint();
        }
      }
      var workers = []; for (var w = 0; w < Math.min(CONCURRENCY, total); w++) workers.push(worker());
      await Promise.all(workers);
      // keep the original file order
      var added = 0;
      results.forEach(function (x) {
        if (!x) return;
        var r = x.r;
        if (replaceId) {
          var im = byId(replaceId);
          if (im) { im.src = r.url; im.src_pid = r.publicId; if (r.width) { im.width = r.width; im.height = r.height; im.orientation = r.width > r.height * 1.9 ? 'panoramic' : r.width > r.height * 1.05 ? 'landscape' : r.width < r.height * 0.95 ? 'portrait' : 'square'; } }
          added++; return;
        }
        var it = { id: rid('img-'), on: true, src: r.url, src_pid: r.publicId, title: x.nice, alt: x.nice, caption: '', tags: [], size: '', featured: false, categoryId: category, albumId: '' };
        if (r.width && r.height) { it.width = r.width; it.height = r.height; it.orientation = r.width > r.height * 1.9 ? 'panoramic' : r.width > r.height * 1.05 ? 'landscape' : r.width < r.height * 0.95 ? 'portrait' : 'square'; }
        g.images.push(it); added++;
      });
      save(true);
      prog.querySelector('.lgm-ptext').textContent = (replaceId ? 'Photo replaced' : 'Uploaded ' + added + ' of ' + total + ' photo' + (total === 1 ? '' : 's')) + (failed.length ? ' — ' + failed.length + ' failed (details below)' : '');
      prog.querySelector('.lgm-pbar i').style.width = '100%';
      if (!failed.length) setTimeout(function () { prog.classList.remove('on'); }, 2500);
      o.toast(replaceId ? 'Photo replaced' : ('Added ' + added + ' photo' + (added === 1 ? '' : 's')), failed.length ? 'warn' : undefined);
      renderAll();
    }

    /* ---------------- events ---------------- */
    on(root, 'click', function (ev) {
      var t = ev.target, a = t.closest('[data-a]');
      var tile = t.closest('.lgm-tile');
      if (a) {
        var act = a.getAttribute('data-a'), g = PG(), ids = Object.keys(sel);
        if (act === 'upload') { o.pick(function (f) { uploadFiles(f); }, { multiple: true, accept: 'image/*,.zip,application/zip' }); return; }
        if (act === 'folder') { o.pick(function (f) { uploadFiles(f); }, { folder: true, multiple: true, accept: 'image/*,.zip,application/zip' }); return; }
        if (act === 'url') {
          var u = window.prompt('Paste the image address (https://…)'); if (!u) return;
          u = u.trim(); if (!/^https?:\/\//i.test(u)) { o.toast('That does not look like an image address', 'warn'); return; }
          g.images.push({ id: rid('img-'), on: true, src: u, title: '', alt: '', caption: '', tags: [], categoryId: view.cat && view.cat !== '__none' ? view.cat : '', albumId: '' });
          save(true); renderAll(); return;
        }
        if (act === 'selall') { var vis = visible(); if (ids.length >= vis.length) sel = {}; else vis.forEach(function (x) { sel[x.im.id] = 1; }); renderGrid(); return; }
        if (act === 'clear') { sel = {}; renderGrid(); return; }
        if (act === 'show' || act === 'hide') { ids.forEach(function (id) { var im = byId(id); if (im) im.on = act === 'show'; }); save(true); renderGrid(); renderDetail(); return; }
        if (act === 'del') {
          if (!ids.length || !window.confirm('Delete ' + ids.length + ' photo' + (ids.length === 1 ? '' : 's') + ' from this gallery?')) return;
          g.images = g.images.filter(function (im) { return !sel[im.id]; }); o.get().images = g.images;
          if (sel[cur]) cur = null; sel = {}; save(true); renderAll(); return;
        }
        if (act === 'addtags') {
          var add = tagsOf(root.querySelector('[data-b="tags"]').value); if (!add.length || !ids.length) return;
          ids.forEach(function (id) { var im = byId(id); if (!im) return; var t2 = tagsOf(im.tags); add.forEach(function (x) { if (t2.indexOf(x) < 0) t2.push(x); }); im.tags = t2; });
          root.querySelector('[data-b="tags"]').value = ''; save(true); renderGrid(); renderDetail(); o.toast('Tags added'); return;
        }
        if (act === 'closedetail') { cur = null; renderGrid(); renderDetail(); return; }
        if (act === 'delone') {
          if (!window.confirm('Delete this photo from the gallery?')) return;
          g.images = g.images.filter(function (im) { return im.id !== cur; }); o.get().images = g.images; delete sel[cur]; cur = null; save(true); renderAll(); return;
        }
        if (act === 'replace') { var rid0 = cur; o.pick(function (f) { uploadFiles(f, rid0); }, { multiple: false, accept: 'image/*' }); return; }
        if (act === 'focal') {
          var img = a.querySelector('img'), rc = img.getBoundingClientRect(), im2 = byId(cur); if (!im2) return;
          im2.focalX = Math.round(Math.max(0, Math.min(1, (ev.clientX - rc.left) / rc.width)) * 100);
          im2.focalY = Math.round(Math.max(0, Math.min(1, (ev.clientY - rc.top) / rc.height)) * 100);
          var dot = a.querySelector('.lgm-focus'); dot.style.left = im2.focalX + '%'; dot.style.top = im2.focalY + '%';
          save(); return;
        }
        if (act === 'addcat') { g.categories.push({ id: rid('cat-'), on: true, name: '', intro: '', slug: '' }); save(true); setsHtml(); renderFilters(); var last = root.querySelector('[data-set="cats"] .lgm-item:last-of-type [data-cf="name"]'); if (last) last.focus(); return; }
        if (act === 'addalb') { g.albums.push({ id: rid('alb-'), on: true, title: '', categoryId: view.cat && view.cat !== '__none' ? view.cat : '', intro: '', location: '' }); save(true); setsHtml(); renderFilters(); var la = root.querySelector('[data-set="albs"] .lgm-item:last-of-type [data-af="title"]'); if (la) la.focus(); return; }
        if (act === 'delcat') {
          var cid = a.closest('[data-cat]').getAttribute('data-cat');
          var used = g.images.filter(function (im) { return im.categoryId === cid; }).length;
          if (!window.confirm('Delete this category?' + (used ? ' Its ' + used + ' photo(s) stay in the gallery without a category.' : ''))) return;
          g.categories = g.categories.filter(function (c) { return c.id !== cid; }); o.get().categories = g.categories;
          g.images.forEach(function (im) { if (im.categoryId === cid) im.categoryId = ''; });
          g.albums.forEach(function (al) { if (al.categoryId === cid) al.categoryId = ''; });
          if (view.cat === cid) view.cat = '';
          save(true); renderAll(); return;
        }
        if (act === 'delalb') {
          var aid = a.closest('[data-alb]').getAttribute('data-alb');
          if (!window.confirm('Delete this album? Its photos stay in the gallery.')) return;
          g.albums = g.albums.filter(function (x) { return x.id !== aid; }); o.get().albums = g.albums;
          g.images.forEach(function (im) { if (im.albumId === aid) im.albumId = ''; });
          save(true); renderAll(); return;
        }
        if (act === 'cover') {
          var item = a.closest('.lgm-item'), hostC = item.querySelector('.lgm-cover-host');
          if (hostC.innerHTML) { hostC.innerHTML = ''; return; }
          var isCat = item.hasAttribute('data-cat'), key = isCat ? item.getAttribute('data-cat') : item.getAttribute('data-alb');
          var obj = (isCat ? g.categories : g.albums).filter(function (x) { return x.id === key; })[0];
          var pool = g.images.filter(function (im) { return isCat ? im.categoryId === key : im.albumId === key; });
          if (!pool.length) pool = g.images;
          hostC.innerHTML = '<div class="lgm-hint">Choose a cover photo:</div><div class="lgm-coverpick">' + pool.slice(0, 120).map(function (im) {
            return '<button type="button" data-cover="' + esc(im.id) + '" class="' + (obj && obj.cover === im.src ? 'on' : '') + '"><img src="' + esc(thumb(im.src, 140)) + '" alt="" loading="lazy"></button>';
          }).join('') + '</div>';
          return;
        }
      }
      var cv = t.closest('[data-cover]');
      if (cv) {
        var it2 = cv.closest('.lgm-item'), isC = it2.hasAttribute('data-cat'), k2 = isC ? it2.getAttribute('data-cat') : it2.getAttribute('data-alb');
        var ob = (isC ? PG().categories : PG().albums).filter(function (x) { return x.id === k2; })[0], pim = byId(cv.getAttribute('data-cover'));
        if (ob && pim) { ob.cover = pim.src; ob.cover_pid = pim.src_pid || ''; save(true); setsHtml(); }
        return;
      }
      if (tile) {
        var id = tile.getAttribute('data-id');
        var vis2 = visible().map(function (x) { return x.im.id; });
        if (ev.shiftKey && lastClick) {
          var i1 = vis2.indexOf(lastClick), i2 = vis2.indexOf(id);
          if (i1 >= 0 && i2 >= 0) for (var k = Math.min(i1, i2); k <= Math.max(i1, i2); k++) sel[vis2[k]] = 1;
        } else if (ev.metaKey || ev.ctrlKey || t.closest('.lgm-ck') || Object.keys(sel).length) {
          if (sel[id]) delete sel[id]; else sel[id] = 1;
        } else {
          cur = cur === id ? null : id;
        }
        lastClick = id;
        renderGrid(); renderDetail();
      }
    });
    on(root, 'keydown', function (ev) {
      var tile = ev.target.closest && ev.target.closest('.lgm-tile');
      if (!tile) return;
      if (ev.key === 'Enter') { ev.preventDefault(); var id = tile.getAttribute('data-id'); cur = cur === id ? null : id; renderGrid(); renderDetail(); var nt = grid.querySelector('[data-id="' + id + '"]'); if (nt) nt.focus(); }
      else if (ev.key === ' ') { ev.preventDefault(); var id2 = tile.getAttribute('data-id'); if (sel[id2]) delete sel[id2]; else sel[id2] = 1; renderGrid(); var nt2 = grid.querySelector('[data-id="' + id2 + '"]'); if (nt2) nt2.focus(); }
      else if (ev.key === 'Delete' || ev.key === 'Backspace') { if (Object.keys(sel).length) root.querySelector('[data-a="del"]').click(); }
    });
    on(root, 'input', function (ev) {
      var t = ev.target, g = PG();
      if (t.matches('[data-v="q"]')) { view.q = t.value; renderGrid(); return; }
      var f = t.getAttribute('data-f');
      if (f && cur) {
        var im = byId(cur); if (!im) return;
        if (f === 'tags') im.tags = tagsOf(t.value);
        else if (t.type === 'checkbox') return; // handled on change
        else if (t.tagName !== 'SELECT') im[f] = t.value;
        save();
        if (f === 'title' || f === 'alt') { var tl = grid.querySelector('[data-id="' + cur + '"] .lgm-meta'); if (tl && f === 'title') tl.textContent = t.value || catName(im.categoryId) || 'Untitled'; }
        if (f === 'alt') {
          var bad = !String(t.value || '').trim() || /\.(jpe?g|png|webp|heic)$/i.test(t.value);
          var w = t.parentNode.querySelector('.lgm-warn'); if (w) w.style.display = bad ? '' : 'none';
          var fl = grid.querySelector('[data-id="' + cur + '"] .lgm-flag.warn'); if (fl) fl.style.display = bad ? '' : 'none';
        }
        return;
      }
      var cf = t.getAttribute('data-cf'), af = t.getAttribute('data-af');
      if (cf && t.type !== 'checkbox') { var c = g.categories.filter(function (x) { return x.id === t.closest('[data-cat]').getAttribute('data-cat'); })[0]; if (c) { c[cf] = cf === 'slug' ? slug(t.value) || '' : t.value; save(); if (cf === 'name') renderFilters(); } return; }
      if (af && t.tagName !== 'SELECT' && t.type !== 'checkbox') { var al = g.albums.filter(function (x) { return x.id === t.closest('[data-alb]').getAttribute('data-alb'); })[0]; if (al) { al[af] = t.value; save(); if (af === 'title') renderFilters(); } return; }
    });
    on(root, 'change', function (ev) {
      var t = ev.target, g = PG();
      if (t.matches('[data-v="cat"]')) { view.cat = t.value; sel = {}; renderGrid(); return; }
      var b = t.getAttribute('data-b');
      if (b === 'cat' || b === 'alb' || b === 'size') {
        var v = t.value; if (!v) return;
        Object.keys(sel).forEach(function (id) {
          var im = byId(id); if (!im) return;
          if (b === 'cat') { im.categoryId = v === '__clear' ? '' : v; if (im.albumId) { var al = g.albums.filter(function (x) { return x.id === im.albumId; })[0]; if (al && al.categoryId && al.categoryId !== im.categoryId) im.albumId = ''; } }
          if (b === 'alb') { im.albumId = v === '__clear' ? '' : v; var al2 = g.albums.filter(function (x) { return x.id === v; })[0]; if (al2 && al2.categoryId) im.categoryId = al2.categoryId; }
          if (b === 'size') im.size = v === 'standard' ? 'standard' : v;
        });
        t.value = ''; save(true); renderAll(); o.toast('Updated ' + Object.keys(sel).length + ' photo(s)'); return;
      }
      var f = t.getAttribute('data-f');
      if (f && cur) {
        var im2 = byId(cur); if (!im2) return;
        if (t.type === 'checkbox') im2[f] = t.checked;
        else if (f === 'categoryId') { im2.categoryId = t.value; var a3 = g.albums.filter(function (x) { return x.id === im2.albumId; })[0]; if (a3 && a3.categoryId && a3.categoryId !== t.value) im2.albumId = ''; }
        else if (f === 'albumId') { im2.albumId = t.value; var a4 = g.albums.filter(function (x) { return x.id === t.value; })[0]; if (a4 && a4.categoryId) im2.categoryId = a4.categoryId; }
        else if (t.tagName === 'SELECT') im2[f] = t.value;
        save(true); renderGrid(); renderFilters(); setsHtml();
        if (f === 'categoryId' || f === 'albumId') renderDetail();
        return;
      }
      var cf = t.getAttribute('data-cf'), af = t.getAttribute('data-af');
      if (cf && t.type === 'checkbox') { var c = g.categories.filter(function (x) { return x.id === t.closest('[data-cat]').getAttribute('data-cat'); })[0]; if (c) { c.on = t.checked; save(true); } return; }
      if (af) { var al3 = g.albums.filter(function (x) { return x.id === t.closest('[data-alb]').getAttribute('data-alb'); })[0]; if (al3) { al3[af] = t.type === 'checkbox' ? t.checked : t.value; save(true); if (af === 'categoryId') renderFilters(); } return; }
    });

    // drag to reorder (tiles) + drop files to upload
    var dragId = null, drop = host.querySelector('.lgm-drop');
    on(grid, 'dragstart', function (ev) {
      var tile = ev.target.closest && ev.target.closest('.lgm-tile'); if (!tile) return;
      dragId = tile.getAttribute('data-id'); tile.classList.add('dragging');
      try { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', dragId); } catch (e) {}
    });
    on(grid, 'dragend', function () { dragId = null; grid.querySelectorAll('.lgm-tile').forEach(function (x) { x.classList.remove('dragging', 'drop-before', 'drop-after'); }); });
    on(drop, 'dragover', function (ev) {
      ev.preventDefault();
      var files = ev.dataTransfer && Array.prototype.indexOf.call(ev.dataTransfer.types || [], 'Files') >= 0;
      if (files && !dragId) { drop.classList.add('drag-over'); return; }
      var tile = ev.target.closest && ev.target.closest('.lgm-tile'); if (!tile || !dragId) return;
      var rc = tile.getBoundingClientRect(), after = ev.clientX > rc.left + rc.width / 2;
      grid.querySelectorAll('.lgm-tile').forEach(function (x) { x.classList.remove('drop-before', 'drop-after'); });
      tile.classList.add(after ? 'drop-after' : 'drop-before');
    });
    on(drop, 'dragleave', function (ev) { if (!drop.contains(ev.relatedTarget)) drop.classList.remove('drag-over'); });
    on(drop, 'drop', function (ev) {
      ev.preventDefault(); drop.classList.remove('drag-over');
      if (!dragId && ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files.length) { uploadFiles(Array.prototype.slice.call(ev.dataTransfer.files)); return; }
      var tile = ev.target.closest && ev.target.closest('.lgm-tile'); if (!tile || !dragId) return;
      var g = PG(), toId = tile.getAttribute('data-id'); if (toId === dragId) return;
      var rc = tile.getBoundingClientRect(), after = ev.clientX > rc.left + rc.width / 2;
      var moving = sel[dragId] ? g.images.filter(function (im) { return sel[im.id]; }) : [byId(dragId)];
      var rest = g.images.filter(function (im) { return moving.indexOf(im) < 0; });
      var at = rest.indexOf(byId(toId)); if (at < 0) return;
      if (after) at++;
      Array.prototype.splice.apply(rest, [at, 0].concat(moving));
      o.get().images = rest; save(true); renderGrid();
    });

    renderAll();
    return { refresh: renderAll };
  }

  window.lpGalleryManager = lpGalleryManager;
})();
