'use strict';

/**
 * OpenAI-backed briefing helpers for Layout Composer.
 * Uses OPENAI_API_KEY when present; callers must fall back if null.
 */

function clean(s, n) {
  return String(s == null ? '' : s).trim().slice(0, n || 800);
}

function openaiKey() {
  return String(process.env.OPENAI_API_KEY || '').trim() || null;
}

async function chatJson(system, user, opts) {
  opts = opts || {};
  const key = openaiKey();
  if (!key) return null;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const fetchImpl = opts.fetchImpl || fetch;
  const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + key,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      temperature: opts.temperature != null ? opts.temperature : 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });
  if (!res.ok) {
    const errText = await res.text().catch(function () { return ''; });
    const err = new Error('openai_http_' + res.status + (errText ? ': ' + errText.slice(0, 200) : ''));
    err.code = 502;
    throw err;
  }
  const data = await res.json();
  const raw = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

/**
 * Generate one engaging interview turn from conversation so far.
 * @returns {Promise<object|null>}
 */
async function generateInterviewTurn(input) {
  const brief = (input && input.brief) || {};
  const understanding = (input && input.understanding) || {};
  const history = (input && input.history) || [];
  const mode = (input && input.mode) || 'next'; // next | followup_services | research

  const system =
    'You are an expert Australian local-SEO website strategist interviewing a business owner. ' +
    'Ask ONE clear question at a time. Offer 3–5 short recommended answer chips (one marked recommended). ' +
    'Sound like ChatGPT: warm, specific, clever — never generic. ' +
    'Return JSON only with keys: question (string), help (string), multi (boolean), ' +
    'field (services|customers|differentiator|serviceAreas|preferredCta|tone|notes|null), ' +
    'options (array of {id,label,recommended}), ' +
    'understandingPatch (object with any updated fields), ' +
    'done (boolean — true only when you have enough to write the whole site), ' +
    'assistantNote (short line acknowledging their last answer).';

  const user = JSON.stringify({
    mode: mode,
    businessName: brief.businessName || understanding.businessName,
    trade: brief.trade || understanding.trade,
    location: brief.location || understanding.location,
    understanding: understanding,
    recentAnswers: history.slice(-8),
    instruction:
      mode === 'followup_services'
        ? 'Ask ONE deeper follow-up about their services only, then set done=false. Do not restart the whole interview.'
        : 'Continue the interview. If understanding already has services, customers, differentiator, areas, CTA and tone, set done=true and ask them to confirm fill.'
  });

  const parsed = await chatJson(system, user, { temperature: 0.5 });
  if (!parsed || !parsed.question) return null;

  const options = Array.isArray(parsed.options) ? parsed.options.slice(0, 6).map(function (o, i) {
    return {
      id: clean(o && o.id, 40) || ('opt-' + i),
      label: clean(o && o.label, 120) || ('Option ' + (i + 1)),
      recommended: !!(o && o.recommended) || i === 0
    };
  }) : [];

  return {
    question: clean(parsed.question, 280),
    help: clean(parsed.help, 220),
    multi: !!parsed.multi,
    field: parsed.field || null,
    options: options,
    understandingPatch: parsed.understandingPatch && typeof parsed.understandingPatch === 'object'
      ? parsed.understandingPatch
      : {},
    done: !!parsed.done,
    assistantNote: clean(parsed.assistantNote, 200),
    source: 'openai'
  };
}

/**
 * Research brief grounded in the business understanding.
 */
async function generateResearchBrief(brief, understanding) {
  const b = brief || {};
  const u = understanding || {};
  const system =
    'You are an Australian local SEO researcher. Return JSON with: ' +
    'summary (2–3 sentences specific to this business), ' +
    'angles (array of {label, confidence 0-1, note}), ' +
    'sources (array of {title, confidence 0-1, note}), ' +
    'contentIdeas (array of {title, angle, sampleH1, sampleIntro, sampleFaqQ, sampleFaqA}), ' +
    'disclaimer (string). Be specific to trade + location. No fake URLs.';

  const user = JSON.stringify({
    businessName: b.businessName || u.businessName,
    trade: b.trade || u.trade,
    location: b.location || u.location,
    services: u.services || [],
    customers: u.customers || [],
    serviceAreas: u.serviceAreas || [],
    differentiator: u.differentiator || '',
    preferredCta: u.preferredCta || ''
  });

  const parsed = await chatJson(system, user, { temperature: 0.35 });
  if (!parsed || !parsed.summary) return null;

  return {
    ok: true,
    mode: 'openai',
    summary: clean(parsed.summary, 600),
    angles: Array.isArray(parsed.angles) ? parsed.angles.slice(0, 5) : [],
    sources: Array.isArray(parsed.sources) ? parsed.sources.slice(0, 5) : [],
    contentIdeas: Array.isArray(parsed.contentIdeas) ? parsed.contentIdeas.slice(0, 5) : [],
    disclaimer: clean(parsed.disclaimer, 240) ||
      'AI research is advisory. Confirm claims before publishing.',
    source: 'openai'
  };
}

module.exports = {
  openaiKey,
  chatJson,
  generateInterviewTurn,
  generateResearchBrief
};
