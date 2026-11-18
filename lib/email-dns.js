'use strict';
/**
 * Email DNS for client domains on Vercel nameservers (LeadPages never hosts mail).
 *
 * Works out the MX / SPF / DKIM / DMARC (and Outlook autodiscover) records a
 * domain needs for Google Workspace, Microsoft 365 (Outlook) or any other
 * ("remote") mail provider, and the smallest set of changes to get there.
 *
 * Pure — no network. api/site/email-dns.js applies the plan via Vercel.
 *
 * Safety rules:
 *  - Only ever touches: apex MX, apex SPF (TXT v=spf1), the DKIM selectors the
 *    plan names, _dmarc (only when missing) and the Outlook autodiscover CNAME.
 *    Website, verification and other TXT records are never changed.
 *  - Exactly one SPF record. Other services' includes (e.g. Dreamscape
 *    notifications) are kept; only the old mail provider's include is swapped.
 *  - Existing DMARC is never overwritten (the customer may have a policy).
 *  - Values Google/Microsoft generate per customer (DKIM keys, Microsoft MX)
 *    are pasted by the customer, never guessed.
 */

const PROVIDERS = {
  google: {
    label: 'Google Workspace',
    mx: [{ host: 'smtp.google.com', priority: 1 }],
    spf: ['include:_spf.google.com'],
    dkimSelector: 'google',
  },
  outlook: {
    label: 'Microsoft 365 (Outlook)',
    mxPriority: 0,
    spf: ['include:spf.protection.outlook.com'],
    autodiscover: 'autodiscover.outlook.com',
  },
  remote: { label: 'Other email provider' },
};

// Includes that belong to a mail provider — swapped out when the provider changes.
const PROVIDER_SPF = ['include:_spf.google.com', 'include:spf.protection.outlook.com'];

const DMARC_DEFAULT = 'v=DMARC1; p=none';

function clean(v) {
  return String(v == null ? '' : v).trim();
}

/** Lower-case hostname, no trailing dot, no scheme. */
function host(v) {
  return clean(v).toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/\/.*$/, '').replace(/\.$/, '');
}

function isHostname(v, allowUnderscore) {
  const h = host(v);
  const label = allowUnderscore ? '[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?' : '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
  return h.length > 3 && h.length <= 253 && new RegExp('^(' + label + '\\.)+[a-z][a-z0-9-]{1,62}$').test(h);
}

