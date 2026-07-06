// api/admin-command-menu.js
// GET  — returns mobile command centre menu config (any authenticated user)
// POST { content } — saves config (super admin only)

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const MENU_KEY = 'admin_command_menu';

const DEFAULT_MENU = {
  version: 1,
  sections: [
    {
      id: 'publish',
      title: 'Publishing & preview',
      layout: 'stack',
      buttonStyle: 'publish-duo',
      separator: 'none',
      roles: ['super', 'partner', 'client'],
      slot: 'lpc-drawer-top',
      items: [{ id: 'btn-publish' }, { id: 'btn-viewlive' }]
    },
    {
      id: 'site',
      title: 'Site',
      layout: 'stack',
      buttonStyle: 'default',
      separator: 'line',
      roles: ['super', 'partner'],
      condition: 'site-switcher',
      slot: 'lpc-context'
    },
    {
      id: 'builder',
      title: 'Builder Menu',
      layout: 'tabs',
      buttonStyle: 'nav',
      separator: 'line',
      roles: ['super', 'partner', 'client'],
      slot: 'adminnav'
    },
    {
      id: 'tools',
      title: 'Site Tools',
      layout: 'stack',
      buttonStyle: 'outline',
      separator: 'line',
      roles: ['super', 'partner', 'client'],
      slot: 'lpc-tools',
      items: [
        { id: 'btn-settings', roles: ['super', 'partner', 'client'] },
        { id: 'btn-appearance-aa', roles: ['super', 'partner', 'client'] },
        { id: 'btn-billing', roles: ['super', 'partner', 'client'] },
        { id: 'btn-domains', roles: ['super', 'partner', 'client'] },
        { id: 'lpc-preview', roles: ['super', 'partner', 'client'] },
        { id: 'lpc-scope', roles: ['super', 'partner', 'client'] },
        { id: 'lpc-backups', roles: ['super', 'partner', 'client'] },
        { id: 'btn-fav', roles: ['super'] },
        { id: 'btn-newsite', roles: ['super'] },
        { id: 'lpc-partner-admin', roles: ['super'] },
        { id: 'lpc-marketplace-admin', roles: ['super'] },
        { id: 'lpc-partner-console', roles: ['partner'] }
      ]
    },
    {
      id: 'account',
      title: 'Account',
      layout: 'stack',
      buttonStyle: 'outline',
      separator: 'line',
      roles: ['super', 'partner', 'client'],
      slot: 'lpc-drawer-footer',
      items: [
        { id: 'btn-switch', roles: ['super'] },
        { id: 'lp-mode-toggle', roles: ['super', 'partner'] },
        { id: 'lpc-drawer-signout', roles: ['super', 'partner', 'client'] }
      ]
    }
  ]
};

async function authUser(token) {
  const ur = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token }
  });
  const user = await ur.json();
  if (!user || !user.id) return null;
  const { data: prof } = await sb.from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle();
  return { id: user.id, isSuper: !!(prof && prof.is_super_admin) };
}

function validateMenu(content) {
  if (!content || typeof content !== 'object') return false;
  if (!Array.isArray(content.sections)) return false;
  for (const sec of content.sections) {
    if (!sec || typeof sec !== 'object' || !sec.id) return false;
    if (sec.roles && !Array.isArray(sec.roles)) return false;
    if (sec.items && !Array.isArray(sec.items)) return false;
  }
  return true;
}

module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Unauthorised' });

  let user;
  try {
    user = await authUser(token);
    if (!user) return res.status(401).json({ error: 'Invalid session' });
  } catch (e) {
    return res.status(401).json({ error: 'Auth failed' });
  }

  if (req.method === 'GET') {
    try {
      const { data } = await sb.from('system_pages').select('content').eq('key', MENU_KEY).maybeSingle();
      const content = data && data.content && validateMenu(data.content) ? data.content : DEFAULT_MENU;
      return res.status(200).json({ ok: true, content, defaults: DEFAULT_MENU });
    } catch (e) {
      return res.status(200).json({ ok: true, content: DEFAULT_MENU, defaults: DEFAULT_MENU });
    }
  }

  if (req.method === 'POST') {
    if (!user.isSuper) return res.status(403).json({ error: 'Super admin only' });

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    const content = body && body.content ? body.content : body;
    if (!validateMenu(content)) return res.status(400).json({ error: 'Invalid menu config' });

    try {
      const { error } = await sb.from('system_pages').upsert({ key: MENU_KEY, content }, { onConflict: 'key' });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
