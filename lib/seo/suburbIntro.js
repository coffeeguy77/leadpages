// lib/seo/suburbIntro.js
// One UNIQUE intro paragraph per (site, suburb), generated once and cached
// in Supabase. When BRAIN_SUBURB_INTRO=1, uses LeadPages Brain.

import { createRequire } from 'module';
import { getIntro, saveIntro } from './store.js';

const require = createRequire(import.meta.url);
const { getPlatformBrain, isSuburbIntroEnabled } = require('../brain/platform.js');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

function fallbackIntro(suburb, tok) {
  return (
    `${tok.business || 'We'} provide ${tok.trade ? tok.trade.toLowerCase() + ' services' : 'trusted local service'} ` +
    `across ${suburb}${tok.region ? ', ' + tok.region : ''}. Fast response, upfront pricing, fully licensed and insured.`
  );
}

async function generateViaBrain(suburb, tok) {
  const brain = getPlatformBrain();
  const result = await brain.generate({
    taskId: 'seo.suburb_intro',
    promptId: 'seo.suburb_intro',
    actor: { role: 'system' },
    input: {
      businessName: tok.business || '',
      trade: tok.trade || '',
      suburb: String(suburb || '')
    }
  });
  if (!result.ok) return null;
  const text = result.output && result.output.text != null
    ? String(result.output.text).trim()
    : '';
  return text || null;
}

async function generateViaAnthropic(suburb, tok) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

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
    if (!r.ok) return null;
    const j = await r.json();
    const txt = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    return txt || null;
  } catch {
    return null;
  }
}

export async function getOrCreateIntro(slug, suburb, tok) {
  try {
    const cached = await getIntro(slug, suburb);
    if (cached) return cached;
  } catch { /* fall through */ }

  const fallback = fallbackIntro(suburb, tok);
  let intro = null;
  try {
    if (isSuburbIntroEnabled()) {
      intro = await generateViaBrain(suburb, tok);
    } else {
      intro = await generateViaAnthropic(suburb, tok);
    }
  } catch {
    intro = null;
  }

  const out = intro || fallback;
  try { await saveIntro(slug, suburb, out); } catch { /* non-fatal */ }
  return out;
}
