'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  composeWebsiteConcepts,
  runQualityGate
} = require('../lib/website-composer');
const {
  useMemoryStore,
  resetMemoryStore,
  createDraft,
  createVersion,
  updateDraft,
  getDraft
} = require('../lib/theme-studio');
const {
  planApplication,
  commitApplication,
  putMemorySite,
  getSite,
  getReplacementDraft,
  discardReplacementDraft,
  resetAllApplicationMemory,
  MODES,
  assertApplicationPermission,
  assemblePrivateTemplate,
  validateForApplication,
  isApplicationEnabled,
  isCreateSiteEnabled
} = require('../lib/website-studio-application');
const { assertAiImageAccess } = require('../lib/image-service');
const briefs = require('../fixtures/website-composer/briefs');

const FLAG_KEYS = [
  'WEBSITE_STUDIO_APPLICATION',
  'WEBSITE_STUDIO_CREATE_SITE',
  'WEBSITE_STUDIO_REPLACEMENT_DRAFT',
  'WEBSITE_STUDIO_PRIVATE_TEMPLATE',
  'WEBSITE_STUDIO_APPLICATION_AUDIENCE'
];

function saveEnv() {
  const prev = {};
  for (const k of FLAG_KEYS) prev[k] = process.env[k];
  return prev;
}

function restoreEnv(prev) {
  for (const k of FLAG_KEYS) {
    if (prev[k] == null) delete process.env[k];
    else process.env[k] = prev[k];
  }
}

function enableApplicationFlags() {
  process.env.WEBSITE_STUDIO_APPLICATION = '1';
  process.env.WEBSITE_STUDIO_CREATE_SITE = '1';
  process.env.WEBSITE_STUDIO_REPLACEMENT_DRAFT = '1';
  process.env.WEBSITE_STUDIO_PRIVATE_TEMPLATE = '1';
  process.env.WEBSITE_STUDIO_APPLICATION_AUDIENCE = 'partners';
}

async function approvedDraftFromBrief(brief, actor) {
  const composed = await composeWebsiteConcepts(brief, {
    count: 1,
    allowMockImages: true,
    actor: actor || { isSuperuser: true }
  });
  assert.equal(composed.ok, true);
  const item = composed.concepts[0];
  const concept = JSON.parse(JSON.stringify(item.concept));
  const draftConfig = JSON.parse(JSON.stringify(item.draftConfig));

  // Mark images approved + imported with Cloudinary URLs for application
  const selections = (draftConfig.__websiteComposer && draftConfig.__websiteComposer.imageSelections) || [];
  for (let i = 0; i < selections.length; i++) {
    selections[i].approvalStatus = 'imported';
    selections[i].status = 'imported';
    selections[i].url =
      'https://res.cloudinary.com/leadpages/image/upload/leadpages/test/website-studio/img-' + i + '.jpg';
    if (selections[i].selectedAsset) {
      selections[i].selectedAsset.url = selections[i].url;
    }
  }
  if (draftConfig.__websiteComposer) {
    draftConfig.__websiteComposer.imageSelections = selections;
    draftConfig.__websiteComposer.approvalState = 'approved-for-application';
  }
  concept.approvalState = 'approved-for-application';

  // Ensure SEO fields present
  draftConfig.seo = draftConfig.seo || {};
  draftConfig.seo.title = draftConfig.seo.title || concept.businessProfile.businessName;
  draftConfig.seo.description = draftConfig.seo.description || concept.businessProfile.specialisation || 'Website';

  const draft = await createDraft({
    owner_user_id: (actor && actor.userId) || 'user-super',
    partner_id: (actor && actor.partnerId) || null,
    mode: 'new',
    brief,
    foundation_id: concept.foundationId,
    meta: { approvalState: 'approved-for-application' }
  });
  assert.equal(draft.ok, true);

  const ver = await createVersion({
    draft_id: draft.draft.id,
    concept_id: concept.conceptId,
    kind: 'approve',
    concept_json: concept,
    draft_config_json: draftConfig,
    created_by: (actor && actor.userId) || 'user-super'
  });
  assert.equal(ver.ok, true);

  await updateDraft(draft.draft.id, {
    selected_version_id: ver.version.id,
    selected_concept_id: concept.conceptId,
    meta: {
      approvalState: 'approved-for-application',
      approvedVersionId: ver.version.id
    }
  });

  const refreshed = await getDraft(draft.draft.id);
  return {
    draft: refreshed.draft,
    version: ver.version,
    concept,
    draftConfig
  };
}

