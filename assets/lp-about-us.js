/**
 * About Us section painter — story layout + optional navy CTA band.
 * Used by trade/landing templates and marketplace demos.
 */
(function (root) {
  'use strict';

  function tok(s, biz) {
    return String(s == null ? '' : s).replace(/\{\{\s*businessName\s*\}\}/gi, biz || '');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function paras(text) {
    var raw = String(text == null ? '' : text).replace(/\r\n/g, '\n').trim();
    if (!raw) return '';
    return raw.split(/\n\s*\n/).map(function (p) {
      return '<p>' + esc(p.replace(/\n/g, ' ').trim()) + '</p>';
    }).join('');
  }

  function hex(v) {
    v = String(v || '').trim();
    if (/^#?[0-9a-fA-F]{3}$/.test(v)) {
      v = v.charAt(0) === '#' ? v.slice(1) : v;
      return '#' + v.split('').map(function (c) { return c + c; }).join('');
    }
    if (/^#?[0-9a-fA-F]{6}$/.test(v)) return v.charAt(0) === '#' ? v : '#' + v;
    return '';
  }

  function resolveHref(action, target, url) {
    action = String(action || 'scroll').toLowerCase();
    if (action === 'none' || action === 'off') return null;
    if (action === 'url') {
      var u = String(url || '').trim();
      return u || null;
    }
    var t = String(target || 'quote').replace(/^#/, '').trim() || 'quote';
    return '#' + t;
  }

  function wireCta(el, action, target, url, label) {
    if (!el) return;
    var lab = String(label || '').trim();
    var href = resolveHref(action, target, url);
    var labEl = el.querySelector('.au-cta-label, .au-band-cta-label');
    if (labEl) labEl.textContent = lab;
    else if (lab) el.childNodes.length && el.firstChild && el.firstChild.nodeType === 3
      ? (el.firstChild.textContent = lab)
      : null;
    if (!lab || !href) {
      el.setAttribute('hidden', '');
      el.classList.add('au-hide');
      el.removeAttribute('href');
      return;
    }
    el.removeAttribute('hidden');
    el.classList.remove('au-hide');
    el.setAttribute('href', href);
    if (String(action || '').toLowerCase() === 'url') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    } else {
      el.removeAttribute('target');
      el.removeAttribute('rel');
    }
  }

  /**
   * @param {object} sec sections.aboutUs
   * @param {Element|null} node [data-sec="aboutUs"]
   * @param {object} [ctx] { business, theme }
   */
  function lpApplyAboutUs(sec, node, ctx) {
    if (!node) return;
    sec = sec || {};
    ctx = ctx || {};
    var biz = ctx.business || ctx.businessName || '';
    var theme = ctx.theme || {};
    var on = sec.on === true;
    node.classList.toggle('au-on', on);
    if (on) {
      node.removeAttribute('hidden');
      node.style.setProperty('display', 'block', 'important');
    } else {
      node.style.setProperty('display', 'none', 'important');
      return;
    }

    var layout = String(sec.layout || sec.mode || 'story').toLowerCase();
    if (layout !== 'story') layout = 'story';
    node.setAttribute('data-au-layout', layout);
    node.classList.add('au-layout-' + layout);

    var accent = hex(sec.accent) || hex(theme.hivis) || hex(theme.pipe) || '';
    if (accent) node.style.setProperty('--au-accent', accent);
    else node.style.removeProperty('--au-accent');

    var headingColor = hex(sec.headingColor);
    if (headingColor) node.style.setProperty('--au-heading', headingColor);
    else node.style.removeProperty('--au-heading');

    var bg = hex(sec.bg);
    if (bg) node.style.setProperty('--au-bg', bg);
    else node.style.removeProperty('--au-bg');

    var eb = node.querySelector('.au-eyebrow');
    if (eb) {
      var ebV = tok(sec.eyebrow != null ? sec.eyebrow : '', biz);
      eb.textContent = ebV;
      eb.style.display = ebV ? '' : 'none';
    }
    var h = node.querySelector('.au-heading');
    if (h) h.textContent = tok(sec.heading != null ? sec.heading : '', biz);

    var intro = node.querySelector('.au-intro');
    if (intro) {
      var introV = tok(sec.intro != null ? sec.intro : '', biz);
      intro.textContent = introV;
      intro.style.display = introV ? '' : 'none';
    }

    var body = node.querySelector('.au-body');
    if (body) {
      var bodySrc = sec.body != null ? sec.body : (sec.content != null ? sec.content : '');
      body.innerHTML = paras(tok(bodySrc, biz));
    }

    wireCta(
      node.querySelector('.au-cta'),
      sec.ctaAction || 'scroll',
      sec.ctaTarget || 'quote',
      sec.ctaUrl || sec.ctaHref || '',
      tok(sec.ctaLabel != null ? sec.ctaLabel : 'Our Story', biz)
    );

    var media = node.querySelector('.au-col-media');
    var wrap = node.querySelector('.au-media-wrap');
    var img = node.querySelector('.au-img');
    var imgUrl = String(sec.image || '').trim();
    var quoteText = tok(sec.quote != null ? sec.quote : '', biz).trim();
    var quoteAttr = tok(sec.quoteAttr != null ? sec.quoteAttr : '', biz).trim();
    var hasMedia = !!(imgUrl || quoteText);
    if (media) {
      if (hasMedia) {
        media.classList.remove('au-hide');
        media.removeAttribute('hidden');
      } else {
        media.classList.add('au-hide');
        media.setAttribute('hidden', '');
      }
    }
    if (wrap) wrap.classList.toggle('au-no-img', !imgUrl);
    if (img) {
      if (imgUrl) {
        img.setAttribute('src', imgUrl);
        img.setAttribute('alt', tok(sec.imageAlt != null ? sec.imageAlt : '', biz) || '');
        img.style.display = '';
      } else {
        img.removeAttribute('src');
        img.style.display = 'none';
      }
    }
    var q = node.querySelector('.au-quote');
    var qt = node.querySelector('.au-quote-text');
    var qa = node.querySelector('.au-quote-attr');
    if (q) {
      if (quoteText) {
        q.removeAttribute('hidden');
        if (qt) qt.textContent = quoteText.charAt(0) === '"' || quoteText.charAt(0) === '\u201C'
          ? quoteText
          : ('\u201C' + quoteText.replace(/^["'\u201C\u201D]+|["'\u201C\u201D]+$/g, '') + '\u201D');
        if (qa) {
          qa.textContent = quoteAttr ? ('\u2014 ' + quoteAttr) : '';
          qa.style.display = quoteAttr ? '' : 'none';
        }
      } else {
        q.setAttribute('hidden', '');
      }
    }

    var band = node.querySelector('.au-band');
    if (band) {
      var bandOn = sec.bandOn === true;
      band.classList.toggle('au-band-on', bandOn);
      if (!bandOn) {
        band.setAttribute('hidden', '');
        band.style.display = 'none';
      } else {
        band.removeAttribute('hidden');
        band.style.display = 'block';
        var bandBg = hex(sec.bandBg) || '#0a2744';
        band.style.setProperty('--au-band-bg', bandBg);
        band.classList.toggle('au-no-decor', sec.bandDecor === false);
        var bh = band.querySelector('.au-band-heading');
        if (bh) bh.textContent = tok(sec.bandHeading != null ? sec.bandHeading : '', biz);
        var bs = band.querySelector('.au-band-sub');
        if (bs) {
          var bsV = tok(sec.bandSub != null ? sec.bandSub : '', biz);
          bs.textContent = bsV;
          bs.style.display = bsV ? '' : 'none';
        }
        wireCta(
          band.querySelector('.au-band-cta'),
          sec.bandCtaAction || 'scroll',
          sec.bandCtaTarget || 'quote',
          sec.bandCtaUrl || sec.bandCtaHref || '',
          tok(sec.bandCtaLabel != null ? sec.bandCtaLabel : 'Start the Conversation', biz)
        );
        var tag = band.querySelector('.au-band-tag');
        var tagline = band.querySelector('.au-band-tagline');
        var tagV = tok(sec.bandTagline != null ? sec.bandTagline : '', biz).trim();
        if (tagline) tagline.textContent = tagV;
        if (tag) {
          if (tagV) {
            tag.removeAttribute('hidden');
            tag.classList.remove('au-hide');
          } else {
            tag.setAttribute('hidden', '');
            tag.classList.add('au-hide');
          }
        }
      }
    }
  }

  root.lpApplyAboutUs = lpApplyAboutUs;
})(typeof window !== 'undefined' ? window : globalThis);
