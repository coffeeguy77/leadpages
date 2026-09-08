'use strict';

/**
 * OAuth redirect target for Xero Bookings connect.
 * Xero app redirect URI: /api/bookings/xero/callback
 * Delegates to the xero action router with action=callback.
 */

module.exports = async function (req, res) {
  const url = new URL(req.url || '/', 'https://x');
  if (!url.searchParams.get('action')) url.searchParams.set('action', 'callback');
  req.url = '/api/bookings/xero?' + url.searchParams.toString();
  return require('../xero.js')(req, res);
};
