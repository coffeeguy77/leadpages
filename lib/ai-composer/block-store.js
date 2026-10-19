'use strict';

/**
 * Loading and saving AI Composer design blocks (table composer_layouts).
 * Who may use a block: super admins any; others approved blocks plus their own.
 */

const { admin } = require('../layout-composer/http');

const COLS = 'id,app_key,name,looks,template,css,fields,status,created_by,partner_id';

function toBlock(row) {
  return { id: row.id, app: row.app_key, name: row.name, looks: row.looks, template: row.template, css: row.css, fields: row.fields || {}, status: row.status };
}

function mayUse(access, row) {
  if (!row || row.status === 'hidden') return false;
  if (access.role === 'super' || row.status === 'approved') return true;
  return !!(access.partner && row.partner_id === access.partner.id);
}

/**
 * Blocks referenced by a plan's sections, that this account may use.
 * @returns {Promise<Record<string, object>>}
 */
async function blocksForPlan(access, plan) {
  const ids = (plan.sections || []).map(function (s) { return s.block; }).filter(Boolean);
  if (!ids.length) return {};
  const r = await admin.from('composer_layouts').select(COLS).in('id', ids.slice(0, 20));
  if (r.error) throw new Error('Could not load new layouts: ' + r.error.message);
  const out = {};
  (r.data || []).forEach(function (row) { if (mayUse(access, row)) out[row.id] = toBlock(row); });
  return out;
}

/** Short name the plan prompt uses for a block. */
function blockAlias(id) { return 'custom-' + String(id).slice(0, 8); }

/**
 * Approved blocks, offered to the planner for every account.
 * @returns {Promise<{ byApp: Record<string, object[]>, byAlias: Record<string, object> }>}
 */
async function approvedBlocks() {
  const r = await admin.from('composer_layouts').select('id,app_key,name,looks,fields,status').eq('status', 'approved').order('created_at', { ascending: false }).limit(60);
  const byApp = {};
  const byAlias = {};
  if (r.error) return { byApp: byApp, byAlias: byAlias };
  (r.data || []).forEach(function (row) {
    const alias = blockAlias(row.id);
    const b = { id: row.id, app: row.app_key, alias: alias, name: row.name, looks: row.looks, layout: (row.fields && row.fields.layout) || '' };
    (byApp[row.app_key] = byApp[row.app_key] || []).push(b);
    byAlias[row.app_key + '/' + alias] = b;
  });
  return { byApp: byApp, byAlias: byAlias };
}

/**
 * The plan names a custom layout by alias in its "layout": turn it into the block id
 * plus the base layout it was made with (its fields come from that layout).
 */
function resolvePlanAliases(rawPlan, approved) {
  (rawPlan && Array.isArray(rawPlan.sections) ? rawPlan.sections : []).forEach(function (s) {
    if (!s || typeof s.layout !== 'string' || s.layout.indexOf('custom-') !== 0) return;
    const b = approved.byAlias[String(s.appKey) + '/' + s.layout];
    if (b) { s.block = b.id; s.layout = b.layout; } else { s.layout = ''; }
  });
  return rawPlan;
}

/** Save a new block. Super admins' blocks are approved straight away. */
async function saveBlock(access, block, meta) {
  const row = {
    id: block.id,
    app_key: block.app,
    name: block.name,
    looks: block.looks,
    template: block.template,
    css: block.css,
    fields: block.fields,
    status: access.role === 'super' ? 'approved' : 'site',
    approved_at: access.role === 'super' ? new Date().toISOString() : null,
    created_by: access.user && access.user.id,
    partner_id: access.partner ? access.partner.id : null,
    site_slug: meta && meta.slug || null,
    design_url: meta && meta.designUrl || null
  };
  const r = await admin.from('composer_layouts').insert(row).select('id,status').single();
  if (r.error) throw new Error('Could not save the new layout: ' + r.error.message);
  return r.data;
}

/** Super admin list of blocks. */
async function listBlocks() {
  const r = await admin.from('composer_layouts').select('id,app_key,name,looks,status,created_by,partner_id,site_slug,design_url,created_at,approved_at').order('created_at', { ascending: false }).limit(200);
  if (r.error) throw new Error(r.error.message);
  return r.data || [];
}

async function setBlockStatus(id, status) {
  if (['approved', 'site', 'hidden'].indexOf(status) < 0) throw new Error('Unknown status');
  const r = await admin.from('composer_layouts').update({ status: status, approved_at: status === 'approved' ? new Date().toISOString() : null }).eq('id', id).select('id,status').single();
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

module.exports = { blocksForPlan, saveBlock, mayUse, toBlock, blockAlias, approvedBlocks, resolvePlanAliases, listBlocks, setBlockStatus };
