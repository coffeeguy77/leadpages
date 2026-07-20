'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.SITE_BRAIN_STORAGE = 'memory';

const siteBrain = require('../lib/site-brain');
const aiTeam = require('../lib/ai-team');

describe('AI Team Phase 2 — Forge', () => {
  beforeEach(() => {
    siteBrain.useMemoryForTests(true);
    siteBrain.resetMemoryStore();
    process.env.SITE_BRAIN_STORAGE = 'memory';
  });

  it('applyPatchToConfig sets hero CTA on callText and cta', () => {
    const cfg = {
      name: 'Bean Culture',
      sections: { hero: { on: true, title: 'Welcome', cta: 'Contact us', callText: 'Contact us' } }
    };
    const out = aiTeam.applyPatchToConfig(cfg, {
      operation: 'hero_cta',
      after: { cta: 'Get a free quote' }
    });
    assert.equal(out.ok, true);
    assert.equal(out.config.sections.hero.cta, 'Get a free quote');
    assert.equal(out.config.sections.hero.callText, 'Get a free quote');
    assert.equal(out.config.sections.hero.title, 'Welcome');
    assert.equal(out.config.name, 'Bean Culture');
  });

  it('applyPatchToConfig enables FAQ section and sectionOrder', () => {
    const cfg = { sections: { hero: { on: true } }, sectionOrder: ['hero', 'quote'] };
    const out = aiTeam.applyPatchToConfig(cfg, {
      operation: 'enable_section',
      sectionKey: 'faq'
    });
    assert.equal(out.ok, true);
    assert.equal(out.config.sections.faq.on, true);
    assert.ok(out.config.sectionOrder.indexOf('faq') >= 0);
  });

  it('buildDraftFromRecommendation plans hero CTA when Site Knowledge has CTA', () => {
    const plan = aiTeam.buildDraftFromRecommendation(
      {
        title: 'Strengthen CTA',
        proposedChange: { type: 'outcome', outcome: 'strengthen_primary_cta' }
      },
      {
        goals: {
          preferredCta: siteBrain.makeFact('Book a table', { status: 'verified', source: 'user' })
        }
      },
      { sections: { hero: { on: true, callText: 'Contact us' } } }
    );
    assert.equal(plan.ok, true);
    assert.equal(plan.kind, 'execution_plan');
    assert.ok(plan.executionPlan);
    assert.equal(plan.executionPlan.generatedBy, 'forge');
    assert.ok(plan.executionPlan.steps.length >= 1);
    assert.equal(plan.executionPlan.steps[0].operation, 'hero_cta');
  });

  it('approve recommendation creates an Execution Plan task', async () => {
    await siteBrain.syncSiteBrainFromSite({
      id: 'p2-task',
      business_name: 'Bean Culture',
      config: {
        name: 'Bean Culture',
        services: [{ title: 'Coffee' }],
        sections: { hero: { on: true, cta: 'Contact', callText: 'Contact' } },
        sectionOrder: ['hero']
      }
    });
    await siteBrain.applyBootstrapReview(
      'p2-task',
      {
        businessName: 'Bean Culture',
        preferredCta: 'Get a free quote',
        primaryGoal: 'More hires'
      },
      { actorUserId: 'u1' }
    );
    const review = await aiTeam.runAtlasReview({
      siteId: 'p2-task',
      requestText: 'Improve conversions',
      editorContext: { editorTab: 'ai-team', pagePurpose: 'homepage' },
      actorUserId: 'u1',
      actorRole: 'client'
    });
    const heroRec = review.recommendations.find((r) => {
      const c = r.proposed_change || r.proposedChange || {};
      return c.outcome === 'strengthen_primary_cta' || c.sectionKey === 'hero';
    });
    assert.ok(heroRec, 'expected CTA outcome recommendation');

    const taskResult = await aiTeam.createTaskForApprovedRecommendation(
      'p2-task',
      {
        id: heroRec.id,
        title: heroRec.title,
        proposed_change: heroRec.proposed_change || heroRec.proposedChange
      },
      { actorUserId: 'u1' }
    );
    assert.equal(taskResult.ok, true);
    assert.ok(taskResult.executionPlan);
    assert.equal(taskResult.executionPlan.generatedBy, 'forge');
    assert.equal(taskResult.task.kind, 'execution_plan');

    const got = await siteBrain.getSiteBrain('p2-task');
    assert.ok((got.brain.snapshot.executionPlans || []).length >= 1);
    assert.equal(got.brain.snapshot.openTasks.length >= 1, true);
  });

  it('legacy forge_draft recommendations still plan via Forge', () => {
    const plan = aiTeam.buildDraftFromRecommendation(
      {
        title: 'Apply hero',
        proposedChange: { type: 'forge_draft', capabilityId: 'hero', sectionKey: 'hero' }
      },
      {
        goals: {
          preferredCta: siteBrain.makeFact('Book a table', { status: 'verified', source: 'user' })
        }
      },
      { sections: { hero: { on: true, callText: 'Hi' } } }
    );
    assert.equal(plan.ok, true);
    assert.ok(plan.executionPlan);
  });

  it('isExecutableCapability allows hero and faq only', () => {
    assert.equal(aiTeam.isExecutableCapability('hero'), true);
    assert.equal(aiTeam.isExecutableCapability('faq'), true);
    assert.equal(aiTeam.isExecutableCapability('quote'), false);
  });
});

