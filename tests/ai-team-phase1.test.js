'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.SITE_BRAIN_STORAGE = 'memory';

const siteBrain = require('../lib/site-brain');
const aiTeam = require('../lib/ai-team');
const { canAccessThemeStudio, ROLE_POLICY } = require('../lib/theme-studio/access');

describe('AI Team Phase 1', () => {
  beforeEach(() => {
    siteBrain.useMemoryForTests(true);
    siteBrain.resetMemoryStore();
    process.env.SITE_BRAIN_STORAGE = 'memory';
  });

  it('registers all specialists but only Atlas is Phase 1 interactive', () => {
    const all = aiTeam.listSpecialists();
    assert.equal(all.length, 9);
    const interactive = aiTeam.interactiveSpecialists();
    assert.equal(interactive.length, 1);
    assert.equal(interactive[0].id, 'atlas');
  });

  it('context selectors do not dump the full Site Brain', async () => {
    await siteBrain.createSiteBrain({
      siteId: 'ctx-1',
      snapshot: Object.assign(siteBrain.emptySnapshot('ctx-1'), {
        business: { name: siteBrain.makeFact('Acme', { status: 'verified', source: 'user' }) },
        campaigns: { secret: 'should-not-appear-for-atlas' },
        seo: { pages: siteBrain.makeFact([], { status: 'verified', source: 'site_config' }) }
      })
    });
    const got = await siteBrain.getSiteBrain('ctx-1');
    const ctx = aiTeam.getRelevantContext(got.brain.snapshot, 'atlas', {
      editorContext: { editorTab: 'details', selectedSection: 'hero', userRole: 'client' }
    });
    assert.ok(ctx.business);
    assert.ok(ctx.editorContext);
    assert.equal(ctx.editorContext.selectedSection, 'hero');
    assert.equal(ctx.campaigns, undefined);
    assert.equal(ctx.seo, undefined);
    assert.equal(Object.keys(got.brain.snapshot).includes('campaigns'), true);
  });

  it('capability registry excludes Composer virtual authority', () => {
    const caps = aiTeam.listCapabilities();
    assert.ok(caps.some((c) => c.sectionKey === 'hero'));
    assert.ok(caps.every((c) => c.evidence));
    const exclusions = aiTeam.listExclusions();
    assert.ok(exclusions.length >= 1);
    const classified = aiTeam.classifyComposerCandidate('totally-virtual-app-xyz');
    assert.equal(classified.status, 'excluded_or_unknown');
  });

  it('Guardian blocks publish and live mutation; Phase 1 forces non-executable', () => {
    const bad = aiTeam.validateRecommendation({
      title: 'Publish now',
      specialist: 'atlas',
      publish: true,
      executable: true
    });
    assert.equal(bad.ok, false);
    assert.ok(bad.critical.some((c) => c.code === 'publish_forbidden'));
    const attached = aiTeam.attachGuardian({
      title: 'Add FAQ',
      specialist: 'atlas',
      executable: true,
      proposedChange: { sectionKey: 'faq' }
    });
    assert.equal(attached.executable, false);
    assert.equal(attached.guardian.ok, true);
  });

  it('Atlas review persists recommendations without config mutation', async () => {
    await siteBrain.syncSiteBrainFromSite({
      id: 'atlas-1',
      business_name: 'Render Co',
      config: {
        name: 'Render Co',
        services: [{ title: 'Renders' }],
        sections: { hero: { on: true, cta: 'Get in touch' }, quote: { on: true } },
        sectionOrder: ['hero', 'quote', 'footer']
      }
    });
    await siteBrain.applyBootstrapReview(
      'atlas-1',
      {
        businessName: 'Render Co',
        industry: 'Rendering',
        mainServices: 'Commercial renders',
        primaryGoal: 'More commercial enquiries',
        preferredCta: 'Get in touch',
        targetAudience: 'Builders',
        brandTone: 'Professional'
      },
      { actorUserId: 'u1' }
    );

    const result = await aiTeam.runAtlasReview({
      siteId: 'atlas-1',
      requestText: 'Help me get more commercial rendering enquiries in Canberra',
      editorContext: { editorTab: 'details', selectedSection: 'hero', userRole: 'client' },
      actorUserId: 'u1',
      actorRole: 'client'
    });
    assert.equal(result.ok, true);
    assert.equal(result.persisted, true);
    assert.ok(result.recommendations.length >= 1);
    assert.ok(result.recommendations.every((r) => r.executable === false || r.executable == null));
    const listed = await siteBrain.listRecommendations('atlas-1');
    assert.ok(listed.recommendations.length >= 1);
  });

  it('permissions deny unknown actions and allow atlas for client', () => {
    assert.equal(aiTeam.assertAction('client', 'atlas_review').ok, true);
    assert.equal(aiTeam.assertAction('client', 'diagnostics').ok, false);
    assert.equal(aiTeam.assertAction('super', 'diagnostics').ok, true);
  });

  it('Website Studio remains superuser-gated (On Ice)', () => {
    assert.equal(ROLE_POLICY.partner, false);
    assert.equal(ROLE_POLICY.client, false);
    assert.equal(canAccessThemeStudio({ isSuperuser: true }).allowed, true);
    assert.equal(canAccessThemeStudio({ isPartner: true }).allowed, false);
    assert.equal(canAccessThemeStudio({ isClient: true }).allowed, false);
  });

  it('Site Knowledge field guide covers CTA with plain-language explain', () => {
    const cta = aiTeam.getSiteKnowledgeField('preferredCta');
    assert.ok(cta);
    assert.match(cta.explain, /call to action/i);
    assert.ok(cta.examples.length >= 1);
    assert.equal(aiTeam.SITE_KNOWLEDGE_FIELDS.length >= 8, true);
  });

  it('Atlas knowledge gaps point at Site Knowledge chat field keys', async () => {
    await siteBrain.syncSiteBrainFromSite({
      id: 'atlas-cta',
      business_name: 'Bean Culture',
      config: {
        name: 'Bean Culture',
        services: [{ title: 'Coffee' }],
        sections: { hero: { on: true, cta: 'Contact us' }, quote: { on: true } },
        sectionOrder: ['hero', 'quote']
      }
    });
    const result = await aiTeam.runAtlasReview({
      siteId: 'atlas-cta',
      requestText: 'Help me convert more visitors',
      editorContext: { editorTab: 'ai-team', userRole: 'client' },
      actorUserId: 'u1',
      actorRole: 'client'
    });
    assert.equal(result.ok, true);
    const knowledge = result.recommendations.filter((r) => {
      const change = r.proposedChange || r.proposed_change || {};
      return change.type === 'site_brain_update' && change.fieldKey;
    });
    assert.ok(knowledge.length >= 1);
    assert.ok(
      knowledge.some((r) => {
        const change = r.proposedChange || r.proposed_change || {};
        return change.fieldKey === 'preferredCta' || change.fieldKey === 'primaryGoal';
      })
    );
  });
});
