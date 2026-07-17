// lib/ig/enrich.mjs
// Turn a raw Instagram caption into a tidy {title, service, location}.
// When BRAIN_IG_ENRICH=1, routes through LeadPages Brain; otherwise legacy Anthropic.

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { getPlatformBrain, isIgEnrichEnabled } = require('../brain/platform.js');
const { IG_ENRICH_SCHEMA, normalizeIgEnrich } = require('../brain/ig-compose.js');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

async function enrichViaBrain(caption) {
  const brain = getPlatformBrain();
  const result = await brain.generateStructured({
    taskId: 'ig.caption_enrich',
    promptId: 'ig.caption_enrich',
    actor: { role: 'system' },
    input: { businessName: '', caption: String(caption).slice(0, 1500) },
    responseSchema: IG_ENRICH_SCHEMA
  });
  if (!result.ok || !result.output) return null;
  const o = normalizeIgEnrich(result.output);
  if (!o.title && !o.service && !o.location) return null;
  return o;
}

async function enrichViaAnthropic(caption) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !caption || !String(caption).trim()) return null;

  const prompt =
    `You are tidying an Australian tradesperson's Instagram post for a website portfolio. ` +
    `From the caption below, extract:\n` +
    `- title: a short, clean project title (max 6 words, no hashtags, no emojis)\n` +
    `- service: the trade or service performed (e.g. "Blocked drain", "Bathroom renovation", "Hot water install")\n` +
    `- location: the suburb or town if clearly mentioned, otherwise an empty string\n\n` +
    `Return ONLY a JSON object on a single line, no markdown, no commentary:\n` +
    `{"title":"","service":"","location":""}\n\n` +
    `Caption:\n"""\n${String(caption).slice(0, 1500)}\n"""`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const text = (j.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    const match = text.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
    if (!match) return null;
    const o = JSON.parse(match[0]);
    return normalizeIgEnrich(o);
  } catch {
    return null;
  }
}

export async function enrichCaption(caption) {
  if (!caption || !String(caption).trim()) return null;
  try {
    if (isIgEnrichEnabled()) {
      return await enrichViaBrain(caption);
    }
  } catch {
    return null;
  }
  return enrichViaAnthropic(caption);
}
