// api/domains/diag.js — ADMIN ONLY. Confirms the Dreamscape connection + which
// auth header style your account uses, and shows raw response shapes.
// Call: /api/domains/diag?key=<DREAMSCAPE_DIAG_KEY>   (never link this in the UI)

const ds = require('../../dreamscape');

module.exports = async (req, res) => {
  const key = (req.query && req.query.key) || '';
  const expected = process.env.DREAMSCAPE_DIAG_KEY || '';
  if (!expected || key !== expected) return res.status(404).json({ error: 'Not found' });

  // Which auth style works? (2xx = good; 401/403 = wrong style; 0 = network)
  const authProbe = await ds.diagnoseAuth();
  const working = Object.keys(authProbe).find(k => authProbe[k] >= 200 && authProbe[k] < 300) || null;

  const sample = (req.query && req.query.domain) || 'example-test-9271.com.au';
  const [reseller, balance, currencies, avail, privacy] = await Promise.all([
    ds.getReseller(), ds.getBalance(), ds.getCurrencies(), ds.checkAvailability(sample), ds.listDomainPrivacyProducts()
  ]);

  res.setHeader('cache-control', 'no-store');
  return res.status(200).json({
    config: { base: ds.BASE, scheme: ds.SCHEME, minReserve: ds.MIN_RESERVE, lowWarning: ds.LOW_WARNING },
    authProbe,                                   // status per strategy
    workingAuthStrategy: working,                // set DREAMSCAPE_API_AUTH_SCHEME to the matching value
    reseller, balance, currencies,
    availabilitySample: Object.assign({ domain: sample }, avail),
    domainPrivacyProducts: privacy
  });
};
