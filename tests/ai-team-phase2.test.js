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

  it('applyPatchToConfig sets hero CTA without wiping other keys', () => {
    const cfg = {
      name: 'Bean Culture',
      sections: { hero: { on: true, title: 'Welcome', cta: 'Contact us' } }
    };
    const out = aiTeam.applyPatchToConfig(cfg, {
      operation: 'hero_cta',
      after: { cta: 'Get a free quote' }
    });
    assert.equal(out.ok, true);
    assert.equal(out.config.sections.hero.cta, 'Get a free quote');
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
        title: 'Apply hero',
        proposedChange: { type: 'forge_draft', capabilityId: 'hero', sectionKey: 'hero' }
      },
      {
        goals: {
          preferredCta: siteBrain.makeFact('Book a table', { status: 'verified', source: 'user' })
        }
      }
    );
    assert.equal(plan.ok, true);
    assert.equal(plan.kind, 'forge_draft');
    assert.equal(plan.patch.operation, 'hero_cta');
  });

  it('approve recommendation creates an open task', async () => {
    await siteBrain.syncSiteBrainFromSite({
      id: 'p2-task',
      business_name: 'Bean Culture',
      config: {
        name: 'Bean Culture',
        services: [{ title: 'Coffee' }],
        sections: { hero: { on: true, cta: 'Contact' } },
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
      editorContext: { editorTab: 'ai-team' },
      actorUserId: 'u1',
      actorRole: 'client'
    });
    const heroRec = review.recommendations.find((r) => {
      const c = r.proposed_change || r.proposedChange || {};
      return c.sectionKey === 'hero' && c.type === 'forge_draft';
    });
    assert.ok(heroRec, 'expected hero forge recommendation');

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
    assert.equal(taskResult.task.kind, 'forge_draft');

    const got = await siteBrain.getSiteBrain('p2-task');
    assert.equal(got.brain.snapshot.openTasks.length, 1);
  });

  it('isExecutableCapability allows hero and faq only', () => {
    assert.equal(aiTeam.isExecutableCapability('hero'), true);
    assert.equal(aiTeam.isExecutableCapability('faq'), true);
    assert.equal(aiTeam.isExecutableCapability('quote'), false);
  });
});
