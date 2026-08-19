'use strict';

const { getAdmin } = require('./supabase');

async function writeAudit(evt) {
  const admin = getAdmin();
  const row = {
    order_system_id: evt.order_system_id || null,
    site_id: evt.site_id,
    order_id: evt.order_id || null,
    cart_id: evt.cart_id || null,
    event_type: evt.event_type,
    actor_user_id: evt.actor_user_id || null,
    actor_label: evt.actor_label || null,
    source: evt.source || 'system',
    payload: evt.payload || {}
  };
  const { error } = await admin.from('order_audit_events').insert(row);
  if (error) throw error;
}

async function writeChange(chg) {
  const admin = getAdmin();
  const { error } = await admin.from('order_changes').insert({
    order_id: chg.order_id,
    site_id: chg.site_id,
    order_item_id: chg.order_item_id || null,
    field_path: chg.field_path,
    previous_value: chg.previous_value == null ? null : chg.previous_value,
    new_value: chg.new_value == null ? null : chg.new_value,
    source: chg.source,
    actor_user_id: chg.actor_user_id || null,
    actor_label: chg.actor_label || null,
    note: chg.note || null
  });
  if (error) throw error;
}

module.exports = { writeAudit, writeChange };