const contact = {
  businessEmail: 'hello@bean-culture.test',
  leadRecipientEmail: 'leads@bean-culture.test',
  phone: '+61 400 000 000',
  businessName: 'Bean Culture',
  confirmed: true
};

describe('Website Studio Phase 5 — flags default off', () => {
  it('application flags are disabled by default', () => {
    const prev = saveEnv();
    for (const k of FLAG_KEYS) delete process.env[k];
    // Re-require not needed — flags read env each call
    assert.equal(isApplicationEnabled(), false);
    assert.equal(isCreateSiteEnabled(), false);
    restoreEnv(prev);
  });
});

describe('Website Studio Phase 5 — application modes', () => {
  let prevEnv;
  before(() => {
    prevEnv = saveEnv();
    enableApplicationFlags();
    useMemoryStore(true);
  });
  after(() => {
    resetMemoryStore();
    resetAllApplicationMemory();
    useMemoryStore(false);
    restoreEnv(prevEnv);
  });
  beforeEach(() => {
    resetMemoryStore();
    resetAllApplicationMemory();
    useMemoryStore(true);
    enableApplicationFlags();
  });

  it('approved concept creates a new draft site (not published)', async () => {
    const actor = { userId: 'user-super', isSuperuser: true, isPartner: false };
    const { draft, version } = await approvedDraftFromBrief(briefs.BEAN_CULTURE, actor);
    const result = await commitApplication({
      actor,
      draft,
      version,
      mode: MODES.CREATE_SITE,
      contactConfirmation: contact,
      siteIdentity: { siteName: 'Bean Culture Events', slug: 'bean-culture-events' },
      confirmPlan: true,
      acknowledgeWarnings: true,
      mockImages: true,
      idempotencyKey: 'create-bean-1'
    });
    assert.equal(result.ok, true, JSON.stringify(result.validation || result, null, 2));
    assert.ok(result.site);
    assert.equal(result.site.status, 'draft');
    assert.equal(result.published, false);
    assert.equal(result.liveWrite, false);
    assert.equal(result.site.config.seo.noindex, true);
    assert.equal(result.site.config.sections.quote.notifyEmail, 'leads@bean-culture.test');
    assert.ok(!result.site.config.__themeStudioPreview);
  });

  it('idempotent new-site request does not duplicate', async () => {
    const actor = { userId: 'user-super', isSuperuser: true };
    const { draft, version } = await approvedDraftFromBrief(briefs.BEAN_CULTURE, actor);
    const key = 'idem-create-1';
    const a = await commitApplication({
      actor,
      draft,
      version,
      mode: MODES.CREATE_SITE,
      contactConfirmation: contact,
      siteIdentity: { siteName: 'Bean Culture', slug: 'bean-idem' },
      confirmPlan: true,
      acknowledgeWarnings: true,
      mockImages: true,
      idempotencyKey: key
    });
    const b = await commitApplication({
      actor,
      draft,
      version,
      mode: MODES.CREATE_SITE,
      contactConfirmation: contact,
      siteIdentity: { siteName: 'Bean Culture', slug: 'bean-idem' },
      confirmPlan: true,
      acknowledgeWarnings: true,
      mockImages: true,
      idempotencyKey: key
    });
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(b.idempotentReplay, true);
    assert.equal(a.site.id, b.site.id);
  });

  it('approved concept creates a replacement draft without changing live site', async () => {
    const actor = { userId: 'user-super', isSuperuser: true };
    const live = putMemorySite({
      id: 'site-live-1',
      slug: 'existing-biz',
      status: 'live',
      owner_user_id: 'user-super',
      config: {
        name: 'Old Biz',
        sectionOrder: ['hero', 'services', 'footer'],
        sections: {
          hero: { on: true, title: 'Old hero' },
          services: { on: true, heading: 'Old services', items: [{ title: 'A' }] },
          footer: { on: true }
        },
        analytics: { gaId: 'UA-KEEP-ME' }
      }
    });
    const liveConfigBefore = JSON.stringify(live.config);

    const { draft, version } = await approvedDraftFromBrief(briefs.BEAN_CULTURE, actor);
    const result = await commitApplication({
      actor,
      draft,
      version,
      mode: MODES.REPLACEMENT_DRAFT,
      contactConfirmation: contact,
      siteIdentity: { targetSiteId: live.id },
      targetSite: live,
      confirmPlan: true,
      acknowledgeWarnings: true,
      mockImages: true,
      idempotencyKey: 'replace-1'
    });
    assert.equal(result.ok, true, JSON.stringify(result.validation || result, null, 2));
    assert.ok(result.replacementDraft);
    assert.ok(result.snapshot);
    assert.equal(result.liveSiteUnchanged, true);
    assert.equal(result.published, false);
    assert.equal(JSON.stringify(live.config), liveConfigBefore);
    assert.equal(live.config.analytics.gaId, 'UA-KEEP-ME');
  });

  it('discarding replacement does not affect live site', async () => {
    const actor = { userId: 'user-super', isSuperuser: true };
    const live = putMemorySite({
      id: 'site-live-2',
      slug: 'keep-live',
      status: 'live',
      owner_user_id: 'user-super',
      config: { name: 'Keep', analytics: { gaId: 'G-1' } }
    });
    const { draft, version } = await approvedDraftFromBrief(briefs.PINK_DIAMOND_VAULT, actor);
    const result = await commitApplication({
      actor,
      draft,
      version,
      mode: MODES.REPLACEMENT_DRAFT,
      contactConfirmation: {
        ...contact,
        businessEmail: 'hello@pink.test',
        leadRecipientEmail: 'leads@pink.test',
        businessName: 'Pink Diamond Vault'
      },
      siteIdentity: { targetSiteId: live.id },
      targetSite: live,
      confirmPlan: true,
      acknowledgeWarnings: true,
      mockImages: true
    });
    assert.equal(result.ok, true, JSON.stringify(result.validation || result, null, 2));
    const discarded = discardReplacementDraft(result.replacementDraft.id);
    assert.equal(discarded.ok, true);
    assert.equal(discarded.replacementDraft.status, 'discarded');
    assert.equal(live.status, 'live');
    assert.equal(live.config.analytics.gaId, 'G-1');
  });

  it('approved concept saves a private template without private contact data', async () => {
    const actor = { userId: 'user-partner', isSuperuser: false, isPartner: true, partnerId: 'partner-1' };
    const { draft, version } = await approvedDraftFromBrief(briefs.PINK_DIAMOND_VAULT, actor);
    const result = await commitApplication({
      actor,
      draft,
      version,
      mode: MODES.PRIVATE_TEMPLATE,
      siteIdentity: { templateName: 'Luxury Jewellery Base', templateVisibility: 'private' },
      confirmPlan: true,
      acknowledgeWarnings: true,
      mockImages: true
    });
    assert.equal(result.ok, true, JSON.stringify(result.validation || result, null, 2));
    assert.ok(result.template);
    assert.equal(result.template.visibility, 'private');
    const cfg = result.template.draft_config_json;
    assert.ok(!cfg.email);
    assert.ok(!(cfg.sections && cfg.sections.quote && cfg.sections.quote.notifyEmail));
    assert.match(String(cfg.name || ''), /businessName|\{\{/);
  });

  it('non-approved concept is rejected', async () => {
    const actor = { userId: 'user-super', isSuperuser: true };
    const composed = await composeWebsiteConcepts(briefs.BEAN_CULTURE, {
      count: 1,
      allowMockImages: true,
      actor
    });
    const item = composed.concepts[0];
    const draft = await createDraft({
      owner_user_id: actor.userId,
      mode: 'new',
      meta: { approvalState: 'draft' }
    });
    const ver = await createVersion({
      draft_id: draft.draft.id,
      concept_id: item.concept.conceptId,
      kind: 'generate',
      concept_json: item.concept,
      draft_config_json: item.draftConfig,
      created_by: actor.userId
    });
    const result = await commitApplication({
      actor,
      draft: draft.draft,
      version: ver.version,
      mode: MODES.CREATE_SITE,
      contactConfirmation: contact,
      confirmPlan: true,
      acknowledgeWarnings: true,
      mockImages: true
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'validation_blocked');
  });

  it('blocked-quality concept cannot be applied even if meta says approved', async () => {
    const actor = { userId: 'user-super', isSuperuser: true };
    const draft = await createDraft({
      owner_user_id: actor.userId,
      meta: { approvalState: 'approved-for-application', approvedVersionId: 'x' }
    });
    const badConcept = {
      conceptId: 'bad',
      foundationId: 'hospitality',
      recipeId: 'recipe-cafe',
      businessProfile: { businessName: 'X', industry: 'cafe' },
      sectionOrder: ['hero'],
      approvalState: 'approved-for-application'
    };
    const badConfig = {
      sectionOrder: ['hero'],
      sections: { hero: { on: true, title: 'Hi' } },
      __websiteComposer: { contentInheritance: 'none', approvalState: 'approved-for-application' }
    };
    const ver = await createVersion({
      draft_id: draft.draft.id,
      concept_id: 'bad',
      kind: 'approve',
      concept_json: badConcept,
      draft_config_json: badConfig,
      created_by: actor.userId
    });
    await updateDraft(draft.draft.id, {
      meta: { approvalState: 'approved-for-application', approvedVersionId: ver.version.id }
    });
    const got = await getDraft(draft.draft.id);
    const result = await commitApplication({
      actor,
      draft: got.draft,
      version: ver.version,
      mode: MODES.CREATE_SITE,
      contactConfirmation: contact,
      confirmPlan: true,
      acknowledgeWarnings: true,
      mockImages: true
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'validation_blocked');
  });

  it('publishing is not triggered and live apply flag remains unused', async () => {
    const actor = { userId: 'user-super', isSuperuser: true };
    const { draft, version } = await approvedDraftFromBrief(briefs.RIVERSONG_CAFE, actor);
    const planned = await planApplication({
      actor,
      draft,
      version,
      mode: MODES.CREATE_SITE,
      contactConfirmation: {
        ...contact,
        businessEmail: 'hi@cafe.test',
        leadRecipientEmail: 'leads@cafe.test',
        businessName: 'Riversong Café'
      },
      acknowledgeWarnings: true,
      mockImages: true
    });
    assert.equal(planned.ok, true);
    assert.equal(planned.plan.siteToCreate.status, 'draft');
    assert.equal(planned.plan.siteToCreate.published, false);
    assert.ok(planned.plan.dataIntentionallyNotTransferred.includes('billing'));
  });
});

describe('Website Studio Phase 5 — permissions', () => {
  let prevEnv;
  before(() => {
    prevEnv = saveEnv();
    enableApplicationFlags();
  });
  after(() => restoreEnv(prevEnv));

  it('partner cannot create platform template', () => {
    const denied = assertApplicationPermission(
      { userId: 'p1', isPartner: true, partnerId: 'p1' },
      MODES.PRIVATE_TEMPLATE,
      { templateVisibility: 'platform' }
    );
    assert.equal(denied.ok, false);
    assert.equal(denied.error, 'platform_template_denied');
  });

  it('client cannot create Marketplace / studio templates', () => {
    process.env.WEBSITE_STUDIO_APPLICATION_AUDIENCE = 'wider';
    const denied = assertApplicationPermission(
      { userId: 'c1', isClient: true },
      MODES.PRIVATE_TEMPLATE,
      { templateVisibility: 'private' }
    );
    assert.equal(denied.ok, false);
  });

  it('cross-tenant replacement is rejected', () => {
    const denied = assertApplicationPermission(
      { userId: 'p1', isPartner: true, partnerId: 'partner-a' },
      MODES.REPLACEMENT_DRAFT,
      {
        targetSite: {
          id: 's1',
          owner_user_id: 'other',
          servicing_partner_id: 'partner-b',
          referring_partner_id: 'partner-b'
        }
      }
    );
    assert.equal(denied.ok, false);
    assert.equal(denied.error, 'cross_tenant_denied');
  });

  it('partner/client AI image generation remains rejected', () => {
    const partner = assertAiImageAccess({ isPartner: true });
    const client = assertAiImageAccess({ isClient: true });
    assert.equal(partner.ok, false);
    assert.equal(client.ok, false);
    assert.match(String(partner.error || partner.message), /ai_image|forbidden|superuser/i);
  });
});

describe('Website Studio Phase 5 — config assembly + templates', () => {
  it('private template strips recipients and parameterises business name', () => {
    const concept = {
      conceptId: 'c1',
      foundationId: 'retail',
      recipeId: 'recipe-luxury-jewellery',
      businessProfile: { businessName: 'Pink Diamond Vault', industry: 'jewellery' }
    };
    const draftConfig = {
      name: 'Pink Diamond Vault',
      email: 'secret@client.test',
      phone: '0400',
      sections: {
        quote: { on: true, heading: 'Book with Pink Diamond Vault', notifyEmail: 'leads@client.test', notifyMode: 'custom' },
        reviews: { on: true, items: [{ quote: 'Amazing', name: 'Ada' }] }
      },
      __websiteComposer: { contentInheritance: 'none', diagnostics: { noisy: true } }
    };
    const tmpl = assemblePrivateTemplate(concept, draftConfig, { visibility: 'private' });
    assert.equal(tmpl.ok, true);
    assert.ok(!tmpl.draft_config_json.email);
    assert.ok(!tmpl.draft_config_json.sections.quote.notifyEmail);
    assert.equal(tmpl.draft_config_json.sections.reviews.items.length, 0);
    assert.match(JSON.stringify(tmpl.draft_config_json), /\{\{businessName\}\}/);
  });
});

describe('Website Studio Phase 5 — security checks', () => {
  let prevEnv;
  before(() => {
    prevEnv = saveEnv();
    enableApplicationFlags();
    useMemoryStore(true);
  });
  after(() => {
    resetMemoryStore();
    resetAllApplicationMemory();
    useMemoryStore(false);
    restoreEnv(prevEnv);
  });

  it('forged client approvalState does not bypass server draft meta', async () => {
    const actor = { userId: 'user-super', isSuperuser: true };
    const composed = await composeWebsiteConcepts(briefs.BEAN_CULTURE, {
      count: 1,
      allowMockImages: true,
      actor
    });
    const item = composed.concepts[0];
    const draft = await createDraft({
      owner_user_id: actor.userId,
      meta: { approvalState: 'draft' }
    });
    const ver = await createVersion({
      draft_id: draft.draft.id,
      concept_id: item.concept.conceptId,
      kind: 'generate',
      concept_json: item.concept,
      draft_config_json: item.draftConfig,
      created_by: actor.userId
    });
    const result = await commitApplication({
      actor,
      draft: draft.draft,
      version: ver.version,
      mode: MODES.CREATE_SITE,
      contactConfirmation: contact,
      confirmPlan: true,
      acknowledgeWarnings: true,
      mockImages: true,
      approvalState: 'approved-for-application'
    });
    assert.equal(result.ok, false);
  });

  it('application disabled when flags off', async () => {
    delete process.env.WEBSITE_STUDIO_APPLICATION;
    const denied = assertApplicationPermission(
      { userId: 'user-super', isSuperuser: true },
      MODES.CREATE_SITE
    );
    assert.equal(denied.ok, false);
    assert.equal(denied.error, 'application_disabled');
    enableApplicationFlags();
  });
});

describe('Website Studio Phase 5 — browser-level new-site flow (module orchestration)', () => {
  let prevEnv;
  before(() => {
    prevEnv = saveEnv();
    enableApplicationFlags();
    useMemoryStore(true);
  });
  after(() => {
    resetMemoryStore();
    resetAllApplicationMemory();
    useMemoryStore(false);
    restoreEnv(prevEnv);
  });

  it('plan → confirm → create → editor next action for Bean Culture', async () => {
    const actor = { userId: 'user-super', isSuperuser: true };
    const { draft, version } = await approvedDraftFromBrief(briefs.BEAN_CULTURE, actor);
    const planned = await planApplication({
      actor,
      draft,
      version,
      mode: MODES.CREATE_SITE,
      contactConfirmation: contact,
      siteIdentity: { siteName: 'Bean Culture', slug: 'bean-culture-app' },
      acknowledgeWarnings: true,
      mockImages: true
    });
    assert.equal(planned.ok, true);
    assert.ok(planned.plan.humanSummary.length);
    assert.ok(planned.plan.marketplaceAppsInstalling.includes('packageCompare'));

    const committed = await commitApplication({
      actor,
      draft,
      version,
      mode: MODES.CREATE_SITE,
      contactConfirmation: contact,
      siteIdentity: { siteName: 'Bean Culture', slug: 'bean-culture-app' },
      confirmPlan: true,
      acknowledgeWarnings: true,
      mockImages: true,
      idempotencyKey: 'flow-bean-1'
    });
    assert.equal(committed.ok, true, JSON.stringify(committed.validation || committed, null, 2));
    assert.deepEqual(committed.nextActions.includes('open_editor'), true);
    assert.equal(committed.published, false);
    const gate = runQualityGate(version.concept_json, committed.site.config);
    assert.notEqual(gate.status, 'blocked');
  });
});
