'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  composeWebsiteConcepts,
  listCatalogueApps,
  listSupportedApps,
  listAppMetadataIds,
  listAdapterIds,
  RENDERER_SHELL_NEUTRAL_V1
} = require('../lib/website-composer');
const { renderDraftPreviewHtml, resolveShellAsset } = require('../lib/theme-studio/render-preview');
const { runQualityGate } = require('../lib/website-composer/quality-gate');
const { planRefinement } = require('../lib/website-composer/refine');
const { assertAiImageAccess } = require('../lib/image-service');
const {
  useMemoryStore,
  resetMemoryStore,
  createDraft,
  createVersion,
  listVersions
} = require('../lib/theme-studio');
const briefs = require('../fixtures/website-composer/briefs');

describe('Website Studio Phase 4 — marketplace final statuses', () => {
  it('has no requires-adapter or requires-metadata leftovers', () => {
    const apps = listCatalogueApps();
    assert.ok(apps.length >= 43);
    for (const app of apps) {
      assert.ok(
        !['requires-adapter', 'requires-metadata'].includes(app.websiteStudioSupport),
        app.appId + ' still deferred'
      );
    }
  });

  it('every supported app has metadata and adapter', () => {
    const meta = new Set(listAppMetadataIds());
    const adapters = new Set(listAdapterIds());
    for (const app of listSupportedApps()) {
      assert.ok(meta.has(app.appId), 'meta ' + app.appId);
      assert.ok(adapters.has(app.appId), 'adapter ' + app.appId);
    }
  });

  it('registers Phase 4 apps as supported', () => {
    const ids = new Set(listSupportedApps().map((a) => a.appId));
    for (const id of ['productCollection', 'clientLogos', 'bookingCta', 'brandStory', 'packageCompare']) {
      assert.ok(ids.has(id), id);
    }
  });
});

describe('Website Studio Phase 4 — neutral renderer shell', () => {
  it('neutral shell asset exists without plumbing defaults', () => {
    const shellPath = path.join(__dirname, '../landing-shell-neutral-v1.template.json');
    assert.ok(fs.existsSync(shellPath));
    const html = JSON.parse(fs.readFileSync(shellPath, 'utf8')).html;
    assert.doesNotMatch(html, /plumber|blocked\s*drain|Gungahlin/i);
    assert.match(html, /landing-shell-neutral-v1|data-ws-shell/);
    for (const key of ['productCollection', 'clientLogos', 'bookingCta', 'brandStory', 'packageCompare']) {
      assert.match(html, new RegExp('data-sec="' + key + '"'));
    }
  });

  it('Composer drafts resolve to neutral shell', async () => {
    const result = await composeWebsiteConcepts(briefs.BEAN_CULTURE, {
      count: 1,
      allowMockImages: true,
      actor: { isSuperuser: true }
    });
    assert.equal(result.ok, true);
    const draft = result.concepts[0].draftConfig;
    assert.equal(draft.__websiteComposer.rendererShellId, RENDERER_SHELL_NEUTRAL_V1);
    const resolved = resolveShellAsset(draft);
    assert.equal(resolved.shellId, RENDERER_SHELL_NEUTRAL_V1);
    assert.match(resolved.assetFile, /landing-shell-neutral/);
    const html = renderDraftPreviewHtml(draft, { mode: 'desktop' });
    assert.doesNotMatch(html, /plumber|blocked\s*drain/i);
    assert.match(html, /noindex/);
  });
});

describe('Website Studio Phase 4 — fixtures and quality', () => {
  for (const brief of briefs.ALL) {
    it('composes three structurally different concepts for ' + brief.fixtureId, async () => {
      const result = await composeWebsiteConcepts(brief, {
        count: 3,
        allowMockImages: true,
        actor: { isSuperuser: true }
      });
      assert.equal(result.ok, true, JSON.stringify(result.errors || result.discarded));
      assert.ok(result.concepts.length >= 2);
      const orders = new Set(result.concepts.map((c) => c.concept.sectionOrder.join('|')));
      const heroes = new Set(result.concepts.map((c) => c.diagnostics.appSelection.heroAppId));
      assert.ok(orders.size >= 2 || heroes.size >= 2, 'concepts must differ');
      for (const item of result.concepts) {
        const gate = runQualityGate(item.concept, item.draftConfig, {
          renderedHtml: renderDraftPreviewHtml(item.draftConfig, { mode: 'mobile' })
        });
        assert.notEqual(gate.status, 'blocked', JSON.stringify(gate.issues.slice(0, 5), null, 2));
        assert.equal(item.draftConfig.__websiteComposer.contentInheritance, 'none');
      }
    });
  }

  it('Bean Culture uses package compare and no trade leakage in render', async () => {
    const result = await composeWebsiteConcepts(briefs.BEAN_CULTURE, {
      count: 1,
      allowMockImages: true,
      actor: { isSuperuser: true }
    });
    const draft = result.concepts[0].draftConfig;
    assert.ok(draft.sectionOrder.includes('packageCompare'));
    const html = renderDraftPreviewHtml(draft, { mode: 'desktop' });
    assert.doesNotMatch(html, /plumber|landscap(e|ing)\s+design|emergency\s+call/i);
    assert.match(JSON.stringify(draft.sections.packageCompare), /Coffee cart|Coffee van|Coffee caravan/i);
  });

  it('Pink Diamond uses product collection + brand story + booking', async () => {
    const result = await composeWebsiteConcepts(briefs.PINK_DIAMOND_VAULT, {
      count: 1,
      allowMockImages: true,
      actor: { isSuperuser: true }
    });
    const order = result.concepts[0].draftConfig.sectionOrder;
    assert.ok(order.includes('productCollection'));
    assert.ok(order.includes('brandStory'));
    assert.ok(order.includes('bookingCta'));
    assert.ok(!order.includes('emerg'));
  });
});

