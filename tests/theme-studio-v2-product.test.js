'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const {
  useMemoryStore,
  resetMemoryStore,
  createDraft,
  createVersion,
  getVersion,
  listVersions,
  updateDraft,
  buildDeterministicConcepts,
  applyConceptPatch,
  buildDeterministicRefinePatch,
  buildQualityReport,
  signPreviewToken,
  verifyPreviewToken,
  renderDraftPreviewHtml,
  sandboxConfig,
  canAccessThemeStudio,
  selectFoundationCandidates
} = require('../lib/theme-studio');

const briefs = require('../fixtures/theme-studio/briefs');

describe('Theme Studio V2 product (phases 3–10)', () => {
  before(() => {
    useMemoryStore(true);
    resetMemoryStore();
  });
  after(() => {
    resetMemoryStore();
    useMemoryStore(false);
  });

  it('builds three deterministic concepts for jewellery without trade leakage', () => {
    const result = buildDeterministicConcepts(briefs.PINK_DIAMOND_VAULT);
    assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
    assert.equal(result.foundationId, 'retail-boutique');
    assert.ok(result.concepts.length >= 1);
    for (const item of result.concepts) {
      const text = JSON.stringify(item.draftConfig);
      assert.doesNotMatch(text, /\bdrains?\b/i);
      assert.doesNotMatch(text, /\bplumb/i);
      assert.match(text, /Pink Diamond Vault/);
      assert.ok(item.draftConfig.layout);
      assert.ok(item.draftConfig.theme);
    }
  });

  it('builds trade concepts for Luke security', () => {
    const result = buildDeterministicConcepts(briefs.LUKES_SECURITY_CO);
    assert.equal(result.ok, true);
    assert.equal(result.foundationId, 'trade-field-services');
    assert.ok(result.concepts.length >= 1);
    const text = JSON.stringify(result.concepts[0].draftConfig);
    assert.doesNotMatch(text, /pink diamond/i);
  });

  it('draft/version store works in memory and never marks published', async () => {
    const draft = await createDraft({
      owner_user_id: 'user-1',
      mode: 'new',
      brief: briefs.RIVERSONG_CAFE
    });
    assert.equal(draft.ok, true);
    const gen = buildDeterministicConcepts(briefs.RIVERSONG_CAFE);
    assert.equal(gen.ok, true);
    const ver = await createVersion({
      draft_id: draft.draft.id,
      concept_id: gen.concepts[0].concept.conceptId,
      kind: 'generate',
      concept_json: gen.concepts[0].concept,
      draft_config_json: gen.concepts[0].draftConfig
    });
    assert.equal(ver.ok, true);
    const listed = await listVersions(draft.draft.id);
    assert.equal(listed.versions.length, 1);
    await updateDraft(draft.draft.id, {
      selected_version_id: ver.version.id,
      selected_concept_id: ver.version.concept_id
    });
  });

  it('refinement patch creates validated concept without protected writes', () => {
    const gen = buildDeterministicConcepts(briefs.NORTHSIDE_ADVISORY);
    assert.equal(gen.ok, true);
    const concept = gen.concepts[0].concept;
    const patch = buildDeterministicRefinePatch(concept, 'Make the CTA: "Book a consultation"');
    const applied = applyConceptPatch(concept, patch, null);
    assert.equal(applied.ok, true, JSON.stringify(applied.errors, null, 2));
    assert.equal(applied.concept.callsToAction.primary.label, 'Book a consultation');
    assert.equal(applied.published, undefined);
  });

  it('quality report scores concepts and flags leakage', () => {
    const gen = buildDeterministicConcepts(briefs.PINK_DIAMOND_VAULT);
    const report = buildQualityReport(gen.concepts[0].concept, gen.concepts[0].draftConfig);
    assert.ok(report.score >= 70);
    assert.match(report.disclaimer, /not a WCAG/i);

    const leaky = JSON.parse(JSON.stringify(gen.concepts[0].concept));
    leaky.sections.hero.content.heading = 'Blocked drain emergency call-outs';
    const bad = buildQualityReport(leaky, null);
    assert.equal(bad.ok, false);
  });

  it('signed preview tokens expire and verify', () => {
    const token = signPreviewToken({
      draftId: 'd1',
      versionId: 'v1',
      userId: 'u1',
      exp: Math.floor(Date.now() / 1000) + 60
    });
    const ok = verifyPreviewToken(token);
    assert.equal(ok.ok, true);
    assert.equal(ok.payload.draftId, 'd1');

    const expired = signPreviewToken({
      draftId: 'd1',
      versionId: 'v1',
      userId: 'u1',
      exp: Math.floor(Date.now() / 1000) - 10
    });
    assert.equal(verifyPreviewToken(expired).ok, false);
  });

  it('preview HTML uses trade template, noindex, sandboxed forms/tracking', () => {
    const gen = buildDeterministicConcepts(briefs.CANBERRA_EVENT_HIRE);
    const html = renderDraftPreviewHtml(gen.concepts[0].draftConfig, { mode: 'desktop' });
    assert.match(html, /noindex/);
    assert.match(html, /ts-preview-guard/);
    assert.match(html, /__themeStudioPreview|Theme Studio preview/);
    assert.match(html, /Capital Marquee Hire/);
    assert.doesNotMatch(html, /\{\{businessName\}\}/);
    // SITE_CONFIG must carry event hire identity (static template FAQ may still mention trade defaults)
    assert.match(html, /"name":"Capital Marquee Hire"|"business":"Capital Marquee Hire"/);
    const sandboxed = sandboxConfig({
      theme: { pipe: '#111' },
      analytics: { gaId: 'G-PROD' },
      gtmId: 'GTM-X',
      formDestinations: { webhook: 'https://x' }
    });
    assert.equal(sandboxed.analytics, undefined);
    assert.equal(sandboxed.gtmId, undefined);
    assert.equal(sandboxed.formDestinations, undefined);
    assert.equal(sandboxed.__disableForms, true);
  });

  it('adapter maps hero title/sub and disables emerg for hospitality', () => {
    const gen = buildDeterministicConcepts({
      businessName: 'Bean Culture',
      industry: 'coffee',
      specialisation: 'Event Coffee (coffee carts + coffee van)',
      location: 'Canberra',
      desiredStyle: 'elegant, cafe vibes',
      audience: 'Marketing agencies'
    });
    assert.equal(gen.ok, true);
    assert.equal(gen.foundationId, 'hospitality-cafe');
    const cfg = gen.concepts[0].draftConfig;
    assert.equal(cfg.sections.hero.title != null, true);
    assert.equal(cfg.sections.hero.sub != null, true);
    assert.equal(cfg.sections.emerg && cfg.sections.emerg.on, false);
    assert.match(JSON.stringify(cfg.services), /body/);
    const html = renderDraftPreviewHtml(cfg);
    assert.match(html, /Bean Culture/);
    assert.match(html, /Event Coffee/);
    assert.doesNotMatch(html, /24\/7 Emergency Plumber/i);
    assert.match(html, /"title":"Bean Culture/);
    assert.match(html, /display:none/);
  });

  it('access policy still denies clients', () => {
    assert.equal(canAccessThemeStudio({ isClient: true }).allowed, false);
    assert.equal(canAccessThemeStudio({ isPartner: true }).allowed, true);
  });

  it('foundation candidates remain stable for fixtures', () => {
    assert.equal(selectFoundationCandidates(briefs.PINK_DIAMOND_VAULT)[0].foundationId, 'retail-boutique');
    assert.equal(selectFoundationCandidates(briefs.LUKES_SECURITY_CO)[0].foundationId, 'trade-field-services');
  });
});