/** Strip wrapping quotes and join split TXT chunks ("abc" "def"). */
function txt(v) {
  let s = clean(v);
  if (/^".*"$/s.test(s)) s = s.replace(/"\s+"/g, '').replace(/^"|"$/g, '');
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Vercel record name relative to the domain ('' = apex).
 * Accepts '@', the full domain, or 'x.domain.com'.
 */
function relName(name, domain) {
  const n = host(name);
  const d = host(domain);
  if (!n || n === '@' || n === d) return '';
  if (d && n.endsWith('.' + d)) return n.slice(0, -(d.length + 1));
  return n;
}

/** Vercel records → { id, type, name, value, priority } with comparable values. */
function normalizeRecords(records, domain) {
  return (records || []).map(function (r) {
    const type = clean(r.type).toUpperCase();
    const val = type === 'TXT' ? txt(r.value) : host(r.value);
    return {
      id: r.id || r.uid || null,
      type,
      name: relName(r.name, domain),
      value: val,
      priority: r.mxPriority != null ? Number(r.mxPriority) : (r.priority != null ? Number(r.priority) : null),
      system: r.creator === 'system',
    };
  });
}

function isSpf(r) {
  return r.type === 'TXT' && r.name === '' && /^v=spf1(\s|$)/i.test(r.value);
}

function isDkimName(name) {
  return /(^|\.)_domainkey$/.test(name);
}

/** What the domain's mail currently looks like. */
function inspect(records, domain) {
  const recs = normalizeRecords(records, domain);
  const mx = recs.filter(function (r) { return r.type === 'MX' && r.name === ''; });
  const spf = recs.filter(isSpf);
  const dkim = recs.filter(function (r) { return (r.type === 'TXT' || r.type === 'CNAME') && isDkimName(r.name); });
  const dmarc = recs.filter(function (r) { return r.type === 'TXT' && r.name === '_dmarc'; });
  const autodiscover = recs.filter(function (r) { return r.type === 'CNAME' && r.name === 'autodiscover'; });
  return {
    provider: detectProvider(mx),
    mx: mx.map(function (r) { return { host: r.value, priority: r.priority }; }).sort(function (a, b) { return (a.priority || 0) - (b.priority || 0); }),
    spf: spf.map(function (r) { return r.value; }),
    dkim: dkim.map(function (r) { return { selector: r.name.replace(/\._domainkey$/, ''), type: r.type, value: r.value }; }),
    dmarc: dmarc.map(function (r) { return r.value; }),
    autodiscover: autodiscover.map(function (r) { return r.value; }),
    problems: [].concat(spf.length > 1 ? ['Two or more SPF records — receivers treat this as an SPF failure.'] : []),
  };
}

function detectProvider(mx) {
  if (!mx || !mx.length) return 'none';
  const all = mx.map(function (r) { return r.value || r.host || ''; });
  if (all.every(function (h) { return /(^|\.)google\.com$|(^|\.)googlemail\.com$/.test(h); })) return 'google';
  if (all.every(function (h) { return /\.mail\.protection\.outlook\.com$|\.mx\.microsoft$/.test(h); })) return 'outlook';
  return 'remote';
}

// Second-level suffixes where the registrable domain has three labels (example.com.au).
const SLD = /\.(com|net|org|edu|gov|asn|id|co|ac)\.[a-z]{2}$/;

/** Registrable part of a host name: mx1.mailhost.net → mailhost.net, a.b.com.au → b.com.au */
function baseDomain(h) {
  const parts = host(h).split('.').filter(Boolean);
  const n = SLD.test(host(h)) ? 3 : 2;
  return parts.slice(-n).join('.');
}

/** Split an SPF value into its mechanisms (minus "v=spf1"). */
function spfTerms(value) {
  return txt(value).split(/\s+/).filter(function (t) { return t && !/^v=spf1$/i.test(t); });
}

/**
 * One SPF record: the existing terms (from every SPF record, de-duplicated),
 * minus the other mail providers' includes, plus the new provider's terms,
 * ending with the existing "all" (default ~all).
 */
function mergeSpf(existingValues, addTerms, opts) {
  opts = opts || {};
  const add = (addTerms || []).map(function (t) { return clean(t); }).filter(Boolean);
  let all = '~all';
  const keep = [];
  (existingValues || []).forEach(function (v) {
    spfTerms(v).forEach(function (t) {
      const low = t.toLowerCase();
      if (/^[-~?+]?all$/.test(low)) { all = t; return; }
      const isAdded = add.map(function (a) { return a.toLowerCase(); }).indexOf(low) >= 0;
      if (opts.dropProviderIncludes && PROVIDER_SPF.indexOf(low) >= 0 && !isAdded) return;
      if (!isAdded && opts.dropDomains && /^[+~?-]?include:/.test(low)) {
        const inc = baseDomain(low.replace(/^[+~?-]?include:/, ''));
        if (opts.dropDomains.indexOf(inc) >= 0) return;
      }
      if (keep.map(function (k) { return k.toLowerCase(); }).indexOf(low) < 0) keep.push(t);
    });
  });
  add.forEach(function (t) {
    if (/^[-~?+]?all$/i.test(t)) return;
    if (keep.map(function (k) { return k.toLowerCase(); }).indexOf(t.toLowerCase()) < 0) keep.push(t);
  });
  return ['v=spf1'].concat(keep, [all]).join(' ');
}

/** Turn a remote provider's SPF text ("include:x ip4:1.2.3.4" or a full record) into terms. */
function spfInputTerms(v) {
  return spfTerms(v).filter(function (t) { return !/^[-~?+]?all$/i.test(t); });
}

function err(list, msg) { list.push(msg); }

/**
 * Validate the customer's choices and build the records the domain should have.
 *
 * input = {
 *   provider: 'google'|'outlook'|'remote',
 *   spf: bool, dkim: bool, dmarc: bool,
 *   outlookMx: 'contoso-com.mail.protection.outlook.com',
 *   autodiscover: bool (outlook, default true),
 *   remoteMx: [{ host, priority }], remoteSpf: 'include:mail.example.com',
 *   dkimRecords: [{ selector, type:'TXT'|'CNAME', value }]
 * }
 */
function desired(input, domain) {
  const errors = [];
  const p = clean(input && input.provider).toLowerCase();
  const prov = PROVIDERS[p];
  if (!prov) return { errors: ['Choose Google, Outlook or Remote.'] };
  const want = { provider: p, mx: [], spfAdd: [], dkim: [], dmarc: null, autodiscover: null };

  if (p === 'google') {
    want.mx = prov.mx.slice();
  } else if (p === 'outlook') {
    const m = host(input.outlookMx);
    if (!m) err(errors, 'Paste the MX "Points to address" from Microsoft 365 (Settings → Domains).');
    else if (!/\.mail\.protection\.outlook\.com$|\.mx\.microsoft$/.test(m) || !isHostname(m)) {
      err(errors, 'That doesn’t look like a Microsoft 365 mail server. It ends in .mail.protection.outlook.com or .mx.microsoft.');
    } else want.mx = [{ host: m, priority: prov.mxPriority }];
    if (input.autodiscover !== false) want.autodiscover = prov.autodiscover;
  } else {
    const list = Array.isArray(input.remoteMx) ? input.remoteMx : [];
    list.forEach(function (r, i) {
      const h = host(r && r.host);
      if (!h) return;
      const pr = Number(r.priority);
      if (!isHostname(h)) err(errors, 'Mail server ' + (i + 1) + ' (' + h + ') isn’t a valid host name.');
      else if (!isFinite(pr) || pr < 0 || pr > 65535) err(errors, 'Mail server ' + (i + 1) + ' needs a priority from 0 to 65535.');
      else want.mx.push({ host: h, priority: Math.round(pr) });
    });
    if (!want.mx.length && !errors.length) err(errors, 'Add at least one mail server (MX host) from your email provider.');
  }

  if (input.spf) {
    if (p === 'remote') {
      const terms = spfInputTerms(input.remoteSpf);
      if (!terms.length) err(errors, 'Enter the SPF include from your email provider (e.g. include:spf.yourprovider.com), or untick SPF.');
      else if (terms.some(function (t) { return !/^[+~?-]?(include:|a\b|a:|mx\b|mx:|ip4:|ip6:|exists:|redirect=)/i.test(t); })) {
        err(errors, 'The SPF value should only contain things like include:…, ip4:… or mx.');
      } else want.spfAdd = terms;
    } else want.spfAdd = prov.spf.slice();
  }

  if (input.dkim) {
    const list = Array.isArray(input.dkimRecords) ? input.dkimRecords : [];
    list.forEach(function (d, i) {
      const sel = clean(d && d.selector).toLowerCase().replace(/\._domainkey(\..*)?$/, '');
      const type = clean(d && d.type).toUpperCase() || 'TXT';
      const raw = clean(d && d.value);
      if (!raw) return;
      const n = 'DKIM ' + (i + 1);
      if (!/^[a-z0-9]([a-z0-9-_.]{0,61}[a-z0-9])?$/.test(sel)) return err(errors, n + ': enter the selector (the part before ._domainkey).');
      if (type === 'TXT') {
        const v = txt(raw);
        if (!/^v=DKIM1;/i.test(v) || !/(^|;)\s*p=[A-Za-z0-9+/=]{100,}/.test(v)) return err(errors, n + ': paste the whole DKIM value — it starts with v=DKIM1; and contains p=…');
        want.dkim.push({ name: sel + '._domainkey', type: 'TXT', value: v });
      } else if (type === 'CNAME') {
        const v = host(raw);
        if (!isHostname(v, true)) return err(errors, n + ': the "points to" address isn’t a valid host name.');
        if (p === 'outlook' && !/\._domainkey\./.test(v)) return err(errors, n + ': Microsoft DKIM addresses contain ._domainkey. — copy it from the Defender portal.');
        want.dkim.push({ name: sel + '._domainkey', type: 'CNAME', value: v });
      } else err(errors, n + ': type must be TXT or CNAME.');
    });
    if (!want.dkim.length && !errors.length) {
      err(errors, p === 'outlook'
        ? 'Paste both DKIM CNAME values from Microsoft (selector1 and selector2), or untick DKIM.'
        : 'Paste the DKIM record from your email provider, or untick DKIM.');
    }
    if (p === 'outlook' && want.dkim.length && want.dkim.length < 2 && !errors.length) {
      err(errors, 'Microsoft 365 needs both DKIM records (selector1 and selector2).');
    }
  }

  if (input.dmarc) want.dmarc = DMARC_DEFAULT;
  if (errors.length) return { errors };
  return { want };
}

function sameMx(a, b) { return host(a.value || a.host) === host(b.value || b.host) && Number(a.priority) === Number(b.priority); }

/**
 * Smallest set of changes from the current Vercel records to the wanted state.
 * Returns { add:[{type,name,value,mxPriority?}], remove:[{id,type,name,value,priority}], unchanged:[...], notes:[...] }
 */
function plan(records, domain, want) {
  const recs = normalizeRecords(records, domain);
  const add = [];
  const remove = [];
  const unchanged = [];
  const notes = [];

  // MX at the apex: exactly the wanted set.
  const mx = recs.filter(function (r) { return r.type === 'MX' && r.name === ''; });
  mx.forEach(function (r) {
    if (want.mx.some(function (w) { return sameMx(r, w); })) unchanged.push(r);
    else remove.push(r);
  });
  want.mx.forEach(function (w) {
    if (!mx.some(function (r) { return sameMx(r, w); })) add.push({ type: 'MX', name: '', value: w.host, mxPriority: w.priority });
  });

  // SPF: one record.
  if (want.spfAdd && want.spfAdd.length) {
    const spf = recs.filter(isSpf);
    // The old mail host's own SPF include goes with its MX (e.g. mx1.oldhost.net → include:_spf.oldhost.net).
    const keepBases = want.mx.map(function (w) { return baseDomain(w.host); });
    const dropDomains = remove.filter(function (r) { return r.type === 'MX'; })
      .map(function (r) { return baseDomain(r.value); })
      .filter(function (d) { return d && keepBases.indexOf(d) < 0 && d !== baseDomain(domain); });
    const merged = mergeSpf(spf.map(function (r) { return r.value; }), want.spfAdd, { dropProviderIncludes: true, dropDomains: dropDomains });
    if (spf.length === 1 && spf[0].value === merged) unchanged.push(spf[0]);
    else {
      spf.forEach(function (r) { remove.push(r); });
      add.push({ type: 'TXT', name: '', value: merged });
      if (spf.length > 1) notes.push('Merged ' + spf.length + ' SPF records into one.');
    }
  }

  // DKIM: replace only the selectors being set.
  (want.dkim || []).forEach(function (w) {
    const at = recs.filter(function (r) { return r.name === w.name && (r.type === 'TXT' || r.type === 'CNAME'); });
    const same = at.length === 1 && at[0].type === w.type && at[0].value === (w.type === 'TXT' ? txt(w.value) : host(w.value));
    if (same) { unchanged.push(at[0]); return; }
    at.forEach(function (r) { remove.push(r); });
    add.push({ type: w.type, name: w.name, value: w.value });
  });

  // DMARC: add only when there is none.
  if (want.dmarc) {
    const d = recs.filter(function (r) { return r.type === 'TXT' && r.name === '_dmarc'; });
    if (d.length) { unchanged.push(d[0]); notes.push('DMARC already set — left as it is.'); }
    else add.push({ type: 'TXT', name: '_dmarc', value: want.dmarc });
  }

  // Outlook autodiscover.
  if (want.autodiscover) {
    const a = recs.filter(function (r) { return r.name === 'autodiscover'; });
    const ok = a.length === 1 && a[0].type === 'CNAME' && a[0].value === host(want.autodiscover);
    if (ok) unchanged.push(a[0]);
    else {
      a.forEach(function (r) { if (r.type === 'CNAME' || r.type === 'A' || r.type === 'AAAA' || r.type === 'TXT') remove.push(r); });
      add.push({ type: 'CNAME', name: 'autodiscover', value: host(want.autodiscover) });
    }
  }

  // A system (Vercel-managed) record is never removed.
  const blocked = remove.filter(function (r) { return r.system || !r.id; });
  if (blocked.length) notes.push('Some records are managed by Vercel and can’t be changed here.');
  return {
    add,
    remove: remove.filter(function (r) { return !r.system && r.id; }),
    unchanged,
    notes,
    blocked: blocked.length,
  };
}

/** Records for the undo of an applied change: recreate what was removed. */
function recreateBody(r) {
  const b = { type: r.type, name: r.name || '', value: r.value, ttl: 3600 };
  if (r.type === 'MX') b.mxPriority = r.priority != null ? r.priority : 10;
  return b;
}

module.exports = {
  PROVIDERS,
  DMARC_DEFAULT,
  host,
  txt,
  relName,
  isHostname,
  normalizeRecords,
  inspect,
  detectProvider,
  mergeSpf,
  baseDomain,
  desired,
  plan,
  recreateBody,
};
