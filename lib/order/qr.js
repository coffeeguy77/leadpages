'use strict';

const { portalUrl } = require('./notify');
const { createAccessToken } = require('./tokens');

/**
 * SVG QR markup for embedding in print HTML (no external image fetch).
 * @param {string} text
 * @param {{ width?: number, margin?: number }} [opts]
 * @returns {Promise<string>}
 */
async function qrSvg(text, opts) {
  opts = opts || {};
  const QRCode = require('qrcode');
  const width = opts.width != null ? opts.width : 96;
  const margin = opts.margin != null ? opts.margin : 1;
  return QRCode.toString(String(text || ''), {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: margin,
    width: width
  });
}

/**
 * Mint a portal token and attach portal_url + portal_qr_svg on each order.
 * Mutates orders in place; skips rows that already have portal_qr_svg.
 */
async function attachPortalQrToOrders(orders, siteId, opts) {
  opts = opts || {};
  const ttlHours = opts.ttlHours != null ? opts.ttlHours : 24 * 30;
  const list = orders || [];
  for (let i = 0; i < list.length; i++) {
    const ord = list[i];
    if (!ord || !ord.id) continue;
    if (ord.portal_qr_svg && ord.portal_url) continue;
    const tok = await createAccessToken(ord.id, siteId, 'portal', ttlHours);
    const url = portalUrl(tok.token);
    ord.portal_url = url;
    try {
      ord.portal_qr_svg = await qrSvg(url, { width: opts.qrWidth || 88, margin: 0 });
    } catch (e) {
      ord.portal_qr_svg = '';
      ord.portal_qr_error = String((e && e.message) || e);
    }
  }
  return list;
}

module.exports = {
  qrSvg,
  attachPortalQrToOrders,
  portalUrl
};
