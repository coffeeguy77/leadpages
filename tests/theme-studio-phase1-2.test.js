'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  FOUNDATIONS,
  listFoundations,
  getFoundation,
  selectFoundationCandidates,
  checkFoundationCompatibility,
  validateConcept,
  adaptConceptToSiteConfig,
  detectIndustryLeakage,
  LAYOUT_IDS,
  KNOWN_SECTION_KEYS,
  WRITABLE_CONFIG_PATHS,
  PROTECTED_FIELDS,
  CONCEPT_SCHEMA_ID,
  THEME_STUDIO_BRAIN_TASKS,
  canAccessThemeStudio,
  ROLE_POLICY
} = require('../lib/theme-studio');

const briefs = require('../fixtures/theme-studio/briefs');
const {
  PINK_DIAMOND_VAULT_CONCEPT,
  PINK_DIAMOND_VAULT_LEAKY,
  LUKES_SECURITY_CONCEPT,
  RIVERSONG_CAFE_CONCEPT,
  NORTHSIDE_ADVISORY_CONCEPT,
  CANBERRA_EVENT_HIRE_CONCEPT
} = require('../fixtures/theme-studio/concepts');
const { makeProtectedSource } = require('../fixtures/theme-studio/source-configs');

describe('Theme Studio Phase 1 — foundation registry (via Website Composer)', () => {
  it('registers structural foundations covering trade and non-trade categories', () => {
    const list = listFoundations();
    assert.ok(list.length >= 16);
    assert.equal(FOUNDATIONS.length, list.length);
    const categories = new Set(list.map((f) => f.category));
    for (const cat of [
      'trades',
      'professional',
      'retail',
      'hospitality',
      'events',
      'health',
      'creative',
      'construction'
    ]) {
      assert.ok(categories.has(cat), 'missing category ' + cat);
    }
  });

  it('includes required structural metadata and no trade template inheritance', () => {
    const required = [
      'id',
      'name',
      'category',
      'supportedIndustries',
      'excludedIndustries',
      'visualStyles',
      'conversionStyle',
      'supportedSectionKeys',
      'requiredSectionKeys',
      'optionalSectionKeys',
      'defaultSectionOrder',
      'compatibleLayoutIds',
      'defaultLayoutId',
      'supportedHeaderVariants',
      'supportedFooterVariants',
      'supportedHeroVariants',
      'typographyProfile',
      'mobileProfile',
      'incompatibilities',
      'rendererShellId',
      'status',
      'version'
    ];
    for (const foundation of listFoundations()) {
      for (const key of required) {
        assert.ok(foundation[key] != null, foundation.id + ' missing ' + key);
      }
      assert.equal(foundation.sourceTemplateId, null);
      assert.ok(LAYOUT_IDS.includes(foundation.defaultLayoutId));
      for (const sectionKey of foundation.supportedSectionKeys) {
        assert.ok(
          KNOWN_SECTION_KEYS.includes(sectionKey),
          foundation.id + ' has unverified section ' + sectionKey
        );
      }
    }
  });

  it('selects retail for Pink Diamond Vault jewellery brief', () => {
    const candidates = selectFoundationCandidates(briefs.PINK_DIAMOND_VAULT, { minScore: 0 });
    assert.ok(candidates.length > 0);
    assert.equal(candidates[0].foundationId, 'retail');
    assert.ok(!candidates.some((c) => c.foundationId === 'trades' && c.score > candidates[0].score));
  });

  it('selects trades for Luke security brief', () => {
    const candidates = selectFoundationCandidates(briefs.LUKES_SECURITY_CO, { minScore: 0 });
    assert.equal(candidates[0].foundationId, 'trades');
  });

  it('selects hospitality for café brief', () => {
    const candidates = selectFoundationCandidates(briefs.RIVERSONG_CAFE, { minScore: 0 });
    assert.equal(candidates[0].foundationId, 'hospitality');
  });

  it('selects professional-services for accounting brief', () => {
    const candidates = selectFoundationCandidates(briefs.NORTHSIDE_ADVISORY, { minScore: 0 });
    assert.equal(candidates[0].foundationId, 'professional-services');
  });

  it('selects events for event hire brief', () => {
    const candidates = selectFoundationCandidates(briefs.CANBERRA_EVENT_HIRE, { minScore: 0 });
    assert.equal(candidates[0].foundationId, 'events');
  });

  it('rejects incompatible retail + emergency layout / trade sections', () => {
    const retail = getFoundation('retail-boutique');
    const result = checkFoundationCompatibility(retail, {
      layoutId: 'emergency-response',
      sectionKeys: ['hero', 'services', 'emerg', 'quote', 'footer'],
      heroVariant: 'heroBeforeAfter'
    });
    assert.equal(result.ok, false);
    const codes = new Set(result.errors.map((e) => e.code));
    assert.ok(codes.has('layout_incompatible'));
    assert.ok(codes.has('section_incompatible') || codes.has('section_unsupported'));
  });
});

