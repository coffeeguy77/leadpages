'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.SITE_BRAIN_STORAGE = 'memory';

const siteBrain = require('../lib/site-brain');

describe('Site Brain', () => {
  beforeEach(() => {
    siteBrain.useMemoryForTests(true);
    siteBrain.resetMemoryStore();
    process.env.SITE_BRAIN_STORAGE = 'memory';
  });

  it('creates a brain with schema and provenance fields', async () => {
    const created = await siteBrain.createSiteBrain({
      siteId: 'site-a',
      accountId: 'acct-1',
      actorUserId: 'user-1'
    });
    assert.equal(created.ok, true);
    assert.equal(created.persisted, true);
    assert.equal(created.brain.snapshot.schemaVersion, '1.0');
    assert.equal(created.brain.snapshot.siteId, 'site-a');
    assert.ok(created.brain.snapshot.agentMemory.atlas);
  });

  it('enforces tenant isolation by siteId', async () => {
    await siteBrain.createSiteBrain({ siteId: 'site-a' });
    await siteBrain.createSiteBrain({ siteId: 'site-b' });
    const a = await siteBrain.getSiteBrain('site-a');
    const b = await siteBrain.getSiteBrain('site-b');
    assert.equal(a.brain.snapshot.siteId, 'site-a');
    assert.equal(b.brain.snapshot.siteId, 'site-b');
  });

  it('versions on update and detects conflicts', async () => {
    const c = await siteBrain.createSiteBrain({ siteId: 'site-v' });
    const s1 = await siteBrain.saveSnapshot('site-v', c.brain.snapshot, {
      expectedVersion: c.brain.version,
      eventType: 'update'
    });
    assert.equal(s1.ok, true);
    assert.equal(s1.brain.version, c.brain.version + 1);
    const conflict = await siteBrain.saveSnapshot('site-v', c.brain.snapshot, {
      expectedVersion: c.brain.version
    });
    assert.equal(conflict.ok, false);
    assert.equal(conflict.error, 'version_conflict');
    assert.equal(conflict.persisted, false);
  });

  it('never silently promotes inferred facts to verified', async () => {
    await siteBrain.createSiteBrain({ siteId: 'site-f' });
    const proposed = await siteBrain.proposeKnowledgeUpdate(
      'site-f',
      'goals.primary',
      siteBrain.makeFact('More enquiries', {
        source: 'specialist_inference',
        status: 'verified'
      }),
      { actorUserId: 'agent' }
    );
    assert.equal(proposed.ok, true);
    assert.equal(proposed.brain.snapshot.goals.primary.status, 'proposed');
    const approved = await siteBrain.approveKnowledgeUpdate('site-f', 'goals.primary', {
      actorUserId: 'user-1'
    });
    assert.equal(approved.brain.snapshot.goals.primary.status, 'verified');
  });

  it('supports reject and history', async () => {
    await siteBrain.createSiteBrain({ siteId: 'site-h' });
    await siteBrain.proposeKnowledgeUpdate('site-h', 'brand.tone', 'warm', {
      source: 'specialist_inference'
    });
    await siteBrain.rejectKnowledgeUpdate('site-h', 'brand.tone', { actorUserId: 'u' });
    const got = await siteBrain.getSiteBrain('site-h');
    assert.equal(got.brain.snapshot.brand.tone.status, 'rejected');
    const hist = await siteBrain.listHistory('site-h', 20);
    assert.equal(hist.ok, true);
    assert.ok(hist.events.length >= 2);
  });

  it('blocks protected path mutation', async () => {
    await siteBrain.createSiteBrain({ siteId: 'site-p' });
    const bad = await siteBrain.proposeKnowledgeUpdate('site-p', 'siteId', 'other');
    assert.equal(bad.ok, false);
    assert.equal(bad.error, 'protected_field');
  });

  it('prevents cross-agent memory overwrite', async () => {
    await siteBrain.createSiteBrain({ siteId: 'site-m' });
    await siteBrain.recordAgentObservation('site-m', 'atlas', {
      conclusions: { note: 'atlas-only' }
    });
    const bad = await siteBrain.recordAgentObservation('site-m', 'not-an-agent', {
      conclusions: {}
    });
    assert.equal(bad.ok, false);
    const got = await siteBrain.getSiteBrain('site-m');
    assert.equal(got.brain.snapshot.agentMemory.atlas.conclusions.note, 'atlas-only');
    assert.deepEqual(got.brain.snapshot.agentMemory.nova, {});
  });

  it('bootstrap sync marks interpretive fields needs-confirmation', () => {
    const snap = siteBrain.buildSnapshotFromSite({
      id: 'site-s',
      business_name: 'Render Co',
      owner_user_id: 'o1',
      template: 'trade',
      slug: 'render-co',
      config: {
        name: 'Render Co',
        trade: '3D rendering',
        region: 'Canberra',
        phone: '0400000000',
        services: [{ title: 'Commercial renders' }, { title: 'Animations' }],
        sections: { hero: { on: true, cta: 'Get a quote' }, faq: { on: false } },
        sectionOrder: ['hero', 'services', 'quote', 'footer']
      }
    });
    assert.equal(snap.business.name.status, 'verified');
    assert.equal(snap.business.industry.status, 'needs-confirmation');
    assert.equal(snap.goals.primary.status, 'needs-confirmation');
    const review = siteBrain.bootstrapReviewFields(snap);
    assert.equal(review.businessName, 'Render Co');
    assert.ok(Array.isArray(review.mainServices));
  });

  it('applyBootstrapReview verifies user-confirmed fields', async () => {
    const site = {
      id: 'site-br',
      business_name: 'Render Co',
      config: { name: 'Render Co', services: [{ title: 'Renders' }], sections: { hero: { on: true } } }
    };
    await siteBrain.syncSiteBrainFromSite(site, { actorUserId: 'u1' });
    const saved = await siteBrain.applyBootstrapReview(
      'site-br',
      {
        businessName: 'Render Co Canberra',
        industry: 'Architectural visualisation',
        mainServices: 'Commercial renders\nAnimations',
        targetAudience: 'Builders',
        primaryGoal: 'More commercial enquiries',
        preferredCta: 'Request a site quote',
        brandTone: 'Premium technical',
        serviceAreas: 'Canberra\nQueanbeyan',
        contentRestrictions: 'No competitor claims'
      },
      { actorUserId: 'u1' }
    );
    assert.equal(saved.ok, true);
    assert.equal(saved.brain.bootstrap_status, 'reviewed');
    assert.equal(saved.brain.snapshot.goals.primary.status, 'verified');
    assert.equal(saved.brain.snapshot.goals.primary.value, 'More commercial enquiries');
  });
});

