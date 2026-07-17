// api/assist.js — the role-aware LeadPages help assistant.
//
// How the role gating works: we fetch the help articles using the CALLER'S OWN
// Supabase token, so row-level security returns only the articles their account
// level is allowed to see (client < partner < super). The assistant is then told
// to answer ONLY from those articles — so it literally cannot leak partner/admin
// guidance to a client, because that content never enters its context.
//
// POST { question, history?:[{role,content}] }  ->  { ok:true, answer }
// Auth: optional "Authorization: Bearer <supabase access_token>". No token = client level.
//
// When BRAIN_HELP_ASSIST=1, answers go through LeadPages Brain (task help.answer).

const { createClient } = require('@supabase/supabase-js');
const { getPlatformBrain, isHelpAssistEnabled } = require('../lib/brain/platform');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const MODEL = process.env.ASSIST_MODEL || 'claude-haiku-4-5-20251001';

function userClient(token) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    token ? { global: { headers: { Authorization: 'Bearer ' + token } } } : {}
  );
}

async function getUser(token) {
  if (!token) return null;
  try {
    const r = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? { id: u.id, email: String(u.email || '').toLowerCase() } : null;
  } catch (_e) { return null; }
}

async function roleOf(user) {
  if (!user) return 'client';
  try {
    const prof = (await admin.from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle()).data;
    if (prof && prof.is_super_admin) return 'super';
    const p = (await admin.from('partners').select('status').eq('user_id', user.id).maybeSingle()).data;
    if (p && p.status === 'active') return 'partner';
  } catch (_e) {}
  return 'client';
}

function buildSystem(role, ctx) {
  const who = role === 'super' ? 'an admin who runs the LeadPages platform'
    : role === 'partner' ? 'a LeadPages partner who builds and sells websites for local businesses'
    : 'a website client of LeadPages';
  const fallback = role === 'client' ? 'suggest they contact their provider or LeadPages support'
    : role === 'partner' ? 'suggest they use the Support area or message LeadPages from their dashboard'
    : 'say it may need a product decision rather than a documented answer';

  return (
    'You are the LeadPages help assistant, speaking with ' + who + '.\n' +
    'Answer ONLY using the help articles provided below. Be concise, warm and practical, and use plain language a busy tradesperson would appreciate.\n' +
    'If the answer is not covered by the articles, say you are not certain and ' + fallback + '. Never invent features, prices, or policies, and never share guidance intended for a different account level.\n' +
    'Keep answers short unless asked for detail. You may use simple formatting (short paragraphs and - bullets).\n\n' +
    'HELP ARTICLES AVAILABLE TO THIS PERSON:\n' + ctx
  );
}

async function answerViaBrain(role, question, history, helpContext) {
  const brain = getPlatformBrain();
  const messages = [
    { role: 'system', content: buildSystem(role, helpContext) }
  ];
  history.forEach((m) => {
    if (m && (m.role === 'user' || m.role === 'assistant') && m.content) {
      messages.push({ role: m.role, content: String(m.content).slice(0, 4000) });
    }
  });
  messages.push({ role: 'user', content: question.slice(0, 4000) });

  const result = await brain.generate({
    taskId: 'help.answer',
    actor: { role },
    messages
  });
  if (!result.ok) {
    const msg = (result.error && result.error.message) || 'Assistant failed';
    const err = new Error(msg);
    err.status = 502;
    throw err;
  }
  return (result.output && result.output.text) || "Sorry, I couldn't find an answer for that.";
}

async function answerViaAnthropic(system, messages) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 700, system, messages }),
  });
  const data = await r.json();
  if (!r.ok) {
    const detail = (data && data.error && data.error.message) ? data.error.message : ('AI request failed (' + r.status + ')');
    const err = new Error(detail);
    err.status = 502;
    throw err;
  }
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
    || "Sorry, I couldn't find an answer for that.";
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST.' });

  const useBrain = isHelpAssistEnabled();
  if (!useBrain && !process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      ok: false,
      error: "The assistant isn't switched on yet. In Vercel, open this project's Settings → Environment Variables, add ANTHROPIC_API_KEY with your Anthropic API key, then redeploy.",
    });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_e) { body = {}; } }
  body = body || {};
  const question = String(body.question || '').trim();
  if (!question) return res.status(400).json({ ok: false, error: 'Please type a question.' });
  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;
  const user = await getUser(token);
  const role = await roleOf(user);

  // Fetch help articles AS THE USER — RLS returns exactly their permitted level.
  const wr = await userClient(token)
    .from('wiki_articles')
    .select('title,category,audience,body')
    .eq('published', true)
    .order('sort', { ascending: true });
  const articles = (wr.data || []);

  const ctx = articles.length
    ? articles.map((a) => '## ' + (a.title || 'Untitled') + ' [' + (a.category || 'General') + ']\n' + (a.body || '')).join('\n\n---\n\n')
    : '(No help articles are available to this account yet.)';

  const system = buildSystem(role, ctx);
  const messages = [];
  history.forEach((m) => {
    if (m && (m.role === 'user' || m.role === 'assistant') && m.content) {
      messages.push({ role: m.role, content: String(m.content).slice(0, 4000) });
    }
  });
  messages.push({ role: 'user', content: question.slice(0, 4000) });

  try {
    const answer = useBrain
      ? await answerViaBrain(role, question, history, ctx)
      : await answerViaAnthropic(system, messages);
    return res.status(200).json({ ok: true, answer, role, via: useBrain ? 'brain' : 'anthropic' });
  } catch (e) {
    return res.status(e && e.status ? e.status : 502).json({
      ok: false,
      error: (e && e.message) || 'Could not reach the assistant right now. Please try again shortly.'
    });
  }
};
