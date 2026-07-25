'use strict';

/**
 * Normalised Search Intelligence provider DTOs.
 * See docs/search-intelligence/04-PROVIDER-GATEWAY.md
 */

const LABEL_CLASSES = Object.freeze(['measured', 'estimated', 'modelled']);

function assertLabelClass(v) {
  return LABEL_CLASSES.includes(v) ? v : 'estimated';
}

function keywordIdea( partial ) {
  const p = partial || {};
  return {
    keyword: String(p.keyword || ''),
    location: p.location || null,
    language: p.language || 'en',
    country: p.country || 'AU',
    volume: p.volume == null ? null : Number(p.volume),
    cpc: p.cpc == null ? null : Number(p.cpc),
    competition: p.competition == null ? null : Number(p.competition),
    difficulty: p.difficulty == null ? null : Number(p.difficulty),
    intent: p.intent || null,
    localIntent: p.localIntent == null ? null : !!p.localIntent,
    trend: Array.isArray(p.trend) ? p.trend : [],
    provider: p.provider || null,
    fetchedAt: p.fetchedAt || new Date().toISOString(),
    labelClass: assertLabelClass(p.labelClass || 'estimated')
  };
}

function serpResult( partial ) {
  const p = partial || {};
  return {
    rank: p.rank == null ? null : Number(p.rank),
    url: p.url || null,
    domain: p.domain || null,
    title: p.title || null,
    snippet: p.snippet || null,
    type: p.type || 'organic'
  };
}

function serpSnapshot( partial ) {
  const p = partial || {};
  return {
    keyword: String(p.keyword || ''),
    location: p.location || null,
    device: p.device || 'mobile',
    fetchedAt: p.fetchedAt || new Date().toISOString(),
    features: Array.isArray(p.features) ? p.features : [],
    results: Array.isArray(p.results) ? p.results.map(serpResult) : [],
    provider: p.provider || null,
    labelClass: assertLabelClass(p.labelClass || 'estimated')
  };
}

function rankObservation( partial ) {
  const p = partial || {};
  return {
    keywordId: p.keywordId || null,
    keyword: p.keyword || null,
    url: p.url || null,
    position: p.position == null ? null : Number(p.position),
    device: p.device || 'mobile',
    geo: p.geo || null,
    features: Array.isArray(p.features) ? p.features : [],
    provider: p.provider || null,
    fetchedAt: p.fetchedAt || new Date().toISOString(),
    labelClass: assertLabelClass(p.labelClass || 'estimated')
  };
}

function competitorDomain( partial ) {
  const p = partial || {};
  return {
    domain: String(p.domain || ''),
    visibilityEstimate: p.visibilityEstimate == null ? null : Number(p.visibilityEstimate),
    overlapCount: p.overlapCount == null ? null : Number(p.overlapCount),
    competitorType: p.competitorType || 'search',
    competitionLevel: p.competitionLevel == null ? null : Number(p.competitionLevel),
    organicKeywords: p.organicKeywords == null ? null : Number(p.organicKeywords),
    organicTraffic: p.organicTraffic == null ? null : Number(p.organicTraffic),
    paidKeywords: p.paidKeywords == null ? null : Number(p.paidKeywords),
    paidTraffic: p.paidTraffic == null ? null : Number(p.paidTraffic),
    avgPosition: p.avgPosition == null ? null : Number(p.avgPosition),
    provider: p.provider || null,
    fetchedAt: p.fetchedAt || new Date().toISOString(),
    labelClass: assertLabelClass(p.labelClass || 'estimated')
  };
}

function rankedKeyword(partial) {
  const p = partial || {};
  return {
    keyword: String(p.keyword || ''),
    volume: p.volume == null ? null : Number(p.volume),
    cpc: p.cpc == null ? null : Number(p.cpc),
    competition: p.competition == null ? null : Number(p.competition),
    position: p.position == null ? null : Number(p.position),
    url: p.url || null,
    etv: p.etv == null ? null : Number(p.etv),
    intent: p.intent || null,
    itemType: p.itemType || 'organic',
    provider: p.provider || null,
    labelClass: assertLabelClass(p.labelClass || 'estimated')
  };
}

function referringDomain(partial) {
  const p = partial || {};
  return {
    domain: String(p.domain || ''),
    rank: p.rank == null ? null : Number(p.rank),
    backlinks: p.backlinks == null ? null : Number(p.backlinks),
    dofollow: p.dofollow == null ? null : Number(p.dofollow),
    firstSeen: p.firstSeen || null,
    provider: p.provider || null,
    labelClass: assertLabelClass(p.labelClass || 'estimated')
  };
}

function backlinkSummary( partial ) {
  const p = partial || {};
  return {
    domain: String(p.domain || ''),
    referringDomains: p.referringDomains == null ? null : Number(p.referringDomains),
    backlinks: p.backlinks == null ? null : Number(p.backlinks),
    newLost: p.newLost || null,
    topAnchors: Array.isArray(p.topAnchors) ? p.topAnchors : [],
    provider: p.provider || null,
    fetchedAt: p.fetchedAt || new Date().toISOString(),
    labelClass: assertLabelClass(p.labelClass || 'estimated')
  };
}

module.exports = {
  LABEL_CLASSES,
  assertLabelClass,
  keywordIdea,
  serpResult,
  serpSnapshot,
  rankObservation,
  competitorDomain,
  rankedKeyword,
  referringDomain,
  backlinkSummary
};
