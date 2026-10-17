'use strict';

/** Image library: several files at once with a progress meter; file names kept; transparency kept. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const m = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');

test('library uploads many files with per-file and overall progress', () => {
  assert.match(m, /async function cwLibBatch\(files\)/);
  assert.match(m, /cwPickMany\(function\(files\)\{ cwLibBatch\(files\); \},\{accept:'image\/\*'\}\)/);
  assert.match(m, /id="cwl-queue" hidden/);
  assert.match(m, /x\.upload\.onprogress=function\(ev\)/);
  assert.match(m, /'Uploading '\+\(i\+1\)\+' of '\+n/);
  assert.match(m, /_box\.addEventListener\('drop'/);
});

test('library uploads keep the file name (suffix only when taken)', () => {
  assert.match(m, /var pid=_folder\+'\/'\+\(opts\.publicName\?String\(opts\.publicName\):cwRand\(\)\);/);
  assert.match(m, /if\(taken\[slug\]\) slug=slug\+'-'\+cwRand\(\)\.slice\(-5\);/);
});

test('compressing a transparent PNG/WebP keeps it transparent (WebP, not JPEG on white)', () => {
  assert.match(m, /if\(_alpha\) asJpeg=false;/);
  assert.match(m, /var mime=asJpeg\?'image\/jpeg':\(_alpha\?'image\/webp':'image\/png'\);/);
});
