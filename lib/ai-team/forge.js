'use strict';

/**
 * Forge — sole specialist permitted to mutate website configuration.
 *
 * Owns Execution Plans, config diffs, Apply, and Rollback.
 * Atlas / Echo / Scout / Pulse / Nova / Lens propose outcomes only.
 * Never publishes.
 */

const { randomUUID } = require('crypto');
const {
  emptyPlan,
  makeStep,
  buildChangePreview,
  collectConfigPaths,
  highestRisk,
  BUSINESS_OUTCOMES
} = require('./execution-plan');
const { getCapability } = require('./capability-registry');
const { getField } = require('./site-knowledge-fields');
const { validateExecutionPlan } = require('./guardian');

const EXECUTABLE_OPERATIONS = Object.freeze({
  hero_cta: { capabilityId: 'hero', sectionKey: 'hero' },
  sticky_cta: { capabilityId: 'hero', sectionKey: 'hero' },
  footer_cta: { capabilityId: 'footer', sectionKey: 'footer' },
  enable_faq: { capabilityId: 'faq', sectionKey: 'faq' },
  enable_section: { capabilityId: null, sectionKey: null },
  create_landing_page: { capabilityId: 'seoLandingPage', sectionKey: null },
  checklist: { capabilityId: null, sectionKey: null }
});

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-')
    .slice(0, 80);
}

function uniquePageSlug(base, config) {
  const pages = Array.isArray(config && config.pages) ? config.pages : [];
  const taken = {};
  pages.forEach(function (p) {
    if (p && p.slug) taken[String(p.slug).toLowerCase()] = true;
  });
  let slug = slugify(base) || 'landing-page';
  if (!taken[slug]) return slug;
  let n = 2;
  while (taken[slug + '-' + n]) n += 1;
  return slug + '-' + n;
}

/**
 * Build a Landing pages draft row from Write with AI inputs (no LLM required).
 * Apply appends this to sites.config.pages[] — user still Publishes Live Site.
 */
function buildLandingPageFromInputs(inputs, config) {
  const kw = String((inputs && inputs.primaryKeyword) || '').trim();
  const loc = String((inputs && inputs.location) || '').trim();
  const extra = String((inputs && inputs.extraInfo) || '').trim();
  const negatives = String((inputs && inputs.negativeKeywords) || '').trim();
  const business = String((config && (config.businessName || config.name)) || '').trim();
  const title = kw + (loc ? ' in ' + loc : '');
  const slug = uniquePageSlug(title, config);
  const h1 = title;
  const meta = (
    (business ? title + ' — ' + business + '. ' : title + '. ') +
    'Get a free quote today.'
  ).slice(0, 160);
  const bodyParts = [
    '## Why choose us for ' + kw + (loc ? ' in ' + loc : ''),
    extra ||
      ('Looking for ' +
        kw +
        (loc ? ' in ' + loc : '') +
        '? Tell us what you need and we will come back with a clear next step.'),
    '',
    '## What you get',
    '- Clear pricing and next steps',
    '- Local experience' + (loc ? ' around ' + loc : ''),
    '- Fast response when you enquire',
    '',
    '## Get a free quote',
    'Share a few details and we will reply with a quote — no obligation.'
  ];
  if (negatives) {
    bodyParts.push('', '<!-- Avoid mentioning: ' + negatives + ' -->');
  }
  return {
    id: randomUUID(),
    title: title,
    slug: slug,
    meta: meta,
    h1: h1,
    body: bodyParts.join('\n'),
    menu: 'top',
    status: 'draft',
    pageApps: [],
    pageSections: {},
    pageLayoutOrder: [],
    seo: {
      mode: 'seo',
      primaryKeyword: kw,
      location: loc,
      extraInfo: extra,
      negativeKeywords: negatives
    }
  };
}

function landingInputsFromRecommendation(rec) {
  const change = (rec && (rec.proposed_change || rec.proposedChange)) || {};
  const inputs = change.landingAiInputs || change.landing_ai_inputs || null;
  if (inputs && String(inputs.primaryKeyword || '').trim() && String(inputs.location || '').trim()) {
    return {
      mode: 'seo',
      primaryKeyword: String(inputs.primaryKeyword).trim(),
      location: String(inputs.location).trim(),
      extraInfo: String(inputs.extraInfo || '').trim(),
      negativeKeywords: String(inputs.negativeKeywords || '').trim()
    };
  }
  // Fallback: pull from completed seo_inputs / keywords plan step answers
  const steps = Array.isArray(change.planSteps) ? change.planSteps : [];
  const seo = steps.find(function (s) {
    return s && (s.id === 'seo_inputs' || s.id === 'keywords') && s.status === 'done';
  });
  const ans = (seo && seo.answers) || {};
  const phrase = String(ans.primaryKeyword || ans.phrase || '').trim();
  const location = String(ans.location || '').trim();
  if (phrase && location) {
    return {
      mode: 'seo',
      primaryKeyword: phrase,
      location: location,
      extraInfo: String(ans.extraInfo || '').trim(),
      negativeKeywords: String(ans.negativeKeywords || ans.negatives || '').trim()
    };
  }
  return null;
}