describe('Theme Studio Phase 2 — concept validation', () => {
  const validFixtures = [
    PINK_DIAMOND_VAULT_CONCEPT,
    LUKES_SECURITY_CONCEPT,
    RIVERSONG_CAFE_CONCEPT,
    NORTHSIDE_ADVISORY_CONCEPT,
    CANBERRA_EVENT_HIRE_CONCEPT
  ];

  for (const concept of validFixtures) {
    it('validates fixture ' + concept.conceptId, () => {
      const result = validateConcept(concept);
      assert.equal(result.schemaId, CONCEPT_SCHEMA_ID);
      assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
    });
  }

  it('fails loudly on Pink Diamond Vault trade leakage', () => {
    const result = validateConcept(PINK_DIAMOND_VAULT_LEAKY);
    assert.equal(result.ok, false);
    const leakage = result.errors.filter((e) => e.code === 'industry_leakage_trade');
    assert.ok(leakage.length >= 2, 'expected multiple trade leakage errors');
    const termIds = new Set(leakage.map((e) => e.termId));
    assert.ok(termIds.has('drains') || termIds.has('plumbing'));
    assert.ok(termIds.has('hi_vis') || termIds.has('hedge_trimming') || termIds.has('emergency_callouts'));
  });

  it('detects jewellery leakage inside trade concept text', () => {
    const leakyTrade = {
      ...LUKES_SECURITY_CONCEPT,
      conceptId: 'leaky_trade',
      sections: {
        ...LUKES_SECURITY_CONCEPT.sections,
        hero: {
          on: true,
          variant: 'hero',
          content: {
            heading: 'Pink diamonds and engagement rings',
            subheading: 'Jewellery vault styling',
            cta: 'Quote'
          }
        }
      }
    };
    const result = detectIndustryLeakage(leakyTrade, { industry: 'security' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === 'industry_leakage_jewellery'));
  });

  it('rejects unknown section keys with machine-readable errors', () => {
    const bad = {
      ...PINK_DIAMOND_VAULT_CONCEPT,
      conceptId: 'bad_sections',
      sectionOrder: ['hero', 'ctaBanner', 'services', 'quote', 'footer'],
      sections: {
        ...PINK_DIAMOND_VAULT_CONCEPT.sections,
        ctaBanner: { on: true, content: { heading: 'Nope' } }
      }
    };
    const result = validateConcept(bad, { checkLeakage: false });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === 'section_unknown'));
  });

  it('rejects invalid layout ids', () => {
    const bad = {
      ...PINK_DIAMOND_VAULT_CONCEPT,
      conceptId: 'bad_layout',
      layoutId: 'not-a-real-layout'
    };
    const result = validateConcept(bad, { checkLeakage: false });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === 'layout_unknown'));
  });

  it('rejects incompatible foundation + section combinations', () => {
    const bad = {
      ...PINK_DIAMOND_VAULT_CONCEPT,
      conceptId: 'bad_combo',
      sectionOrder: ['hero', 'services', 'emerg', 'featuredProjects', 'quote', 'footer'],
      sections: {
        ...PINK_DIAMOND_VAULT_CONCEPT.sections,
        emerg: { on: true, content: { text: 'Emergency' } }
      }
    };
    const result = validateConcept(bad, { checkLeakage: false });
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some(
        (e) => e.code === 'section_incompatible' || e.code === 'section_unsupported'
      )
    );
  });

  it('rejects protected-field attempts in generatedFields', () => {
    const bad = {
      ...PINK_DIAMOND_VAULT_CONCEPT,
      conceptId: 'bad_protected',
      generatedFields: ['theme', 'analytics', 'billing']
    };
    const result = validateConcept(bad, { checkLeakage: false });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === 'protected_field_attempt'));
  });
});

