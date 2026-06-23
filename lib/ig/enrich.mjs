// lib/ig/enrich.mjs
// Turn a raw Instagram caption into a tidy {title, service, location} using the Anthropic API.
// Falls back to null on any failure (the caller then uses a simple caption-derived title).

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

export async function enrichCaption(caption) {
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
    return {
      title: String(o.title || '').trim(),
      service: String(o.service || '').trim(),
      location: String(o.location || '').trim(),
    };
  } catch {
    return null;
  }
}