function factValue(f) {
  if (f == null) return '';
  if (typeof f === 'object' && 'value' in f) return f.value == null ? '' : f.value;
  return f;
}

function defaultSectionPayload(sectionKey) {
  if (sectionKey === 'faq') {
    return {
      on: true,
      eyebrow: 'FAQ',
      heading: 'Frequently asked questions',
      items: []
    };
  }
  return { on: true };
}

function readHeroCta(config) {
  const hero = (config && config.sections && config.sections.hero) || {};
  return String(hero.callText || hero.cta || hero.quoteText || '').trim();
}

function readFaqOn(config) {
  const faq = (config && config.sections && config.sections.faq) || {};
  return !!faq.on;
}

/**
 * Map a recommendation (business outcome or legacy forge_draft) into Forge steps.
 * Atlas should emit outcomes; legacy forge_draft / capabilityId still accepted.
 */
function stepsFromRecommendation(recommendation, snapshot, config) {
  const rec = recommendation || {};
  const change = rec.proposed_change || rec.proposedChange || {};
  const snap = snapshot || {};
  const cfg = config || {};
  const steps = [];
  const knowledge = [];

  // Site Knowledge only — Echo owns copy later; Site Knowledge stores business truth.
  if (change.type === 'site_brain_update' && change.fieldKey) {
    const field = getField(change.fieldKey);
    knowledge.push({
      kind: 'site_knowledge',
      fieldKey: change.fieldKey,
      title: field ? 'Confirm: ' + field.label : 'Confirm Site Knowledge',
      recommendationId: rec.id || null,
      message: 'Save approved business truth to Site Knowledge — does not change the live page.'
    });
    return { steps, knowledge };
  }

  const outcome =
    change.outcome ||
    (change.type === 'outcome' ? change.key : null) ||
    inferOutcomeFromLegacy(change, rec);

  if (outcome === 'clarify_preferred_cta' || outcome === 'confirm_business_goal' || outcome === 'expand_main_services') {
    const meta = BUSINESS_OUTCOMES[outcome];
    knowledge.push({
      kind: 'site_knowledge',
      fieldKey: (meta && meta.fieldKey) || change.fieldKey,
      title: (meta && meta.label) || rec.title || 'Confirm Site Knowledge',
      recommendationId: rec.id || null,
      message: 'Save approved business truth to Site Knowledge — does not change the live page.'
    });
    return { steps, knowledge };
  }

  if (outcome === 'strengthen_primary_cta' || change.capabilityId === 'hero' || change.sectionKey === 'hero' || change.field === 'cta') {
    const cta = String(factValue(snap.goals && snap.goals.preferredCta) || '').trim();
    if (!cta) {
      return {
        steps: [],
        knowledge: [],
        error: 'cta_not_set',
        message:
          'Set your preferred call to action in Site Knowledge first (or use Answer with Atlas).'
      };
    }
    if (/^(get in touch|contact us|learn more)$/i.test(cta)) {
      return {
        steps: [],
        knowledge: [],
        error: 'cta_too_generic',
        message: 'Choose a more specific button phrase in Site Knowledge before applying.'
      };
    }
    const beforeCta = readHeroCta(cfg) || '—';
    steps.push(
      makeStep({
        title: 'Update Hero CTA',
        label: 'Hero CTA',
        operation: 'hero_cta',
        recommendationId: rec.id || null,
        outcome: 'strengthen_primary_cta',
        configPaths: ['sections.hero.callText', 'sections.hero.cta'],
        before: { cta: beforeCta },
        after: { cta: cta },
        risk: 'low',
        validationRequirements: ['cta_not_empty', 'cta_not_generic'],
        affectedPages: ['Home']
      })
    );
    // Sticky + footer CTA when those surfaces exist — same approved business CTA.
    const sticky = cfg.sections && cfg.sections.stickyCta;
    if (sticky && typeof sticky === 'object') {
      steps.push(
        makeStep({
          title: 'Update Sticky CTA',
          label: 'Sticky CTA',
          operation: 'sticky_cta',
          recommendationId: rec.id || null,
          outcome: 'strengthen_primary_cta',
          configPaths: ['sections.stickyCta.label', 'sections.stickyCta.text'],
          before: { cta: String(sticky.label || sticky.text || sticky.cta || '—') },
          after: { cta: cta },
          risk: 'low',
          affectedPages: ['Home']
        })
      );
    }
    const footer = cfg.sections && cfg.sections.footer;
    if (footer && typeof footer === 'object' && (footer.cta || footer.callText || footer.buttonText)) {
      steps.push(
        makeStep({
          title: 'Update Footer CTA',
          label: 'Footer CTA',
          operation: 'footer_cta',
          recommendationId: rec.id || null,
          outcome: 'strengthen_primary_cta',
          configPaths: ['sections.footer.cta', 'sections.footer.callText', 'sections.footer.buttonText'],
          before: { cta: String(footer.cta || footer.callText || footer.buttonText || '—') },
          after: { cta: cta },
          risk: 'low',
          affectedPages: ['Home']
        })
      );
    }
    return { steps, knowledge };
  }

  if (outcome === 'enable_faq_for_objections' || change.capabilityId === 'faq' || change.sectionKey === 'faq') {
    const beforeOn = readFaqOn(cfg);
    steps.push(
      makeStep({
        title: 'Enable FAQ section',
        label: 'FAQ Section',
        operation: 'enable_faq',
        recommendationId: rec.id || null,
        outcome: 'enable_faq_for_objections',
        configPaths: ['sections.faq.on', 'sectionOrder'],
        before: { on: beforeOn },
        after: { on: true },
        risk: 'low',
        validationRequirements: ['capability_allowlisted'],
        affectedPages: ['Home']
      })
    );
    return { steps, knowledge };
  }

  if (outcome === 'plan_seo_landing') {
    const inputs = landingInputsFromRecommendation(rec);
    if (!inputs) {
      return {
        steps: [],
        knowledge: [],
        advisory: true,
        error: 'landing_inputs_required',
        message:
          'Answer the Write with AI fields first (Primary keyword + Location), then Draft in Forge to create the landing page.'
      };
    }
    const page = buildLandingPageFromInputs(inputs, cfg);
    steps.push(
      makeStep({
        id: 'create-landing-' + page.slug,
        title: 'Create landing page draft: “' + page.title + '”',
        label: 'Landing page · /' + page.slug,
        operation: 'create_landing_page',
        recommendationId: rec.id || null,
        outcome: 'plan_seo_landing',
        configPaths: ['pages'],
        before: { page: null },
        after: { page: page },
        risk: 'low',
        affectedPages: ['Landing pages · /' + page.slug],
        validationRequirements: ['capability_allowlisted', 'user_preview_confirm']
      })
    );
    return { steps, knowledge, advisory: false };
  }

  // Advisory / capability gap — no Forge mutation
  return {
    steps: [],
    knowledge: [],
    advisory: true,
    title: rec.title || 'Manual follow-up',
    message: 'This recommendation needs a specialist or Page editor follow-up — Forge will not mutate config yet.'
  };
}

