'use strict';

/**
 * AI Composer visual check: compare each built section (screenshot of the draft) with
 * the same section of the design, then apply the fixes the check allows — another
 * layout of the same app, a background tone, the photo side, or a re-fill.
 */

const tiles = require('./tiles');
const layouts = require('./layouts');
const { getApp } = require('./catalogue');
const { cleanLayout } = require('./plan');

const MAX_ISSUES = 3;

function str(v, max) { return String(v == null ? '' : v).trim().slice(0, max || 200); }

/**
 * Pair plan sections with where their app sits on the built page.
 * @param {object} plan sanitised plan
 * @param {{ sec: string, y: number, h: number }[]} boxes from the snapshot
 * @returns {{ section: object, box: { y: number, h: number } }[]}
 */
function pairSections(plan, boxes) {
  const byKey = {};
  (boxes || []).forEach(function (b) { if (b && b.sec && !byKey[b.sec] && b.h > 20) byKey[b.sec] = b; });
  return (plan.sections || [])
    .filter(function (s) { return !s.synthetic && byKey[s.appKey]; })
    .map(function (s) { return { section: s, box: byKey[s.appKey] }; });
}

/**
 * Items for the visual-check prompt.
 * @param {object} plan @param {{ imageUrl: string, width: number, height: number, sections: object[] }} snap
 * @param {string[]} [ids] only these sections
 */
function reviewItems(plan, snap, ids) {
  const designParsed = tiles.parseUploadUrl(plan.design.url);
  const snapParsed = tiles.parseUploadUrl(snap.imageUrl);
  const W = Math.round(Number(snap.width)) || 1440;
  const H = Math.round(Number(snap.height)) || 1;
  return pairSections(plan, snap.sections)
    .filter(function (p) { return !ids || ids.indexOf(p.section.id) >= 0; })
    .map(function (p) {
      const s = p.section;
      const app = getApp(s.appKey);
      const y0 = Math.max(0, Math.min(H - 1, Math.round(p.box.y)));
      const y1 = Math.max(y0 + 20, Math.min(H, Math.round(p.box.y + p.box.h)));
      return {
        sectionId: s.id,
        appKey: s.appKey,
        label: s.label,
        layout: s.layout || '',
        tone: s.tone || '',
        photoSide: s.photoSide || '',
        layouts: (app && app.layouts ? app.layouts : []).filter(function (l) { return l.id !== s.layout; }).concat(
          (app && app.layouts ? app.layouts : []).filter(function (l) { return l.id === s.layout; })
        ),
        designUrls: tiles.sectionImageUrls(designParsed, plan.design.width, s.rows).slice(0, 2),
        builtUrls: tiles.sectionImageUrls(snapParsed, W, { y0: y0, y1: y1 }).slice(0, 2)
      };
    });
}

/**
 * Check the model's verdicts: only known sections, only layouts / tones / sides the
 * app supports.
 * @returns {{ sectionId: string, verdict: string, issues: string[], fix: { layout?: string, tone?: string, photoSide?: string }, refill: boolean }[]}
 */
function normalizeVerdicts(raw, plan) {
  const byId = {};
  (plan.sections || []).forEach(function (s) { byId[s.id] = s; });
  const out = [];
  const seen = {};
  (raw && Array.isArray(raw.sections) ? raw.sections : []).forEach(function (r) {
    const s = r && byId[str(r.id, 20)];
    if (!s || seen[s.id]) return;
    seen[s.id] = true;
    const verdict = ['good', 'close', 'wrong'].indexOf(str(r.verdict, 10).toLowerCase()) >= 0 ? str(r.verdict, 10).toLowerCase() : 'close';
    const fix = {};
    const L = layouts.getLayouts(s.appKey);
    const hasPhoto = (plan.photos || []).some(function (p) { return p.sectionId === s.id; });
    if (L) {
      const wantLayout = str(r.layout, 40);
      const wantVariant = wantLayout ? layouts.getVariant(s.appKey, wantLayout) : null;
      // A layout built around a photo is only an improvement when the section has one.
      const target = wantVariant && !(wantVariant.needsPhoto && !hasPhoto) ? wantLayout : s.layout;
      const cl = cleanLayout(s.appKey, { layout: target, tone: str(r.tone, 10) || s.tone, photoSide: str(r.photoSide, 10) || s.photoSide });
      if (cl.layout !== s.layout) fix.layout = cl.layout;
      if (str(r.tone, 10) && cl.tone !== s.tone) fix.tone = cl.tone;
      if (str(r.photoSide, 10) && cl.photoSide && cl.photoSide !== s.photoSide) fix.photoSide = cl.photoSide;
    }
    out.push({
      sectionId: s.id,
      verdict: verdict,
      issues: (Array.isArray(r.issues) ? r.issues : []).map(function (x) { return str(x, 160); }).filter(Boolean).slice(0, MAX_ISSUES),
      fix: fix,
      refill: r.refill === true || !!fix.layout,
      // No listed layout has the design's arrangement (a new one would be needed).
      newLayout: r.newLayout === true && verdict !== 'good' && !fix.layout
    });
  });
  return out;
}

/**
 * Apply verdict fixes to a plan (returns a new plan and the sections to fill again).
 * Sections judged "good" are never changed.
 */
function applyVerdicts(plan, verdicts) {
  const next = JSON.parse(JSON.stringify(plan));
  const refill = [];
  const changes = [];
  verdicts.forEach(function (v) {
    if (v.verdict === 'good') return;
    const s = next.sections.find(function (x) { return x.id === v.sectionId; });
    if (!s) return;
    const before = [s.layout, s.tone, s.photoSide].join('/');
    if (v.fix.layout) { s.layout = v.fix.layout; s.tone = ''; s.photoSide = ''; }
    if (v.fix.tone != null && v.fix.tone !== undefined) s.tone = v.fix.tone;
    if (v.fix.photoSide) s.photoSide = v.fix.photoSide;
    const cl = cleanLayout(s.appKey, s);
    s.layout = cl.layout; s.tone = cl.tone; s.photoSide = cl.photoSide;
    const after = [s.layout, s.tone, s.photoSide].join('/');
    if (after !== before) changes.push({ sectionId: s.id, appKey: s.appKey, from: before, to: after });
    if (v.refill || after !== before) refill.push(s.id);
  });
  return { plan: next, refill: refill, changes: changes };
}

module.exports = {
  pairSections,
  reviewItems,
  normalizeVerdicts,
  applyVerdicts
};
