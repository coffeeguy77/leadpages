/**
 * LeadPages font sets for trade sites (config.fontSet).
 *
 * The trade template and its app stylesheets use
 *   font-family: var(--lp-font-head, "Barlow Condensed")   — headings, buttons, labels
 *   font-family: var(--lp-font-body, "Barlow")             — body text
 * so a font set only has to set those variables (plus heading width / weight / case).
 * A set can also name an "eyebrow" font for the small capitals — eyebrows, menu links and
 * buttons — (--lp-font-label), e.g. a serif site with tracked sans-serif labels.
 * "classic" (or no fontSet) leaves the page exactly as before.
 *
 * Used by api/render.js (server: <link> + <style> in <head>), assets/lp-layouts.js
 * (editor preview: switches live) and manage.html (Branding → Fonts picker).
 */
(function (root) {
  'use strict';

  var SETS = {
    classic: {
      label: 'Classic Trade', note: 'Barlow Condensed + Barlow (default)',
      head: { family: 'Barlow Condensed', fallback: 'sans-serif', weight: 800, transform: 'uppercase', spacing: '.01em' },
      body: { family: 'Barlow', fallback: 'system-ui,sans-serif' },
      google: null
    },
    archivo: {
      label: 'Archivo Bold', note: 'Archivo extra-condensed headings, Archivo body',
      head: { family: 'Archivo', fallback: 'system-ui,sans-serif', weight: 900, stretch: '62%', transform: 'none', spacing: '-.005em' },
      body: { family: 'Archivo', fallback: 'system-ui,sans-serif', stretch: '100%' },
      google: 'Archivo:wdth,wght@62..125,400..900'
    },
    oswald: {
      label: 'Oswald Strong', note: 'Oswald capitals + Inter',
      head: { family: 'Oswald', fallback: 'sans-serif', weight: 700, transform: 'uppercase', spacing: '.01em' },
      body: { family: 'Inter', fallback: 'system-ui,sans-serif' },
      google: 'Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700'
    },
    bebas: {
      label: 'Bebas Poster', note: 'Bebas Neue + Inter',
      head: { family: 'Bebas Neue', fallback: 'sans-serif', weight: 400, transform: 'uppercase', spacing: '.02em' },
      body: { family: 'Inter', fallback: 'system-ui,sans-serif' },
      google: 'Bebas+Neue&family=Inter:wght@400;500;600;700'
    },
    montserrat: {
      label: 'Montserrat Modern', note: 'Montserrat + Inter',
      head: { family: 'Montserrat', fallback: 'system-ui,sans-serif', weight: 800, transform: 'none', spacing: '-.01em' },
      body: { family: 'Inter', fallback: 'system-ui,sans-serif' },
      google: 'Montserrat:wght@600;700;800&family=Inter:wght@400;500;600;700'
    },
    poppins: {
      label: 'Poppins Friendly', note: 'Poppins throughout',
      head: { family: 'Poppins', fallback: 'system-ui,sans-serif', weight: 700, transform: 'none', spacing: '-.01em' },
      body: { family: 'Poppins', fallback: 'system-ui,sans-serif' },
      google: 'Poppins:wght@400;500;600;700;800'
    },
    space: {
      label: 'Space Grotesk Tech', note: 'Space Grotesk + Inter',
      head: { family: 'Space Grotesk', fallback: 'system-ui,sans-serif', weight: 700, transform: 'none', spacing: '-.02em' },
      body: { family: 'Inter', fallback: 'system-ui,sans-serif' },
      google: 'Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700'
    },
    playfair: {
      label: 'Playfair Elegant', note: 'Playfair Display + Source Sans 3',
      head: { family: 'Playfair Display', fallback: 'Georgia,serif', weight: 700, transform: 'none', spacing: '0' },
      body: { family: 'Source Sans 3', fallback: 'system-ui,sans-serif' },
      google: 'Playfair+Display:wght@600;700;800&family=Source+Sans+3:wght@400;500;600;700'
    },
    heritage: {
      label: 'Newsreader Heritage', note: 'Newsreader serif + Jost tracked capitals',
      head: { family: 'Newsreader', fallback: 'Georgia,serif', weight: 500, transform: 'none', spacing: '-.012em' },
      body: { family: 'Newsreader', fallback: 'Georgia,serif' },
      eyebrow: { family: 'Jost', fallback: 'system-ui,sans-serif', weight: 500, spacing: '.2em', button: '.14em' },
      google: 'Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Jost:wght@400;500;600'
    }
  };
  var ORDER = ['classic', 'archivo', 'oswald', 'bebas', 'montserrat', 'poppins', 'space', 'playfair', 'heritage'];

  function get(key) { return (key && SETS[key] && key !== 'classic') ? SETS[key] : null; }
  function q(f) { return '"' + String(f).replace(/["\\<>]/g, '') + '"'; }
  function googleUrl(set) { return set && set.google ? 'https://fonts.googleapis.com/css2?family=' + set.google + '&display=swap' : ''; }

  /** CSS for a font set (empty for classic / unknown). */
  function css(key) {
    var s = get(key); if (!s) return '';
    var h = s.head, b = s.body;
    var out = ':root{--lp-font-head:' + q(h.family) + ',' + h.fallback + ';--lp-font-body:' + q(b.family) + ',' + b.fallback +
      ';--lp-font-head-stretch:' + (h.stretch || '100%') + ';--lp-heading-case:' + (h.transform || 'none') + '}';
    out += 'body{font-stretch:' + (b.stretch || '100%') + '}';
    // Big display text only — card titles (h3) stay at normal width so they read easily.
    out += 'h1,h2,.display,.hbk-h,.bkw-amt,.sp-num,.cb-h,.tbb-h,.mh-h,.bkw-h,.hbk-quote b{font-stretch:var(--lp-font-head-stretch)}';
    out += 'h1,h2,h3,.display{font-weight:' + h.weight + ';text-transform:' + (h.transform || 'none') + ';letter-spacing:' + (h.spacing || 'normal') + '}';
    var e = s.eyebrow;
    if (e) {
      // Small capitals in their own font: eyebrows, menu links and buttons.
      out += ':root{--lp-font-label:' + q(e.family) + ',' + e.fallback + '}';
      out += '.eyebrow,.hsl-eyebrow,.sph-eyebrow,.lpl-eyebrow{font-family:var(--lp-font-label)!important;font-weight:' + e.weight + '!important;letter-spacing:' + e.spacing + '!important;font-stretch:100%}';
      out += '.btn,.hn-link,.hn-txt,.lpl-link,.lpl-btn{font-family:var(--lp-font-label)!important;font-weight:' + e.weight + '!important;letter-spacing:' + (e.button || e.spacing) + '!important;font-stretch:100%}';
    }
    return out;
  }

  var API = { SETS: SETS, ORDER: ORDER, get: get, css: css, googleUrl: googleUrl };

  /** Browser: apply (or remove) a set on this document. */
  API.apply = function (doc, key) {
    doc = doc || document;
    var s = get(key), head = doc.head || doc.getElementsByTagName('head')[0];
    if (!head) return;
    var link = doc.getElementById('lp-fontset-link'), st = doc.getElementById('lp-fontset');
    if (!s) {
      if (st) st.textContent = '';
      if (link) link.parentNode.removeChild(link);
      if (doc.documentElement) doc.documentElement.removeAttribute('data-lp-fontset');
      return;
    }
    var url = googleUrl(s);
    if (url) {
      if (!link) { link = doc.createElement('link'); link.id = 'lp-fontset-link'; link.rel = 'stylesheet'; head.appendChild(link); }
      if (link.getAttribute('href') !== url) link.setAttribute('href', url);
    }
    if (!st) { st = doc.createElement('style'); st.id = 'lp-fontset'; head.appendChild(st); }
    var c = css(key);
    if (st.textContent !== c) st.textContent = c;
    if (st.nextSibling) head.appendChild(st); // keep it last so it wins over the base heading rule
    doc.documentElement.setAttribute('data-lp-fontset', key);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.LP_FONTS = API;
})(typeof window !== 'undefined' ? window : null);