function inferOutcomeFromLegacy(change, rec) {
  if (change.type === 'forge_draft') {
    if (change.capabilityId === 'hero' || change.sectionKey === 'hero') return 'strengthen_primary_cta';
    if (change.capabilityId === 'faq' || change.sectionKey === 'faq') return 'enable_faq_for_objections';
  }
  if (change.type === 'site_brain_update') {
    if (change.fieldKey === 'preferredCta') return 'clarify_preferred_cta';
    if (change.fieldKey === 'primaryGoal') return 'confirm_business_goal';
    if (change.fieldKey === 'mainServices') return 'expand_main_services';
  }
  const title = String((rec && rec.title) || '').toLowerCase();
  if (title.indexOf('cta') >= 0 || title.indexOf('call to action') >= 0) return 'strengthen_primary_cta';
  if (title.indexOf('faq') >= 0) return 'enable_faq_for_objections';
  return null;
}

/**
 * Build ONE Execution Plan from one or more approved recommendations (batching).
 */
function buildExecutionPlan(opts) {
  const o = opts || {};
  const recommendations = Array.isArray(o.recommendations) ? o.recommendations : [];
  const snapshot = o.snapshot || {};
  const config = o.config || {};
  const siteId = o.siteId || (snapshot.siteId || null);
  const editorContext = o.editorContext || {};

  if (!recommendations.length) {
    return { ok: false, error: 'recommendations_required', message: 'Select at least one recommendation.' };
  }

  const allSteps = [];
  const knowledgeTasks = [];
  const recIds = [];
  const pages = {};
  let error = null;

  for (let i = 0; i < recommendations.length; i++) {
    const rec = recommendations[i];
    recIds.push(rec.id);
    const built = stepsFromRecommendation(rec, snapshot, config);
    if (built.error) {
      error = built;
      break;
    }
    (built.steps || []).forEach(function (s) {
      allSteps.push(s);
      (s.affectedPages || ['Home']).forEach(function (pg) {
        pages[pg] = true;
      });
    });
    (built.knowledge || []).forEach(function (k) {
      knowledgeTasks.push(k);
    });
  }

  if (error) return { ok: false, error: error.error, message: error.message };

  // Deduplicate identical operations (e.g. two CTA recs → one hero step).
  // Landing creates + checklist lines must stay distinct (include title/slug).
  const deduped = [];
  const seenOps = {};
  allSteps.forEach(function (s) {
    const slug =
      s.after && s.after.page && s.after.page.slug ? String(s.after.page.slug) : '';
    const key =
      s.operation +
      '|' +
      (s.configPaths || []).join(',') +
      '|' +
      (s.operation === 'create_landing_page' || s.operation === 'checklist'
        ? slug || String(s.title || s.id || '')
        : '');
    if (seenOps[key]) {
      seenOps[key].recommendationId = seenOps[key].recommendationId || s.recommendationId;
      return;
    }
    seenOps[key] = s;
    deduped.push(s);
  });

  const plan = emptyPlan({
    recommendationIds: recIds,
    generatedBy: 'forge',
    siteId: siteId,
    status: 'draft',
    affectedPages: Object.keys(pages).length ? Object.keys(pages) : ['Home'],
    steps: deduped,
    configPaths: collectConfigPaths({ steps: deduped }),
    risk: highestRisk(deduped),
    validationRequirements: ['guardian_pass', 'user_preview_confirm'],
    dependencies: knowledgeTasks.length
      ? [{ type: 'site_knowledge', note: 'Some items need Site Knowledge confirmation first' }]
      : [],
    editorContext: editorContext,
    title:
      deduped.length > 1
        ? 'Batched changes (' + deduped.length + ' steps)'
        : deduped.length === 1
          ? deduped[0].title
          : knowledgeTasks.length
            ? 'Site Knowledge follow-up'
            : 'Execution Plan',
    summary:
      deduped.length > 0
        ? 'Forge will apply ' + deduped.length + ' configuration step(s) in one diff.'
        : 'No configuration mutation — complete Site Knowledge or follow manual guidance.',
    estimatedTime: deduped.some(function (s) {
      return s.operation === 'create_landing_page';
    })
      ? 'A few seconds'
      : 'Instant'
  });

  plan.preview = buildChangePreview(plan);
  const guardian = validateExecutionPlan(plan, { config: config });
  plan.guardian = guardian;
  if (guardian.ok) {
    plan.status = 'preview_ready';
  } else {
    plan.status = 'draft';
  }

  return {
    ok: true,
    plan: plan,
    knowledgeTasks: knowledgeTasks,
    executable: deduped.length > 0 && guardian.ok,
    published: false
  };
}

