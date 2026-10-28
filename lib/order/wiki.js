'use strict';

/**
 * Staff wiki for the ordering system — Markdown pages in docs/order-wiki/*.md with front matter:
 *   ---
 *   title: Stock
 *   section: Order operations
 *   order: 40
 *   summary: One sentence for the index.
 *   ---
 * Pages are plain Markdown (no HTML). The staff app renders them (orders.html → Settings → Help & Wiki).
 */

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', '..', 'docs', 'order-wiki');

const SECTIONS = [
  'Getting started',
  'Orders',
  'Order operations',
  'Catalogue & customers',
  'Payments & money',
  'Settings',
  'Customer side',
  'Help & troubleshooting',
  'Build history'
];

function parsePage(slug, raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n');
  const meta = { slug: slug, title: slug, section: 'Help & troubleshooting', order: 999, summary: '' };
  let body = text;
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (m) {
    body = text.slice(m[0].length);
    m[1].split('\n').forEach(function (line) {
      const kv = /^([a-z_]+):\s*(.*)$/i.exec(line.trim());
      if (!kv) return;
      const k = kv[1].toLowerCase();
      const v = kv[2].trim().replace(/^["']|["']$/g, '');
      if (k === 'order') meta.order = Number(v) || 999;
      else if (k === 'title' || k === 'section' || k === 'summary') meta[k] = v;
    });
  }
  meta.body = body.trim();
  return meta;
}

let cache = null;

/** All pages, sorted by section then order then title. */
function loadPages() {
  if (cache) return cache;
  let files = [];
  try {
    files = fs.readdirSync(DIR).filter(function (f) { return /\.md$/i.test(f); });
  } catch (_e) {
    files = [];
  }
  const pages = files.map(function (f) {
    return parsePage(f.replace(/\.md$/i, ''), fs.readFileSync(path.join(DIR, f), 'utf8'));
  });
  pages.sort(function (a, b) {
    const sa = SECTIONS.indexOf(a.section);
    const sb = SECTIONS.indexOf(b.section);
    return (sa < 0 ? 99 : sa) - (sb < 0 ? 99 : sb) || a.order - b.order || a.title.localeCompare(b.title);
  });
  cache = pages;
  return pages;
}

module.exports = { SECTIONS, parsePage, loadPages, _reset: function () { cache = null; } };
