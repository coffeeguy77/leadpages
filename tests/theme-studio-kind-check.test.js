'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  useMemoryStore,
  resetMemoryStore,
  setAdminClientForTests,
  createDraft,
  createVersion,
  VERSION_KINDS,
  KIND_LEGACY_FALLBACK,
  KIND_EXPAND_SQL,
  isKindCheckViolation,
  normalizeVersionKind,
  kindConstraintMigrationHint
} = require('../lib/theme-studio/store');

function fakeAdminRejectingKind(rejectKinds) {
  const rejected = new Set(rejectKinds);
  const calls = [];
  return {
    calls,
    client: {
      from(table) {
        assert.equal(table, 'theme_studio_versions');
        return {
          insert(row) {
            calls.push(row);
            return {
              select() {
                return {
                  async single() {
                    if (rejected.has(row.kind)) {
                      return {
                        data: null,
                        error: {
                          code: '23514',
                          message:
                            'new row for relation "theme_studio_versions" violates check constraint "theme_studio_versions_kind_check"'
                        }
                      };
                    }
                    return { data: { ...row }, error: null };
                  }
                };
              }
            };
          }
        };
      }
    }
  };
}

describe('theme_studio_versions kind check', () => {
  beforeEach(() => {
    resetMemoryStore();
    useMemoryStore(true);
  });

  afterEach(() => {
    useMemoryStore(false);
    resetMemoryStore();
    setAdminClientForTests(null);
  });

  it('documents every API kind in VERSION_KINDS', () => {
    for (const kind of Object.keys(KIND_LEGACY_FALLBACK)) {
      assert.equal(VERSION_KINDS.has(kind), true, kind);
    }
    for (const kind of ['generate', 'refine', 'select', 'apply', 'template', 'images', 'approve']) {
      assert.equal(VERSION_KINDS.has(kind), true, kind);
    }
  });

  it('detects kind_check constraint violations', () => {
    assert.equal(
      isKindCheckViolation({
        code: '23514',
        message:
          'new row for relation "theme_studio_versions" violates check constraint "theme_studio_versions_kind_check"'
      }),
      true
    );
    assert.equal(isKindCheckViolation({ message: 'something else' }), false);
  });

  it('rejects unknown kinds before insert', async () => {
    const draft = await createDraft({ owner_user_id: 'u1', brief: {} });
    const bad = await createVersion({
      draft_id: draft.draft.id,
      concept_id: 'c1',
      kind: 'not-a-real-kind',
      concept_json: {}
    });
    assert.equal(bad.ok, false);
    assert.match(bad.error, /invalid_version_kind/);
  });

  it('falls back to a legacy kind when Supabase rejects images', async () => {
    useMemoryStore(false);
    resetMemoryStore();
    const fake = fakeAdminRejectingKind(['images']);
    setAdminClientForTests(fake.client);

    const created = await createVersion({
      draft_id: 'draft-1',
      concept_id: 'c1',
      version_number: 2,
      kind: 'images',
      concept_json: { conceptId: 'c1' },
      adapter_warnings: [{ code: 'image_persist', message: 'ok' }]
    });

    assert.equal(created.ok, true);
    assert.equal(created.notice, 'kind_constraint_legacy_fallback');
    assert.equal(created.intendedKind, 'images');
    assert.equal(created.migration, KIND_EXPAND_SQL);
    assert.equal(created.version.kind, 'refine');
    assert.equal(fake.calls.length, 2);
    assert.equal(fake.calls[0].kind, 'images');
    assert.equal(fake.calls[1].kind, 'refine');
    assert.ok(
      created.version.adapter_warnings.some((w) => w.code === 'kind_constraint_legacy_fallback')
    );
  });

  it('surfaces migration hint when fallback also fails', async () => {
    useMemoryStore(false);
    resetMemoryStore();
    const fake = fakeAdminRejectingKind(['images', 'refine']);
    setAdminClientForTests(fake.client);

    const created = await createVersion({
      draft_id: 'draft-1',
      concept_id: 'c1',
      version_number: 1,
      kind: 'images',
      concept_json: {}
    });

    assert.equal(created.ok, false);
    assert.equal(created.code, 'kind_constraint');
    assert.equal(created.migration, KIND_EXPAND_SQL);
    assert.match(created.error, /theme_studio_versions_kind_expand\.sql/);
    assert.match(kindConstraintMigrationHint(), /theme_studio_versions_kind_expand\.sql/);
    assert.equal(normalizeVersionKind('images').ok, true);
  });
});
