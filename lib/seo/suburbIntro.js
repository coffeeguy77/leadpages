// lib/seo/suburbIntro.js
// One UNIQUE intro paragraph per (site, suburb), generated once with Claude and cached
// in Supabase. Unique copy is what keeps these from being thin/duplicate doorway pages.

import { getIntro, saveIntro } from './store.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

export async function getOrCreateIntro(slug, suburb, tok) {
  try {
    const cached = await getIntro(slug, suburb);
    if (cached) return cached;
  } catch { /* fall through */ }

  const fallback =
    `${tok.business || 'We'} provide ${tok.trade ? tok.trade.toLowerCase() + ' services' : 'trusted local service'} ` +
    `across ${suburb}${tok.region ? ', ' + tok.region : ''}. Fast response, upfront pricing, fully licensed and insured.`;

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return fallback;

  const prompt =
    `Write ONE natural 2-3 sentence intro paragraph for a local tradesperson's web page targeting a single suburb. ` +
    `Make it specific and genuinely useful, NOT keyword-stuffed or spammy. Vary the wording so it reads as unique to this suburb.\n` +
    `Business: ${tok.business || '(local business)'}\n` +
    `Trade: ${tok.trade || '(general trade)'}\n` +
    `Suburb: ${suburb}\n` +
    `City/Region: ${tok.city || ''} ${tok.region || ''}\n` +
    `Return ONLY the paragraph text — no quotes, no preamble, no markdown.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 220, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!r.ok) return fallback;
    const j = await r.json();
    const txt = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    const intro = txt || fallback;
    try { await saveIntro(slug, suburb, intro); } catch { /* non-fatal */ }
    return intro;
  } catch {
    return fallback;
  }
}
