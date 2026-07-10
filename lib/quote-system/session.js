/**
 * Online Quote System — session lifecycle helpers.
 */

const crypto = require('crypto');
const { getAdmin } = require('./supabase');
const { SESSION_TTL_DAYS, SESSION_STATUS } = require('./constants');

function newSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function sessionExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_TTL_DAYS);
  return d.toISOString();
}

async function createSession(siteId, quoteSystemId, progress) {
  const admin = getAdmin();
  const row = {
    site_id: siteId,
    quote_system_id: quoteSystemId,
    session_token: newSessionToken(),
    status: SESSION_STATUS.DRAFT,
    progress: progress || {},
    expires_at: sessionExpiry()
  };
  const { data, error } = await admin.from('quote_sessions').insert(row).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

async function updateSession(sessionId, patch) {
  const admin = getAdmin();
  const { data, error } = await admin.from('quote_sessions')
    .update(patch)
    .eq('id', sessionId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function nextQuoteVersionNumber(sessionId) {
  const admin = getAdmin();
  const { data } = await admin.from('quote_versions')
    .select('version_number')
    .eq('session_id', sessionId)
    .order('version_number', { ascending: false })
    .limit(1);
  return (data && data[0] ? data[0].version_number : 0) + 1;
}

async function insertQuoteVersion(row) {
  const admin = getAdmin();
  const { data, error } = await admin.from('quote_versions').insert(row).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

async function linkLeadToSession(session, leadId) {
  if (!session || !leadId) return session;
  return updateSession(session.id, { lead_id: leadId });
}

module.exports = {
  newSessionToken,
  sessionExpiry,
  createSession,
  updateSession,
  nextQuoteVersionNumber,
  insertQuoteVersion,
  linkLeadToSession
};
