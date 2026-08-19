'use strict';

const { readBody, json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem } = require('../../lib/order/auth');
const { getAdmin } = require('../../lib/order/supabase');
const { writeAudit } = require('../../lib/order/audit');

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET', 'POST', 'PATCH', 'DELETE'])) return;
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'auth' });
    const body = req.method === 'GET' || req.method === 'DELETE' ? {} : await readBody(req);
    const siteId = (req.query && req.query.site_id) || body.site_id;
    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { error: access.error });
    const system = await ensureOrderSystem(siteId);
    const admin = getAdmin();

    if (req.method === 'GET') {
      const { data, error } = await admin
        .from('order_message_templates')
        .select('*')
        .eq('order_system_id', system.id)
        .order('category')
        .order('name');
      if (error) throw error;
      return json(res, 200, { templates: data || [] });
    }

    if (req.method === 'POST') {
      const { data, error } = await admin
        .from('order_message_templates')
        .insert({
          order_system_id: system.id,
          site_id: siteId,
          category: body.category || 'custom',
          name: body.name || 'Untitled',
          channel: body.channel || 'sms',
          subject: body.subject || null,
          body: body.body || '',
          industry: body.industry || system.industry_preset,
          tone: body.tone || null,
          topic: body.topic || null,
          active: body.active !== false
        })
        .select('*')
        .single();
      if (error) throw error;
      await writeAudit({
        order_system_id: system.id,
        site_id: siteId,
        event_type: 'template_created',
        actor_user_id: user.id,
        source: 'admin',
        payload: { id: data.id }
      });
      return json(res, 200, { template: data });
    }

    if (req.method === 'PATCH') {
      if (!body.id) return json(res, 400, { error: 'id_required' });
      const patch = { updated_at: new Date().toISOString() };
      ['category', 'name', 'channel', 'subject', 'body', 'industry', 'tone', 'topic', 'active'].forEach(
        function (k) {
          if (body[k] !== undefined) patch[k] = body[k];
        }
      );
      const { data, error } = await admin
        .from('order_message_templates')
        .update(patch)
        .eq('id', body.id)
        .eq('site_id', siteId)
        .select('*')
        .single();
      if (error) throw error;
      return json(res, 200, { template: data });
    }

    if (req.method === 'DELETE') {
      const id = (req.query && req.query.id) || body.id;
      if (!id) return json(res, 400, { error: 'id_required' });
      await admin.from('order_message_templates').delete().eq('id', id).eq('site_id', siteId);
      return json(res, 200, { ok: true });
    }
  } catch (e) {
    console.error('order/templates', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
