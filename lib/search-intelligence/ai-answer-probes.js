'use strict';

/**
 * Direct ChatGPT (OpenAI) + Perplexity answer probes for Authority & AI.
 * Complements Google AI Overview / ChatGPT-in-SERP which use DataForSEO.
 * Market data stays on DataForSEO + mock only.
 */

const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'];
const PERPLEXITY_MODELS = ['sonar', 'sonar-pro'];

function trimStr(v) {
  return String(v == null ? '' : v).trim();
}

function openaiKey() {
  return (
    process.env.OPENAI_API_KEY ||
    process.env.OPEN_AI_KEY ||
    process.env.OPENAI_KEY ||
    ''
  ).trim();
}

function perplexityKey() {
  return (process.env.PERPLEXITY_API_KEY || process.env.PPLX_API_KEY || '').trim();
}

function openaiConfigured() {
  return Boolean(openaiKey());
}

function perplexityConfigured() {
  return Boolean(perplexityKey());
}

function hostNorm(h) {
  return String(h || '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

function siteHostsLocal(site) {
  const hosts = [];
  const push = (v) => {
    const h = hostNorm(v);
    if (h && hosts.indexOf(h) < 0) hosts.push(h);
  };
  if (site && site.custom_domain) push(site.custom_domain);
  if (site && site.domain) push(site.domain);
  if (site && site.slug) hosts.push(String(site.slug).toLowerCase() + '.leadpages.com.au');
  const cfg = (site && site.config) || {};
  if (cfg.domain) push(cfg.domain);
  if (cfg.primaryDomain) push(cfg.primaryDomain);
  if (cfg.canonicalDomain) push(cfg.canonicalDomain);
  const aliases = Array.isArray(cfg.domainAliases) ? cfg.domainAliases : [];
  aliases.forEach(push);
  return hosts;
}

function brandNameOf(site, opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  return (
    trimStr(o.brandName) ||
    trimStr(site && site.business_name) ||
    trimStr(site && site.config && site.config.businessName) ||
    trimStr(site && site.config && site.config.name) ||
    trimStr(site && site.name) ||
    ''
  );
}

function locationOf(site, opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  return (
    trimStr(o.location) ||
    trimStr(site && site.config && site.config.serviceArea) ||
    trimStr(site && site.config && site.config.city) ||
    trimStr(site && site.config && site.config.region) ||
    ''
  );
}

function brandMentioned(text, brandName) {
  const brand = trimStr(brandName);
  if (!brand || !text) return false;
  const hay = String(text).toLowerCase();
  const needle = brand.toLowerCase();
  if (hay.includes(needle)) return true;
  const parts = needle.split(/\s+/).filter((p) => p.length >= 4);
  return parts.length > 0 && parts.every((p) => hay.includes(p));
}

function hostMentioned(text, hosts) {
  const hay = String(text || '').toLowerCase();
  return (hosts || []).some((h) => h && hay.includes(String(h).toLowerCase()));
}

function extractUrls(text) {
  const out = [];
  const re = /https?:\/\/[^\s)\]>"']+/gi;
  let m;
  const raw = String(text || '');
  while ((m = re.exec(raw))) {
    const u = m[0].replace(/[.,;:!?)]+$/, '');
    if (u && out.indexOf(u) < 0) out.push(u);
  }
  return out.slice(0, 12);
}

function buildProbeQuestion(keyword, brand, location) {
  const kw = trimStr(keyword) || 'local services';
  const loc = trimStr(location);
  const b = trimStr(brand);
  const where = loc ? ' in ' + loc : '';
  if (b) {
    return (
      'Who are the best options for ' +
      kw +
      where +
      '? Include ' +
      b +
      ' if they are relevant, and cite sources with URLs when possible.'
    );
  }
  return 'Who are the best options for ' + kw + where + '? Cite sources with URLs when possible.';
}

