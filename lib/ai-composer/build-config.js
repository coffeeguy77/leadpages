'use strict';

/**
 * Validate the model's field values and assemble a brand-new sites.config.
 *
 * - Only paths from the app catalogue are written (no arbitrary keys).
 * - Photo ids ("p3") become Cloudinary crops from the plan; URLs from the model are ignored.
 * - Every known section that was not chosen is switched off, so no trade-template
 *   default sections appear on the new site.
 */

const { getApp, HERO_APPS, allKnownSectionKeys, isIconName } = require('./catalogue');
const { normHex } = require('./plan');
const { resolveSectionOrder } = require('../section-order');

const MAX_SCALAR = 2000;
const MAX_ITEM_TEXT = 1500;
/** Footer lines that otherwise default to LeadPages platform wording. */
const FOOTER_NEUTRAL = {
  taglineLead: '',
  taglineAccent: '',
  supportTitle: 'Get in touch', // '' would fall back to "Australian support"
  supportHelp: ''
};
/** Quote form wording that otherwise defaults to trade / Canberra examples. */
const QUOTE_NEUTRAL = {
  formTitle: 'Send an enquiry',
  lblJob: 'What do you need?',
  suburbPh: 'Your suburb',
  detailPh: 'A few details help us reply faster.',
  button: 'Send enquiry',
  fineText: '',
  successTitle: 'Thanks — we’ll be in touch',
  successSub: 'We usually reply within one business day.'
};
const QUOTE_JOB_OPTIONS = ['General enquiry', 'Quote request', 'Booking', 'Something else'];
/** Headline / body copy fields that must never show template default text. */
const COPY_FIELD_RE = /^(eyebrow|title|titleHl|heading|sub|subText|intro|body|content|blurb|h1|h2|caption|quote|quoteAttr|text|description|disclaimer|highlightText|bandHeading|bandSub|bandTagline|ctaTitle|ctaSub|suburbs)$/;

function cleanText(v, max) {
  if (v == null) return '';
  if (typeof v !== 'string' && typeof v !== 'number') return '';
  return String(v).replace(/\u0000/g, '').trim().slice(0, max);
}

/** "A, B\nC" or ["A","B"] → ['A','B','C'] (max 30, trimmed, no blanks). */
function toStringList(v) {
  const arr = Array.isArray(v) ? v : String(v == null ? '' : v).split(/[\n,;·|]+/);
  return arr.map(function (x) { return cleanText(x, 80); }).filter(Boolean).slice(0, 30);
}

