/* LeadPages — three-way merge for sites.config.
 *
 * The editor keeps a whole copy of the site config. When the same site is changed somewhere
 * else while the editor is open (another tab, a restore, Claude, Website Studio), writing the
 * editor's copy back would wipe those changes. lpMergeConfig() combines both:
 *
 *   rawBase   what the server had when the editor loaded the site (as stored)
 *   normBase  the same, after the editor's load-time normalising (defaults it fills in)
 *   mine      the editor's config now
 *   theirs    what the server has now
 *
 * Rules, per field (recursing into objects):
 *   - only the editor changed it        -> keep the editor's value
 *   - only the server copy changed it   -> keep the server's value
 *   - both changed it to the same value -> that value
 *   - both changed it differently       -> a conflict (decisions[path] = 'mine' | 'theirs';
 *                                          default 'mine'), reported in result.conflicts
 * Arrays of objects with unique `id`s (pages, slides…) merge item by item, so a page added on
 * the server and a page edited in the editor both survive. Other arrays are single values.
 *
 * Pure functions, no DOM: used by manage.html and by tests (module.exports).
 */
(function (root) {
  'use strict';

  var MISSING = '\u0000missing';

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  /** Stable text for comparing: object key order ignored (Postgres jsonb reorders keys). */
  function canon(v) {
    if (v === undefined) return MISSING;
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (isObj(v)) {
      return '{' + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; })
        .map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
    }
    return JSON.stringify(v);
  }
  function same(a, b) { return canon(a) === canon(b); }

  function idOf(x) { return isObj(x) && x.id != null && x.id !== '' ? String(x.id) : null; }
  /** Every item is an object with a unique id (an empty or missing array also qualifies). */
  function idArray(a) {
    if (a === undefined || a === null) return true;
    if (!Array.isArray(a)) return false;
    var seen = {};
    for (var i = 0; i < a.length; i++) {
      var id = idOf(a[i]);
      if (id === null || seen[id]) return false;
      seen[id] = 1;
    }
    return true;
  }
  function byId(a) {
    var m = {};
    (Array.isArray(a) ? a : []).forEach(function (x) { m[idOf(x)] = x; });
    return m;
  }
  function has(m, k) { return Object.prototype.hasOwnProperty.call(m, k); }

  function itemLabel(x) {
    if (!isObj(x)) return '';
    return String(x.title || x.menuLabel || x.label || x.heading || x.name || x.slug || x.id || '').slice(0, 60);
  }

  function mergeArrays(rb, nb, mine, theirs, path, label, ctx) {
    var R = byId(rb), N = byId(nb), M = byId(mine), T = byId(theirs);
    var mineIds = (mine || []).map(idOf), theirIds = (theirs || []).map(idOf), baseIds = (rb || []).map(idOf);
    // Order: whoever re-ordered wins; otherwise the server's order, with the editor's new items placed after their neighbour.
    var mineOrder = canon(mineIds.filter(function (id) { return has(R, id); })) !== canon(baseIds.filter(function (id) { return has(M, id); }));
    var theirOrder = canon(theirIds.filter(function (id) { return has(R, id); })) !== canon(baseIds.filter(function (id) { return has(T, id); }));
    var primary = theirOrder || !mineOrder ? theirIds : mineIds;
    var secondary = primary === theirIds ? mineIds : theirIds;
    var order = primary.slice();
    secondary.forEach(function (id, i) {
      if (order.indexOf(id) >= 0) return;
      var at = -1;
      for (var j = i - 1; j >= 0 && at < 0; j--) at = order.indexOf(secondary[j]);
      order.splice(at + 1, 0, id);
    });
    var out = [];
    order.forEach(function (id) {
      var inBase = has(R, id) || has(N, id);
      var key = path.concat('#' + id);
      var lab = label.concat(itemLabel(has(M, id) ? M[id] : T[id]) || id);
      if (has(M, id) && has(T, id)) {
        out.push(merge(R[id], N[id], M[id], T[id], key, lab, ctx));
        return;
      }
      if (has(T, id)) {
        if (!inBase) { out.push(T[id]); return; }               // added on the server
        if (same(T[id], R[id])) return;                          // removed in the editor, untouched elsewhere
        if (pick(ctx, key, lab, undefined, T[id], 'removed here, changed elsewhere') === 'theirs') out.push(T[id]);
        return;
      }
      if (has(M, id)) {
        if (!inBase) { out.push(M[id]); return; }               // added in the editor
        if (same(M[id], has(N, id) ? N[id] : R[id])) return;     // removed elsewhere, untouched here
        if (pick(ctx, key, lab, M[id], undefined, 'changed here, removed elsewhere') === 'mine') out.push(M[id]);
      }
    });
    return out;
  }

  function pick(ctx, path, label, mine, theirs, note) {
    var k = path.join('/');
    var choice = ctx.decisions[k] === 'theirs' ? 'theirs' : 'mine';
    ctx.conflicts.push({ key: k, label: label.filter(Boolean).join(' › '), mine: mine, theirs: theirs, note: note || '', choice: choice });
    return choice;
  }

  function merge(rb, nb, mine, theirs, path, label, ctx) {
    if (nb === undefined) nb = rb;
    var mineChanged = !same(mine, nb) && !same(mine, rb);
    var theirChanged = !same(theirs, rb);
    if (!theirChanged) return mine;
    if (!mineChanged) return theirs;
    if (same(mine, theirs)) return mine;
    if (isObj(mine) && isObj(theirs)) {
      var out = {};
      var keys = Object.keys(mine);
      Object.keys(theirs).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
      [rb, nb].forEach(function (b) { if (isObj(b)) Object.keys(b).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); }); });
      keys.forEach(function (k) {
        var v = merge(isObj(rb) ? rb[k] : undefined, isObj(nb) ? nb[k] : undefined, mine[k], theirs[k], path.concat(k), label.concat(k), ctx);
        if (v !== undefined) out[k] = v;
      });
      return out;
    }
    if (Array.isArray(mine) && Array.isArray(theirs) && idArray(mine) && idArray(theirs) && idArray(rb) && idArray(nb)) {
      return mergeArrays(rb || [], nb || rb || [], mine, theirs, path, label, ctx);
    }
    return pick(ctx, path, label, mine, theirs) === 'theirs' ? theirs : mine;
  }

  /**
   * @returns {{config: object, conflicts: Array, changedElsewhere: boolean, differsFromMine: boolean}}
   */
  function lpMergeConfig(rawBase, normBase, mine, theirs, decisions) {
    var ctx = { decisions: decisions || {}, conflicts: [] };
    var cfg = merge(rawBase || {}, normBase || rawBase || {}, mine || {}, theirs || {}, [], [], ctx);
    return {
      config: cfg,
      conflicts: ctx.conflicts,
      changedElsewhere: !same(theirs || {}, rawBase || {}),
      differsFromMine: !same(cfg, mine || {})
    };
  }

  var api = { lpMergeConfig: lpMergeConfig, canon: canon, same: same };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LPConfigMerge = api;
})(typeof window !== 'undefined' ? window : this);
