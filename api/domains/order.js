// api/domains/order.js — returns the status of the orders in a group, for the
// post-checkout "registering your domain…" screen. Auth required; a user can
// only see their own group. Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'sign in' });
    const { data: { user } = {}, error } = await sb.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'sign in' });

    const group = (req.query && req.query.group) || '';
    if (!group) return res.status(400).json({ error: 'missing group' });

    const { data: orders } = await sb.from('domain_orders')
      .select('domain_name,status,error_message')
      .eq('order_group', group).eq('user_id', user.id);

    const list = (orders || []).map(o => ({ domain: o.domain_name, status: o.status, error: o.error_message || null }));
    const done = list.length > 0 && list.every(o => o.status === 'completed');
    const working = list.some(o => ['pending', 'paid', 'registering'].includes(o.status));
    const review = list.some(o => ['failed_requires_review', 'requires_admin_balance'].includes(o.status));
    return res.status(200).json({ orders: list, done, working, review });
  } catch (e) {
    return res.status(500).json({ error: 'status error' });
  }
};
