'use strict';

/**
 * Is a Cloudinary image (or folder) still used anywhere in LeadPages?
 *
 * Why (Nov 2026): sites are copied (demos, partner showcase copies, "duplicate site", AI
 * starters) and the copy keeps the original's image URLs and *_pid ids. When the copy's
 * editor replaced or cleared an image it deleted the "old" file, after checking only its own
 * config, so the original site lost that image (RTT's hero, Bean Culture's trust bar, etc).
 *
 * Every server-side delete now asks this first and refuses if any row still points at the file:
 * live/draft/demo sites, partner pages, presets, catalog blocks, positioning layouts, lead email
 * styles, quote-system versions and site backups (so restoring a backup never brings back a
 * broken image).
 */

const SOURCES = [
  { table: 'sites', cols: ['config'], key: 'id' },
  { table: 'partner_profiles', cols: ['showcase_config'], key: 'partner_id' },
  { table: 'app_presets', cols: ['config'], key: 'id' },
  { table: 'catalog_blocks', cols: ['payload'], key: 'id' },
  { table: 'positioning_layouts', cols: ['demo_packs', 'layout_image_url', 'theme_image_url'], key: 'id' },
  { table: 'lead_notify_email_styles', cols: ['style'], key: 'id' },
  { table: 'quote_system_config_versions', cols: ['config'], key: 'id' },
  { table: 'site_backups', cols: ['config'], key: 'id', siteCol: 'site_id' },
  { table: 'site_brains', cols: ['snapshot'], key: 'id', siteCol: 'site_id' },
  { table: 'partner_showcase_library', cols: ['image_url', 'image_pid'], key: 'site_id', siteCol: 'site_id' }
];

const PAGE = 200;

function toText(v) {
  if (v == null) return '';
  return typeof v === 'string' ? v : JSON.stringify(v);
}

/**
 * Find rows that mention `needle` (a public id such as "leadpages/<site>/hero/abc", or a
 * folder prefix such as "leadpages/<site>/").
 * opts.ignoreSiteIds: site ids whose own rows don't count (used when a whole site is being
 * removed — its own config/backups may still list its files).
 * Returns { refs: [{ table, id }], complete: boolean }. complete=false means a table could not
 * be read; callers must then treat the file as in use.
 */
async function findReferences(admin, needle, opts) {
  opts = opts || {};
  const ignore = new Set((opts.ignoreSiteIds || []).filter(Boolean).map(String));
  const want = String(needle || '');
  const refs = [];
  let complete = true;
  if (!want) return { refs, complete: false };
  for (const src of SOURCES) {
    const select = Array.from(new Set([src.key].concat(src.siteCol ? [src.siteCol] : [], src.cols))).join(',');
    for (let from = 0; from < 20000; from += PAGE) {
      let res;
      try {
        res = await admin.from(src.table).select(select).range(from, from + PAGE - 1);
      } catch (e) {
        res = { error: e };
      }
      if (res.error) {
        // A missing optional table is fine; anything else means we can't be sure.
        const msg = String((res.error && (res.error.message || res.error.code)) || '');
        if (!/does not exist|42P01|schema cache/i.test(msg)) complete = false;
        break;
      }
      const rows = res.data || [];
      rows.forEach(function(r) {
        const rowSite = src.table === 'sites' ? r[src.key] : (src.siteCol ? r[src.siteCol] : null);
        if (rowSite && ignore.has(String(rowSite))) return;
        for (const c of src.cols) {
          if (toText(r[c]).indexOf(want) >= 0) { refs.push({ table: src.table, id: r[src.key] }); break; }
        }
      });
      if (rows.length < PAGE) break;
    }
  }
  return { refs, complete };
}

/** Site ids that a "leadpages/<seg>/" folder belongs to (id folders and legacy slug folders). */
async function siteIdsForPrefix(admin, prefix) {
  const m = /^leadpages\/([^/]+)\/?/.exec(String(prefix || ''));
  if (!m) return [];
  const seg = m[1];
  const out = [];
  if (/^[0-9a-f-]{36}$/i.test(seg)) out.push(seg);
  try {
    const r = await admin.from('sites').select('id').eq('slug', seg);
    (r.data || []).forEach(function(x) { out.push(x.id); });
  } catch (_e) { /* id folder is enough */ }
  return out;
}

module.exports = { findReferences, siteIdsForPrefix, SOURCES };
