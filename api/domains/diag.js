// api/domains/diag.js — ADMIN ONLY. /api/domains/diag?key=<DREAMSCAPE_DIAG_KEY>
const ds = require('../../dreamscape');

module.exports = async (req, res) => {
  const key = (req.query && req.query.key) || '';
  const expected = process.env.DREAMSCAPE_DIAG_KEY || '';
  if (!expected || key !== expected) return res.status(404).json({ error: 'Not found' });

  const test = (req.query && req.query.domain) || 'duncansplumbing.com.au';
  const [reseller, balance, currencies, tlds, avail] = await Promise.all([
    ds.getReseller(), ds.getBalance(), ds.getCurrencies(), ds.listTlds(), ds.checkAvailability([test, 'google.com'])
  ]);
  res.setHeader('cache-control', 'no-store');
  return res.status(200).json({
    config: { base: ds.BASE }, env: ds.envStatus(),
    reseller, balance, balanceParsed: ds.readBalance(balance), currencies, tlds,
    availability: avail
  });
};