/**
 * Backward-compat: single-rec draft plan (used by older callers / tests).
 */
function buildDraftFromRecommendation(recommendation, snapshot, config) {
  const built = buildExecutionPlan({
    recommendations: [recommendation],
    snapshot: snapshot,
    config: config || {},
    siteId: snapshot && snapshot.siteId
  });
  if (!built.ok) return built;

  const plan = built.plan;
  if (built.knowledgeTasks && built.knowledgeTasks.length && !plan.steps.length) {
    const k = built.knowledgeTasks[0];
    return {
      ok: true,
      kind: 'site_knowledge',
      executable: false,
      title: k.title,
      fieldKey: k.fieldKey,
      editorTab: 'ai-team',
      editorSection: null,
      message: k.message,
      executionPlan: plan
    };
  }

  if (!plan.steps.length) {
    return {
      ok: true,
      kind: 'manual',
      executable: false,
      title: plan.title || 'Manual follow-up',
      editorTab: 'details',
      editorSection: null,
      message: plan.summary,
      executionPlan: plan
    };
  }

  const first = plan.steps[0];
  return {
    ok: true,
    kind: 'execution_plan',
    executable: !!built.executable,
    capabilityId: first.operation === 'enable_faq' ? 'faq' : 'hero',
    sectionKey: first.operation === 'enable_faq' ? 'faq' : 'hero',
    operation: first.operation,
    title: plan.title,
    editorTab: 'details',
    editorSection: first.operation === 'enable_faq' ? 'faq' : 'hero',
    patch: stepToLegacyPatch(first),
    patches: plan.steps.map(stepToLegacyPatch),
    executionPlan: plan,
    message:
      'Preview the Change Summary, then Apply Changes. Review in Page editor and Publish Live Site yourself.'
  };
}

