'use strict';

/** Map Page editor orderStorefront section ↔ order_systems.settings.storefront.appearance */

function hexOk(v) {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
}

function numOk(v) {
  if (v == null || v === '') return null;
  var n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Page editor section → storefront.appearance patch */
function sectionToAppearance(sec) {
  sec = sec || {};
  var a = {};
  if (hexOk(sec.accent)) a.accent = sec.accent;
  if (hexOk(sec.cardBg)) a.card_bg = sec.cardBg;
  if (hexOk(sec.cardBorder)) a.card_border = sec.cardBorder;
  if (hexOk(sec.text)) a.text = sec.text;
  if (hexOk(sec.muted)) a.muted = sec.muted;
  if (hexOk(sec.btnBg)) a.btn_bg = sec.btnBg;
  if (hexOk(sec.btnText)) a.btn_text = sec.btnText;
  if (hexOk(sec.inputBg)) a.input_bg = sec.inputBg;
  if (hexOk(sec.inputBorder)) a.input_border = sec.inputBorder;
  var mw = numOk(sec.maxWidth);
  if (mw != null) a.max_width = mw;
  var pad = numOk(sec.padding);
  if (pad != null) a.padding = pad;
  var rad = numOk(sec.radius);
  if (rad != null) a.radius = rad;
  if (hexOk(sec.bg)) a.page_bg = sec.bg;
  return a;
}

/** orders.html colour fields → appearance patch */
function formAppearanceToPatch(form) {
  form = form || {};
  var a = {};
  Object.keys(form).forEach(function (k) {
    if (form[k] == null || form[k] === '') return;
    a[k] = form[k];
  });
  return a;
}

function mergeStorefront(existing, patch) {
  existing = existing || {};
  patch = patch || {};
  return normalizeStorefrontSettings(
    Object.assign({}, existing, patch, {
      appearance: Object.assign({}, existing.appearance || {}, patch.appearance || {})
    })
  );
}

/** Normalize persisted storefront settings (shop_mode + staff layout). */
function normalizeStorefrontSettings(storefront) {
  storefront =
    storefront && typeof storefront === 'object' ? Object.assign({}, storefront) : {};
  if (storefront.shop_mode !== 'traditional') storefront.shop_mode = 'fast';
  storefront.staff_order_mode = 'fast';
  return storefront;
}

/**
 * Merge Orders settings appearance with Page editor orderStorefront colours.
 * Section colours win when set. Optionally remap hex via site colorOverrides.
 */
function resolveStorefrontAppearance(storefront, siteConfig) {
  var base =
    storefront && storefront.appearance && typeof storefront.appearance === 'object'
      ? Object.assign({}, storefront.appearance)
      : {};
  var sec =
    siteConfig && siteConfig.sections && siteConfig.sections.orderStorefront
      ? siteConfig.sections.orderStorefront
      : {};
  var fromSection = sectionToAppearance(sec);
  var merged = Object.assign({}, base, fromSection);
  try {
    var { applyColorOverridesToConfig } = require('../color-overrides');
    var remapped = applyColorOverridesToConfig({
      colorOverrides: (siteConfig && siteConfig.colorOverrides) || [],
      appearance: merged
    });
    if (remapped && remapped.appearance) merged = remapped.appearance;
  } catch (_e) {
    /* optional */
  }
  return merged;
}

function normalizeCutoffMode(mode) {
  var m = String(mode || '').trim();
  if (m === 'weekday_time') return 'weekday_rule';
  return m;
}

module.exports = {
  hexOk,
  sectionToAppearance,
  formAppearanceToPatch,
  mergeStorefront,
  normalizeStorefrontSettings,
  resolveStorefrontAppearance,
  normalizeCutoffMode
};
