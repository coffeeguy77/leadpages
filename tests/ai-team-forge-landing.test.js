'use strict';

/**
 * Forge create_landing_page — Draft/Apply must append sites.config.pages[].
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.SITE_BRAIN_STORAGE = 'memory';

const aiTeam = require('../lib/ai-team');
const forge = require('../lib/ai-team/forge');

const root = path.join(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'assets/ai-website-team.js'), 'utf8');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');

describe('AI Team Forge landing page create', () => {
  it('refuses plan_seo_landing without Primary keyword + Location', () => {
    const built = forge.stepsFromRecommendation(
      {
        id: 'r1',
        proposedChange: { type: 'outcome', outcome: 'plan_seo_landing' }
      },
      {},
      { name: 'Bean Culture', pages: [] }
    );
    assert.equal(built.error, 'landing_inputs_required');
    assert.equal((built.steps || []).length, 0);
  });

  it('builds create_landing_page step from landingAiInputs', () => {
    const built = forge.stepsFromRecommendation(
      {
        id: 'r2',
        proposedChange: {
          type: 'outcome',
          outcome: 'plan_seo_landing',
          landingAiInputs: {
            mode: 'seo',
            primaryKeyword: 'Pumpkin Pie Recipe',
            location: 'Canberra',
            extraInfo: 'Family workshops only'
          }
        }
      },
      {},
      { name: 'Bean Culture', pages: [] }
    );
    assert.equal(built.error, undefined);
    assert.equal(built.steps.length, 1);
    assert.equal(built.steps[0].operation, 'create_landing_page');
    assert.ok(built.steps[0].after.page.slug);
    assert.match(built.steps[0].after.page.title, /Pumpkin Pie Recipe/);
    assert.match(built.steps[0].after.page.slug, /pumpkin-pie-recipe/);
  });

  it('applyPatchToConfig appends a draft page to config.pages', () => {
    const page = forge.buildLandingPageFromInputs(
      { primaryKeyword: 'Halloween pumpkin carvings', location: 'Canberra' },
      { name: 'Bean Culture', pages: [] }
    );
    const out = aiTeam.applyPatchToConfig(
      { name: 'Bean Culture', pages: [] },
      { operation: 'create_landing_page', after: { page: page } }
    );
    assert.equal(out.ok, true);
    assert.equal(out.config.pages.length, 1);
    assert.equal(out.config.pages[0].status, 'draft');
    assert.equal(out.config.pages[0].title, page.title);
    assert.equal(out.pageId, page.id);
  });

  it('buildExecutionPlan creates applyable landing plan when inputs present', () => {
    const plan = aiTeam.buildExecutionPlan({
      recommendations: [
        {
          id: 'r3',
          title: 'Plan landing',
          proposedChange: {
            type: 'outcome',
            outcome: 'plan_seo_landing',
            landingAiInputs: {
              primaryKeyword: 'Pumpkin Pie Recipe',
              location: 'Canberra'
            }
          }
        }
      ],
      snapshot: {},
      config: { name: 'Bean Culture', pages: [] },
      siteId: 'site-1'
    });
    assert.equal(plan.ok, true);
    assert.equal(plan.executable, true);
    assert.equal(plan.plan.steps[0].operation, 'create_landing_page');
    assert.equal(plan.plan.estimatedTime, 'A few seconds');
    const preview = plan.plan.preview;
    assert.ok(preview.changes[0].after.indexOf('Pumpkin Pie Recipe') >= 0);
    assert.ok(preview.changes[0].after.indexOf('draft') >= 0);
  });

  it('UI shows busy overlay and gates Draft until seo inputs', () => {
    assert.ok(ui.includes('showBusy('), 'busy overlay helper');
    assert.ok(ui.includes('ai-team-busy'), 'busy overlay id');
    assert.ok(ui.includes('landingReadyForForge'), 'landing ready gate');
    assert.ok(ui.includes('forgeBlockReason'), 'forge block reason');
    assert.ok(ui.includes('Applying changes'), 'apply busy copy');
    assert.ok(ui.includes('Building Change Preview'), 'draft busy copy');
    assert.ok(manage.includes('lpOpenLandingPage'), 'opens landing page after apply');
    assert.ok(manage.includes('ai-website-team.js?v=forge-landing-'), 'cache bust');
  });
});
