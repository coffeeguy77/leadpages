'use strict';

/**
 * Normalize + compose a full SEO landing-page draft for the editor.
 * Fills title / slug / meta / H1 / body + structured faqs[].
 * FAQs are kept out of bodyMarkdown so the editor can attach a Marketplace
 * FAQ app (Unique) with items — body only keeps persuasive copy + CTA.
 */

/** Strip emojis / decorative symbols that hurt SEO copy and editor preview. */
function stripDecorativeIcons(text) {
  return String(text || '')
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{FE0F}\u{200D}]/gu, '')
    .replace(/^[ \t]*[✅✔☑☕🏢🎂🎪🌅🎯🔥⭐✨]+[ \t]*/gmu, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-')
    .slice(0, 80);
}

/**
 * @param {unknown} faqs
 * @returns {{ question: string, answer: string }[]}
 */
function normalizeFaqs(faqs) {
  if (!Array.isArray(faqs)) return [];
  return faqs
    .map((f) => {
      const row = f && typeof f === 'object' ? /** @type {Record<string, unknown>} */ (f) : {};
      return {
        question: stripDecorativeIcons(String(row.question || row.q || '').trim()),
        answer: stripDecorativeIcons(String(row.answer || row.a || '').trim())
      };
    })
    .filter((f) => f.question && f.answer)
    .slice(0, 8);
}

/**
 * @param {unknown} list
 * @returns {string[]}
 */
function normalizeKeywords(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((k) => stripDecorativeIcons(String(k || '').trim()))
    .filter(Boolean)
    .slice(0, 12);
}

/**
 * Strip a leading markdown H1 — the page stores H1 in a separate field.
 * @param {string} body
 */