describe('Theme Studio Phase 2 — config adapter', () => {
  it('produces a draft snapshot without mutating source config', () => {
    const source = makeProtectedSource();
    const before = JSON.stringify(source);
    const result = adaptConceptToSiteConfig(PINK_DIAMOND_VAULT_CONCEPT, source);
    assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
    assert.equal(JSON.stringify(source), before);
    assert.equal(result.mutatedSource, false);
    assert.equal(result.published, false);
    assert.ok(result.draftConfig);
    assert.equal(result.draftConfig.name, 'Pink Diamond Vault');
    assert.equal(result.draftConfig.layout, 'premium-showcase');
    assert.equal(result.draftConfig.theme.pipe, '#2A1020');
  });

  it('preserves protected fields by omitting them from draft output', () => {
    const source = makeProtectedSource();
    const result = adaptConceptToSiteConfig(LUKES_SECURITY_CONCEPT, source);
    assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
    for (const field of [
      'id',
      'slug',
      'owner_user_id',
      'owner_email',
      'custom_domain',
      'analytics',
      'gtmId',
      'facebookPixel',
      'googleAds',
      'tracking',
      'crm',
      'leadRouting',
      'formDestinations',
      'billing',
      'permissions',
      'auth',
      'publishing',
      'status',
      'stripe_customer_id'
    ]) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(result.draftConfig, field),
        false,
        'draft unexpectedly contains ' + field
      );
    }
    assert.ok(PROTECTED_FIELDS.includes('analytics'));
    assert.ok(WRITABLE_CONFIG_PATHS.includes('theme.pipe'));
  });

  it('rejects unknown section keys and invalid layouts via validation', () => {
    const bad = {
      ...RIVERSONG_CAFE_CONCEPT,
      conceptId: 'adapter_bad',
      layoutId: 'mystery-layout',
      sectionOrder: ['hero', 'newsletter', 'quote', 'footer']
    };
    const source = makeProtectedSource();
    const before = JSON.stringify(source);
    const result = adaptConceptToSiteConfig(bad, source);
    assert.equal(result.ok, false);
    assert.equal(result.draftConfig, null);
    assert.equal(JSON.stringify(source), before);
    assert.ok(result.errors.some((e) => e.code === 'layout_unknown' || e.code === 'section_unknown'));
  });

  it('maps concepts deterministically across repeated runs', () => {
    const source = makeProtectedSource();
    const a = adaptConceptToSiteConfig(CANBERRA_EVENT_HIRE_CONCEPT, source);
    const b = adaptConceptToSiteConfig(CANBERRA_EVENT_HIRE_CONCEPT, source);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(JSON.stringify(a.draftConfig), JSON.stringify(b.draftConfig));
    assert.deepEqual(a.writtenPaths, b.writtenPaths);
  });

  it('does not leak jewellery copy into trade adapter output or vice versa', () => {
    const jewellery = adaptConceptToSiteConfig(PINK_DIAMOND_VAULT_CONCEPT, makeProtectedSource());
    const trade = adaptConceptToSiteConfig(LUKES_SECURITY_CONCEPT, makeProtectedSource());
    assert.equal(jewellery.ok, true);
    assert.equal(trade.ok, true);
    // Exclude theme token keys (e.g. hivis) from leakage scan of draft copy.
    const jScan = {
      name: jewellery.draftConfig.name,
      sections: jewellery.draftConfig.sections,
      services: jewellery.draftConfig.services,
      seoTitle: jewellery.draftConfig.seoTitle,
      seoDescription: jewellery.draftConfig.seoDescription
    };
    const tScan = {
      name: trade.draftConfig.name,
      sections: trade.draftConfig.sections,
      services: trade.draftConfig.services,
      seoTitle: trade.draftConfig.seoTitle,
      seoDescription: trade.draftConfig.seoDescription
    };
    assert.equal(detectIndustryLeakage(jScan, { industry: 'jewellery' }).ok, true);
    assert.equal(detectIndustryLeakage(tScan, { industry: 'security' }).ok, true);
    assert.match(JSON.stringify(jScan), /Pink Diamond Vault/);
    assert.match(JSON.stringify(tScan), /Luke's Security Co/);
    assert.doesNotMatch(JSON.stringify(tScan), /pink diamond/i);
    assert.doesNotMatch(JSON.stringify(tScan), /engagement ring/i);
  });

  it('never sets published true and never claims source mutation', () => {
    const result = adaptConceptToSiteConfig(NORTHSIDE_ADVISORY_CONCEPT, makeProtectedSource());
    assert.equal(result.published, false);
    assert.equal(result.mutatedSource, false);
  });
});

describe('Theme Studio Phase 2 — access + brain contracts', () => {
  it('allows superusers only; denies partners and clients (On Ice)', () => {
    assert.equal(canAccessThemeStudio({ isSuperuser: true }).allowed, true);
    assert.equal(canAccessThemeStudio({ isPartner: true }).allowed, false);
    assert.equal(canAccessThemeStudio({ isClient: true }).allowed, false);
    assert.equal(canAccessThemeStudio({ role: 'client' }).allowed, false);
    assert.equal(ROLE_POLICY.client, false);
    assert.equal(ROLE_POLICY.partner, false);
  });

  it('documents brain task contracts without provider wiring', () => {
    const ids = THEME_STUDIO_BRAIN_TASKS.map((t) => t.taskId);
    for (const id of [
      'theme_studio.business_analysis',
      'theme_studio.foundation_selection',
      'theme_studio.concept_generation',
      'theme_studio.content_generation',
      'theme_studio.image_direction',
      'theme_studio.refinement',
      'theme_studio.quality_review'
    ]) {
      assert.ok(ids.includes(id));
    }
    assert.ok(THEME_STUDIO_BRAIN_TASKS.every((t) => t.writesSites === false && t.draftOnly === true));
  });
});
