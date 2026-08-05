/**
 * Reconcile Dreamscape DNS so "Point at my site" leaves only Vercel-compatible
 * apex A + www CNAME. Dreamscape defaults often leave parking A records
 * (e.g. 27.124.x / 216.150.x); adding the Vercel A without deleting them
 * leaves Vercel in "Invalid Configuration".
 */

function normalizeDnsContent(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
}

/**
 * Map a Dreamscape record's subdomain onto @ / www / other relative label.
 */
function normalizeSubdomain(sub, apex) {
  const a = String(apex || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  let s = String(sub == null ? '' : sub)
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  if (!s || s === '@' || s === a) return '@';
  if (s === 'www' || (a && s === 'www.' + a)) return 'www';
  if (a && s.endsWith('.' + a)) {
    const rel = s.slice(0, -(a.length + 1));
    if (!rel || rel === '@') return '@';
    if (rel === 'www') return 'www';
    return rel;
  }
  return s;
}

function recordContent(rec) {
  if (!rec || typeof rec !== 'object') return '';
  return normalizeDnsContent(rec.content || rec.value || rec.forward_to || rec.target || '');
}

function recordId(rec) {
  if (!rec || rec.id == null) return null;
  return rec.id;
}

/**
 * Decide which records to delete and whether apex/www still need creating.
 * Pure — safe to unit test.
 *
 * @param {object[]} records
 * @param {{ domainName: string, apexA: string, wwwCname: string }} opts
 * @returns {{ deleteIds: any[], needApex: boolean, needWww: boolean, keptApexIds: any[], keptWwwIds: any[] }}
 */
function planVercelDnsReconcile(records, opts) {
  const apex = String((opts && opts.domainName) || '')
    .trim()
    .toLowerCase();
  const wantA = normalizeDnsContent((opts && opts.apexA) || '76.76.21.21');
  const wantCname = normalizeDnsContent((opts && opts.wwwCname) || 'cname.vercel-dns.com');
  const list = Array.isArray(records) ? records : [];

  const deleteIds = [];
  const keptApexIds = [];
  const keptWwwIds = [];
  let haveApex = false;
  let haveWww = false;

  // Types that compete with site pointing at apex / www.
  const CONFLICT_TYPES = new Set(['A', 'AAAA', 'CNAME', 'WEBFWD']);

  for (const rec of list) {
    const type = String((rec && rec.type) || '').toUpperCase();
    if (!CONFLICT_TYPES.has(type)) continue;

    const sub = normalizeSubdomain(rec && rec.subdomain, apex);
    const id = recordId(rec);
    const content = recordContent(rec);

    if (sub === '@') {
      const isDesired = type === 'A' && content === wantA;
      if (isDesired) {
        haveApex = true;
        if (id != null) keptApexIds.push(id);
      } else if (id != null) {
        deleteIds.push(id);
      }
      continue;
    }

    if (sub === 'www') {
      const isDesired = type === 'CNAME' && content === wantCname;
      if (isDesired) {
        haveWww = true;
        if (id != null) keptWwwIds.push(id);
      } else if (id != null) {
        deleteIds.push(id);
      }
    }
  }

  // Deduplicate delete ids while preserving order.
  const seen = new Set();
  const uniqueDeletes = [];
  for (const id of deleteIds) {
    const key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueDeletes.push(id);
  }

  return {
    deleteIds: uniqueDeletes,
    needApex: !haveApex,
    needWww: !haveWww,
    keptApexIds,
    keptWwwIds
  };
}

/**
 * List → delete conflicts → ensure desired A/CNAME via Dreamscape client.
 *
 * @param {object} ds dreamscape module (listDomainDns, deleteDomainDns, addDomainDns)
 * @param {string|number} dsId
 * @param {{ domainName: string, apexA: string, wwwCname: string }} opts
 */
async function reconcileVercelDns(ds, dsId, opts) {
  const apexA = normalizeDnsContent((opts && opts.apexA) || '76.76.21.21') || '76.76.21.21';
  const wwwCname =
    normalizeDnsContent((opts && opts.wwwCname) || 'cname.vercel-dns.com') || 'cname.vercel-dns.com';
  const domainName = String((opts && opts.domainName) || '')
    .trim()
    .toLowerCase();

  const listed = await ds.listDomainDns(dsId);
  if (!listed || !listed.ok) {
    return {
      ok: false,
      error: (listed && listed.error) || 'Could not load DNS records.',
      apex: { status: 'error', error: 'list_failed' },
      www: { status: 'error', error: 'list_failed' },
      removed: []
    };
  }

  const records = (listed.data && listed.data.data) || [];
  const plan = planVercelDnsReconcile(records, { domainName, apexA, wwwCname });

  const removed = [];
  const removeErrors = [];
  for (const id of plan.deleteIds) {
    const del = await ds.deleteDomainDns(dsId, id);
    if (del && (del.ok || del.status === 204)) {
      removed.push(id);
    } else {
      removeErrors.push({
        id,
        error: (del && del.error) || 'delete_failed'
      });
    }
  }

  // If deletes failed for conflicts, still try to add — but report errors.
  let apexStatus;
  if (!plan.needApex) {
    apexStatus = { status: 'ok', detail: 'already_set' };
  } else {
    const add = await ds.addDomainDns(dsId, {
      type: 'A',
      subdomain: '@',
      content: apexA
    });
    if (add && add.ok) {
      apexStatus = { status: 'ok', detail: 'created' };
    } else {
      const err = String((add && add.error) || '').toLowerCase();
      if (/exist|already|duplicate|conflict/i.test(err)) {
        apexStatus = { status: 'ok', detail: 'already_set', error: add.error };
      } else {
        apexStatus = { status: 'error', error: (add && add.error) || 'dns_failed' };
      }
    }
  }

  let wwwStatus;
  if (!plan.needWww) {
    wwwStatus = { status: 'ok', detail: 'already_set' };
  } else {
    const add = await ds.addDomainDns(dsId, {
      type: 'CNAME',
      subdomain: 'www',
      content: wwwCname
    });
    if (add && add.ok) {
      wwwStatus = { status: 'ok', detail: 'created' };
    } else {
      const err = String((add && add.error) || '').toLowerCase();
      if (/exist|already|duplicate|conflict/i.test(err)) {
        wwwStatus = { status: 'ok', detail: 'already_set', error: add.error };
      } else {
        wwwStatus = { status: 'error', error: (add && add.error) || 'dns_failed' };
      }
    }
  }

  const ok =
    apexStatus.status === 'ok' &&
    wwwStatus.status === 'ok' &&
    removeErrors.length === 0;

  return {
    ok,
    apex: apexStatus,
    www: wwwStatus,
    removed,
    remove_errors: removeErrors,
    plan: {
      delete_count: plan.deleteIds.length,
      need_apex: plan.needApex,
      need_www: plan.needWww
    },
    error: ok
      ? null
      : removeErrors.length
        ? 'Could not remove one or more conflicting DNS records.'
        : (apexStatus.error || wwwStatus.error || 'dns_failed')
  };
}

module.exports = {
  normalizeDnsContent,
  normalizeSubdomain,
  planVercelDnsReconcile,
  reconcileVercelDns
};