describe('Site Brain storage modes', () => {
  it('test/memory mode may use memory adapter', () => {
    process.env.SITE_BRAIN_STORAGE = 'memory';
    siteBrain.useMemoryForTests(false);
    assert.equal(siteBrain.resolveStorageMode(), 'memory');
  });

  it('production mode rejects memory fallback (database mode)', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    delete process.env.SITE_BRAIN_STORAGE;
    siteBrain.useMemoryForTests(false);
    assert.equal(siteBrain.resolveStorageMode(), 'database');
    process.env.NODE_ENV = prev;
    process.env.SITE_BRAIN_STORAGE = 'memory';
    siteBrain.useMemoryForTests(true);
  });

  it('deployed preview rejects SITE_BRAIN_STORAGE=memory (no silent fallback)', () => {
    const prevVercel = process.env.VERCEL_ENV;
    const prevStorage = process.env.SITE_BRAIN_STORAGE;
    const prevNode = process.env.NODE_ENV;
    process.env.VERCEL_ENV = 'preview';
    process.env.SITE_BRAIN_STORAGE = 'memory';
    process.env.NODE_ENV = 'production';
    siteBrain.useMemoryForTests(false);
    assert.equal(siteBrain.resolveStorageMode(), 'database');
    if (prevVercel == null) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prevVercel;
    process.env.SITE_BRAIN_STORAGE = prevStorage || 'memory';
    process.env.NODE_ENV = prevNode || 'test';
    siteBrain.useMemoryForTests(true);
  });

  it('explicit database mode does not silently fall back when tables missing', async () => {
    siteBrain.useMemoryForTests(false);
    process.env.SITE_BRAIN_STORAGE = 'database';
    siteBrain.setAdminClientForTests({
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({
            data: null,
            error: { code: '42P01', message: 'relation "public.site_brains" does not exist' }
          }),
          insert() {
            return this;
          },
          update() {
            return this;
          },
          upsert() {
            return this;
          }
        };
      }
    });
    const got = await siteBrain.getSiteBrain('site-x');
    assert.equal(got.ok, false);
    assert.equal(got.error, 'site_brain_storage_unavailable');
    assert.equal(got.persisted, false);
    siteBrain.setAdminClientForTests(null);
    process.env.SITE_BRAIN_STORAGE = 'memory';
    siteBrain.useMemoryForTests(true);
  });
});
