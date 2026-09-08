'use strict';

/**
 * OAuth redirect target for Google Bookings connect.
 * Google Console redirect URI: /api/bookings/google/callback
 * Delegates to the google action router with action=callback.
 */

module.exports = async function (req, res) {
  const url = new URL(req.url || '/', 'https://x');
  if (!url.searchParams.get('action')) url.searchParams.set('action', 'callback');
  req.url = '/api/bookings/google?' + url.searchParams.toString();
  return require('../google.js')(req, res);
};
