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
  createDraft,
  createVersion
} = require('../lib/theme-studio/store');
const { composeWebsiteConcepts } = require('../lib/website-composer');
const { loadShellHtml, renderDraftPreviewHtml } = require('../lib/theme-studio/render-preview');
const { signPreviewToken } = require('../lib/theme-studio/preview-token');

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

describe('Theme Studio preview — shell bundle + GET token', () => {
  let restoreActor;
  let handler;

  before(() => {
    useMemoryStore(true);
    handler = require('../api/theme-studio/preview');
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

  it('loads both shells via static requires (Vercel-bundlable)', () => {
    const trade = loadShellHtml('trade.template.json');
    const neutral = loadShellHtml('landing-shell-neutral-v1.template.json');
    assert.ok(trade.length > 1000);
    assert.ok(neutral.length > 1000);
    assert.match(neutral, /landing-shell-neutral-v1|data-ws-shell/);
    assert.throws(() => loadShellHtml('missing.template.json'), /renderer_shell_missing/);
  });

  it('GET signed preview returns HTML for Pink Diamond Vault (not a crash)', async () => {
    const composed = await composeWebsiteConcepts(
      {
        businessName: 'Pink Diamond Vault',
        industry: 'Luxury Jewellery',
        specialisation: 'Rare Argyle pink diamonds',
        location: 'Canberra ACT',
        desiredStyle: 'Luxury elegant',
        conversionGoal: 'Book appointment',
        audience: 'Affluent couples'
      },
      { count: 1, allowMockImages: true, actor: { isSuperuser: true } }
    );
    assert.equal(composed.ok, true);

    const draft = await createDraft({
      owner_user_id: '00000000-0000-4000-8000-000000000001',
      brief: { businessName: 'Pink Diamond Vault', industry: 'Luxury Jewellery' }
    });
    const ver = await createVersion({
      draft_id: draft.draft.id,
      concept_id: composed.concepts[0].concept.conceptId,
      kind: 'generate',
      concept_json: composed.concepts[0].concept,
      draft_config_json: composed.concepts[0].draftConfig
    });

    const direct = renderDraftPreviewHtml(composed.concepts[0].draftConfig, { mode: 'desktop' });
    assert.match(direct, /landing-shell-neutral-v1/);
    assert.doesNotMatch(direct, /FUNCTION_INVOCATION_FAILED/);

    const token = signPreviewToken({
      draftId: draft.draft.id,
      versionId: ver.version.id,
      userId: '00000000-0000-4000-8000-000000000001'
    });
    const res = mockRes();
    await handler(
      {
        method: 'GET',
        url: '/api/theme-studio/preview?token=' + encodeURIComponent(token) + '&mode=desktop'
      },
      res
    );
    assert.equal(res.statusCode, 200, String(res.body).slice(0, 300));
    assert.match(res.headers['Content-Type'] || '', /text\/html/);
    assert.match(String(res.body), /Pink Diamond Vault|landing-shell-neutral/);
    assert.doesNotMatch(String(res.body), /FUNCTION_INVOCATION_FAILED|This Serverless Function has crashed/);
  });

  it('surfaces render exceptions as JSON 500 with diagnosticId', async () => {
    const renderPreview = require('../lib/theme-studio/render-preview');
    const boom = mock.method(renderPreview, 'renderDraftPreviewHtml', () => {
      throw new Error('simulated_shell_missing');
    });
    try {
      const draft = await createDraft({
        owner_user_id: '00000000-0000-4000-8000-000000000001',
        brief: { businessName: 'X', industry: 'Y' }
      });
      const ver = await createVersion({
        draft_id: draft.draft.id,
        concept_id: 'c1',
        kind: 'generate',
        concept_json: { conceptId: 'c1' },
        draft_config_json: {}
      });
      const token = signPreviewToken({
        draftId: draft.draft.id,
        versionId: ver.version.id,
        userId: '00000000-0000-4000-8000-000000000001'
      });
      const res = mockRes();
      await handler(
        {
          method: 'GET',
          url: '/api/theme-studio/preview?token=' + encodeURIComponent(token)
        },
        res
      );
      assert.equal(res.statusCode, 500);
      const j = JSON.parse(res.body);
      assert.equal(j.error, 'preview_exception');
      assert.match(j.message, /simulated_shell_missing/);
      assert.ok(j.diagnosticId);
    } finally {
      boom.mock.restore();
    }
  });
});
