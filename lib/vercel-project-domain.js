/**
 * Helpers for attaching client hostnames to the shared Vercel project.
 */

function normalizeApex(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');
}

function wwwHost(apex) {
  const a = normalizeApex(apex);
  return a ? 'www.' + a : '';
}

/**
 * Classify a Vercel addProjectDomain success or thrown error.
 * @returns {{ status: string, code?: string, verified?: boolean, message?: string, data?: any }}
 */
function classifyProjectDomainResult(errOrData, asError) {
  if (!asError) {
    const data = errOrData || {};
    const verified = data.verified !== false;
    return {
      status: verified ? 'added' : 'pending',
      verified: !!verified,
      data: data
    };
  }

  const err = errOrData || {};
  const status = err.status;
  const data = err.data || {};
  const code = (data.error && data.error.code) || err.code || '';
  const msg = String(
    (data.error && data.error.message) || err.message || ''
  ).toLowerCase();

  if (code === 'no_token' || code === 'no_project') {
    return { status: 'error', code: 'not_configured', message: err.message };
  }
  if (
    status === 400 &&
    (/already/i.test(msg) ||
      /exist/i.test(msg) ||
      /domain_already/i.test(code) ||
      /taken/i.test(msg))
  ) {
    return { status: 'already_exists', code: 'already_exists', message: err.message, data: data };
  }
  if (/limit|quota|maximum|too many/i.test(msg) || status === 402) {
    return { status: 'error', code: 'quota_exceeded', message: err.message, data: data };
  }
  if (/another|other project|owned|conflict/i.test(msg) || status === 409) {
    return { status: 'error', code: 'domain_elsewhere', message: err.message, data: data };
  }
  return {
    status: 'error',
    code: code || 'vercel_error',
    message: err.message || 'Vercel API error',
    data: data
  };
}

/**
 * Add apex (+ optional www) to the project. Treats "already exists" as success.
 */
async function attachHostsToProject(vercel, apex, opts) {
  const host = normalizeApex(apex);
  const includeWww = !opts || opts.includeWww !== false;
  const out = { apex: null, www: null };

  async function one(name, addOpts) {
    try {
      const data = await vercel.addProjectDomain(name, addOpts);
      return classifyProjectDomainResult(data, false);
    } catch (e) {
      const classified = classifyProjectDomainResult(e, true);
      if (classified.status === 'already_exists') {
        try {
          const existing = await vercel.getProjectDomain(name);
          if (existing) {
            return {
              status: 'already_exists',
              code: 'already_exists',
              verified: existing.verified !== false,
              data: existing
            };
          }
        } catch (_) { /* ignore */ }
      }
      return classified;
    }
  }

  out.apex = await one(host);
  if (includeWww) {
    const www = wwwHost(host);
    // Keep www serving the same project (render strips www). No redirect required.
    out.www = await one(www);
  }
  return out;
}

module.exports = {
  normalizeApex,
  wwwHost,
  classifyProjectDomainResult,
  attachHostsToProject
};