describe('Website Studio Phase 4 — refinement + versions', () => {
  before(() => {
    useMemoryStore(true);
    resetMemoryStore();
  });
  after(() => {
    resetMemoryStore();
    useMemoryStore(false);
  });

  it('planRefinement can add supported apps and reorder quote', () => {
    const concept = {
      sectionOrder: ['hero', 'services', 'reviews', 'quote', 'footer'],
      sections: {},
      theme: {},
      businessProfile: { businessName: 'Test Co' }
    };
    const plan = planRefinement(concept, 'Add a package comparison and move the quote form higher');
    assert.ok(plan.sectionOrder.includes('packageCompare'));
    assert.ok(plan.sectionOrder.indexOf('quote') < plan.sectionOrder.indexOf('reviews'));
    assert.ok(plan.changeSummary.length >= 1);
  });

  it('persists generate versions and restore creates a new version', async () => {
    const draft = await createDraft({
      owner_user_id: 'u1',
      mode: 'new',
      brief: briefs.BEAN_CULTURE
    });
    assert.equal(draft.ok, true);
    const gen = await composeWebsiteConcepts(briefs.BEAN_CULTURE, {
      count: 1,
      allowMockImages: true,
      actor: { isSuperuser: true }
    });
    const v1 = await createVersion({
      draft_id: draft.draft.id,
      concept_id: gen.concepts[0].concept.conceptId,
      kind: 'generate',
      concept_json: gen.concepts[0].concept,
      draft_config_json: gen.concepts[0].draftConfig
    });
    assert.equal(v1.ok, true);
    const v2 = await createVersion({
      draft_id: draft.draft.id,
      concept_id: gen.concepts[0].concept.conceptId,
      kind: 'restore',
      concept_json: gen.concepts[0].concept,
      draft_config_json: {
        ...gen.concepts[0].draftConfig,
        __websiteComposer: {
          ...gen.concepts[0].draftConfig.__websiteComposer,
          imageSelections: [
            {
              ...(gen.concepts[0].concept.imagery[0] || {}),
              approvalStatus: 'approved'
            }
          ],
          approvalState: 'ready-for-review'
        }
      }
    });
    assert.equal(v2.ok, true);
    const listed = await listVersions(draft.draft.id);
    assert.ok(listed.versions.length >= 2);
    assert.equal(
      listed.versions[listed.versions.length - 1].draft_config_json.__websiteComposer.approvalState,
      'ready-for-review'
    );
  });
});

describe('Website Studio Phase 4 — permissions unchanged', () => {
  it('blocks partner/client AI images', () => {
    assert.equal(assertAiImageAccess({ isPartner: true }).ok, false);
    assert.equal(assertAiImageAccess({ isClient: true }).ok, false);
    assert.equal(assertAiImageAccess({ isSuperuser: true }).ok, true);
  });
});

describe('Website Studio Phase 4 — visual regression snapshots', () => {
  const outDir = path.join(__dirname, '../tmp/website-studio-visual');

  it('writes desktop/mobile HTML snapshots for key fixtures', async () => {
    fs.mkdirSync(outDir, { recursive: true });
    for (const brief of [briefs.BEAN_CULTURE, briefs.PINK_DIAMOND_VAULT, briefs.CANBERRA_ELECTRICIAN]) {
      const result = await composeWebsiteConcepts(brief, {
        count: 1,
        allowMockImages: true,
        actor: { isSuperuser: true }
      });
      assert.equal(result.ok, true);
      for (const mode of ['desktop', 'mobile']) {
        const html = renderDraftPreviewHtml(result.concepts[0].draftConfig, { mode });
        const file = path.join(outDir, brief.fixtureId + '-' + mode + '.html');
        fs.writeFileSync(file, html);
        assert.ok(fs.statSync(file).size > 1000);
        assert.doesNotMatch(html, /plumber|blocked\s*drain/i);
        if (mode === 'mobile') assert.match(html, /ts-mobile-frame|max-width:412px/);
      }
    }
  });
});
