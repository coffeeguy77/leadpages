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

  /** Preserve intentional line breaks as <br>; blank lines become paragraphs. */
  function paras(text) {
    var raw = String(text == null ? '' : text).replace(/\r\n/g, '\n').trim();
    if (!raw) return '';
    return raw.split(/\n\s*\n/).map(function (p) {
      return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  /** Multiline plain text → textContent preserves \n with CSS white-space:pre-line. */
  function setMultilineText(el, value) {
    if (!el) return;
    el.textContent = value == null ? '' : String(value);
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

  function fitValue(v) {
    v = String(v || 'cover').toLowerCase();
    if (v === 'contain' || v === 'fill' || v === 'cover') return v;
    if (v === 'stretch') return 'fill';
    return 'cover';
  }

  function posValue(v) {
    v = String(v || 'center').toLowerCase().replace(/\s+/g, ' ');
    var ok = {
      center: 1, top: 1, bottom: 1, left: 1, right: 1,
      'top left': 1, 'top right': 1, 'bottom left': 1, 'bottom right': 1,
      'left top': 1, 'right top': 1, 'left bottom': 1, 'right bottom': 1
    };
    return ok[v] ? v : 'center';
  }

  function clampNum(v, min, max, fallback) {
    var n = Number(v);
    if (!isFinite(n)) return fallback;
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  function setCssColor(node, prop, value) {
    var h = hex(value);
    if (h) node.style.setProperty(prop, h);
    else node.style.removeProperty(prop);
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

    setCssColor(node, '--au-heading', sec.headingColor);
    setCssColor(node, '--au-eyebrow', sec.eyebrowColor);
    setCssColor(node, '--au-intro', sec.introColor);
    setCssColor(node, '--au-body', sec.bodyColor || sec.textColor);
    setCssColor(node, '--au-cta', sec.ctaColor);
    setCssColor(node, '--au-cta-border', sec.ctaBorderColor || sec.ctaColor);
    setCssColor(node, '--au-bg', sec.bg);

    var eb = node.querySelector('.au-eyebrow');
    if (eb) {
      var ebV = tok(sec.eyebrow != null ? sec.eyebrow : '', biz);
      setMultilineText(eb, ebV);
      eb.style.display = ebV.trim() ? '' : 'none';
    }
    var h = node.querySelector('.au-heading');
    if (h) setMultilineText(h, tok(sec.heading != null ? sec.heading : '', biz));

    var intro = node.querySelector('.au-intro');
    if (intro) {
      var introV = tok(sec.intro != null ? sec.intro : '', biz);
      setMultilineText(intro, introV);
      intro.style.display = introV.trim() ? '' : 'none';
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
    var quoteOn = sec.quoteOn !== false && sec.quoteShow !== false;
    var quoteText = quoteOn ? tok(sec.quote != null ? sec.quote : '', biz).trim() : '';
    var quoteAttr = tok(sec.quoteAttr != null ? sec.quoteAttr : '', biz).trim();
    var quoteStyle = String(sec.quoteStyle || sec.quoteFont || 'handwriting').toLowerCase();
    if (quoteStyle !== 'plain') quoteStyle = 'handwriting';
    var hasMedia = !!(imgUrl || quoteText);
    if (media) {
      if (hasMedia) {
        media.classList.remove('au-hide');
        media.removeAttribute('hidden');
      } else {
        media.classList.add('au-hide');
        media.setAttribute('hidden', '');
      }
      media.classList.toggle('au-hide-quote', !quoteOn || !quoteText);
    }
    if (wrap) wrap.classList.toggle('au-no-img', !imgUrl);

    var fit = fitValue(sec.imageFit || sec.imgFit);
    var pos = posValue(sec.imagePos || sec.imagePosition || sec.imgPos);
    node.style.setProperty('--au-img-fit', fit);
    node.style.setProperty('--au-img-pos', pos);

    if (img) {
      if (imgUrl) {
        img.setAttribute('src', imgUrl);
        img.setAttribute('alt', tok(sec.imageAlt != null ? sec.imageAlt : '', biz) || '');
        img.style.display = '';
        img.style.objectFit = fit;
        img.style.objectPosition = pos;
      } else {
        img.removeAttribute('src');
        img.style.display = 'none';
      }
    }

    /* Quote overlay size / position / colours */
    var qSize = clampNum(sec.quoteSize != null ? sec.quoteSize : sec.quoteScale, 50, 220, 100) / 100;
    var qX = clampNum(sec.quoteX, 0, 100, 50);
    var qY = clampNum(sec.quoteY, 0, 100, 78);
    var qMaxW = clampNum(sec.quoteMaxW, 40, 100, 86);
    var qScrim = clampNum(sec.quoteScrim, 0, 100, 86) / 100;
    var qAlign = String(sec.quoteAlign || 'left').toLowerCase();
    if (qAlign !== 'center' && qAlign !== 'right') qAlign = 'left';
    node.style.setProperty('--au-quote-size', String(qSize));
    node.style.setProperty('--au-quote-x', qX + '%');
    node.style.setProperty('--au-quote-y', qY + '%');
    node.style.setProperty('--au-quote-maxw', qMaxW + '%');
    node.style.setProperty('--au-quote-scrim', String(qScrim));
    node.style.setProperty('--au-quote-align', qAlign);
    setCssColor(node, '--au-quote-color', sec.quoteColor);
    setCssColor(node, '--au-quote-attr', sec.quoteAttrColor);
    if (qScrim < 0.25) {
      node.style.setProperty('--au-quote-shadow', '0 1px 3px rgba(0,0,0,.45)');
    } else {
      node.style.removeProperty('--au-quote-shadow');
    }

    var q = node.querySelector('.au-quote');
    var qt = node.querySelector('.au-quote-text');
    var qa = node.querySelector('.au-quote-attr');
    if (q) {
      q.setAttribute('data-au-quote-style', quoteStyle);
      q.classList.toggle('au-quote-hand', quoteStyle === 'handwriting');
      q.classList.toggle('au-quote-plain', quoteStyle === 'plain');
      if (quoteText) {
        q.removeAttribute('hidden');
        q.classList.remove('au-hide');
        if (qt) {
          var qBody = quoteText;
          if (quoteStyle === 'handwriting') {
            // Keep optional wrapping quotes for handwriting look.
            if (!(qBody.charAt(0) === '"' || qBody.charAt(0) === '\u201C')) {
              qBody = '\u201C' + qBody.replace(/^["'\u201C\u201D]+|["'\u201C\u201D]+$/g, '') + '\u201D';
            }
          }
          setMultilineText(qt, qBody);
        }
        if (qa) {
          qa.textContent = quoteAttr ? ('\u2014 ' + quoteAttr) : '';
          qa.style.display = quoteAttr ? '' : 'none';
        }
      } else {
        q.setAttribute('hidden', '');
        q.classList.add('au-hide');
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
        setCssColor(band, '--au-band-heading', sec.bandHeadingColor);
        setCssColor(band, '--au-band-sub', sec.bandSubColor);
        setCssColor(band, '--au-band-tag', sec.bandTagColor);
        band.classList.toggle('au-no-decor', sec.bandDecor === false);
        var bh = band.querySelector('.au-band-heading');
        if (bh) setMultilineText(bh, tok(sec.bandHeading != null ? sec.bandHeading : '', biz));
        var bs = band.querySelector('.au-band-sub');
        if (bs) {
          var bsV = tok(sec.bandSub != null ? sec.bandSub : '', biz);
          setMultilineText(bs, bsV);
          bs.style.display = bsV.trim() ? '' : 'none';
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
        if (tagline) setMultilineText(tagline, tagV);
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
