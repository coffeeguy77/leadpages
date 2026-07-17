'use strict';

/**
 * Mock existing site configs with protected operational fields.
 * Adapter must not mutate these objects and must not copy protected keys.
 */

function makeProtectedSource(overrides) {
  return {
    id: 'site_protected_001',
    slug: 'existing-site',
    owner_user_id: 'user_abc',
    owner_email: 'owner@example.com',
    referring_partner_id: 'partner_1',
    custom_domain: 'example.com.au',
    status: 'live',
    billing_status: 'active',
    plan_key: 'pro',
    stripe_customer_id: 'cus_123',
    analytics: { gaId: 'G-PROD123' },
    gtmId: 'GTM-PROD',
    facebookPixel: '999888777',
    googleAds: { conversionId: 'AW-111' },
    tracking: { enabled: true },
    crm: { provider: 'hubspot' },
    leadRouting: { email: 'leads@example.com' },
    formDestinations: { webhook: 'https://example.com/hooks/leads' },
    billing: { seat: 1 },
    permissions: { editors: ['user_abc'] },
    auth: { mode: 'owner' },
    publishing: { publishedAt: '2026-01-01T00:00:00Z' },
    name: 'Existing Site',
    trade: 'Existing Site',
    theme: {
      pipe: '#111111',
      hivis: '#ff0000',
      steel: '#333333',
      safety: '#ffff00',
      lightBg: '#ffffff'
    },
    layout: 'classic',
    sectionOrder: ['hero', 'services', 'quote', 'footer'],
    sections: {
      hero: { on: true, heading: 'Old heading' },
      services: { on: true },
      quote: { on: true },
      footer: { on: true }
    },
    services: [{ title: 'Old service', text: 'Old copy' }],
    ...overrides
  };
}

module.exports = {
  makeProtectedSource
};
