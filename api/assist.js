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
// Requires env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
// Optional env: ASSIST_MODEL (defaults to a current Claude model)

const { createClient } = require('@supabase/supabase-js');

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

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST.' });

  if (!process.env.ANTHROPIC_API_KEY) {
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

  const who = role === 'super' ? 'an admin who runs the LeadPages platform'
    : role === 'partner' ? 'a LeadPages partner who builds and sells websites for local businesses'
    : 'a website client of LeadPages';
  const fallback = role === 'client' ? 'suggest they contact their provider or LeadPages support'
    : role === 'partner' ? 'suggest they use the Support area or message LeadPages from their dashboard'
    : 'say it may need a product decision rather than a documented answer';

  const system =
    'You are the LeadPages help assistant, speaking with ' + who + '.\n' +
    'Answer ONLY using the help articles provided below. Be concise, warm and practical, and use plain language a busy tradesperson would appreciate.\n' +
    'If the answer is not covered by the articles, say you are not certain and ' + fallback + '. Never invent features, prices, or policies, and never share guidance intended for a different account level.\n' +
    'Keep answers short unless asked for detail. You may use simple formatting (short paragraphs and - bullets).\n\n' +
    'HELP ARTICLES AVAILABLE TO THIS PERSON:\n' + ctx;

  const messages = [];
  history.forEach((m) => {
    if (m && (m.role === 'user' || m.role === 'assistant') && m.content) {
      messages.push({ role: m.role, content: String(m.content).slice(0, 4000) });
    }
  });
  messages.push({ role: 'user', content: question.slice(0, 4000) });

  try {
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
      return res.status(502).json({ ok: false, error: detail });
    }
    const answer = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return res.status(200).json({ ok: true, answer: answer || "Sorry, I couldn't find an answer for that.", role });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'Could not reach the assistant right now. Please try again shortly.' });
  }
};
