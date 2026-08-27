/**
 * Smart site backups — service helpers + API wiring smoke tests.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const svc = require('../lib/site-backups/service');

// Pure helpers
assert.strictEqual(svc.normalizeSource('pre_publish'), 'pre_publish');
assert.strictEqual(svc.normalizeSource('weird'), 'manual');
assert.ok(svc.hashConfig({ a: 1 }));
assert.strictEqual(svc.hashConfig({ a: 1 }), svc.hashConfig({ a: 1 }));
assert.notStrictEqual(svc.hashConfig({ a: 1 }), svc.hashConfig({ a: 2 }));
assert.ok(svc.jsonSize({ hello: 'world' }) > 10);
assert.strictEqual(svc.effectiveSizeBytes({ size_bytes: 0, config: { a: 1 } }), svc.jsonSize({ a: 1 }));
assert.strictEqual(svc.effectiveSizeBytes({ size_bytes: 512, config: { a: 1 } }), 512);
assert.ok(svc.needsSizeBackfill({ id: '1', size_bytes: 0, config: { x: 1 } }));
assert.ok(!svc.needsSizeBackfill({ id: '1', size_bytes: 100, config: { x: 1 } }));
assert.ok(svc.defaultLabel('pre_publish').indexOf('Before publish') === 0);
assert.ok(svc.defaultLabel('manual', 'My label') === 'My label');
assert.ok(svc.tableMissing({ message: "Could not find the table 'public.site_backups'" }));
assert.ok(svc.columnMissing({ message: "Could not find the 'size_bytes' column of 'site_backups'" }));
assert.deepStrictEqual(svc.publicBackup({
  id: '1',
  label: 'x',
  created_at: 't',
  size_bytes: 12,
  source: 'manual'
}).source, 'manual');

// Schema migration exists
const sql = fs.readFileSync(path.join(root, 'db/site_backups.sql'), 'utf8');
assert.ok(sql.includes('create table if not exists site_backups'));
assert.ok(sql.includes('size_bytes'));
assert.ok(sql.includes('config_hash'));
assert.ok(sql.includes('pre_publish'));
assert.ok(sql.includes('pre_restore'));

// API module loads and wires service
const apiSrc = fs.readFileSync(path.join(root, 'api/site-backups.js'), 'utf8');
assert.ok(apiSrc.includes("require('../lib/site-backups/service')"));
assert.ok(apiSrc.includes('createBackup'));
assert.ok(apiSrc.includes('restoreBackup'));
assert.ok(apiSrc.includes('setup_required') || apiSrc.includes('message:'));
assert.ok(apiSrc.includes("message: (e && e.message)"));

// Manage client surfaces real messages + smart sources
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
assert.ok(manage.includes('lpBkErrMsg') || manage.includes('j.message'), 'client prefers API message');
assert.ok(manage.includes("source:'pre_publish'") || manage.includes('source:\'pre_publish\'') || manage.includes('pre_publish'), 'publish auto-backup');
assert.ok(manage.includes('lpBkRefreshLists') || manage.includes('_dashLoadBk'), 'list refresh');
assert.ok(manage.includes('safetySource') || manage.includes('pre_import'), 'import safety snapshot');

console.log('site-backups.test.js: ok');
