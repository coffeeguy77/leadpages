'use strict';

/**
 * On-page editing for partner pages (Nov 2026).
 *
 * In edit mode the Studio-family text helpers wrap each slot value in private-use marker
 * characters. After the page is built, applyEditMarkers() turns markers in visible text into
 * <span data-lpe="slot">…</span> (click-to-edit), drops them inside attributes and raw-text
 * elements (script, style, title, textarea), and tags elements whose src/style came from an
 * image slot with data-lpe-img="slot" (click to change picture).
 *
 * tagSections() gives every <section> a stable data-lp-sec key (its id, or s<n>) so a partner
 * can hide sections; hiddenSectionsCss() hides them on the public page.
 */

const M_OPEN = '';
const M_MID = '';
const M_CLOSE = '';
const RAW_TEXT = { script: 1, style: 1, title: 1, textarea: 1 };

function markText(key, html) {
  return M_OPEN + key + M_MID + html + M_CLOSE;
}
function markImage(key, url) {
  return M_OPEN + 'img:' + key + M_MID + M_CLOSE + url;
}

function safeKey(k) {
  return String(k).replace(/[^a-z0-9_.#:-]/gi, '');
}

function applyEditMarkers(html) {
  if (typeof html !== 'string' || html.indexOf(M_OPEN) < 0) return html;
  let out = '';
  let i = 0;
  const n = html.length;
  let inTag = false;
  let quote = '';
  let tagImgs = [];
  let tagStart = -1;
  let rawUntil = '';            // inside <script>…</script> etc.
  while (i < n) {
    const ch = html[i];
    if (rawUntil) {
      const end = html.toLowerCase().indexOf('</' + rawUntil, i);
      const stop = end < 0 ? n : end;
      out += stripMarkers(html.slice(i, stop));
      i = stop;
      rawUntil = '';
      continue;
    }
    if (!inTag) {
      if (ch === '<' && /[a-zA-Z\/!]/.test(html[i + 1] || '')) {
        inTag = true; quote = ''; tagImgs = []; tagStart = out.length;
        out += ch; i++;
        continue;
      }
      if (ch === M_OPEN) {
        const mid = html.indexOf(M_MID, i);
        if (mid < 0) { i++; continue; }
        const key = html.slice(i + 1, mid);
        if (key.indexOf('img:') === 0) {
          // An image marker in text (e.g. a bare URL): just drop it.
          const close = html.indexOf(M_CLOSE, mid);
          i = close < 0 ? mid + 1 : close + 1;
          continue;
        }
        out += '<span data-lpe="' + safeKey(key) + '">';
        i = mid + 1;
        continue;
      }
      if (ch === M_CLOSE) { out += '</span>'; i++; continue; }
      if (ch === M_MID) { i++; continue; }
      out += ch; i++;
      continue;
    }
    // inside a tag
    if (quote) {
      if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      let tagText = out.slice(tagStart);
      const attrs = tagImgs.length ? ' data-lpe-img="' + safeKey(tagImgs[0]) + '"' : '';
      if (attrs) {
        out = out.slice(0, tagStart) + tagText.replace(/\s*\/?$/, function(m) { return attrs + m; });
      }
      out += '>';
      const m = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(out.slice(tagStart));
      if (m && RAW_TEXT[m[1].toLowerCase()]) rawUntil = m[1].toLowerCase();
      inTag = false; i++;
      continue;
    }
    if (ch === M_OPEN) {
      const mid = html.indexOf(M_MID, i);
      if (mid > 0) {
        const key = html.slice(i + 1, mid);
        if (key.indexOf('img:') === 0) tagImgs.push(key.slice(4));
        i = mid + 1;
        continue;
      }
    }
    if (ch === M_MID || ch === M_CLOSE || ch === M_OPEN) { i++; continue; }
    out += ch; i++;
  }
  return out;
}

function stripMarkers(s) {
  return String(s).replace(/[^]*/g, '').replace(/[]/g, '');
}

/** Add data-lp-sec="<id|sN>" to every <section> (top-level page sections are all <section>). */
function tagSections(html) {
  let idx = 0;
  return String(html).replace(/<section\b([^>]*)>/gi, function(all, attrs) {
    idx++;
    if (/\sdata-lp-sec=/.test(attrs)) return all;
    const m = /\sid=["']([^"']+)["']/i.exec(attrs);
    const key = m ? m[1] : 's' + idx;
    return '<section' + attrs + ' data-lp-sec="' + safeKey(key) + '">';
  });
}

function hiddenSectionsCss(list) {
  const keys = (list || []).map(safeKey).filter(Boolean);
  if (!keys.length) return '';
  return '<style id="lp-hidden-sections">' + keys.map(function(k) { return '[data-lp-sec="' + k + '"]'; }).join(',') + '{display:none!important}</style>';
}

module.exports = { markText, markImage, applyEditMarkers, stripMarkers, tagSections, hiddenSectionsCss, M_OPEN, M_MID, M_CLOSE };
