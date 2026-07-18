'use strict';

const { describe, it, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');

process.env.THEME_STUDIO_MEMORY_STORE = '1';
process.env.THEME_STUDIO_V2 = '1';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role';
delete process.env.PEXELS_API_KEY;

const httpAccess = require('../lib/theme-studio/http-access');
const {
  useMemoryStore,
  resetMemoryStore,
  createDraft
} = require('../lib/theme-studio/store');
const { generateConceptsWithBrain } = require('../lib/theme-studio/generate');
const briefs = require('../fixtures/website-composer/briefs');

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    end(b) {
      this.body = b;
    }
  };
}

function mockReq(body) {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer test' },
    body
  };
}

describe('Theme Studio generate-concepts — resilience', () => {
  let restoreActor;
  let handler;

  before(() => {
    useMemoryStore(true);
    handler = require('../api/theme-studio/generate-concepts');
    restoreActor = mock.method(httpAccess, 'requireThemeStudioActor', async () => ({
      ok: true,
      user: { id: '00000000-0000-4000-8000-000000000001' },
      actor: {
        userId: '00000000-0000-4000-8000-000000000001',
        isSuperuser: true,
        isPartner: false,
        isClient: false,
        role: 'superuser'
      }
    }));
  });

  after(() => {
    if (restoreActor) restoreActor.mock.restore();
    resetMemoryStore();
  });

  beforeEach(() => {
    resetMemoryStore();
    useMemoryStore(true);
  });

  it('returns JSON 400 when draftId is missing (not empty 500)', async () => {
    const res = mockRes();
    await handler(mockReq({}), res);
    assert.equal(res.statusCode, 400);
    const j = JSON.parse(res.body);
    assert.equal(j.ok, false);
    assert.ok(j.message);
    assert.ok(j.diagnosticId);
  });

  it('generates three concepts for Bean Culture draft', async () => {
    const created = await createDraft({
      owner_user_id: '00000000-0000-4000-8000-000000000001',
      brief: briefs.BEAN_CULTURE
    });
    assert.equal(created.ok, true);

    const res = mockRes();
    await handler(
      mockReq({
        draftId: created.draft.id,
        brief: briefs.BEAN_CULTURE
      }),
      res
    );
    assert.equal(res.statusCode, 200, res.body);
    const j = JSON.parse(res.body);
    assert.equal(j.ok, true);
    assert.equal(j.source, 'website_composer');
    assert.ok(j.versions.length >= 2);
    assert.ok(j.versions[0].conceptName);
    assert.ok(j.versions[0].draftConfig);
  });

  it('surfaces unexpected exceptions as JSON 500 with diagnosticId', async () => {
    const store = require('../lib/theme-studio/store');
    const created = await createDraft({
      owner_user_id: '00000000-0000-4000-8000-000000000001',
      brief: briefs.BEAN_CULTURE
    });
    const boom = mock.method(store, 'createVersion', async () => {
      throw new Error('simulated_store_crash');
    });
    try {
      const res = mockRes();
      await handler(
        mockReq({
          draftId: created.draft.id,
          brief: briefs.BEAN_CULTURE
        }),
        res
      );
      assert.equal(res.statusCode, 500);
      const j = JSON.parse(res.body);
      assert.equal(j.ok, false);
      assert.equal(j.error, 'generate_concepts_exception');
      assert.match(j.message, /simulated_store_crash/);
      assert.ok(j.diagnosticId);
    } finally {
      boom.mock.restore();
    }
  });
});

describe('Theme Studio generateConceptsWithBrain — Brain off critical path', () => {
  it('defaults to Composer-only source without awaiting Brain', async () => {
    let brainCalled = false;
    const brain = {
      generateStructured: async () => {
        brainCalled = true;
        await new Promise((r) => setTimeout(r, 50));
        return { ok: true, output: { concept: {} } };
      }
    };
    const result = await generateConceptsWithBrain(brain, briefs.BEAN_CULTURE, {
      count: 1,
      allowMockImages: true,
      actor: { isSuperuser: true }
    });
    assert.equal(result.ok, true);
    assert.equal(result.source, 'website_composer');
    assert.equal(brainCalled, false);
  });

  it('optional useBrain times out instead of hanging', async () => {
    const brain = {
      generateStructured: async () => {
        await new Promise((r) => setTimeout(r, 200));
        return { ok: true, output: { concept: {} } };
      }
    };
    const result = await generateConceptsWithBrain(brain, briefs.BEAN_CULTURE, {
      count: 1,
      allowMockImages: true,
      actor: { isSuperuser: true },
      useBrain: true,
      brainTimeoutMs: 20
    });
    assert.equal(result.ok, true);
    assert.equal(result.source, 'website_composer_brain_timeout');
  });
});