async function readFetchBody(res) {
  if (res && typeof res.json === 'function') {
    try {
      return await res.json();
    } catch (_) {
      /* fall through */
    }
  }
  if (res && typeof res.text === 'function') {
    const raw = await res.text();
    try {
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }
  return null;
}

function scoreFromText(site, brand, text, citations) {
  const hosts = siteHostsLocal(site);
  const cites = Array.isArray(citations) ? citations : [];
  const citeHay = cites.join(' ');
  const brandHit = brandMentioned(text, brand) || brandMentioned(citeHay, brand);
  const siteHit = hostMentioned(text, hosts) || hostMentioned(citeHay, hosts);
  const cited = brandHit || siteHit;
  return {
    mentioned: cited,
    brandMentioned: brandHit,
    siteMentioned: siteHit,
    cited: cited,
    citationCount: cites.length,
    citations: cites.slice(0, 8),
    snippet: String(text || '').slice(0, 280)
  };
}

async function callOpenAIChat(question, fetchImpl) {
  const key = openaiKey();
  if (!key) {
    return {
      ok: false,
      available: false,
      status: 'unavailable',
      reason: 'OPENAI_API_KEY not set',
      message: 'OPENAI_API_KEY not set',
      text: '',
      citations: []
    };
  }
  const doFetch = typeof fetchImpl === 'function' ? fetchImpl : fetch;
  let lastErr = '';
  for (let i = 0; i < OPENAI_MODELS.length; i++) {
    const model = OPENAI_MODELS[i];
    try {
      const res = await doFetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          temperature: 0.2,
          max_tokens: 700,
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful research assistant. Answer with concrete business recommendations and include source URLs when you can.'
            },
            { role: 'user', content: question }
          ]
        })
      });
      const json = await readFetchBody(res);
      if (!res || !res.ok) {
        lastErr =
          (json && json.error && json.error.message) ||
          (json && json.message) ||
          'HTTP ' + ((res && res.status) || '?');
        if (res && (res.status === 404 || /model/i.test(lastErr))) continue;
        return {
          ok: false,
          available: false,
          status: 'error',
          reason: lastErr,
          message: lastErr,
          text: '',
          citations: [],
          model: model
        };
      }
      const text = trimStr(
        json &&
          json.choices &&
          json.choices[0] &&
          json.choices[0].message &&
          json.choices[0].message.content
      );
      return {
        ok: true,
        available: true,
        status: 'live',
        reason: '',
        message: '',
        text: text,
        citations: extractUrls(text),
        model: model,
        usage: json && json.usage ? json.usage : null
      };
    } catch (e) {
      lastErr = e && e.message ? e.message : String(e);
    }
  }
  return {
    ok: false,
    available: false,
    status: 'error',
    reason: lastErr || 'OpenAI request failed',
    message: lastErr || 'OpenAI request failed',
    text: '',
    citations: []
  };
}

async function callPerplexity(question, fetchImpl) {
  const key = perplexityKey();
  if (!key) {
    return {
      ok: false,
      available: false,
      status: 'unavailable',
      reason: 'PERPLEXITY_API_KEY not set',
      message: 'PERPLEXITY_API_KEY not set',
      text: '',
      citations: []
    };
  }
  const doFetch = typeof fetchImpl === 'function' ? fetchImpl : fetch;
  let lastErr = '';
  for (let i = 0; i < PERPLEXITY_MODELS.length; i++) {
    const model = PERPLEXITY_MODELS[i];
    try {
      const res = await doFetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          temperature: 0.2,
          max_tokens: 700,
          messages: [
            {
              role: 'system',
              content:
                'Answer with concrete local-business recommendations. Prefer citing official websites and review sources with URLs.'
            },
            { role: 'user', content: question }
          ]
        })
      });
      const json = await readFetchBody(res);
      if (!res || !res.ok) {
        lastErr =
          (json && json.error && json.error.message) ||
          (json && json.message) ||
          'HTTP ' + ((res && res.status) || '?');
        if (res && (res.status === 404 || /model/i.test(lastErr))) continue;
        return {
          ok: false,
          available: false,
          status: 'error',
          reason: lastErr,
          message: lastErr,
          text: '',
          citations: [],
          model: model
        };
      }
      const text = trimStr(
        json &&
          json.choices &&
          json.choices[0] &&
          json.choices[0].message &&
          json.choices[0].message.content
      );
      const cites = [];
      const rawCites = Array.isArray(json && json.citations) ? json.citations : [];
      rawCites.forEach((c) => {
        const u = trimStr(typeof c === 'string' ? c : c && (c.url || c.link));
        if (u && cites.indexOf(u) < 0) cites.push(u);
      });
      extractUrls(text).forEach((u) => {
        if (cites.indexOf(u) < 0) cites.push(u);
      });
      return {
        ok: true,
        available: true,
        status: 'live',
        reason: '',
        message: '',
        text: text,
        citations: cites.slice(0, 12),
        model: model,
        usage: json && json.usage ? json.usage : null
      };
    } catch (e) {
      lastErr = e && e.message ? e.message : String(e);
    }
  }
  return {
    ok: false,
    available: false,
    status: 'error',
    reason: lastErr || 'Perplexity request failed',
    message: lastErr || 'Perplexity request failed',
    text: '',
    citations: []
  };
}

