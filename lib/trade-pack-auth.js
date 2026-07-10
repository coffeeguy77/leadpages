// Auth for community trade-pack APIs — active partners or platform super admins.

async function getTradePackActor(token, sb) {
  if (!token) return null;
  try {
    const ur = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    });
    const user = await ur.json();
    if (!user || !user.id) return null;

    const prof = await sb.from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle();
    if (prof.data && prof.data.is_super_admin) {
      return { userId: user.id, partnerId: null, isSuper: true };
    }

    const pr = await sb.from('partners').select('id,status').eq('user_id', user.id).maybeSingle();
    if (!pr.data || pr.data.status !== 'active') return null;
    return { userId: user.id, partnerId: pr.data.id, isSuper: false };
  } catch (_e) {
    return null;
  }
}

module.exports = { getTradePackActor };
