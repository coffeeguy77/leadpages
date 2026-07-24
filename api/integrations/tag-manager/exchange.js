'use strict';

const { createClient } = require('@supabase/supabase-js');
const http = require('../../../lib/brain/http');
const gtm = require('../../../lib/gtm/oauth');

function admin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return http.json(res, 405, { error: 'method_not_allowed' });
    const body = await http.readBody(req);
    const code = String(body.code || '').trim();
    const stateRaw = String(body.state || '').trim();
    if (!code || !stateRaw) return http.json(res, 400, { error: 'missing_code_or_state' });
    const state = gtm.parseState(stateRaw);
    if (!state || !state.n || !state.s) return http.json(res, 400, { error: 'invalid_state' });

    const db = admin();
    const { data: st } = await db.from('gtm_oauth_states').select('*').eq('nonce', state.n).maybeSingle();
    if (!st || st.used_at) return http.json(res, 400, { error: 'state_replay' });
    if (new Date(st.expires_at).getTime() < Date.now()) return http.json(res, 400, { error: 'state_expired' });
    if (String(st.site_id) !== String(state.s)) return http.json(res, 400, { error: 'state_site_mismatch' });

    await db.from('gtm_oauth_states').update({ used_at: new Date().toISOString() }).eq('nonce', state.n);

    const tok = await gtm.exchangeCode(code);
    if (!tok.refresh_token && !tok.access_token) {
      return http.json(res, 400, { error: 'no_tokens' });
    }

    let email = null;
    try {
      const ur = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: 'Bearer ' + tok.access_token }
      });
      const uj = await ur.json();
      email = uj && uj.email;
    } catch (_e) {}

    const row = {
      site_id: state.s,
      leadpages_user_id: state.u || st.leadpages_user_id,
      google_account_email: email,
      granted_scopes: (tok.scope || gtm.scopesForMode(state.m || 'read').join(' ')).slice(0, 2000),
      refresh_token: gtm.encryptSecret(tok.refresh_token || ''),
      access_token: tok.access_token ? gtm.encryptSecret(tok.access_token) : null,
      token_expires_at: new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString(),
      setup_mode: state.m === 'managed' ? 'managed' : state.m === 'data_layer' ? 'data_layer' : 'native',
      connection_status: 'connected',
      updated_at: new Date().toISOString(),
      connected_at: new Date().toISOString()
    };
    if (!tok.refresh_token) {
      // Keep existing refresh if Google did not return a new one
      delete row.refresh_token;
    }

    const { error } = await db.from('gtm_connections').upsert(row, { onConflict: 'site_id' });
    if (error) return http.json(res, 500, { error: 'persist_failed', message: error.message });

    return http.json(res, 200, {
      ok: true,
      returnPath: (state.r || '/settings/integrations/tag-manager') + '?gtm=connected'
    });
  } catch (e) {
    return http.json(res, 500, { error: 'exchange_failed', message: e && e.message ? e.message : String(e) });
  }
};
