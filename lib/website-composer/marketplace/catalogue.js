'use strict';

const data = require('./catalogue-data.json');

const BY_ID = new Map((data.apps || []).map((a) => [a.appId || a.sectionKey, Object.freeze({ ...a })]));

function listCatalogueApps() {
  return (data.apps || []).map((a) => ({ ...a }));
}

function getCatalogueApp(appId) {
  if (!appId) return null;
  const hit = BY_ID.get(String(appId));
  return hit ? { ...hit } : null;
}

function listSupportedApps() {
  return listCatalogueApps().filter((a) => a.websiteStudioSupport === 'supported');
}

function isAppSupported(appId) {
  const app = getCatalogueApp(appId);
  return !!(app && app.websiteStudioSupport === 'supported');
}

function assertSupportedApp(appId) {
  const app = getCatalogueApp(appId);
  if (!app) {
    return { ok: false, error: { code: 'app_unknown', message: 'Unknown Marketplace app: ' + appId } };
  }
  if (app.websiteStudioSupport !== 'supported') {
    return {
      ok: false,
      error: {
        code: 'app_unsupported',
        message: 'App not auto-selectable for Website Studio: ' + appId,
        status: app.websiteStudioSupport
      }
    };
  }
  return { ok: true, app };
}

module.exports = {
  CATALOGUE_VERSION: data.version,
  listCatalogueApps,
  getCatalogueApp,
  listSupportedApps,
  isAppSupported,
  assertSupportedApp
};