function stripLeadingH1(body) {
  return String(body || '').replace(/^#\s+[^\n]+\n+/m, '').trim();
}

const CTA_HEADING_RE =
  /##\s*((?:Contact|Get in touch|Ready to|Call |Book |Request )[^\n]*)\n([\s\S]*)$/i;

/**
 * Remove FAQ heading blocks and ??? markers so we can rebuild collapsible FAQs.
 * @param {string} body
 */
function stripFaqBlocks(body) {
  let b = String(body || '');
  // Drop from FAQ heading to end (CTA should already have been peeled off).
  b = b.replace(/\n*##\s*(Frequently Asked Questions|FAQs?)\b[\s\S]*$/i, '');
  // Drop any remaining ??? Q&A blocks.
  b = b.replace(/(?:^|\n)\?\?\?\s+.+(?:\n(?!\?\?\?|##).*)*/g, '\n');
  return b.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Map Brain faqs[] → Marketplace FAQ section items (`q` / `a`).
 * @param {unknown} faqs
 * @returns {{ q: string, a: string, on: boolean }[]}
 */
function faqsToPageItems(faqs) {
  return normalizeFaqs(faqs).map((f) => ({
    q: f.question,
    a: f.answer,
    on: true
  }));
}

/**
 * @param {object} output
 * @returns {string}
 */
function composeBodyMarkdown(output) {
  let body = stripLeadingH1(stripDecorativeIcons(String(output.bodyMarkdown || '').trim()));
  const ctaHeadline = stripDecorativeIcons(String(output.ctaHeadline || '').trim());
  const ctaBody = stripDecorativeIcons(String(output.ctaBody || '').trim());

  // Peel trailing CTA so FAQ strip does not swallow it.
  /** @type {{ headline: string, body: string } | null} */
  let trailingCta = null;
  const ctaMatch = body.match(CTA_HEADING_RE);
  if (ctaMatch && ctaMatch.index != null) {
    trailingCta = {
      headline: String(ctaMatch[1] || '').trim(),
      body: String(ctaMatch[2] || '').trim()
    };
    body = body.slice(0, ctaMatch.index).trim();
  }

  // Keep FAQs out of body — editor attaches Marketplace FAQ (Unique) from faqs[].
  body = stripFaqBlocks(body);

  const finalCtaHeadline = ctaHeadline || (trailingCta && trailingCta.headline) || '';
  const finalCtaBody = ctaBody || (trailingCta && trailingCta.body) || '';
  if (finalCtaHeadline || finalCtaBody) {
    body += '\n\n## ' + (finalCtaHeadline || 'Get in touch') + '\n\n';
    if (finalCtaBody) body += finalCtaBody.trim() + '\n';
  }

  return body.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Soft-trim meta to a clickable SERP length without cutting mid-word when possible.
 * @param {string} meta
 * @param {number} [max]
 */
function trimMeta(meta, max) {
  const limit = max != null ? max : 160;
  const t = String(meta || '').trim();
  if (t.length <= limit) return t;
  const cut = t.slice(0, limit - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > 100 ? cut.slice(0, sp) : cut).trim() + '…';
}

/**
 * @param {object} output — raw model JSON
 * @param {{ businessName?: string }} [opts]
 */
function normalizeLandingDraft(output, opts) {
  const o = output && typeof output === 'object' ? output : {};
  const businessName = stripDecorativeIcons(String((opts && opts.businessName) || '').trim());
  const primaryKeyword = stripDecorativeIcons(String(o.primaryKeyword || '').trim());
  const h1 = stripDecorativeIcons(
    String(o.h1 || primaryKeyword || o.title || '').trim()
  );

  let title = stripDecorativeIcons(String(o.title || '').trim());
  if (!title && h1) {
    title = businessName ? h1 + ' | ' + businessName : h1;
  }
  if (title.length > 70) {
    const cut = title.slice(0, 67);
    const sp = cut.lastIndexOf(' ');
    title = (sp > 40 ? cut.slice(0, sp) : cut).trim();
  }

  const slug = slugify(o.slug || primaryKeyword || h1 || title);

  let meta = stripDecorativeIcons(String(o.meta || '').trim());
  if (!meta && h1) {
    meta = businessName
      ? businessName +
        ' provides ' +
        h1 +
        '. Reliable local service, clear advice and a fast response — get in touch today.'
      : 'Looking for ' +
        h1 +
        '? Get expert local help, clear advice and a fast response — contact us today.';
  }
  meta = trimMeta(meta, 160);

  const bodyMarkdown = composeBodyMarkdown(o);
  const secondaryKeywords = normalizeKeywords(o.secondaryKeywords);
  const faqs = normalizeFaqs(o.faqs);

  return {
    primaryKeyword: primaryKeyword || h1,
    secondaryKeywords,
    title,
    slug,
    meta,
    h1,
    bodyMarkdown,
    markdown: bodyMarkdown,
    faqs,
    ctaHeadline: stripDecorativeIcons(String(o.ctaHeadline || '').trim()),
    ctaBody: stripDecorativeIcons(String(o.ctaBody || '').trim())
  };
}

/** JSON Schema for Brain structured landing drafts (v3). */
const LANDING_DRAFT_SCHEMA = {
  type: 'object',
  required: [
    'primaryKeyword',
    'title',
    'slug',
    'meta',
    'h1',
    'bodyMarkdown',
    'faqs',
    'ctaHeadline',
    'ctaBody'
  ],
  properties: {
    primaryKeyword: { type: 'string' },
    secondaryKeywords: {
      type: 'array',
      items: { type: 'string' }
    },
    title: { type: 'string' },
    slug: { type: 'string' },
    meta: { type: 'string' },
    h1: { type: 'string' },
    bodyMarkdown: { type: 'string' },
    faqs: {
      type: 'array',
      items: {
        type: 'object',
        required: ['question', 'answer'],
        properties: {
          question: { type: 'string' },
          answer: { type: 'string' }
        },
        additionalProperties: false
      }
    },
    ctaHeadline: { type: 'string' },
    ctaBody: { type: 'string' }
  },
  additionalProperties: false
};

module.exports = {
  stripDecorativeIcons,
  slugify,
  normalizeFaqs,
  normalizeKeywords,
  faqsToPageItems,
  stripFaqBlocks,
  composeBodyMarkdown,
  normalizeLandingDraft,
  trimMeta,
  LANDING_DRAFT_SCHEMA
};
