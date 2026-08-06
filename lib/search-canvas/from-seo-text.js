'use strict';

const { blankTab, defaultSearchCanvasConfig, newId } = require('./defaults');
const { normalizeSearchCanvas } = require('./normalize');
const { pickIcon } = require('../brain/search-canvas-compose');

/**
 * Convert SEO Text article content into a SearchCanvas draft (previewable).
 * Does not mutate the original SEO Text config.
 */
function convertSeoTextToSearchCanvas(seoText) {
  const s = seoText && typeof seoText === 'object' ? seoText : {};
  const content = String(s.content || '');
  const sections = splitSeoSections(content);
  const tabs = [];

  if (s.h2 && String(s.h2).trim()) {
    // Prefer body sections; h2 alone becomes first tab if body empty
  }

  if (sections.length) {
    sections.forEach(function (sec, i) {
      tabs.push(
        blankTab({
          id: newId('tab'),
          label: clipWords(sec.heading, 4) || 'Topic ' + (i + 1),
          iconKey: pickIcon('', sec.heading),
          heading: sec.heading,
          intro: sec.intro || sec.paragraphs[0] || '',
          content: sec.paragraphs.slice(sec.intro ? 0 : 1).join('\n\n'),
          bullets: sec.bullets.length ? sec.bullets : ['What’s included', 'How it works', 'Next steps'],
          image: {
            url: i === 0 && s.image ? String(s.image) : null,
            publicId: null,
            alt: sec.heading,
            fit: 'cover',
            objectPosition: 'center'
          },
          link: { label: 'View ' + clipWords(sec.heading, 3), destination: null },
          _imageSearchQuery: String(sec.heading || '').toLowerCase() + ' australia'
        })
      );
    });
  } else {
    const intro = String(s.intro || '').trim();
    const body = content.trim();
    tabs.push(
      blankTab({
        id: newId('tab'),
        label: clipWords(s.h2 || s.h1 || 'Overview', 4),
        iconKey: pickIcon('', s.h2 || s.h1),
        heading: String(s.h2 || s.h1 || 'Overview').trim(),
        intro: intro || body.slice(0, 280),
        content: intro ? body : body.slice(280),
        bullets: extractBullets(body).slice(0, 4),
        image: {
          url: s.image ? String(s.image) : null,
          publicId: null,
          alt: String(s.h1 || ''),
          fit: 'cover',
          objectPosition: 'center'
        }
      })
    );
  }

  while (tabs.length < 1) tabs.push(blankTab());

  const base = defaultSearchCanvasConfig();
  const out = normalizeSearchCanvas(
    Object.assign({}, base, {
      on: true,
      header: {
        eyebrow: String(s.eyebrow || 'Our expertise').trim(),
        heading: String(s.h1 || base.header.heading).trim(),
        intro: String(s.intro || '').trim() || 'Explore the topics below for practical detail.',
        colours: {
          eyebrow: s.eyebrowColor || null,
          heading: s.h1Color || null,
          intro: s.textColor || null
        }
      },
      tabs: tabs.slice(0, 8),
      defaultTabId: tabs[0].id,
      ai: {
        source: 'converted-from-seo-text',
        generatedAt: new Date().toISOString()
      }
    })
  );

  return {
    searchCanvas: out,
    recovery: {
      seoText: JSON.parse(JSON.stringify(s)),
      convertedAt: new Date().toISOString()
    }
  };
}

function clipWords(str, n) {
  return String(str || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, n)
    .join(' ');
}

function extractBullets(text) {
  return String(text || '')
    .split('\n')
    .map(function (l) {
      return l.replace(/^\s*[-*•]\s+/, '').trim();
    })
    .filter(function (l, i, arr) {
      const raw = String(text || '').split('\n')[i] || '';
      return /^\s*[-*•]\s+/.test(raw) && l;
    });
}

function splitSeoSections(content) {
  const text = String(content || '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];
  const lines = text.split('\n');
  const blocks = [];
  let cur = null;

  function looksHeading(line) {
    const t = String(line || '').trim().replace(/:$/, '');
    if (!t || t.length > 72) return false;
    if (/[.!?]/.test(t)) return false;
    if (/^[-*•]/.test(t)) return false;
    if (/^https?:\/\//i.test(t)) return false;
    const w = t.split(/\s+/).filter(Boolean);
    return w.length >= 1 && w.length <= 10;
  }

  function push() {
    if (!cur) return;
    if (cur.heading || cur.paragraphs.length || cur.bullets.length) blocks.push(cur);
    cur = null;
  }

  lines.forEach(function (line) {
    const t = line.trim();
    if (!t) return;
    if (/^###?\s+/.test(t) || looksHeading(t)) {
      push();
      cur = {
        heading: t.replace(/^###?\s+/, '').replace(/:$/, ''),
        intro: '',
        paragraphs: [],
        bullets: []
      };
      return;
    }
    if (!cur) {
      cur = { heading: 'Overview', intro: '', paragraphs: [], bullets: [] };
    }
    if (/^[-*•]\s+/.test(t)) {
      cur.bullets.push(t.replace(/^[-*•]\s+/, '').trim());
      return;
    }
    if (!cur.intro && !cur.paragraphs.length) cur.intro = t;
    else cur.paragraphs.push(t);
  });
  push();

  return blocks.filter(function (b) {
    return b.heading || b.intro || b.paragraphs.length;
  });
}

module.exports = {
  convertSeoTextToSearchCanvas,
  splitSeoSections
};
