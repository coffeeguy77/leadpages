// api/domains/diag.js — ADMIN ONLY. Confirms connection/auth + discovers the real
// request params & response shapes. Call: /api/domains/diag?key=<DREAMSCAPE_DIAG_KEY>
// Optional: &domain=somedomain.com.au to test availability with a specific name.

const ds = require('../../dreamscape');

module.exports = async (req, res) => {
  const key = (req.query && req.query.key) || '';
  const expected = process.env.DREAMSCAPE_DIAG_KEY || '';
  if (!expected || key !== expected) return res.status(404).json({ error: 'Not found' });

  const authProbe = await ds.diagnoseAuth();
  const working = Object.keys(authProbe).find(k => authProbe[k] >= 200 && authProbe[k] < 300) || null;

  // --- read-only endpoints: see the REAL body shapes ---
  const [reseller, balance, currencies] = await Promise.all([
    ds.getReseller(), ds.getBalance(), ds.getCurrencies()
  ]);

  // --- availability: try several param names + a POST, show raw of each ---
  const testDomain = (req.query && req.query.domain) || 'duncansplumbing.com.au';
  const keys = ['domain', 'domains', 'name', 'query', 'q', 'domain_name', 'domain_names'];
  const availabilityProbes = {};
  for (const k of keys) {
    const r = await ds.call('GET', '/domains/availability', { query: { [k]: testDomain } });
    availabilityProbes['GET ?' + k] = { status: r.status, ok: r.ok, data: r.data };
  }
  const post = await ds.call('POST', '/domains/availability', { body: { domain: testDomain } });
  availabilityProbes['POST {domain}'] = { status: post.status, ok: post.ok, data: post.data };

  // raw bytes, exactly as Dreamscape sends them (to compare against the swagger tester)
  const rawProbes = {
    reseller:        await ds.rawGet('/reseller'),
    balance:         await ds.rawGet('/finances/balance'),
    availability:    await ds.rawGet('/domains/availability', { domain: testDomain }),
    tlds:            await ds.rawGet('/domains/tlds')
  };

  res.setHeader('cache-control', 'no-store');
  return res.status(200).json({
    config: { base: ds.BASE, scheme: ds.SCHEME },
    env: ds.envStatus(),
    workingAuthStrategy: working,
    reseller, balance, currencies,
    availabilityProbes,
    rawProbes
  });
};
