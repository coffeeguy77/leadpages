/*!
 * LeadPages Gallery engine (lp-gallery.js)
 *
 * One source for the Premium Gallery app (sections.premiumGallery).
 * - Never mutates the config it is given (works on a normalised copy).
 * - Reads every legacy config shape and heals broken category/album links.
 * - Real layouts: smart/random/editorial mosaic, uniform grid, masonry (reading
 *   order), justified rows, feature grid, filmstrip, slideshow, stacked, collage.
 * - One accessible lightbox per gallery: focus trap, scroll lock, keyboard,
 *   swipe, pinch/double-tap zoom, Back button closes it, neighbour preloading.
 * - Cloudinary responsive images (f_auto,q_auto,w_*) with srcset/sizes.
 * - URL state only changes when the visitor navigates (push + popstate).
 * - Never touches the page title/description at the gallery root.
 *
 * Browser: window.LPGallery.mount(sectionNode, config, context)
 * Node (tests): require('./assets/lp-gallery.js').normalize(config)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LPGallery = api;
})(this, function () {
  'use strict';

  var VERSION = '1.0.0';
  var HAS_DOM = typeof window !== 'undefined' && typeof document !== 'undefined';

  /* ------------------------------------------------------------------ *
   * Defaults & presets (single source — editor + Node read these too)  *
   * ------------------------------------------------------------------ */
  var DEFAULTS = {
    structureMode: 'simple', eyebrow: 'Our work', heading: 'A gallery of completed projects',
    intro: '', supporting: '', badge: '', headerLayout: 'centred',
    showEyebrow: true, showTitle: true, showIntro: true, showSupporting: false, showBadge: false,
    showCount: true, showBreadcrumb: true, showBack: true, showCta: false,
    ctaText: 'Get a quote', ctaAction: 'quote', coverImage: '',
    layout: 'smart-mosaic', density: 'balanced', imageSize: 'standard', ratio: 'original',
    columnsDesktop: 4, columnsTablet: 3, columnsMobile: 2, gap: 12, radius: 12,
    hover: 'zoom', overlay: 'bottom-gradient', loadMoreCount: 16, autoLoad: true,
    lightboxOn: true, lightboxStyle: 'dark', lightboxCaptions: true, lightboxThumbnails: true,
    lightboxZoom: true, lightboxDownloads: false,
    filtersEnabled: true, filterStyle: 'pills', filterSource: 'tags', filterMultiple: false,
    showAllTab: true, showFilterCounts: false,
    autoplay: false, autoplayDelay: 5000, cardLayout: 'overlay', smartPreset: 'dynamic',
    mosaicLocked: true, mosaicSeed: 7, mosaicRandomize: 'locked', mosaicLayout: [],
    collageRotation: 4, collageOverlap: 12, virtualizeAt: 48, urlMode: 'hash',
    seoTitle: '', seoDescription: '', seoIndex: true, analyticsOn: true,
    eyebrowColor: '', titleColor: '', introColor: '', captionColor: '', filterColor: '',
    activeFilterColor: '', badgeBg: '', badgeText: '',
    categories: [], albums: [], images: []
  };

  var PRESETS = {
    clean: { layout: 'grid', density: 'airy', ratio: 'square', hover: 'none', radius: 8, gap: 18, headerLayout: 'centred', mosaicLocked: true, mosaicRandomize: 'locked' },
    editorial: { layout: 'editorial', density: 'editorial', ratio: 'original', hover: 'caption', radius: 4, gap: 20, headerLayout: 'split', mosaicLocked: true, mosaicRandomize: 'locked' },
    dynamic: { layout: 'smart-mosaic', density: 'balanced', ratio: 'original', hover: 'zoom', radius: 12, gap: 12, headerLayout: 'centred', mosaicLocked: false, mosaicRandomize: 'once' },
    minimal: { layout: 'grid', density: 'compact', ratio: 'original', hover: 'none', radius: 0, gap: 8, headerLayout: 'minimal', mosaicLocked: true, mosaicRandomize: 'locked' },
    cinematic: { layout: 'feature-grid', density: 'edge', ratio: '21:9', hover: 'zoom', radius: 0, gap: 4, headerLayout: 'hero', lightboxStyle: 'dark', mosaicLocked: true, mosaicRandomize: 'locked' },
    collage: { layout: 'collage', density: 'balanced', ratio: 'original', hover: 'lift', radius: 10, gap: 10, headerLayout: 'centred', mosaicLocked: true, mosaicRandomize: 'locked', collageRotation: 4, collageOverlap: 12 }
  };

  var LAYOUTS = ['smart-mosaic', 'random-mosaic', 'grid', 'masonry', 'justified', 'editorial', 'feature-grid', 'filmstrip', 'slideshow', 'stacked', 'collage'];
  var SIZES = ['standard', 'wide', 'tall', 'large', 'full'];
  var DENSITY_GAP = { airy: 22, balanced: 12, compact: 8, edge: 2, editorial: 18 };
  var RATIO_VAL = { square: 1, '4:5': 0.8, '3:4': 0.75, '4:3': 4 / 3, '3:2': 1.5, '16:9': 16 / 9, '21:9': 21 / 9 };
  var ORIENT_RATIO = { portrait: 0.75, landscape: 1.5, square: 1, panoramic: 2.4 };

  /* ------------------------------------------------------------------ *
   * Small utilities                                                     *
   * ------------------------------------------------------------------ */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function slug(s) {
    return String(s == null ? '' : s).toLowerCase().normalize ? String(s == null ? '' : s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64)
      : String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
  }
  function hash(s) {
    s = String(s || ''); var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
  function clone(v) {
    if (v == null) return v;
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; }
  }
  function has(v) { return v !== undefined && v !== null; }
  function int(v, d, lo, hi) {
    var n = parseInt(v, 10); if (isNaN(n)) return d;
    if (lo != null && n < lo) n = lo; if (hi != null && n > hi) n = hi; return n;
  }
  function bool(v, d) {
    if (v === true || v === 'true' || v === 1 || v === '1' || v === 'yes' || v === 'on') return true;
    if (v === false || v === 'false' || v === 0 || v === '0' || v === 'no' || v === 'off' || v === '') return false;
    return d;
  }
  function str(v, d) { return (v == null) ? (d == null ? '' : d) : String(v); }
  /** Only http(s), protocol-relative, site-relative or data:image URLs. */
  function safeUrl(u) {
    u = String(u == null ? '' : u).trim();
    if (!u) return '';
    if (/^(https?:)?\/\//i.test(u) || /^\/(?!\/)/.test(u) || /^data:image\//i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return ''; // javascript:, vbscript:, etc.
    return u; // bare relative path
  }
  function parseRatio(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return v > 0.05 && v < 20 ? v : null;
    var s = String(v).trim();
    if (RATIO_VAL[s]) return RATIO_VAL[s];
    var m = s.match(/^(\d+(?:\.\d+)?)\s*[:x\/]\s*(\d+(?:\.\d+)?)$/);
    if (m) { var r = parseFloat(m[1]) / parseFloat(m[2]); return r > 0.05 && r < 20 ? r : null; }
    var n = parseFloat(s); return (n > 0.05 && n < 20) ? n : null;
  }
  function tagsOf(v) {
    if (Array.isArray(v)) return v.map(function (t) { return String(t == null ? '' : t).trim(); }).filter(Boolean);
    return String(v == null ? '' : v).split(',').map(function (t) { return t.trim(); }).filter(Boolean);
  }

  /* ------------------------------------------------------------------ *
   * Cloudinary responsive URLs                                          *
   * ------------------------------------------------------------------ */
  var CLD_KEYS = { a:1, ac:1, af:1, ar:1, b:1, bo:1, c:1, co:1, cs:1, d:1, dl:1, dn:1, dpr:1, du:1, e:1, eo:1, f:1, fl:1, fn:1, fps:1, g:1, h:1, ki:1, l:1, o:1, p:1, pg:1, q:1, r:1, so:1, sp:1, t:1, u:1, vc:1, vs:1, w:1, x:1, y:1, z:1 };
  function isCldTransform(seg) {
    if (!seg || /^v\d+$/.test(seg)) return false;
    var parts = seg.split(',');
    for (var i = 0; i < parts.length; i++) {
      var m = parts[i].match(/^([a-z]{1,3})_./);
      if (!m || !CLD_KEYS[m[1]]) { if (parts[i].charAt(0) !== '$') return false; }
    }
    return true;
  }
  /**
   * Return a resized/optimised URL for Cloudinary and Unsplash images, or the
   * original URL for anything else. `extra` appends transforms (e.g. fl_attachment).
   */
  function cdn(url, w, extra) {
    url = safeUrl(url); if (!url) return '';
    var m = url.match(/^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/);
    if (m) {
      var rest = m[2].split('/'), i = 0;
      while (i < rest.length - 1 && isCldTransform(rest[i])) i++;
      var t = 'f_auto,q_auto' + (w ? ',c_limit,w_' + Math.round(w) : '') + (extra ? ',' + extra : '');
      rest.splice(i, 0, t);
      return m[1] + rest.join('/');
    }
    if (w && /^https?:\/\/images\.unsplash\.com\//.test(url)) {
      try {
        var u = new URL(url), ow = parseInt(u.searchParams.get('w'), 10), oh = parseInt(u.searchParams.get('h'), 10);
        if (ow && oh) u.searchParams.set('h', String(Math.round(oh * w / ow)));
        u.searchParams.set('w', String(Math.round(w)));
        if (!u.searchParams.get('auto')) u.searchParams.set('auto', 'format');
        return u.toString();
      } catch (e) { return url; }
    }
    return url;
  }
  var SRCSET_W = [320, 480, 640, 800, 1024, 1280, 1600, 2048];
  function srcset(url) {
    if (!url || cdn(url, 100) === safeUrl(url)) return '';
    return SRCSET_W.map(function (w) { return cdn(url, w) + ' ' + w + 'w'; }).join(', ');
  }

  /* ------------------------------------------------------------------ *
   * Normaliser — pure, never mutates input                              *
   * ------------------------------------------------------------------ */
  function resolver(list, prefix, nameKey) {
    // Many keys per item so legacy references keep resolving after the old
    // editor stripped / regenerated ids.
    var map = {}, stems = [];
    function add(k, item) { k = String(k || '').toLowerCase(); if (k && !map[k]) map[k] = item; }
    list.forEach(function (it) {
      var keys = [it.id, it._origId, slug(it.id), slug(it[nameKey]), slug(it.slug), prefix + slug(it[nameKey]), prefix + slug(it.slug)];
      keys.forEach(function (k) { add(k, it); var s = String(k || '').toLowerCase(); if (s.indexOf(prefix) === 0) add(s.slice(prefix.length), it); });
      stems.push({ item: it, keys: [slug(it[nameKey]), slug(it.slug)].filter(Boolean) });
    });
    return function (ref) {
      if (ref == null || ref === '') return null;
      var r = String(ref).toLowerCase(), s = slug(ref);
      var hit = map[r] || map[s] || map[prefix + s] || (s.indexOf(slug(prefix)) === 0 ? map[s.slice(slug(prefix).length + 1)] : null);
      if (hit) return hit;
      // last resort: unique prefix match ("cat-outdoor" → "Outdoor Living")
      var stem = s.indexOf(slug(prefix)) === 0 ? s.slice(slug(prefix).length + 1) : s;
      if (!stem) return null;
      var found = stems.filter(function (x) { return x.keys.some(function (k) { return k.indexOf(stem) === 0; }); });
      return found.length === 1 ? found[0].item : null;
    };
  }

  /**
   * normalize(config, {demo}) → a clean, fully-defaulted copy.
   * Precedence: explicit field > smart preset > default. `_presetApplied` is ignored.
   */
  function normalize(input, opts) {
    opts = opts || {};
    var src = clone(input) || {};
    var preset = PRESETS[String(src.smartPreset == null ? DEFAULTS.smartPreset : src.smartPreset).toLowerCase()] || {};
    var cfg = {};
    Object.keys(src).forEach(function (k) { cfg[k] = src[k]; }); // keep unknown keys
    Object.keys(DEFAULTS).forEach(function (k) {
      if (has(src[k]) && src[k] !== '' ) cfg[k] = src[k];
      else if (has(src[k]) && src[k] === '' && typeof DEFAULTS[k] === 'string') cfg[k] = src[k];
      else if (has(preset[k])) cfg[k] = preset[k];
      else cfg[k] = clone(DEFAULTS[k]);
    });
    delete cfg._presetApplied;

    // Scalars
    cfg.on = cfg.on === true;
    if (['simple', 'filtered', 'categories', 'categories-albums'].indexOf(cfg.structureMode) < 0) cfg.structureMode = 'simple';
    if (LAYOUTS.indexOf(cfg.layout) < 0) cfg.layout = 'smart-mosaic';
    cfg.columnsDesktop = int(cfg.columnsDesktop, 4, 2, 6);
    cfg.columnsTablet = int(cfg.columnsTablet, 3, 1, 4);
    cfg.columnsMobile = int(cfg.columnsMobile, 2, 1, 3);
    cfg.radius = int(cfg.radius, 12, 0, 48);
    var g = int(cfg.gap, DENSITY_GAP[cfg.density] || 12, 0, 64);
    // The old seeding saved gap:12 into every config, which made Density do nothing.
    // Untouched 12 + a non-balanced density → use the density's gap.
    if (g === 12 && DENSITY_GAP[cfg.density] != null && cfg.density !== 'balanced') g = DENSITY_GAP[cfg.density];
    cfg.gap = g;
    cfg.loadMoreCount = int(cfg.loadMoreCount, 16, 4, 200);
    cfg.virtualizeAt = int(cfg.virtualizeAt, 48, 12, 2000);
    cfg.autoplayDelay = int(cfg.autoplayDelay, 5000, 1500, 30000);
    cfg.collageRotation = int(cfg.collageRotation, 4, 0, 20);
    cfg.collageOverlap = int(cfg.collageOverlap, 12, 0, 40);
    cfg.mosaicSeed = int(cfg.mosaicSeed, 7, 1, 99999);
    ['showEyebrow', 'showTitle', 'showIntro', 'showCount', 'showBreadcrumb', 'showBack', 'lightboxOn', 'lightboxCaptions',
      'lightboxThumbnails', 'lightboxZoom', 'filtersEnabled', 'showAllTab', 'seoIndex', 'analyticsOn', 'autoLoad'].forEach(function (k) { cfg[k] = bool(cfg[k], true); });
    ['showSupporting', 'showBadge', 'showCta', 'filterMultiple', 'showFilterCounts', 'autoplay', 'lightboxDownloads'].forEach(function (k) { cfg[k] = bool(cfg[k], false); });
    cfg.mosaicLocked = bool(cfg.mosaicLocked, true);
    ['eyebrow', 'heading', 'intro', 'supporting', 'badge', 'ctaText', 'seoTitle', 'seoDescription'].forEach(function (k) { cfg[k] = str(cfg[k]); });
    cfg.coverImage = safeUrl(cfg.coverImage);

    // Categories
    var usedCat = {};
    var cats = (Array.isArray(cfg.categories) ? cfg.categories : []).filter(function (c) { return c && typeof c === 'object'; }).map(function (c, i) {
      var name = str(c.name || c.title || ('Category ' + (i + 1)));
      var id = str(c.id) || ('cat-' + (slug(name) || i));
      while (usedCat[id]) id += '-' + i; usedCat[id] = 1;
      return {
        id: id, _origId: str(c.id), on: c.on !== false && c.on !== 'false', name: name, eyebrow: str(c.eyebrow), intro: str(c.intro),
        cover: safeUrl(c.cover), slug: slug(c.slug || name) || id, badge: str(c.badge),
        seoTitle: str(c.seoTitle), seoDescription: str(c.seoDescription)
      };
    }).filter(function (c) { return c.on; });
    var findCat = resolver(cats, 'cat-', 'name');

    // Albums
    var usedAlb = {};
    var albums = (Array.isArray(cfg.albums) ? cfg.albums : []).filter(function (a) { return a && typeof a === 'object'; }).map(function (a, i) {
      var title = str(a.title || a.name || ('Album ' + (i + 1)));
      var id = str(a.id) || ('alb-' + (slug(title) || i));
      while (usedAlb[id]) id += '-' + i; usedAlb[id] = 1;
      var cat = findCat(a.categoryId);
      return {
        id: id, _origId: str(a.id), on: a.on !== false && a.on !== 'false', categoryId: cat ? cat.id : '', title: title, eyebrow: str(a.eyebrow),
        intro: str(a.intro), location: str(a.location), cover: safeUrl(a.cover), slug: slug(a.slug || title) || id,
        featured: bool(a.featured, false), tags: tagsOf(a.tags), seoTitle: str(a.seoTitle), seoDescription: str(a.seoDescription)
      };
    }).filter(function (a) { return a.on; });
    var findAlb = resolver(albums, 'alb-', 'title');

    // Images
    var usedImg = {};
    var images = (Array.isArray(cfg.images) ? cfg.images : []).map(function (im, i) {
      if (!im || typeof im !== 'object') return null;
      var srcUrl = safeUrl(im.src || im.url || im.image);
      if (!srcUrl) return null;
      if (im.on === false || im.on === 'false') return null;
      var id = str(im.id) || ('img-' + hash(srcUrl));
      while (usedImg[id]) id += '-' + i; usedImg[id] = 1;
      var w = int(im.width, 0, 0), h = int(im.height, 0, 0);
      var ratio = (w && h) ? w / h : (parseRatio(im.ratio) || ORIENT_RATIO[String(im.orientation || '')] || null);
      var alb = findAlb(im.albumId);
      var cat = findCat(im.categoryId) || (alb && alb.categoryId ? findCat(alb.categoryId) : null);
      var size = String(im.size || '').toLowerCase();
      if (size === 'feature') size = 'large';
      if (SIZES.indexOf(size) < 0) size = '';
      var title = str(im.title), alt = str(im.alt);
      // Filenames make poor alt text ("IMG_1234.jpg") — fall back to the title.
      if (/^(img|dsc|pxl|photo|image)?[_-]?\d{3,}[\w-]*\.(jpe?g|png|webp|heic|gif)$/i.test(alt) || /\.(jpe?g|png|webp|heic|gif)$/i.test(alt)) alt = '';
      return {
        id: id, _origId: str(im.id), index: i, src: srcUrl, alt: alt || title || str(im.caption).slice(0, 120), title: title, caption: str(im.caption),
        categoryId: cat ? cat.id : '', albumId: alb ? alb.id : '', tags: tagsOf(im.tags), featured: bool(im.featured, false),
        size: size, badge: str(im.badge), orientation: str(im.orientation), ratio: ratio, width: w || null, height: h || null,
        focalX: has(im.focalX) ? Math.max(0, Math.min(100, parseFloat(im.focalX))) : null,
        focalY: has(im.focalY) ? Math.max(0, Math.min(100, parseFloat(im.focalY))) : null
      };
    }).filter(Boolean);

    if (!images.length && opts.demo) images = demoImages();

    cfg.categories = cats; cfg.albums = albums; cfg.images = images;

    // Locked mosaic map (by id; old configs keyed some as img-<index>)
    var map = {};
    if (Array.isArray(cfg.mosaicLayout) && cfg.mosaicLocked !== false) {
      var byId = {}; images.forEach(function (im) { byId[im.id] = im; if (im._origId) byId[im._origId] = im; });
      cfg.mosaicLayout.forEach(function (row) {
        if (!row || !row.id) return;
        var target = byId[row.id];
        if (!target) { var m = String(row.id).match(/^img-(\d+)$/); if (m) target = images.filter(function (x) { return x.index === +m[1]; })[0]; }
        if (target) map[target.id] = row.size === 'feature' ? 'large' : row.size;
      });
    }
    cfg._mosaicMap = map;
    return cfg;
  }

  /** Marketplace-demo-only sample set (never used on a tenant site). */
  function demoImages() {
    var u = 'https://images.unsplash.com/';
    return [
      ['photo-1600585154340-be6161a56a0c', 1.5, 'Open-plan living'], ['photo-1552321554-5fefe8c9ef14', 0.67, 'Ensuite bath'],
      ['photo-1556912173-46c336c7fd55', 1.33, 'Island kitchen'], ['photo-1600607687939-ce8a6c25118c', 1, 'Timber detail'],
      ['photo-1600566753190-17f0baa2a6c3', 2.28, 'Courtyard panorama'], ['photo-1584622650111-993a426fbf0a', 0.73, 'Family bathroom'],
      ['photo-1600210492486-724fe5c67fb0', 1.5, 'Natural light living'], ['photo-1600585154526-990dced4db0d', 1.33, 'Entertaining deck'],
      ['photo-1556911220-bff31c812dba', 0.75, 'Open shelving'], ['photo-1507652313519-d4e9174996dd', 1.5, 'Spa bathroom']
    ].map(function (r, i) {
      var w = 1200, h = Math.round(w / r[1]);
      return { id: 'demo-' + i, index: i, src: u + r[0] + '?w=' + w + '&h=' + h + '&fit=crop&q=80', alt: r[2], title: r[2], caption: '', categoryId: '', albumId: '', tags: [], featured: i === 0, size: '', badge: '', orientation: '', ratio: r[1], width: w, height: h, focalX: null, focalY: null };
    });
  }

  /* ------------------------------------------------------------------ *
   * Layout maths (pure)                                                 *
   * ------------------------------------------------------------------ */
  /** Mosaic tile size class (compatible with the legacy algorithm). */
  function sizeFor(im, layout, seed, idx, map) {
    var sz = (map && map[im.id]) || im.size;
    if (sz) return sz === 'standard' ? '' : sz;
    var r = im.ratio;
    if (r && r >= 2.1) return 'full';
    if (layout === 'editorial') { var m = idx % 6; return m === 0 ? 'large' : m === 3 ? 'wide' : (m === 5 || (r && r < 0.9)) ? 'tall' : ''; }
    if (r && r < 0.9) return 'tall';
    if (im.featured) return (r && r >= 1.2) ? 'wide' : 'large';
    if (layout === 'random-mosaic' || layout === 'smart-mosaic' || layout === 'collage') {
      var n = ((seed || 7) * 31 + idx * 17) % 10;
      if (n === 0) return 'large';
      if ((n === 1 || n === 2) && (!r || r >= 1.1)) return 'wide';
      if ((n === 3) && (!r || r <= 1.1)) return 'tall';
    }
    return '';
  }

  /**
   * Justified rows. ratios[] → [{start, count, height}]
   * The last row is never stretched beyond the target height.
   */
  function justify(ratios, width, target, gap) {
    var rows = [], start = 0, sum = 0;
    var maxH = target * 1.6;
    for (var i = 0; i < ratios.length; i++) {
      var r = ratios[i] || 1.5;
      sum += r;
      var count = i - start + 1;
      var rowW = sum * target + gap * (count - 1);
      if (rowW >= width) {
        var h = (width - gap * (count - 1)) / sum;
        rows.push({ start: start, count: count, height: Math.min(h, maxH), full: true });
        start = i + 1; sum = 0;
      }
    }
    if (start < ratios.length) {
      var c = ratios.length - start;
      var hh = Math.min(target, (width - gap * (c - 1)) / sum);
      rows.push({ start: start, count: c, height: hh, full: false });
    }
    return rows;
  }

  /** Columns for a container width. */
  function colsFor(cfg, width) {
    if (width <= 640) return cfg.columnsMobile;
    if (width <= 1024) return cfg.columnsTablet;
    return cfg.columnsDesktop;
  }

  /* ------------------------------------------------------------------ *
   * View model (pure)                                                   *
   * ------------------------------------------------------------------ */
  function catById(cfg, id) { for (var i = 0; i < cfg.categories.length; i++) if (cfg.categories[i].id === id) return cfg.categories[i]; return null; }
  function albById(cfg, id) { for (var i = 0; i < cfg.albums.length; i++) if (cfg.albums[i].id === id) return cfg.albums[i]; return null; }

  /** Filter chips available for the current view. */
  function filterChips(cfg, pool) {
    var mode = cfg.structureMode;
    var on = mode === 'filtered' || (mode === 'simple' && cfg.filtersEnabled);
    if (!on) return [];
    var chips = [];
    var useCats = cfg.filterSource === 'categories' && cfg.categories.length && mode !== 'categories' && mode !== 'categories-albums';
    if (useCats) {
      cfg.categories.forEach(function (c) {
        var n = pool.filter(function (im) { return im.categoryId === c.id; }).length;
        if (n) chips.push({ key: 'cat:' + c.id, label: c.name, count: n });
      });
    } else {
      var counts = {}, order = [];
      pool.forEach(function (im) { im.tags.forEach(function (t) { if (!counts[t]) { counts[t] = 0; order.push(t); } counts[t]++; }); });
      order.forEach(function (t) { chips.push({ key: 'tag:' + t, label: t, count: counts[t] }); });
    }
    // only worth showing when at least one chip would actually narrow the set
    return chips.some(function (c) { return c.count < pool.length; }) ? chips : [];
  }

  function applyFilters(list, keys) {
    if (!keys || !keys.length) return list;
    return list.filter(function (im) {
      return keys.some(function (k) {
        if (k.indexOf('cat:') === 0) return im.categoryId === k.slice(4);
        if (k.indexOf('tag:') === 0) return im.tags.indexOf(k.slice(4)) >= 0;
        return false;
      });
    });
  }

  function viewModel(cfg, st) {
    var mode = cfg.structureMode, imgs = cfg.images;
    var vm = { kind: 'images', cards: null, images: imgs, title: cfg.heading, intro: cfg.intro, eyebrow: cfg.eyebrow, crumbs: [], chips: [], seoTitle: '', seoDescription: '' };
    var isCat = mode === 'categories' || mode === 'categories-albums';
    if (isCat && cfg.categories.length) {
      var uncats = imgs.filter(function (im) { return !im.categoryId; });
      if (st.view === 'root') {
        vm.kind = 'cards';
        vm.cards = cfg.categories.map(function (c) {
          var mine = imgs.filter(function (im) { return im.categoryId === c.id; });
          var aN = cfg.albums.filter(function (a) { return a.categoryId === c.id; }).length;
          return { kind: 'category', id: c.id, slug: c.slug, title: c.name, intro: c.intro, eyebrow: c.eyebrow, badge: c.badge,
            cover: c.cover || (mine[0] && mine[0].src) || '', count: mine.length,
            meta: (mode === 'categories-albums' && aN ? aN + (aN === 1 ? ' project · ' : ' projects · ') : '') + mine.length + (mine.length === 1 ? ' photo' : ' photos') };
        }).filter(function (c) { return c.count > 0 || c.cover; });
        if (uncats.length) vm.cards.push({ kind: 'category', id: '__other', slug: 'more', title: 'More work', intro: '', cover: uncats[0].src, count: uncats.length, meta: uncats.length + ' photos' });
      } else if (st.view === 'category') {
        var cat = st.categoryId === '__other' ? { id: '__other', name: 'More work', intro: '', slug: 'more' } : catById(cfg, st.categoryId);
        if (cat) {
          vm.title = cat.name; vm.intro = cat.intro || ''; vm.eyebrow = cat.eyebrow || cfg.eyebrow;
          vm.seoTitle = cat.seoTitle || ''; vm.seoDescription = cat.seoDescription || '';
          vm.crumbs = [{ label: cfg.heading || 'Gallery', nav: 'root' }, { label: cat.name }];
          var inCat = cat.id === '__other' ? uncats : imgs.filter(function (im) { return im.categoryId === cat.id; });
          var albs = mode === 'categories-albums' ? cfg.albums.filter(function (a) { return a.categoryId === cat.id; }) : [];
          if (albs.length) {
            vm.kind = 'cards';
            vm.cards = albs.map(function (a) {
              var mine = imgs.filter(function (im) { return im.albumId === a.id; });
              return { kind: 'album', id: a.id, slug: a.slug, title: a.title, intro: a.intro, eyebrow: a.eyebrow, cover: a.cover || (mine[0] && mine[0].src) || '',
                count: mine.length, meta: (a.location ? a.location + ' · ' : '') + mine.length + (mine.length === 1 ? ' photo' : ' photos') };
            });
            vm.loose = inCat.filter(function (im) { return !im.albumId; });
          } else vm.images = inCat;
        }
      } else if (st.view === 'album') {
        var alb = albById(cfg, st.albumId), c2 = alb ? catById(cfg, alb.categoryId) : null;
        if (alb) {
          vm.title = alb.title; vm.intro = alb.intro || ''; vm.eyebrow = alb.location || alb.eyebrow || (c2 && c2.name) || cfg.eyebrow;
          vm.seoTitle = alb.seoTitle || ''; vm.seoDescription = alb.seoDescription || '';
          vm.crumbs = [{ label: cfg.heading || 'Gallery', nav: 'root' }];
          if (c2) vm.crumbs.push({ label: c2.name, nav: 'category', id: c2.id });
          vm.crumbs.push({ label: alb.title });
          vm.images = imgs.filter(function (im) { return im.albumId === alb.id; });
        }
      }
    }
    if (vm.kind === 'images') {
      vm.chips = filterChips(cfg, vm.images);
      var valid = st.filters.filter(function (k) { return vm.chips.some(function (c) { return c.key === k; }); });
      vm.activeFilters = valid;
      vm.images = applyFilters(vm.images, valid);
    }
    return vm;
  }

  /* ------------------------------------------------------------------ *
   * URL state                                                           *
   * ------------------------------------------------------------------ */
  function readUrl(cfg) {
    if (!HAS_DOM || cfg.urlMode === 'none') return null;
    var parts = null;
    try {
      if (cfg.urlMode === 'query' || cfg.urlMode === 'path') {
        var q = new URLSearchParams(location.search).get('pg');
        if (q != null) parts = q.split('/').filter(Boolean);
        if (!parts && cfg.urlMode === 'path') {
          var segs = location.pathname.replace(/\/+$/, '').split('/').filter(Boolean), gi = segs.indexOf('gallery');
          if (gi >= 0 && gi < segs.length - 1) parts = segs.slice(gi + 1);
        }
      }
      if (!parts) {
        var h = String(location.hash || '').replace(/^#\/?/, '');
        if (/^(gallery|pg)(\/|$)/.test(h)) parts = h.replace(/^(gallery|pg)\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
      }
    } catch (e) { return null; }
    if (!parts) return null;
    if (!parts.length) return { view: 'root' };
    var cat = null, alb = null;
    cfg.categories.forEach(function (c) { if (!cat && (c.slug === parts[0] || c.id === parts[0])) cat = c; });
    if (!cat && parts[0] === 'more') cat = { id: '__other' };
    if (cat && parts[1]) cfg.albums.forEach(function (a) { if (!alb && a.categoryId === cat.id && (a.slug === parts[1] || a.id === parts[1])) alb = a; });
    if (alb) return { view: 'album', categoryId: cat.id, albumId: alb.id };
    if (cat) return { view: 'category', categoryId: cat.id };
    return { view: 'root' };
  }
  function urlFor(cfg, st) {
    if (!HAS_DOM) return '';
    var bits = [];
    if (st.view !== 'root') {
      var cat = st.categoryId === '__other' ? { slug: 'more' } : catById(cfg, st.categoryId);
      if (cat) bits.push(cat.slug);
      if (st.view === 'album') { var a = albById(cfg, st.albumId); if (a) bits.push(a.slug); }
    }
    var base = location.pathname;
    if (cfg.urlMode === 'query' || cfg.urlMode === 'path') {
      var sp = new URLSearchParams(location.search);
      if (bits.length) sp.set('pg', bits.join('/')); else sp.delete('pg');
      var qs = sp.toString();
      return base + (qs ? '?' + qs : '');
    }
    return base + location.search + (bits.length ? '#/gallery/' + bits.map(encodeURIComponent).join('/') : '');
  }

  /* ------------------------------------------------------------------ *
   * Browser rendering                                                   *
   * ------------------------------------------------------------------ */
  var reduceMotion = function () { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  var uid = 0;

  function track(cfg, name, props) {
    if (!cfg || cfg.analyticsOn === false) return;
    try { if (typeof window.trackEvent === 'function') window.trackEvent(name, Object.assign({ location: 'premiumGallery' }, props || {})); } catch (e) {}
  }

  function Gallery(node) {
    this.node = node;
    this.id = 'lpg' + (++uid);
    this.st = { view: 'root', categoryId: null, albumId: null, filters: [], shown: 0, slide: 0 };
    this.sig = '';
    this.cfg = null;
    this.ratios = {};
    this.hydrated = false;
    this.lb = null;
    this.baseTitle = HAS_DOM ? document.title : '';
    this._bind();
  }

  Gallery.prototype.update = function (raw, ctx) {
    ctx = ctx || {};
    this.ctx = ctx;
    var node = this.node;
    if (!raw || raw.on !== true) { this._hide(); return; }
    var cfg = normalize(raw, { demo: !!ctx.demo });
    var sig;
    try { sig = JSON.stringify(cfg); } catch (e) { sig = String(Math.random()); }
    if (sig === this.sig && node.querySelector('.lpg-root-inner')) return;
    this.sig = sig;
    this.cfg = cfg;
    this.preview = !!ctx.preview;
    node.classList.remove('lpg-void');
    // the template stylesheet hides this section until it is switched on
    if (node.style.display !== 'block') node.style.display = 'block';

    if (!this.hydrated) {
      var fromUrl = readUrl(cfg);
      if (fromUrl) { this.st.view = fromUrl.view; this.st.categoryId = fromUrl.categoryId || null; this.st.albumId = fromUrl.albumId || null; }
      this.hydrated = true;
    }
    // Drop state pointing at things that no longer exist
    if (this.st.view === 'album' && !albById(cfg, this.st.albumId)) { this.st.view = this.st.categoryId ? 'category' : 'root'; this.st.albumId = null; }
    if (this.st.view === 'category' && this.st.categoryId !== '__other' && !catById(cfg, this.st.categoryId)) { this.st.view = 'root'; this.st.categoryId = null; }

    if (!cfg.images.length) {
      if (this.preview) this._renderEmpty(); else this._hide(true);
      return;
    }
    this._applyVars();
    this._render();
    this._jsonLd();
  };

  Gallery.prototype._hide = function (keepOn) {
    var node = this.node;
    if (keepOn) { node.classList.add('lpg-void'); var r = node.querySelector('.pg-root'); if (r) r.innerHTML = ''; }
    else node.style.display = 'none';
    this.sig = '';
    if (this._io) { this._io.disconnect(); this._io = null; }
    this._stopAutoplay();
  };

  Gallery.prototype._host = function () {
    var host = this.node.querySelector('.pg-root');
    if (!host) { host = document.createElement('div'); host.className = 'pg-root'; this.node.appendChild(host); }
    return host;
  };

  Gallery.prototype._renderEmpty = function () {
    this._applyVars();
    this._host().innerHTML = '<div class="wrap lpg-root-inner"><div class="lpg-empty-state"><strong>Your gallery is ready for photos.</strong><span>Add images in the editor under Premium Gallery → Photos. This message only shows in the preview.</span></div></div>';
  };

  Gallery.prototype._applyVars = function () {
    var cfg = this.cfg, n = this.node;
    function set(k, v) { v = String(v == null ? '' : v).trim(); if (v) n.style.setProperty(k, v); else n.style.removeProperty(k); }
    n.style.setProperty('--pg-cols', String(cfg.columnsDesktop));
    n.style.setProperty('--pg-cols-tab', String(cfg.columnsTablet));
    n.style.setProperty('--pg-cols-mob', String(cfg.columnsMobile));
    n.style.setProperty('--pg-gap', cfg.gap + 'px');
    n.style.setProperty('--pg-radius', cfg.radius + 'px');
    n.style.setProperty('--lpg-rot', cfg.collageRotation + 'deg');
    n.style.setProperty('--lpg-overlap', cfg.collageOverlap + 'px');
    set('--pg-eyebrow', cfg.eyebrowColor); set('--pg-title', cfg.titleColor); set('--pg-intro', cfg.introColor);
    set('--pg-cap', cfg.captionColor); set('--pg-filter', cfg.filterColor); set('--pg-filter-active', cfg.activeFilterColor);
    set('--pg-badge-bg', cfg.badgeBg); set('--pg-badge-fg', cfg.badgeText);
    var keep = (n.className || '').split(/\s+/).filter(function (c) { return c && !/^(pg-|lpg-)/.test(c) && c !== 'section'; });
    keep.push('section', 'lpg', 'lpg-dense-' + cfg.density, 'lpg-hover-' + (cfg.hover === 'reveal-caption' ? 'caption' : cfg.hover), 'lpg-ov-' + cfg.overlay, 'lpg-size-' + cfg.imageSize);
    if (cfg.density === 'edge') keep.push('pg-edge', 'lpg-edge');
    if (cfg.columnsMobile === 1) keep.push('lpg-m1');
    if (cfg.columnsTablet === 1) keep.push('lpg-t1');
    if (cfg.seoIndex === false) n.setAttribute('data-nosnippet', ''); else n.removeAttribute('data-nosnippet');
    n.className = keep.join(' ');
  };

  /* ---------- full render (config change or navigation) ---------- */
  Gallery.prototype._render = function () {
    var cfg = this.cfg, st = this.st;
    var vm = this.vm = viewModel(cfg, st);
    st.filters = vm.activeFilters || [];
    if (!st.shown) st.shown = cfg.loadMoreCount;
    var host = this._host();
    var hl = cfg.headerLayout;
    var head = this._headHtml(vm);
    var filters = this._filtersHtml(vm);
    var html = '<div class="wrap lpg-root-inner" id="' + this.id + '">';
    if (hl === 'titleFilters') html += '<div class="lpg-head-row">' + head + filters + '</div>';
    else html += head + filters;
    html += '<div class="lpg-body" aria-live="polite"></div><div class="lpg-more-slot"></div></div>';
    host.innerHTML = html;
    this._renderBody();
    this._syncTitle(vm);
  };

  Gallery.prototype._headHtml = function (vm) {
    var cfg = this.cfg, st = this.st, hl = cfg.headerLayout;
    if (['centred', 'left', 'split', 'titleFilters', 'hero', 'minimal'].indexOf(hl) < 0) hl = 'centred';
    var style = '';
    if (hl === 'hero') {
      var cover = cfg.coverImage || (vm.cards && vm.cards[0] && vm.cards[0].cover) || (vm.images[0] && vm.images[0].src) || '';
      if (cover) style = ' style="background-image:url(&quot;' + esc(cdn(cover, 1600)) + '&quot;)"';
    }
    var h = '<header class="lpg-head lpg-h-' + hl + '"' + style + '><div class="lpg-head-text">';
    if (cfg.showBadge && cfg.badge) h += '<div class="lpg-badge">' + esc(cfg.badge) + '</div>';
    if (cfg.showEyebrow && vm.eyebrow) h += '<div class="lpg-eyebrow">' + esc(vm.eyebrow) + '</div>';
    if (cfg.showTitle && vm.title) h += '<h2 class="lpg-title">' + esc(vm.title) + '</h2>';
    h += '</div>';
    var side = '';
    if (cfg.showIntro && vm.intro) side += '<p class="lpg-intro">' + esc(vm.intro) + '</p>';
    if (cfg.showSupporting && cfg.supporting && st.view === 'root') side += '<p class="lpg-supporting">' + esc(cfg.supporting) + '</p>';
    var meta = [];
    if (cfg.showBack && st.view !== 'root') meta.push('<button type="button" class="lpg-back" data-lpg-back="1"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>Back</button>');
    if (cfg.showBreadcrumb && vm.crumbs.length) {
      meta.push('<nav class="lpg-crumbs" aria-label="Gallery breadcrumb"><ol>' + vm.crumbs.map(function (c, i) {
        var last = i === vm.crumbs.length - 1;
        return '<li>' + (last ? '<span aria-current="page">' + esc(c.label) + '</span>'
          : '<button type="button" data-lpg-nav="' + esc(c.nav) + '"' + (c.id ? ' data-lpg-id="' + esc(c.id) + '"' : '') + '>' + esc(c.label) + '</button>') + '</li>';
      }).join('') + '</ol></nav>');
    }
    if (cfg.showCount) {
      var label;
      if (vm.kind === 'cards') { var n = vm.cards.length; label = n + (st.view === 'root' ? (n === 1 ? ' category' : ' categories') : (n === 1 ? ' project' : ' projects')); }
      else label = vm.images.length + (vm.images.length === 1 ? ' photo' : ' photos');
      meta.push('<span class="lpg-count">' + esc(label) + '</span>');
    }
    if (meta.length) side += '<div class="lpg-meta">' + meta.join('') + '</div>';
    if (cfg.showCta && cfg.ctaText) side += '<a class="lpg-cta" href="' + esc(this._ctaHref()) + '" data-lpg-cta="1">' + esc(cfg.ctaText) + '</a>';
    if (side) h += '<div class="lpg-head-side">' + side + '</div>';
    return h + '</header>';
  };

  Gallery.prototype._ctaHref = function () {
    var cfg = this.cfg, ph = (this.ctx && this.ctx.phone) || '';
    if (!ph) { try { ph = (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG && SITE_CONFIG.phone) || ''; } catch (e) {} }
    if (cfg.ctaAction === 'call' && ph) return 'tel:' + String(ph).replace(/[^\d+]/g, '');
    var act = String(cfg.ctaAction || '');
    // page:<slug> or /<slug> → a landing page; prefix /<site> only when we are on the LeadPages address
    var pg = act.indexOf('page:') === 0 ? act.slice(5) : (/^\/[a-z0-9-]+\/?$/i.test(act) ? act.replace(/^\/|\/$/g, '') : '');
    if (pg) {
      var base = '';
      try { var sl = (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG && SITE_CONFIG.slug) || ''; if (sl && (location.pathname + '/').indexOf('/' + sl + '/') === 0) base = '/' + sl; } catch (e) {}
      return base + '/' + pg.replace(/[^a-z0-9-]/gi, '');
    }
    if (/^(https?:|#)/.test(act)) return act;
    return '#quote';
  };

  Gallery.prototype._filtersHtml = function (vm) {
    var cfg = this.cfg;
    if (vm.kind !== 'images' || !vm.chips.length) return '';
    var active = this.st.filters, total = 0;
    var pool = vm.kind === 'images' ? null : null;
    var style = ['pills', 'underlined', 'segmented'].indexOf(cfg.filterStyle) >= 0 ? cfg.filterStyle : 'pills';
    var h = '<div class="lpg-filters lpg-f-' + style + '" role="group" aria-label="Filter photos">';
    var allCount = 0; vm.chips.forEach(function (c) { allCount = Math.max(allCount, c.count); });
    if (cfg.showAllTab) {
      h += '<button type="button" class="lpg-chip' + (!active.length ? ' is-on' : '') + '" aria-pressed="' + (!active.length) + '" data-lpg-filter="">All' +
        (cfg.showFilterCounts ? ' <span class="lpg-chip-n">' + this._poolCount() + '</span>' : '') + '</button>';
    }
    vm.chips.forEach(function (c) {
      var on = active.indexOf(c.key) >= 0;
      h += '<button type="button" class="lpg-chip' + (on ? ' is-on' : '') + '" aria-pressed="' + on + '" data-lpg-filter="' + esc(c.key) + '">' + esc(c.label) +
        (cfg.showFilterCounts ? ' <span class="lpg-chip-n">' + c.count + '</span>' : '') + '</button>';
    });
    return h + '</div>';
  };
  Gallery.prototype._poolCount = function () {
    var st = this.st, saved = st.filters; st.filters = [];
    var n = viewModel(this.cfg, st).images.length; st.filters = saved; return n;
  };

  /* ---------- body ---------- */
  Gallery.prototype._renderBody = function () {
    var cfg = this.cfg, vm = this.vm, body = this.node.querySelector('.lpg-body');
    if (!body) return;
    this._stopAutoplay();
    if (this._io) { this._io.disconnect(); this._io = null; }
    var more = this.node.querySelector('.lpg-more-slot'); if (more) more.innerHTML = '';
    body.className = 'lpg-body';
    if (vm.kind === 'cards') {
      body.innerHTML = this._cardsHtml(vm.cards) + (vm.loose && vm.loose.length ? '<h3 class="lpg-sub">More photos</h3><div class="lpg-loose"></div>' : '');
      if (vm.loose && vm.loose.length) {
        this.list = vm.loose;
        var loose = body.querySelector('.lpg-loose');
        loose.className = 'lpg-loose lpg-grid lpg-ratio-43';
        loose.innerHTML = vm.loose.map(function (im, i) { return this._tile(im, i, 'grid'); }, this).join('');
      } else this.list = [];
      return;
    }
    this.list = vm.images;
    if (!vm.images.length) { body.innerHTML = '<div class="lpg-empty">No photos match these filters.</div>'; return; }
    var L = cfg.layout;
    body.classList.add('lpg-l-' + L);
    if (L === 'slideshow') return this._renderSlideshow(body);
    var slice = vm.images.slice(0, Math.min(this.st.shown, vm.images.length));
    this.rendered = slice.length;
    if (L === 'filmstrip') return this._renderFilmstrip(body, vm.images);
    body.innerHTML = '<div class="' + this._containerClass() + '">' + slice.map(function (im, i) { return this._tile(im, i, L); }, this).join('') + '</div>';
    this._layout();
    this._renderMore();
  };

  Gallery.prototype._containerClass = function () {
    var L = this.cfg.layout, r = this.cfg.ratio;
    var rc = { square: 'lpg-ratio-11', '4:5': 'lpg-ratio-45', '3:4': 'lpg-ratio-34', '4:3': 'lpg-ratio-43', '3:2': 'lpg-ratio-32', '16:9': 'lpg-ratio-169', '21:9': 'lpg-ratio-219' }[r] || 'lpg-ratio-43';
    if (L === 'grid') return 'lpg-tiles lpg-grid ' + rc;
    if (L === 'smart-mosaic' || L === 'random-mosaic' || L === 'editorial') return 'lpg-tiles lpg-mosaic';
    if (L === 'feature-grid') return 'lpg-tiles lpg-mosaic lpg-featuregrid';
    if (L === 'masonry') return 'lpg-tiles lpg-masonry';
    if (L === 'justified') return 'lpg-tiles lpg-justified';
    if (L === 'stacked') return 'lpg-tiles lpg-stacked';
    if (L === 'collage') return 'lpg-tiles lpg-collage';
    return 'lpg-tiles lpg-grid ' + rc;
  };

  Gallery.prototype._sizes = function () {
    var cfg = this.cfg, L = cfg.layout;
    if (L === 'stacked' || L === 'slideshow') return '(max-width: 1100px) 100vw, 1100px';
    if (L === 'justified' || L === 'filmstrip') return '(max-width: 640px) 70vw, 480px';
    var d = Math.round(100 / cfg.columnsDesktop), t = Math.round(100 / cfg.columnsTablet), m = Math.round(100 / cfg.columnsMobile);
    var big = (L === 'smart-mosaic' || L === 'random-mosaic' || L === 'editorial' || L === 'feature-grid') ? 2 : 1;
    return '(max-width: 640px) ' + Math.min(100, m * big) + 'vw, (max-width: 1024px) ' + Math.min(100, t * big) + 'vw, ' + Math.min(1240, Math.round(1240 * big / cfg.columnsDesktop)) + 'px';
  };

  Gallery.prototype._tile = function (im, i, L) {
    var cfg = this.cfg;
    var size = '';
    if (L === 'smart-mosaic' || L === 'random-mosaic' || L === 'editorial' || L === 'collage') size = sizeFor(im, L, cfg.mosaicSeed, i, cfg._mosaicMap);
    if (L === 'feature-grid') size = i === 0 ? 'large' : '';
    var r = this.ratios[im.id] || im.ratio;
    var style = [];
    if (r) style.push('--lpg-r:' + r.toFixed(4));
    if (im.focalX != null || im.focalY != null) style.push('--lpg-focus:' + (im.focalX == null ? 50 : im.focalX) + '% ' + (im.focalY == null ? 50 : im.focalY) + '%');
    if (L === 'collage') style.push('--lpg-tilt:' + (((i * 7) % 5) - 2) * cfg.collageRotation / 2 + 'deg');
    var full = cdn(im.src, 2048);
    var w = im.width || (r ? 1200 : ''), h = im.height || (r ? Math.round(1200 / r) : '');
    var lazy = i >= 4 ? ' loading="lazy"' : '';
    var ss = srcset(im.src);
    var cap = cfg.overlay === 'none' ? '' : (im.title || im.caption ? '<span class="lpg-cap">' + (im.title ? '<span class="lpg-cap-t">' + esc(im.title) + '</span>' : '') + (im.caption && im.caption !== im.title ? '<span class="lpg-cap-c">' + esc(im.caption) + '</span>' : '') + '</span>' : '');
    var label = (im.title || im.alt || 'Photo') + ' — open larger view';
    var cv = i >= cfg.virtualizeAt ? ' lpg-cv' : '';
    return '<a class="lpg-item' + (size ? ' lpg-s-' + size : '') + cv + (r ? '' : ' lpg-unk') + '" href="' + esc(full) + '" data-lpg-i="' + i + '" data-lpg-id="' + esc(im.id) + '"' +
      (cfg.lightboxOn ? ' aria-label="' + esc(label) + '"' : ' tabindex="-1" aria-hidden="true"') + (style.length ? ' style="' + esc(style.join(';')) + '"' : '') + '>' +
      '<span class="lpg-frame"><img src="' + esc(cdn(im.src, 800)) + '"' + (ss ? ' srcset="' + esc(ss) + '" sizes="' + esc(this._sizes()) + '"' : '') +
      ' alt="' + esc(im.alt) + '"' + (w && h ? ' width="' + w + '" height="' + h + '"' : '') + lazy + ' decoding="async" draggable="false"></span>' +
      (im.badge ? '<span class="lpg-ibadge">' + esc(im.badge) + '</span>' : '') + cap + '</a>';
  };

  Gallery.prototype._cardsHtml = function (cards) {
    var cfg = this.cfg, self = this;
    var lay = cfg.cardLayout === 'below' ? 'below' : 'overlay';
    return '<div class="lpg-cards lpg-cards-' + lay + '">' + cards.map(function (c, i) {
      var href = HAS_DOM ? urlFor(cfg, c.kind === 'category' ? { view: 'category', categoryId: c.id } : { view: 'album', categoryId: self.st.categoryId, albumId: c.id }) : '#';
      return '<a class="lpg-card" href="' + esc(href) + '" data-lpg-open="' + esc(c.kind) + '" data-lpg-id="' + esc(c.id) + '">' +
        '<span class="lpg-card-shot">' + (c.cover ? '<img src="' + esc(cdn(c.cover, 900)) + '"' + (srcset(c.cover) ? ' srcset="' + esc(srcset(c.cover)) + '" sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 420px"' : '') + ' alt=""' + (i > 2 ? ' loading="lazy"' : '') + ' decoding="async">' : '<span class="lpg-ph"></span>') + '</span>' +
        '<span class="lpg-card-body">' + (c.badge ? '<span class="lpg-card-badge">' + esc(c.badge) + '</span>' : '') +
        '<span class="lpg-card-title">' + esc(c.title) + '</span>' + (c.intro ? '<span class="lpg-card-intro">' + esc(c.intro) + '</span>' : '') +
        '<span class="lpg-card-meta">' + esc(c.meta) + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></span></a>';
    }).join('') + '</div>';
  };

  Gallery.prototype._renderMore = function () {
    var slot = this.node.querySelector('.lpg-more-slot'); if (!slot) return;
    var total = this.list.length, shown = this.rendered || 0;
    if (shown >= total) { slot.innerHTML = ''; if (this._io) { this._io.disconnect(); this._io = null; } return; }
    var left = total - shown;
    slot.innerHTML = '<div class="lpg-more"><button type="button" class="lpg-more-btn" data-lpg-more="1">Show ' + Math.min(left, this.cfg.loadMoreCount) + ' more <span>(' + left + ' left)</span></button></div>';
    if (this.cfg.autoLoad && 'IntersectionObserver' in window && !this.preview) {
      var self = this, btn = slot.querySelector('.lpg-more-btn');
      if (this._io) this._io.disconnect();
      this._io = new IntersectionObserver(function (en) {
        if (en.some(function (e) { return e.isIntersecting; }) && !self._loading) {
          self._loading = true;
          requestAnimationFrame(function () { self._more(false); self._loading = false; });
        }
      }, { rootMargin: '300px 0px' });
      this._io.observe(btn);
    }
  };

  /** Append the next page without rebuilding what is already on screen. */
  Gallery.prototype._more = function (focus) {
    var cfg = this.cfg, cont = this.node.querySelector('.lpg-tiles');
    if (!cont) return;
    var from = this.rendered, to = Math.min(this.list.length, from + cfg.loadMoreCount);
    if (to <= from) return;
    var frag = document.createElement('div'), L = cfg.layout;
    frag.innerHTML = this.list.slice(from, to).map(function (im, k) { return this._tile(im, from + k, L); }, this).join('');
    var first = frag.firstElementChild;
    while (frag.firstChild) cont.appendChild(frag.firstChild);
    this.rendered = to; this.st.shown = to;
    track(cfg, 'gallery_load_more', { shown: to });
    this._layout();
    this._renderMore();
    if (focus && first) try { first.focus({ preventScroll: false }); } catch (e) { first.focus(); }
  };

  /* ---------- layout passes that need measurements ---------- */
  Gallery.prototype._layout = function () {
    var L = this.cfg.layout, cont = this.node.querySelector('.lpg-tiles');
    if (!cont) return;
    if (L === 'justified') this._layoutJustified(cont);
    else if (L === 'masonry') this._layoutMasonry(cont);
  };

  Gallery.prototype._layoutJustified = function (cont) {
    var W = cont.clientWidth; if (!W) return;
    var cfg = this.cfg, gap = cfg.gap;
    var target = { small: 180, standard: 250, large: 340 }[cfg.imageSize] || 250;
    if (W < 640) target = Math.round(target * 0.68);
    var items = Array.prototype.slice.call(cont.querySelectorAll('.lpg-item'));
    var self = this;
    var ratios = items.map(function (el) { var id = el.getAttribute('data-lpg-id'); return self.ratios[id] || parseFloat(el.style.getPropertyValue('--lpg-r')) || 1.5; });
    var rows = justify(ratios, W, target, gap);
    rows.forEach(function (row) {
      var used = 0;
      for (var k = 0; k < row.count; k++) {
        var idx = row.start + k, el = items[idx];
        var w = ratios[idx] * row.height;
        if (row.full && k === row.count - 1) w = W - used - gap * (row.count - 1); // absorb rounding
        w = Math.max(40, Math.floor(w * 100) / 100);
        used += w;
        el.style.width = w + 'px';
        el.style.height = Math.round(row.height) + 'px';
      }
    });
  };

  Gallery.prototype._layoutMasonry = function (cont) {
    var W = cont.clientWidth; if (!W) return;
    var cfg = this.cfg, cols = colsFor(cfg, W), gap = cfg.gap;
    var colW = (W - gap * (cols - 1)) / cols, unit = 4, self = this;
    cont.style.setProperty('--lpg-mcols', String(cols));
    Array.prototype.forEach.call(cont.querySelectorAll('.lpg-item'), function (el) {
      var id = el.getAttribute('data-lpg-id');
      var r = self.ratios[id] || parseFloat(el.style.getPropertyValue('--lpg-r')) || 1.33;
      var h = colW / r;
      el.style.gridRowEnd = 'span ' + Math.max(1, Math.ceil((h + gap) / unit));
    });
  };

  /* ---------- filmstrip ---------- */
  Gallery.prototype._renderFilmstrip = function (body, list) {
    var L = 'filmstrip';
    this.rendered = list.length;
    body.innerHTML = '<div class="lpg-film-wrap"><button type="button" class="lpg-film-btn lpg-prev" data-lpg-film="-1" aria-label="Scroll back"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>' +
      '<div class="lpg-tiles lpg-film" tabindex="0" aria-label="Photo strip, scroll sideways">' + list.map(function (im, i) { return this._tile(im, i, L); }, this).join('') + '</div>' +
      '<button type="button" class="lpg-film-btn lpg-next" data-lpg-film="1" aria-label="Scroll forward"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button></div>';
  };

  /* ---------- slideshow ---------- */
  Gallery.prototype._renderSlideshow = function (body) {
    var cfg = this.cfg, list = this.list, st = this.st;
    st.slide = ((st.slide % list.length) + list.length) % list.length;
    var ratio = RATIO_VAL[cfg.ratio] || (16 / 9);
    var html = '<div class="lpg-show" role="region" aria-roledescription="carousel" aria-label="' + esc(this.vm.title || 'Gallery') + '" tabindex="0" style="--lpg-show-r:' + ratio.toFixed(4) + '">' +
      '<div class="lpg-show-stage">' + list.map(function (im, i) {
        var near = Math.abs(i - st.slide) <= 1 || i === list.length - 1 && st.slide === 0;
        return '<figure class="lpg-slide' + (i === st.slide ? ' is-on' : '') + '" aria-roledescription="slide" aria-label="' + (i + 1) + ' of ' + list.length + '"' + (i === st.slide ? '' : ' aria-hidden="true"') + ' data-lpg-i="' + i + '">' +
          '<img ' + (near ? 'src' : 'data-src') + '="' + esc(cdn(im.src, 1600)) + '"' + (srcset(im.src) ? ' ' + (near ? 'srcset' : 'data-srcset') + '="' + esc(srcset(im.src)) + '" sizes="(max-width:1100px) 100vw, 1100px"' : '') + ' alt="' + esc(im.alt) + '" decoding="async" draggable="false">' +
          ((im.title || im.caption) && cfg.overlay !== 'none' ? '<figcaption>' + esc(im.title || im.caption) + '</figcaption>' : '') + '</figure>';
      }).join('') + '</div>' +
      (list.length > 1 ? '<button type="button" class="lpg-show-btn lpg-prev" data-lpg-slide="-1" aria-label="Previous photo"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>' +
        '<button type="button" class="lpg-show-btn lpg-next" data-lpg-slide="1" aria-label="Next photo"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>' +
        '<div class="lpg-show-dots">' + (list.length <= 24 ? list.map(function (_, i) { return '<button type="button" data-lpg-goto="' + i + '" aria-label="Go to photo ' + (i + 1) + '"' + (i === st.slide ? ' aria-current="true"' : '') + '></button>'; }).join('') : '<span class="lpg-show-count">' + (st.slide + 1) + ' / ' + list.length + '</span>') + '</div>' +
        (cfg.autoplay ? '<button type="button" class="lpg-show-play" data-lpg-play="1" aria-label="Pause slideshow"><svg viewBox="0 0 24 24"><path d="M9 5v14M15 5v14"/></svg></button>' : '') : '') + '</div>';
    body.innerHTML = html;
    this._startAutoplay();
  };
  Gallery.prototype._go = function (to, user) {
    var list = this.list, st = this.st, n = list.length; if (!n) return;
    st.slide = ((to % n) + n) % n;
    var show = this.node.querySelector('.lpg-show'); if (!show) return;
    var slides = show.querySelectorAll('.lpg-slide');
    Array.prototype.forEach.call(slides, function (s, i) {
      var on = i === st.slide;
      s.classList.toggle('is-on', on);
      if (on) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
      if (Math.abs(i - st.slide) <= 1 || (st.slide === n - 1 && i === 0) || (st.slide === 0 && i === n - 1)) {
        var img = s.querySelector('img');
        if (img && img.getAttribute('data-src')) { if (img.getAttribute('data-srcset')) img.setAttribute('srcset', img.getAttribute('data-srcset')); img.src = img.getAttribute('data-src'); img.removeAttribute('data-src'); img.removeAttribute('data-srcset'); }
      }
    });
    Array.prototype.forEach.call(show.querySelectorAll('[data-lpg-goto]'), function (b, i) { if (i === st.slide) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    var ct = show.querySelector('.lpg-show-count'); if (ct) ct.textContent = (st.slide + 1) + ' / ' + n;
    if (user) { track(this.cfg, 'gallery_slideshow', { slide: st.slide }); this._stopAutoplay(); this._startAutoplay(); }
  };
  Gallery.prototype._startAutoplay = function () {
    var cfg = this.cfg, self = this;
    if (!cfg || !cfg.autoplay || cfg.layout !== 'slideshow' || this._paused || reduceMotion() || (this.list || []).length < 2) return;
    this._stopAutoplay();
    this._timer = setInterval(function () { if (document.hidden || self._hover) return; self._go(self.st.slide + 1, false); }, cfg.autoplayDelay);
  };
  Gallery.prototype._stopAutoplay = function () { if (this._timer) { clearInterval(this._timer); this._timer = null; } };

  /* ---------- navigation ---------- */
  Gallery.prototype._nav = function (next, push) {
    var cfg = this.cfg, st = this.st;
    st.view = next.view; st.categoryId = next.categoryId || null; st.albumId = next.albumId || null;
    st.filters = []; st.shown = cfg.loadMoreCount; st.slide = 0;
    if (push && cfg.urlMode !== 'none') { try { history.pushState({ lpg: this.id }, '', urlFor(cfg, st)); } catch (e) {} }
    this._render();
    var top = this.node.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.6) {
      try { this.node.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }); } catch (e) { this.node.scrollIntoView(); }
    }
    var t = this.node.querySelector('.lpg-title, .lpg-back');
    if (t) { t.setAttribute('tabindex', '-1'); try { t.focus({ preventScroll: true }); } catch (e) {} }
  };

  Gallery.prototype._syncTitle = function (vm) {
    if (!HAS_DOM || this.preview) return;
    if (this.st.view === 'root') { if (this._titled) { document.title = this.baseTitle; this._titled = false; } return; }
    var t = vm.seoTitle || vm.title;
    if (t) { document.title = t + (this.baseTitle ? ' | ' + this.baseTitle.split(/\s[|–-]\s/)[0] : ''); this._titled = true; }
  };

  Gallery.prototype._jsonLd = function () {
    if (!HAS_DOM || this.preview) return;
    var id = this.id + '-ld', old = document.getElementById(id);
    if (old) old.remove();
    var cfg = this.cfg;
    if (cfg.seoIndex === false || !cfg.images.length) return;
    var data = { '@context': 'https://schema.org', '@type': 'ImageGallery', name: cfg.seoTitle || cfg.heading || 'Gallery' };
    if (cfg.seoDescription || cfg.intro) data.description = cfg.seoDescription || cfg.intro;
    data.image = cfg.images.slice(0, 40).map(function (im) {
      var o = { '@type': 'ImageObject', contentUrl: cdn(im.src, 1600) };
      if (im.title) o.name = im.title; if (im.caption || im.alt) o.caption = im.caption || im.alt;
      if (im.width && im.height) { o.width = im.width; o.height = im.height; }
      return o;
    });
    var s = document.createElement('script'); s.type = 'application/ld+json'; s.id = id;
    s.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
    document.head.appendChild(s);
  };

  /* ---------- events (bound once, always read current this.cfg) ---------- */
  Gallery.prototype._bind = function () {
    var self = this, node = this.node;
    node.addEventListener('click', function (ev) {
      if (!self.cfg) return;
      var t = ev.target && ev.target.closest ? ev.target : null; if (!t) return;
      var el;
      if ((el = t.closest('[data-lpg-back]'))) {
        ev.preventDefault();
        var st = self.st;
        self._nav(st.view === 'album' && st.categoryId ? { view: 'category', categoryId: st.categoryId } : { view: 'root' }, true);
        track(self.cfg, 'gallery_nav', { action: 'back', view: self.st.view }); return;
      }
      if ((el = t.closest('[data-lpg-nav]'))) {
        ev.preventDefault();
        var to = el.getAttribute('data-lpg-nav');
        self._nav(to === 'category' ? { view: 'category', categoryId: el.getAttribute('data-lpg-id') } : { view: 'root' }, true); return;
      }
      if ((el = t.closest('[data-lpg-open]'))) {
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button === 1) return;
        ev.preventDefault();
        var kind = el.getAttribute('data-lpg-open'), id = el.getAttribute('data-lpg-id');
        if (kind === 'category') { self._nav({ view: 'category', categoryId: id }, true); track(self.cfg, 'gallery_category', { categoryId: id }); }
        else { self._nav({ view: 'album', categoryId: self.st.categoryId, albumId: id }, true); track(self.cfg, 'gallery_album', { albumId: id }); }
        return;
      }
      if ((el = t.closest('[data-lpg-filter]'))) {
        var key = el.getAttribute('data-lpg-filter'), f = self.st.filters.slice();
        if (!key) f = [];
        else if (self.cfg.filterMultiple) { var at = f.indexOf(key); if (at >= 0) f.splice(at, 1); else f.push(key); }
        else f = (f.length === 1 && f[0] === key) ? [] : [key];
        self.st.filters = f; self.st.shown = self.cfg.loadMoreCount;
        track(self.cfg, 'gallery_filter', { filter: f.join(',') || 'all' });
        self.vm = viewModel(self.cfg, self.st);
        // update chips in place so keyboard focus stays put
        Array.prototype.forEach.call(node.querySelectorAll('[data-lpg-filter]'), function (b) {
          var k = b.getAttribute('data-lpg-filter'), on = k ? f.indexOf(k) >= 0 : !f.length;
          b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on));
        });
        var cnt = node.querySelector('.lpg-count'); if (cnt) cnt.textContent = self.vm.images.length + (self.vm.images.length === 1 ? ' photo' : ' photos');
        self._renderBody(); return;
      }
      if ((el = t.closest('[data-lpg-more]'))) { self._more(true); return; }
      if ((el = t.closest('[data-lpg-slide]'))) { self._go(self.st.slide + parseInt(el.getAttribute('data-lpg-slide'), 10), true); return; }
      if ((el = t.closest('[data-lpg-goto]'))) { self._go(parseInt(el.getAttribute('data-lpg-goto'), 10), true); return; }
      if ((el = t.closest('[data-lpg-play]'))) {
        self._paused = !self._paused;
        el.setAttribute('aria-label', self._paused ? 'Play slideshow' : 'Pause slideshow');
        el.innerHTML = self._paused ? '<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M9 5v14M15 5v14"/></svg>';
        if (self._paused) self._stopAutoplay(); else self._startAutoplay(); return;
      }
      if ((el = t.closest('[data-lpg-film]'))) {
        var film = node.querySelector('.lpg-film');
        if (film) film.scrollBy({ left: parseInt(el.getAttribute('data-lpg-film'), 10) * film.clientWidth * 0.8, behavior: reduceMotion() ? 'auto' : 'smooth' });
        return;
      }
      if ((el = t.closest('[data-lpg-cta]'))) { track(self.cfg, 'cta_click', { action: 'gallery_cta' }); return; }
      if ((el = t.closest('.lpg-item, .lpg-slide'))) {
        if (!self.cfg.lightboxOn) { ev.preventDefault(); return; }
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button === 1) return;
        ev.preventDefault();
        var inLoose = !!el.closest('.lpg-loose');
        var list = inLoose && self.vm.loose ? self.vm.loose : self.list;
        var i = parseInt(el.getAttribute('data-lpg-i'), 10) || 0;
        track(self.cfg, 'gallery_image_click', { idx: i, imageId: list[i] && list[i].id });
        self._openLightbox(list, i, el);
      }
    });
    node.addEventListener('keydown', function (ev) {
      var show = ev.target && ev.target.closest && ev.target.closest('.lpg-show');
      if (show && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) { ev.preventDefault(); self._go(self.st.slide + (ev.key === 'ArrowRight' ? 1 : -1), true); }
    });
    node.addEventListener('mouseover', function (ev) { if (ev.target.closest && ev.target.closest('.lpg-show')) self._hover = true; });
    node.addEventListener('mouseout', function (ev) { if (ev.target.closest && ev.target.closest('.lpg-show') && !(ev.relatedTarget && ev.relatedTarget.closest && ev.relatedTarget.closest('.lpg-show'))) self._hover = false; });
    node.addEventListener('focusin', function (ev) { if (ev.target.closest && ev.target.closest('.lpg-show')) self._hover = true; });
    node.addEventListener('focusout', function (ev) { if (ev.target.closest && ev.target.closest('.lpg-show')) self._hover = false; });
    // swipe on the slideshow
    var sx = null, sy = 0;
    node.addEventListener('pointerdown', function (ev) { if (ev.target.closest && ev.target.closest('.lpg-show-stage')) { sx = ev.clientX; sy = ev.clientY; } });
    node.addEventListener('pointerup', function (ev) {
      if (sx == null) return; var dx = ev.clientX - sx, dy = ev.clientY - sy; sx = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) { self._swiped = Date.now(); self._go(self.st.slide + (dx < 0 ? 1 : -1), true); }
    });
    node.addEventListener('click', function (ev) { if (self._swiped && Date.now() - self._swiped < 400) { ev.stopPropagation(); ev.preventDefault(); } }, true);
    // learn real aspect ratios as images load; mark broken images
    node.addEventListener('load', function (ev) {
      var img = ev.target; if (!img || img.tagName !== 'IMG') return;
      var a = img.closest('.lpg-item'); if (!a) return;
      a.classList.add('is-loaded');
      var id = a.getAttribute('data-lpg-id');
      if (img.naturalWidth && img.naturalHeight) {
        var r = img.naturalWidth / img.naturalHeight, known = self.ratios[id] || parseFloat(a.style.getPropertyValue('--lpg-r'));
        if (!known || Math.abs(known - r) / r > 0.04) {
          self.ratios[id] = r; a.style.setProperty('--lpg-r', r.toFixed(4)); a.classList.remove('lpg-unk');
          self._relayoutSoon();
        }
      }
    }, true);
    node.addEventListener('error', function (ev) {
      var img = ev.target; if (!img || img.tagName !== 'IMG') return;
      var a = img.closest('.lpg-item, .lpg-card, .lpg-slide');
      if (img.getAttribute('srcset')) { img.removeAttribute('srcset'); return; } // retry without the CDN variants
      if (a) a.classList.add('lpg-broken');
    }, true);
    if (HAS_DOM && 'ResizeObserver' in window) {
      var last = 0;
      this._ro = new ResizeObserver(function (en) {
        var w = en[0] && en[0].contentRect ? Math.round(en[0].contentRect.width) : 0;
        if (w && w !== last) { last = w; self._relayoutSoon(); }
      });
      this._ro.observe(node);
    } else if (HAS_DOM) window.addEventListener('resize', function () { self._relayoutSoon(); });
    if (HAS_DOM) {
      this._onPop = function () {
        if (!self.cfg || !self.node.isConnected) return;
        if (self.lb && self.lb.open) { self._closeLightbox(true); return; }
        var s = readUrl(self.cfg) || { view: 'root' };
        if (s.view !== self.st.view || (s.categoryId || null) !== self.st.categoryId || (s.albumId || null) !== self.st.albumId) self._nav(s, false);
      };
      window.addEventListener('popstate', this._onPop);
    }
  };
  Gallery.prototype._relayoutSoon = function () {
    var self = this;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(function () { self._raf = 0; if (self.cfg) self._layout(); });
  };

  /* ------------------------------------------------------------------ *
   * Lightbox                                                            *
   * ------------------------------------------------------------------ */
  Gallery.prototype._buildLightbox = function () {
    var lb = document.createElement('div');
    lb.className = 'lpg-lb';
    lb.id = this.id + '-lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Photo viewer');
    lb.hidden = true;
    lb.innerHTML =
      '<div class="lpg-lb-top"><span class="lpg-lb-count" aria-live="polite"></span><span class="lpg-lb-tools">' +
      '<button type="button" class="lpg-lb-btn" data-lb="zoom" aria-label="Zoom in" aria-pressed="false"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/></svg></button>' +
      '<a class="lpg-lb-btn" data-lb="download" aria-label="Download photo" download target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg></a>' +
      '<button type="button" class="lpg-lb-btn" data-lb="close" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></span></div>' +
      '<div class="lpg-lb-stage"><div class="lpg-lb-pan"><img class="lpg-lb-img" alt="" draggable="false"></div><div class="lpg-lb-spin" aria-hidden="true"></div></div>' +
      '<button type="button" class="lpg-lb-nav lpg-lb-prev" data-lb="prev" aria-label="Previous photo"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>' +
      '<button type="button" class="lpg-lb-nav lpg-lb-next" data-lb="next" aria-label="Next photo"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>' +
      '<div class="lpg-lb-foot"><div class="lpg-lb-cap"></div><div class="lpg-lb-thumbs" role="tablist" aria-label="Photos"></div></div>';
    document.body.appendChild(lb);
    var self = this;
    var L = this.lb = { el: lb, open: false, list: [], i: 0, scale: 1, x: 0, y: 0 };
    L.img = lb.querySelector('.lpg-lb-img');
    L.pan = lb.querySelector('.lpg-lb-pan');
    L.stage = lb.querySelector('.lpg-lb-stage');

    lb.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-lb]');
      if (b) {
        var a = b.getAttribute('data-lb');
        if (a === 'close') { self._closeLightbox(); return; }
        if (a === 'next') { self._lbGo(L.i + 1); return; }
        if (a === 'prev') { self._lbGo(L.i - 1); return; }
        if (a === 'zoom') { self._lbZoom(L.scale > 1 ? 1 : 2.5); return; }
        return;
      }
      var th = ev.target.closest('[data-lbi]'); if (th) { self._lbGo(parseInt(th.getAttribute('data-lbi'), 10)); return; }
      if (ev.target === L.stage || ev.target === lb) { if (!L.moved) self._closeLightbox(); }
    });
    // pointer: swipe / pan / pinch / double-tap
    var pts = {}, startDist = 0, startScale = 1, sx = 0, sy = 0, ox = 0, oy = 0, lastTap = 0;
    L.stage.addEventListener('pointerdown', function (ev) {
      pts[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      try { L.stage.setPointerCapture(ev.pointerId); } catch (e) {}
      var ids = Object.keys(pts);
      L.moved = false;
      if (ids.length === 2) {
        var a = pts[ids[0]], b = pts[ids[1]];
        startDist = Math.hypot(a.x - b.x, a.y - b.y); startScale = L.scale;
      } else { sx = ev.clientX; sy = ev.clientY; ox = L.x; oy = L.y; }
    });
    L.stage.addEventListener('pointermove', function (ev) {
      if (!pts[ev.pointerId]) return;
      pts[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      var ids = Object.keys(pts);
      if (ids.length === 2 && self.cfg.lightboxZoom) {
        var a = pts[ids[0]], b = pts[ids[1]];
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        if (startDist) { L.scale = Math.max(1, Math.min(4, startScale * d / startDist)); L.moved = true; self._lbApply(); }
        return;
      }
      var dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) L.moved = true;
      if (L.scale > 1) { L.x = ox + dx; L.y = oy + dy; self._lbApply(); }
      else if (L.moved) { L.pan.style.transform = 'translate3d(' + dx + 'px,' + (Math.abs(dy) > Math.abs(dx) ? Math.max(0, dy) : 0) + 'px,0)'; L.pan.style.transition = 'none'; L.pan.style.opacity = String(1 - Math.min(0.5, Math.max(0, dy) / 400)); }
    });
    function up(ev) {
      if (!pts[ev.pointerId]) return;
      var n = Object.keys(pts).length;
      delete pts[ev.pointerId];
      if (n === 2) { startDist = 0; if (L.scale < 1.05) self._lbZoom(1); return; }
      var dx = ev.clientX - sx, dy = ev.clientY - sy;
      L.pan.style.transition = ''; L.pan.style.opacity = '';
      if (L.scale > 1) { self._lbClamp(); return; }
      if (L.moved && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { self._lbGo(L.i + (dx < 0 ? 1 : -1)); }
      else if (L.moved && dy > 110 && Math.abs(dy) > Math.abs(dx)) { self._closeLightbox(); }
      else {
        L.pan.style.transform = '';
        if (!L.moved && ev.target === L.img) {
          var now = Date.now();
          if (now - lastTap < 300 && self.cfg.lightboxZoom) { self._lbZoom(2.5, ev.clientX, ev.clientY); lastTap = 0; }
          else lastTap = now;
        }
      }
      setTimeout(function () { L.moved = false; }, 0);
    }
    L.stage.addEventListener('pointerup', up);
    L.stage.addEventListener('pointercancel', up);
    L.stage.addEventListener('wheel', function (ev) {
      if (!self.cfg.lightboxZoom) return;
      if (ev.ctrlKey || L.scale > 1) {
        ev.preventDefault();
        var s = Math.max(1, Math.min(4, L.scale * (ev.deltaY < 0 ? 1.15 : 0.87)));
        self._lbZoom(s, ev.clientX, ev.clientY);
      }
    }, { passive: false });
    L.img.addEventListener('load', function () { lb.classList.remove('is-loading'); });
    L.img.addEventListener('error', function () { lb.classList.remove('is-loading'); lb.classList.add('is-broken'); });
    this._lbKey = function (ev) {
      if (!L.open) return;
      if (ev.key === 'Escape') { ev.preventDefault(); if (L.scale > 1) self._lbZoom(1); else self._closeLightbox(); }
      else if (ev.key === 'ArrowRight') { ev.preventDefault(); self._lbGo(L.i + 1); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); self._lbGo(L.i - 1); }
      else if (ev.key === 'Home') { ev.preventDefault(); self._lbGo(0); }
      else if (ev.key === 'End') { ev.preventDefault(); self._lbGo(L.list.length - 1); }
      else if ((ev.key === '+' || ev.key === '=') && self.cfg.lightboxZoom) self._lbZoom(Math.min(4, L.scale * 1.5));
      else if (ev.key === '-' && self.cfg.lightboxZoom) self._lbZoom(Math.max(1, L.scale / 1.5));
      else if (ev.key === 'Tab') {
        var f = Array.prototype.filter.call(lb.querySelectorAll('button, a[href]'), function (x) { return x.offsetParent !== null && !x.disabled; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
        else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
        else if (!lb.contains(document.activeElement)) { ev.preventDefault(); first.focus(); }
      }
    };
  };

  Gallery.prototype._openLightbox = function (list, i, opener) {
    if (!list || !list.length) return;
    // The editor preview iframe auto-sizes to its content, so a fixed overlay
    // would not be visible there — the lightbox is a live-site feature.
    if (this.preview && document.documentElement.classList.contains('lp-preview-mode')) return;
    if (!this.lb) this._buildLightbox();
    var L = this.lb, cfg = this.cfg, lb = L.el;
    L.list = list.slice(); L.opener = opener || document.activeElement;
    lb.classList.toggle('lpg-lb-light', cfg.lightboxStyle === 'light');
    lb.classList.toggle('lpg-lb-nothumbs', !cfg.lightboxThumbnails || list.length < 2);
    lb.classList.toggle('lpg-lb-single', list.length < 2);
    lb.querySelector('[data-lb="zoom"]').hidden = !cfg.lightboxZoom;
    lb.querySelector('[data-lb="download"]').hidden = !cfg.lightboxDownloads;
    var th = lb.querySelector('.lpg-lb-thumbs');
    th.innerHTML = cfg.lightboxThumbnails && list.length > 1 ? list.map(function (im, k) {
      return '<button type="button" role="tab" data-lbi="' + k + '" aria-label="Photo ' + (k + 1) + '"><img src="' + esc(cdn(im.src, 180)) + '" alt="" loading="lazy" decoding="async"></button>';
    }).join('') : '';
    // scroll lock that does not shift the page
    var sw = window.innerWidth - document.documentElement.clientWidth;
    this._prevOverflow = document.documentElement.style.overflow;
    this._prevPad = document.body.style.paddingRight;
    document.documentElement.style.overflow = 'hidden';
    if (sw > 0) document.body.style.paddingRight = sw + 'px';
    lb.hidden = false;
    // force reflow for the fade-in
    void lb.offsetWidth;
    lb.classList.add('is-open');
    L.open = true;
    document.addEventListener('keydown', this._lbKey, true);
    try { history.pushState({ lpgLb: this.id, from: history.state }, '', location.href); L.pushed = true; } catch (e) { L.pushed = false; }
    this._lbGo(i, true);
    var close = lb.querySelector('[data-lb="close"]'); if (close) close.focus();
    track(cfg, 'gallery_lightbox', { idx: i, imageId: list[i] && list[i].id });
  };

  Gallery.prototype._lbGo = function (i, first) {
    var L = this.lb, cfg = this.cfg, n = L.list.length; if (!n) return;
    L.i = ((i % n) + n) % n;
    var im = L.list[L.i], lb = L.el;
    this._lbZoom(1);
    L.pan.style.transform = '';
    lb.classList.remove('is-broken');
    var src = cdn(im.src, 2048), ss = srcset(im.src);
    if (L.img.getAttribute('data-src') !== src) {
      lb.classList.add('is-loading');
      L.img.removeAttribute('srcset');
      L.img.setAttribute('data-src', src);
      if (ss) { L.img.setAttribute('sizes', '100vw'); L.img.setAttribute('srcset', ss); }
      L.img.src = src;
      if (L.img.complete && L.img.naturalWidth) lb.classList.remove('is-loading');
    }
    L.img.alt = im.alt || '';
    var cap = lb.querySelector('.lpg-lb-cap');
    if (cfg.lightboxCaptions && (im.title || im.caption)) {
      cap.innerHTML = (im.title ? '<strong>' + esc(im.title) + '</strong>' : '') + (im.caption && im.caption !== im.title ? '<span>' + esc(im.caption) + '</span>' : '');
      cap.hidden = false;
    } else { cap.innerHTML = ''; cap.hidden = true; }
    lb.querySelector('.lpg-lb-count').textContent = (L.i + 1) + ' / ' + n;
    var dl = lb.querySelector('[data-lb="download"]');
    if (dl) dl.setAttribute('href', cdn(im.src, 0, 'fl_attachment') || im.src);
    var thumbs = lb.querySelectorAll('[data-lbi]');
    Array.prototype.forEach.call(thumbs, function (b, k) {
      var on = k === L.i;
      b.classList.toggle('is-on', on); b.setAttribute('aria-selected', String(on));
      if (on && b.scrollIntoView) { try { b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: first || reduceMotion() ? 'auto' : 'smooth' }); } catch (e) {} }
    });
    // preload neighbours
    [L.i + 1, L.i - 1].forEach(function (k) {
      var nb = L.list[((k % n) + n) % n]; if (!nb) return;
      var p = new Image(); p.decoding = 'async'; p.src = cdn(nb.src, 2048);
    });
    if (!first) track(cfg, 'gallery_nav', { action: 'lightbox', idx: L.i });
  };

  Gallery.prototype._lbZoom = function (s, cx, cy) {
    var L = this.lb; if (!L) return;
    var prev = L.scale;
    L.scale = s;
    if (s <= 1) { L.scale = 1; L.x = 0; L.y = 0; }
    else if (cx != null) {
      var r = L.stage.getBoundingClientRect();
      var px = cx - (r.left + r.width / 2), py = cy - (r.top + r.height / 2);
      L.x = (L.x - px) * (s / prev) + px; L.y = (L.y - py) * (s / prev) + py;
    }
    this._lbClamp();
    var z = L.el.querySelector('[data-lb="zoom"]');
    if (z) { z.setAttribute('aria-pressed', String(L.scale > 1)); z.setAttribute('aria-label', L.scale > 1 ? 'Zoom out' : 'Zoom in'); }
    L.el.classList.toggle('is-zoomed', L.scale > 1);
  };
  Gallery.prototype._lbClamp = function () {
    var L = this.lb, r = L.stage.getBoundingClientRect();
    var mx = Math.max(0, (r.width * (L.scale - 1)) / 2), my = Math.max(0, (r.height * (L.scale - 1)) / 2);
    L.x = Math.max(-mx, Math.min(mx, L.x)); L.y = Math.max(-my, Math.min(my, L.y));
    this._lbApply();
  };
  Gallery.prototype._lbApply = function () {
    var L = this.lb;
    L.img.style.transform = L.scale > 1 ? 'translate3d(' + L.x + 'px,' + L.y + 'px,0) scale(' + L.scale + ')' : '';
  };

  Gallery.prototype._closeLightbox = function (fromPop) {
    var L = this.lb; if (!L || !L.open) return;
    L.open = false;
    var lb = L.el;
    lb.classList.remove('is-open');
    document.removeEventListener('keydown', this._lbKey, true);
    document.documentElement.style.overflow = this._prevOverflow || '';
    document.body.style.paddingRight = this._prevPad || '';
    setTimeout(function () { if (!L.open) lb.hidden = true; }, reduceMotion() ? 0 : 220);
    if (!fromPop && L.pushed && history.state && history.state.lpgLb === this.id) { try { history.back(); } catch (e) {} }
    L.pushed = false;
    if (L.opener && document.contains(L.opener)) { try { L.opener.focus({ preventScroll: true }); } catch (e) { L.opener.focus(); } }
  };

  Gallery.prototype.destroy = function () {
    this._hide();
    if (this._ro) this._ro.disconnect();
    if (this._onPop) window.removeEventListener('popstate', this._onPop);
    if (this.lb) { this._closeLightbox(true); this.lb.el.remove(); this.lb = null; }
    var ld = document.getElementById(this.id + '-ld'); if (ld) ld.remove();
    this.node.__lpg = null;
  };

  /* ------------------------------------------------------------------ *
   * Public API                                                          *
   * ------------------------------------------------------------------ */
  function mount(node, config, ctx) {
    if (!HAS_DOM || !node) return null;
    ctx = ctx || {};
    if (ctx.preview == null) { try { ctx.preview = /[?&]preview=/.test(location.search); } catch (e) { ctx.preview = false; } }
    var inst = node.__lpg;
    if (!inst) { inst = new Gallery(node); node.__lpg = inst; }
    inst.update(config, ctx);
    return inst;
  }
  function unmount(node) { if (node && node.__lpg) node.__lpg.destroy(); }

  return {
    version: VERSION,
    DEFAULTS: DEFAULTS,
    PRESETS: PRESETS,
    LAYOUTS: LAYOUTS,
    normalize: normalize,
    viewModel: viewModel,
    sizeFor: sizeFor,
    justify: justify,
    colsFor: colsFor,
    cdn: cdn,
    srcset: srcset,
    safeUrl: safeUrl,
    esc: esc,
    slug: slug,
    mount: mount,
    unmount: unmount
  };
});