/**
 * Probe ChatGPT (OpenAI chat completions) for brand/site visibility.
 */
async function probeChatGptAnswers(site, opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const brand = brandNameOf(site, o);
  const location = locationOf(site, o);
  const keyword = trimStr(o.keyword) || brand || 'local services';
  const question = buildProbeQuestion(keyword, brand, location);
  const raw = await callOpenAIChat(question, o.fetchImpl);
  const scored = scoreFromText(site, brand, raw.text, raw.citations);
  return {
    ok: raw.ok === true,
    available: raw.available === true,
    status: raw.status,
    provider: 'openai',
    platform: 'chatgpt',
    label: 'ChatGPT answers',
    reason: raw.reason || '',
    message: raw.message || raw.reason || '',
    note: raw.message || raw.reason || '',
    model: raw.model || '',
    question: question,
    brand: brand,
    keyword: keyword,
    ...scored
  };
}

/**
 * Probe Perplexity Sonar for brand/site visibility.
 */
async function probePerplexity(site, opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const brand = brandNameOf(site, o);
  const location = locationOf(site, o);
  const keyword = trimStr(o.keyword) || brand || 'local services';
  const question = buildProbeQuestion(keyword, brand, location);
  const raw = await callPerplexity(question, o.fetchImpl);
  const scored = scoreFromText(site, brand, raw.text, raw.citations);
  return {
    ok: raw.ok === true,
    available: raw.available === true,
    status: raw.status,
    provider: 'perplexity',
    platform: 'perplexity',
    label: 'Perplexity',
    reason: raw.reason || '',
    message: raw.message || raw.reason || '',
    note: raw.message || raw.reason || '',
    model: raw.model || '',
    question: question,
    brand: brand,
    keyword: keyword,
    ...scored
  };
}

/**
 * Run both answer probes in parallel.
 */
async function probeDirectAiAnswers(site, keyword, opts) {
  const o = Object.assign({}, opts && typeof opts === 'object' ? opts : {}, {
    keyword: trimStr(keyword) || (opts && opts.keyword) || ''
  });
  const [chatgpt, perplexity] = await Promise.all([
    probeChatGptAnswers(site, o),
    probePerplexity(site, o)
  ]);
  return {
    question: chatgpt.question || perplexity.question || '',
    brand: chatgpt.brand || perplexity.brand || '',
    chatgpt: chatgpt,
    perplexity: perplexity
  };
}

module.exports = {
  openaiConfigured: openaiConfigured,
  perplexityConfigured: perplexityConfigured,
  openaiKey: openaiKey,
  perplexityKey: perplexityKey,
  buildProbeQuestion: buildProbeQuestion,
  probeChatGptAnswers: probeChatGptAnswers,
  probePerplexity: probePerplexity,
  probeDirectAiAnswers: probeDirectAiAnswers,
  callOpenAIChat: callOpenAIChat,
  callPerplexity: callPerplexity
};