function stepToLegacyPatch(step) {
  if (!step) return null;
  if (step.operation === 'hero_cta' || step.operation === 'sticky_cta' || step.operation === 'footer_cta') {
    return {
      operation: step.operation,
      paths: step.configPaths,
      after: step.after,
      before: step.before
    };
  }
  if (step.operation === 'enable_faq') {
    return {
      operation: 'enable_section',
      sectionKey: 'faq',
      paths: step.configPaths,
      after: step.after,
      before: step.before
    };
  }
  return {
    operation: step.operation,
    paths: step.configPaths,
    after: step.after,
    before: step.before
  };
}

/**
 * Apply a single Forge patch to sites.config (merge only).
 * Sole mutation path for website configuration.
 */
function applyPatchToConfig(config, patch) {
  const cfg = deepClone(config || {});
  if (!cfg.sections || typeof cfg.sections !== 'object') cfg.sections = {};
  const p = patch || {};

  if (p.operation === 'hero_cta') {
    const cta = p.after && p.after.cta != null ? String(p.after.cta).trim() : '';
    if (!cta) return { ok: false, error: 'cta_required' };
    if (!cfg.sections.hero || typeof cfg.sections.hero !== 'object') cfg.sections.hero = {};
    cfg.sections.hero.on = cfg.sections.hero.on !== false;
    // Editor primarily binds callText; keep cta for older renderers.
    cfg.sections.hero.callText = cta;
    cfg.sections.hero.cta = cta;
    return {
      ok: true,
      config: cfg,
      summary: 'Hero CTA set to “' + cta + '”',
      paths: ['sections.hero.callText', 'sections.hero.cta']
    };
  }

  if (p.operation === 'sticky_cta') {
    const cta = p.after && p.after.cta != null ? String(p.after.cta).trim() : '';
    if (!cta) return { ok: false, error: 'cta_required' };
    if (!cfg.sections.stickyCta || typeof cfg.sections.stickyCta !== 'object') {
      return { ok: true, config: cfg, summary: 'Sticky CTA skipped (not present)', paths: [] };
    }
    cfg.sections.stickyCta.label = cta;
    cfg.sections.stickyCta.text = cta;
    if ('cta' in cfg.sections.stickyCta) cfg.sections.stickyCta.cta = cta;
    return {
      ok: true,
      config: cfg,
      summary: 'Sticky CTA set to “' + cta + '”',
      paths: ['sections.stickyCta.label', 'sections.stickyCta.text']
    };
  }

  if (p.operation === 'footer_cta') {
    const cta = p.after && p.after.cta != null ? String(p.after.cta).trim() : '';
    if (!cta) return { ok: false, error: 'cta_required' };
    if (!cfg.sections.footer || typeof cfg.sections.footer !== 'object') {
      return { ok: true, config: cfg, summary: 'Footer CTA skipped (not present)', paths: [] };
    }
    if ('cta' in cfg.sections.footer || cfg.sections.footer.cta != null) cfg.sections.footer.cta = cta;
    if ('callText' in cfg.sections.footer || cfg.sections.footer.callText != null) {
      cfg.sections.footer.callText = cta;
    }
    if ('buttonText' in cfg.sections.footer || cfg.sections.footer.buttonText != null) {
      cfg.sections.footer.buttonText = cta;
    }
    return {
      ok: true,
      config: cfg,
      summary: 'Footer CTA set to “' + cta + '”',
      paths: ['sections.footer.cta', 'sections.footer.callText', 'sections.footer.buttonText']
    };
  }

  if (p.operation === 'enable_faq' || (p.operation === 'enable_section' && p.sectionKey === 'faq')) {
    return applyEnableSection(cfg, 'faq');
  }

  if (p.operation === 'enable_section') {
    const key = String(p.sectionKey || '').trim();
    if (!key) return { ok: false, error: 'section_key_required' };
    return applyEnableSection(cfg, key);
  }

  if (p.operation === 'create_landing_page') {
    const page = p.after && p.after.page && typeof p.after.page === 'object' ? p.after.page : null;
    if (!page || !String(page.title || '').trim() || !String(page.slug || '').trim()) {
      return { ok: false, error: 'landing_page_required' };
    }
    if (!Array.isArray(cfg.pages)) cfg.pages = [];
    const slugLc = String(page.slug).toLowerCase();
    const exists = cfg.pages.some(function (row) {
      return row && String(row.slug || '').toLowerCase() === slugLc;
    });
    if (exists) {
      return {
        ok: false,
        error: 'landing_slug_exists',
        message: 'A landing page with slug “' + page.slug + '” already exists.'
      };
    }
    const row = Object.assign(
      {
        id: page.id || randomUUID(),
        menu: 'top',
        status: 'draft',
        pageApps: [],
        pageSections: {},
        pageLayoutOrder: []
      },
      page,
      { status: 'draft' }
    );
    cfg.pages.push(row);
    return {
      ok: true,
      config: cfg,
      summary: 'Created landing page draft “' + row.title + '” (/' + row.slug + ')',
      paths: ['pages'],
      pageId: row.id,
      pageSlug: row.slug
    };
  }

  if (p.operation === 'checklist') {
    return {
      ok: true,
      config: cfg,
      summary: 'Checklist step agreed (no site config change)',
      paths: []
    };
  }

  return { ok: false, error: 'unknown_operation' };
}

