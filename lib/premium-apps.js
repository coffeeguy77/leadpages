/**
 * Premium marketplace apps — Orders, Quote Builder, Bookings.
 * Entitlement = active site_app_subscriptions row, platform exempt (Quote),
 * or grandfathered engine flag (order_systems / booking_systems enabled).
 */
'use strict';

const PREMIUM_APPS = [
  {
    slug: 'online-quote',
    section_key: 'onlineQuote',
    nav_key: 'onlinequotes',
    name: 'Quote Builder',
    description: 'Online quote wizard and pricing engine.'
  },
  {
    slug: 'order-storefront',
    section_key: 'orderStorefront',
    nav_key: 'orders',
    name: 'Orders',
    description: 'Order Engine — catalogue, cart, and fulfilment.'
  },
  {
    slug: 'bookings',
    section_key: 'bookingStorefront',
    nav_key: 'bookings',
    name: 'Bookings',
    description: 'Appointment booking storefront and staff calendar.'
  }
];

function subscriptionIsActive(sub) {
  if (!sub) return false;
  var now = new Date();
  if (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due') return true;
  if (sub.status === 'cancelled' && sub.access_until && new Date(sub.access_until) > now) return true;
  return false;
}

function findPremiumDef(slugOrKey) {
  var key = String(slugOrKey || '').trim();
  return (
    PREMIUM_APPS.find(function (a) {
      return a.slug === key || a.section_key === key || a.nav_key === key;
    }) || null
  );
}

/**
 * Resolve entitlement for one premium app on a site.
 * @param {object} sb - supabase service client
 * @param {string} siteId
 * @param {object} def - PREMIUM_APPS entry
 * @param {object} [registryRow] - optional app_registry row
 */
async function resolveAppEntitlement(sb, siteId, def, registryRow) {
  var out = {
    slug: def.slug,
    section_key: def.section_key,
    nav_key: def.nav_key,
    name: (registryRow && registryRow.name) || def.name,
    description: (registryRow && registryRow.tagline) || def.description,
    tier: (registryRow && registryRow.tier) || 'paid',
    price_monthly_aud: registryRow ? registryRow.price_monthly_aud : null,
    price_annual_aud: registryRow ? registryRow.price_annual_aud : null,
    app_id: registryRow ? registryRow.id : null,
    entitled: false,
    reason: 'not_activated',
    subscription: null
  };

  if (!siteId) return out;

  // Quote Builder: Bean Culture / private_superuser exempt
  if (def.slug === 'online-quote') {
    try {
      var qs = await sb
        .from('quote_systems')
        .select('configuration_classification')
        .eq('site_id', siteId)
        .maybeSingle();
      if (qs.data && qs.data.configuration_classification === 'private_superuser') {
        out.entitled = true;
        out.reason = 'platform_exempt';
        return out;
      }
    } catch (_e) {}
  }

  // Grandfather: engine already enabled for this site
  if (def.slug === 'order-storefront') {
    try {
      var os = await sb.from('order_systems').select('enabled').eq('site_id', siteId).maybeSingle();
      if (os.data && os.data.enabled === true) {
        out.entitled = true;
        out.reason = 'engine_enabled';
      }
    } catch (_e) {}
  }
  if (def.slug === 'bookings') {
    try {
      var bs = await sb.from('booking_systems').select('enabled').eq('site_id', siteId).maybeSingle();
      if (bs.data && bs.data.enabled === true) {
        out.entitled = true;
        out.reason = 'engine_enabled';
      }
    } catch (_e) {}
  }

  var appId = registryRow && registryRow.id;
  if (!appId) {
    try {
      var ar = await sb
        .from('app_registry')
        .select('id,slug,name,tagline,tier,price_monthly_aud,price_annual_aud,section_key')
        .or('slug.eq.' + def.slug + ',section_key.eq.' + def.section_key)
        .maybeSingle();
      if (ar.data) {
        appId = ar.data.id;
        out.app_id = appId;
        out.name = ar.data.name || out.name;
        out.description = ar.data.tagline || out.description;
        out.tier = ar.data.tier || out.tier;
        out.price_monthly_aud = ar.data.price_monthly_aud;
        out.price_annual_aud = ar.data.price_annual_aud;
      }
    } catch (_e) {}
  }

  if (appId) {
    try {
      var sub = await sb
        .from('site_app_subscriptions')
        .select('id,status,billing_cycle,access_until,stripe_subscription_item_id,created_at')
        .eq('site_id', siteId)
        .eq('app_id', appId)
        .maybeSingle();
      if (sub.data) {
        out.subscription = sub.data;
        if (subscriptionIsActive(sub.data)) {
          out.entitled = true;
          out.reason = sub.data.stripe_subscription_item_id ? 'subscription' : 'admin_activated';
        }
      }
    } catch (_e) {}
  }

  return out;
}

async function listPremiumEntitlements(sb, siteId) {
  var slugs = PREMIUM_APPS.map(function (a) {
    return a.slug;
  });
  var sectionKeys = PREMIUM_APPS.map(function (a) {
    return a.section_key;
  });
  var registry = [];
  try {
    var r = await sb
      .from('app_registry')
      .select('id,slug,name,tagline,tier,price_monthly_aud,price_annual_aud,section_key,marketplace_status')
      .or('slug.in.(' + slugs.join(',') + '),section_key.in.(' + sectionKeys.join(',') + ')');
    registry = r.data || [];
  } catch (_e) {
    registry = [];
  }

  var apps = [];
  for (var i = 0; i < PREMIUM_APPS.length; i++) {
    var def = PREMIUM_APPS[i];
    var row =
      registry.find(function (x) {
        return x.slug === def.slug || x.section_key === def.section_key;
      }) || null;
    apps.push(await resolveAppEntitlement(sb, siteId, def, row));
  }
  return apps;
}

/**
 * Admin-activate a premium app for a site (no Stripe charge).
 * Also enables order_systems / booking_systems when applicable.
 */
async function activatePremiumApp(sb, siteId, slugOrKey, opts) {
  opts = opts || {};
  var def = findPremiumDef(slugOrKey);
  if (!def) return { ok: false, error: 'unknown_app' };

  var ar = await sb
    .from('app_registry')
    .select('*')
    .or('slug.eq.' + def.slug + ',section_key.eq.' + def.section_key)
    .maybeSingle();
  if (!ar.data) return { ok: false, error: 'app_not_registered' };
  var app = ar.data;
  var now = new Date().toISOString();
  var cycle = opts.billing_cycle === 'annual' ? 'annual' : 'monthly';

  var upsert = await sb.from('site_app_subscriptions').upsert(
    {
      site_id: siteId,
      app_id: app.id,
      status: 'active',
      billing_cycle: cycle,
      access_until: null,
      updated_at: now
    },
    { onConflict: 'site_id,app_id' }
  );
  if (upsert.error) return { ok: false, error: upsert.error.message };

  // Ensure site_apps install row is enabled
  try {
    await sb.from('site_apps').upsert(
      {
        site_id: siteId,
        app_id: app.id,
        enabled: true,
        updated_at: now
      },
      { onConflict: 'site_id,app_id' }
    );
  } catch (_e) {}

  // Ensure section on in config when requested
  if (opts.enable_section !== false) {
    try {
      var site = await sb.from('sites').select('id,config').eq('id', siteId).maybeSingle();
      if (site.data) {
        var cfg = site.data.config && typeof site.data.config === 'object' ? site.data.config : {};
        if (!cfg.sections) cfg.sections = {};
        if (!cfg.sections[def.section_key]) cfg.sections[def.section_key] = {};
        cfg.sections[def.section_key].on = true;
        delete cfg.sections[def.section_key].__ghost;
        await sb.from('sites').update({ config: cfg, updated_at: now }).eq('id', siteId);
      }
    } catch (_e) {}
  }

  if (def.slug === 'order-storefront') {
    try {
      await sb.from('order_systems').upsert(
        { site_id: siteId, enabled: true, updated_at: now },
        { onConflict: 'site_id' }
      );
    } catch (_e) {}
  }
  if (def.slug === 'bookings') {
    try {
      await sb.from('booking_systems').upsert(
        { site_id: siteId, enabled: true, updated_at: now },
        { onConflict: 'site_id' }
      );
    } catch (_e) {}
  }

  return { ok: true, app: app, entitlement: await resolveAppEntitlement(sb, siteId, def, app) };
}

async function deactivatePremiumApp(sb, siteId, slugOrKey) {
  var def = findPremiumDef(slugOrKey);
  if (!def) return { ok: false, error: 'unknown_app' };
  var ar = await sb
    .from('app_registry')
    .select('id')
    .or('slug.eq.' + def.slug + ',section_key.eq.' + def.section_key)
    .maybeSingle();
  if (!ar.data) return { ok: false, error: 'app_not_registered' };
  var now = new Date().toISOString();
  await sb
    .from('site_app_subscriptions')
    .update({ status: 'cancelled', access_until: now, updated_at: now })
    .eq('site_id', siteId)
    .eq('app_id', ar.data.id);
  try {
    await sb.from('site_apps').update({ enabled: false, updated_at: now }).eq('site_id', siteId).eq('app_id', ar.data.id);
  } catch (_e) {}
  return { ok: true };
}

module.exports = {
  PREMIUM_APPS,
  subscriptionIsActive,
  findPremiumDef,
  resolveAppEntitlement,
  listPremiumEntitlements,
  activatePremiumApp,
  deactivatePremiumApp
};