/** Relative luminance (0 dark … 1 light) of a #rrggbb colour. */
function luminance(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (c) {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** WCAG contrast ratio between two colours. */
function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** A layout choice must be one of the field's own option values. */
function choiceValue(field, v) {
  const val = String(v == null ? '' : v).trim();
  return field.options && field.options.indexOf(val) >= 0 ? val : '';
}

/** An icon field must be a LeadPages icon name (icons.js). */
function iconValue(v) {
  const n = String(v == null ? '' : v).trim();
  return isIconName(n) ? n : '';
}

function setPath(obj, path, value) {
  const parts = String(path).split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!cur[k] || typeof cur[k] !== 'object' || Array.isArray(cur[k])) cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

function getPath(obj, path) {
  return String(path).split('.').reduce(function (o, k) {
    return o && typeof o === 'object' ? o[k] : undefined;
  }, obj);
}

/**
 * @param {Record<string,string>} photoUrls  id → url
 * @param {unknown} v
 */
function resolvePhoto(photoUrls, v) {
  const id = String(v == null ? '' : v).trim();
  return photoUrls[id] || '';
}

/**
 * Clean one app's values from the fill call.
 * @param {string} appKey
 * @param {{ fields?: object, lists?: object }} raw
 * @param {Record<string,string>} photoUrls
 * @returns {{ scalars: Record<string, string>, lists: Record<string, object[]> }}
 */
function normalizeAppValues(appKey, raw, photoUrls) {
  const app = getApp(appKey);
  const out = { scalars: {}, lists: {} };
  if (!app || !raw || typeof raw !== 'object') return out;
  const fields = raw.fields && typeof raw.fields === 'object' ? raw.fields : {};
  const lists = raw.lists && typeof raw.lists === 'object' ? raw.lists : {};

  app.scalars.forEach(function (s) {
    if (!Object.prototype.hasOwnProperty.call(fields, s.path)) return;
    const v = fields[s.path];
    if (s.split) {
      out.scalars[s.path] = toStringList(v);
    } else if (s.kind === 'choice') {
      const c = choiceValue(s, v);
      if (c) out.scalars[s.path] = c;
    } else if (s.kind === 'icon') {
      const ic = iconValue(v);
      if (ic) out.scalars[s.path] = ic;
    } else if (s.kind === 'image') {
      out.scalars[s.path] = resolvePhoto(photoUrls, v);
    } else if (s.kind === 'color') {
      const hex = normHex(v);
      if (hex) out.scalars[s.path] = hex;
    } else {
      out.scalars[s.path] = cleanText(v, MAX_SCALAR);
    }
  });

  app.lists.forEach(function (l) {
    const items = lists[l.path];
    if (!Array.isArray(items)) return;
    const cleaned = [];
    items.slice(0, l.maxItems).forEach(function (item) {
      if (!item || typeof item !== 'object') return;
      const o = {};
      let any = false;
      l.fields.forEach(function (f) {
        if (!Object.prototype.hasOwnProperty.call(item, f.name)) return;
        if (f.kind === 'choice' || f.kind === 'icon') {
          const c = f.kind === 'icon' ? iconValue(item[f.name]) : choiceValue(f, item[f.name]);
          if (c) o[f.name] = c;
          return; // a layout choice or icon alone does not make an item
        }
        const val = f.kind === 'image'
          ? resolvePhoto(photoUrls, item[f.name])
          : cleanText(item[f.name], MAX_ITEM_TEXT);
        o[f.name] = val;
        if (val) any = true;
      });
      if (any) cleaned.push(o);
    });
    if (cleaned.length) out.lists[l.path] = cleaned;
  });
  return out;
}

/**
 * Normalise a whole fill-call response for the sections in that batch.
 * @param {object} raw model output { apps: [...] }
 * @param {object[]} batchSections plan sections in this call
 * @param {object} plan sanitised plan
 */
function normalizeFill(raw, batchSections, plan) {
  const photoUrls = {};
  (plan.photos || []).forEach(function (p) { photoUrls[p.id] = p.url; });
  const byKey = {};
  (raw && Array.isArray(raw.apps) ? raw.apps : []).forEach(function (a) {
    if (a && a.appKey && !byKey[a.appKey]) byKey[a.appKey] = a;
  });
  return batchSections.map(function (s) {
    const values = normalizeAppValues(s.appKey, byKey[s.appKey], photoUrls);
    return {
      sectionId: s.id,
      appKey: s.appKey,
      filled: Object.keys(values.scalars).length + Object.keys(values.lists).length > 0,
      scalars: values.scalars,
      lists: values.lists
    };
  });
}

function phoneDigits(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  const plus = t[0] === '+' ? '+' : '';
  return plus + t.replace(/[^0-9]/g, '');
}

/**
 * Assemble the new site's config.
 * @param {object} plan sanitised plan
 * @param {{ sectionId: string, appKey: string, scalars: object, lists: object }[]} fills
 * @param {{ businessName?: string, now?: string }} [opts]
 */
function buildSiteConfig(plan, fills, opts) {
  opts = opts || {};
  const businessName = String(opts.businessName || plan.businessName || 'New site').trim().slice(0, 120);
  const cfg = {
    name: businessName,
    businessName: businessName,
    trade: '',
    sections: {},
    sectionOrder: []
  };
  if (plan.phone) {
    cfg.phoneText = plan.phone;
    cfg.phone = phoneDigits(plan.phone);
  }
  if (plan.email) cfg.email = plan.email;
  if (plan.seoTitle) cfg.seoTitle = plan.seoTitle;
  if (plan.seoDescription) cfg.seoDescription = plan.seoDescription;
  if (plan.theme && Object.keys(plan.theme).length) cfg.theme = Object.assign({}, plan.theme);
  if (plan.logo && plan.logo.url) {
    cfg.logo = { mode: 'image', imageUrl: plan.logo.url, text: businessName };
  }

  // Switch every known section off first — nothing from the trade template shows
  // unless the plan chose it.
  allKnownSectionKeys().forEach(function (k) { cfg.sections[k] = { on: false }; });

  const fillsById = {};
  (fills || []).forEach(function (f) { if (f && f.sectionId) fillsById[f.sectionId] = f; });
  // Only crops of this design (rebuilt server-side in the sanitised plan) may be used as images.
  const allowedImages = {};
  (plan.photos || []).forEach(function (p) { if (p.url) allowedImages[p.url] = true; });
  function imageOk(v) {
    const u = String(v == null ? '' : v);
    return allowedImages[u] ? u : '';
  }
  function cleanScalar(field, v) {
    if (field.split) return toStringList(v);
    if (field.kind === 'choice') return choiceValue(field, v);
    if (field.kind === 'icon') return iconValue(v);
    if (field.kind === 'image') return imageOk(v);
    if (field.kind === 'color') return normHex(v);
    return cleanText(v, MAX_SCALAR);
  }

  const order = [];
  const removed = [];
  let heroKey = null;
  (plan.sections || []).forEach(function (s) {
    const app = getApp(s.appKey);
    if (!app) return;
    const sec = cfg.sections[s.appKey] && typeof cfg.sections[s.appKey] === 'object'
      ? cfg.sections[s.appKey] : (cfg.sections[s.appKey] = {});
    sec.on = true;
    const f = fillsById[s.id];
    if (f) {
      Object.keys(f.scalars || {}).forEach(function (p) {
        // Re-check against the catalogue — fills come back via the browser.
        const field = app.scalars.find(function (x) { return x.path === p; });
        if (!field) return;
        const v = cleanScalar(field, f.scalars[p]);
        if ((field.kind === 'color' || field.kind === 'choice' || field.kind === 'icon') && !v) return;
        setPath(cfg, p, v);
      });
      Object.keys(f.lists || {}).forEach(function (p) {
        const l = app.lists.find(function (x) { return x.path === p; });
        if (!l || !Array.isArray(f.lists[p])) return;
        const items = f.lists[p].slice(0, l.maxItems).map(function (item) {
          const o = {};
          l.fields.forEach(function (fd) {
            if (item && Object.prototype.hasOwnProperty.call(item, fd.name)) {
              if (fd.kind === 'choice' || fd.kind === 'icon') {
                const c = fd.kind === 'icon' ? iconValue(item[fd.name]) : choiceValue(fd, item[fd.name]);
                if (c) o[fd.name] = c;
                return;
              }
              o[fd.name] = fd.kind === 'image'
                ? imageOk(item[fd.name])
                : cleanText(item[fd.name], MAX_ITEM_TEXT);
            }
          });
          return o;
        });
        setPath(cfg, p, items);
      });
    }
    // An app the design gave no content to would show the template's sample (trade)
    // content, so it is switched off and reported instead.
    const hasText = app.scalars.some(function (x) {
      if (x.kind === 'color' || x.kind === 'choice' || x.kind === 'icon') return false;
      const v = getPath(cfg, x.path);
      if (Array.isArray(v)) return v.length > 0;
      return typeof v === 'string' && v.trim() !== '';
    });
    const hasItems = app.lists.some(function (l) {
      const v = getPath(cfg, l.path);
      return Array.isArray(v) && v.length > 0;
    });
    const keep = s.appKey === 'footer' || (app.listsOptional ? (hasText || hasItems) : hasItems);
    if (!keep) {
      cfg.sections[s.appKey] = { on: false };
      app.lists.forEach(function (l) { if (l.path.indexOf('sections.') !== 0) delete cfg[l.path]; });
      removed.push({ what: s.label || app.label, suggestion: 'Left out — no ' + app.label + ' content was found in the design, and an empty app would show sample text.' });
      return;
    }
    // No trade-template copy may leak into a chosen app: headline-type fields the AI
    // did not fill are set to '' and lists it did not fill to [] (so the editor and
    // template do not fall back to their built-in trade defaults). Functional fields
    // (form labels, buttons, placeholders) keep their neutral defaults.
    app.scalars.forEach(function (x) {
      if (x.kind !== 'text') return;
      const name = x.path.split('.').pop();
      if (getPath(cfg, x.path) !== undefined) return;
      if (x.split) setPath(cfg, x.path, []);
      else if (COPY_FIELD_RE.test(name)) setPath(cfg, x.path, '');
    });
    app.lists.forEach(function (l) {
      if (getPath(cfg, l.path) === undefined) setPath(cfg, l.path, []);
    });
    // Colour safety: backgrounds must stay light (template text is dark), and a
    // button colour pair must have readable contrast — otherwise drop them.
    app.scalars.forEach(function (x) {
      if (x.kind !== 'color') return;
      const name = x.path.split('.').pop();
      const v = getPath(cfg, x.path);
      if (!v) return;
      if ((name === 'bg' || name === 'cardBg') && luminance(v) < 0.6) setPath(cfg, x.path, '');
    });
    const btnBgF = app.scalars.find(function (x) { return x.path.split('.').pop() === 'btnBg'; });
    const btnTxF = app.scalars.find(function (x) { return x.path.split('.').pop() === 'btnText'; });
    if (btnBgF) {
      const bgv = getPath(cfg, btnBgF.path);
      const txv = btnTxF ? getPath(cfg, btnTxF.path) : '';
      const txt = txv || '#ffffff'; // template button text is white
      if (bgv && contrast(bgv, txt) < 3) {
        setPath(cfg, btnBgF.path, '');
        if (btnTxF && txv) setPath(cfg, btnTxF.path, '');
      }
    }
    // Section background from the design, when the app has a plain bg colour field
    // and the fill did not already set it.
    if (s.background && luminance(s.background) >= 0.6) {
      const bgField = app.scalars.find(function (x) { return x.kind === 'color' && /\.bg$/.test(x.path); });
      if (bgField && !getPath(cfg, bgField.path)) setPath(cfg, bgField.path, s.background);
    }
    if (HERO_APPS.indexOf(s.appKey) >= 0 && !heroKey) heroKey = s.appKey;
    order.push(s.appKey);
  });

  // Quote form: neutral functional wording where the design showed none.
  if (cfg.sections.quote && cfg.sections.quote.on === true) {
    Object.keys(QUOTE_NEUTRAL).forEach(function (k) {
      const v = cfg.sections.quote[k];
      if (v === undefined || (k !== 'fineText' && !String(v).trim())) cfg.sections.quote[k] = QUOTE_NEUTRAL[k];
    });
    // Designs often title only the form card; the quote app also shows a big
    // heading beside the form, so reuse the card title rather than leave it bare.
    if (!String(cfg.sections.quote.heading || '').trim() && String(cfg.sections.quote.formTitle || '').trim() &&
        cfg.sections.quote.formTitle !== QUOTE_NEUTRAL.formTitle) {
      cfg.sections.quote.heading = cfg.sections.quote.formTitle;
    }
    // The job dropdown is locked from the AI; give it neutral choices instead of
    // the template's trade examples.
    cfg.sections.quote.jobOptions = QUOTE_JOB_OPTIONS.map(function (t) { return { text: t }; });
  }
  // Text Box: its "beside" layout currently drops the photo under the text on
  // desktop (the Trust Bar's unscoped .tb-row rule makes the row wrap), so a text
  // block with a photo uses the "wrap" layout, which sits the photo beside the text.
  if (cfg.sections.textBox && cfg.sections.textBox.on === true && cfg.sections.textBox.image) {
    cfg.sections.textBox.imageLayout = 'wrap';
  }
  // Bookings is only placed as the hire bar (date / time / duration + rate cards).
  const bk = cfg.sections.bookingStorefront;
  if (bk && bk.on === true) bk.layout = 'hire';
  // Hero slider buttons only draw with an action; send them to the quote form.
  const hs = cfg.sections.heroSlider;
  if (hs && hs.on === true && Array.isArray(hs.slides)) {
    hs.slides.forEach(function (sl) {
      if (sl && sl.primaryCtaText && !sl.primaryCtaAction) sl.primaryCtaAction = 'quote';
    });
  }
  // A photo/split hero replaces the standard hero.
  if (heroKey && heroKey !== 'hero') cfg.sections.hero = { on: false };
  // Every site keeps a footer.
  cfg.sections.footer = cfg.sections.footer || {};
  cfg.sections.footer.on = true;
  // The footer template falls back to LeadPages' own marketing lines ("The One
  // website. Everything connected.", "Australian support") when these are unset.
  // Replace with blank / neutral text unless the design supplied them.
  // No footer links from the design: leave the list unset so the template does
  // not draw an empty "Services" column.
  if (Array.isArray(cfg.sections.footer.services) && !cfg.sections.footer.services.length) {
    delete cfg.sections.footer.services;
  }
  Object.keys(FOOTER_NEUTRAL).forEach(function (k) {
    const v = cfg.sections.footer[k];
    if (v === undefined || (k === 'supportTitle' && !String(v).trim())) {
      cfg.sections.footer[k] = FOOTER_NEUTRAL[k];
    }
  });
  if (order.indexOf('footer') < 0) order.push('footer');

  cfg.sectionOrder = order;
  cfg.sectionOrder = resolveSectionOrder(cfg);

  cfg._aiComposer = {
    version: 1,
    createdAt: opts.now || new Date().toISOString(),
    designUrl: plan.design && plan.design.url,
    sections: (plan.sections || [])
      .filter(function (s) { return order.indexOf(s.appKey) >= 0; })
      .map(function (s) { return { appKey: s.appKey, label: s.label }; }),
    gaps: (plan.gaps || []).concat(removed).slice(0, 40)
  };
  return cfg;
}

module.exports = {
  normalizeAppValues,
  normalizeFill,
  buildSiteConfig,
  setPath,
  phoneDigits,
  luminance,
  contrast
};