function applyEnableSection(cfg, key) {
  const cap = getCapability(key);
  if (!cap) return { ok: false, error: 'capability_not_allowlisted' };
  const existing = cfg.sections[key] && typeof cfg.sections[key] === 'object' ? cfg.sections[key] : {};
  cfg.sections[key] = Object.assign({}, defaultSectionPayload(key), existing, { on: true });
  if (!Array.isArray(cfg.sectionOrder)) cfg.sectionOrder = Object.keys(cfg.sections);
  if (cfg.sectionOrder.indexOf(key) < 0) {
    const quoteIdx = cfg.sectionOrder.indexOf('quote');
    if (quoteIdx >= 0) cfg.sectionOrder.splice(quoteIdx, 0, key);
    else cfg.sectionOrder.push(key);
  }
  return {
    ok: true,
    config: cfg,
    summary: 'Enabled ' + key + ' section',
    paths: ['sections.' + key + '.on', 'sectionOrder']
  };
}

/**
 * Apply all steps in an Execution Plan sequentially (one config write for caller).
 */
function applyExecutionPlanToConfig(config, plan) {
  let cfg = deepClone(config || {});
  const paths = [];
  const summaries = [];
  const steps = (plan && plan.steps) || [];
  for (let i = 0; i < steps.length; i++) {
    const patch = stepToLegacyPatch(steps[i]);
    const applied = applyPatchToConfig(cfg, patch);
    if (!applied.ok) return applied;
    cfg = applied.config;
    (applied.paths || []).forEach(function (p) {
      if (paths.indexOf(p) < 0) paths.push(p);
    });
    if (applied.summary) summaries.push(applied.summary);
  }
  let pageId = null;
  let pageSlug = null;
  for (let j = 0; j < steps.length; j++) {
    if (steps[j] && steps[j].operation === 'create_landing_page') {
      const pg = steps[j].after && steps[j].after.page;
      if (pg) {
        pageId = pg.id || pageId;
        pageSlug = pg.slug || pageSlug;
      }
    }
  }
  return {
    ok: true,
    config: cfg,
    summary: summaries.join('; ') || 'Execution Plan applied',
    paths: paths,
    pageId: pageId,
    pageSlug: pageSlug
  };
}

function isForgeOperationAllowed(operation) {
  return Object.prototype.hasOwnProperty.call(EXECUTABLE_OPERATIONS, operation);
}

module.exports = {
  EXECUTABLE_OPERATIONS,
  BUSINESS_OUTCOMES,
  buildExecutionPlan,
  buildDraftFromRecommendation,
  buildChangePreview,
  applyPatchToConfig,
  applyExecutionPlanToConfig,
  isForgeOperationAllowed,
  factValue,
  stepsFromRecommendation,
  stepToLegacyPatch,
  buildLandingPageFromInputs,
  landingInputsFromRecommendation,
  slugify
};