describe('AI Team Phase 2 — Execution Plans', () => {
  beforeEach(() => {
    siteBrain.useMemoryForTests(true);
    siteBrain.resetMemoryStore();
    process.env.SITE_BRAIN_STORAGE = 'memory';
  });

  it('batches multiple outcomes into one Execution Plan', () => {
    const built = aiTeam.buildExecutionPlan({
      siteId: 'batch-1',
      recommendations: [
        {
          id: 'r1',
          title: 'Strengthen CTA',
          proposedChange: { type: 'outcome', outcome: 'strengthen_primary_cta' }
        },
        {
          id: 'r2',
          title: 'FAQ',
          proposedChange: { type: 'outcome', outcome: 'enable_faq_for_objections' }
        }
      ],
      snapshot: {
        siteId: 'batch-1',
        goals: {
          preferredCta: siteBrain.makeFact('Request a Free Quote', {
            status: 'verified',
            source: 'user'
          })
        }
      },
      config: {
        sections: {
          hero: { on: true, callText: 'Contact Us' },
          stickyCta: { label: 'Contact Us' }
        },
        sectionOrder: ['hero']
      }
    });
    assert.equal(built.ok, true);
    assert.equal(built.plan.generatedBy, 'forge');
    assert.equal(built.plan.recommendationIds.length, 2);
    assert.ok(built.plan.steps.length >= 2);
    assert.ok(built.plan.preview);
    assert.ok(built.plan.guardian);
    assert.equal(built.plan.guardian.ok, true);
    assert.equal(built.executable, true);
    // Sticky CTA included when present
    assert.ok(built.plan.steps.some((s) => s.operation === 'sticky_cta'));
    assert.ok(built.plan.steps.some((s) => s.operation === 'enable_faq'));
  });

  it('Guardian blocks publish and generic CTA on Execution Plan', () => {
    const bad = {
      id: 'p1',
      generatedBy: 'forge',
      steps: [
        {
          id: 's1',
          operation: 'hero_cta',
          configPaths: ['sections.hero.cta'],
          after: { cta: 'Contact us' }
        }
      ],
      rollbackStrategy: { type: 'config_snapshot' }
    };
    const g = aiTeam.validateExecutionPlan(bad);
    assert.equal(g.ok, false);
    assert.ok(g.critical.some((c) => c.code === 'cta_too_generic'));
  });

  it('Atlas recommendations use outcomes without config paths', () => {
    const ctx = {
      offers: { mainServices: siteBrain.makeFact(['Coffee'], { status: 'verified' }) },
      goals: {
        primary: siteBrain.makeFact('More bookings', { status: 'verified' }),
        preferredCta: siteBrain.makeFact('Book a table', { status: 'verified' })
      },
      marketplace: { activeSections: siteBrain.makeFact(['hero'], { status: 'inferred' }) },
      editorContext: { pagePurpose: 'homepage', selectedSection: null }
    };
    const recs = aiTeam.runAtlasReview
      ? require('../lib/ai-team/atlas').buildDeterministicRecommendations(ctx, '')
      : [];
    assert.ok(recs.length >= 1);
    recs.forEach((r) => {
      const change = r.proposedChange || {};
      assert.ok(!change.paths, 'Atlas must not emit config paths');
      assert.ok(!change.configPaths, 'Atlas must not emit configPaths');
      if (change.type === 'outcome' || change.type === 'forge_draft') {
        assert.ok(change.outcome || change.capabilityId || change.note);
      }
    });
    const cta = recs.find((r) => (r.proposedChange || {}).outcome === 'strengthen_primary_cta');
    assert.ok(cta);
    assert.match(String(cta.problem || ''), /visitor|quote|next step|direct/i);
  });

  it('Site Knowledge fields are marked business_fact', () => {
    const fields = aiTeam.SITE_KNOWLEDGE_FIELDS;
    assert.ok(fields.every((f) => f.kind === 'business_fact'));
  });

  it('Change Preview lists before/after for steps', () => {
    const preview = aiTeam.buildChangePreview({
      id: 'plan-x',
      steps: [
        {
          id: '1',
          label: 'Hero CTA',
          operation: 'hero_cta',
          before: { cta: 'Contact Us' },
          after: { cta: 'Request a Free Quote' },
          configPaths: ['sections.hero.callText']
        },
        {
          id: '2',
          label: 'FAQ Section',
          operation: 'enable_faq',
          before: { on: false },
          after: { on: true },
          configPaths: ['sections.faq.on']
        }
      ],
      affectedPages: ['Home'],
      risk: 'low',
      estimatedTime: 'Instant'
    });
    assert.equal(preview.changes.length, 2);
    assert.equal(preview.changes[0].before, 'Contact Us');
    assert.equal(preview.changes[0].after, 'Request a Free Quote');
    assert.equal(preview.changes[1].before, 'Disabled');
    assert.equal(preview.changes[1].after, 'Enabled');
  });
});
