'use strict';

/**
 * Multi-location CRM outcomes for Search Intelligence (Phase 5).
 * First-party leads + optional quote accepted value — no external CRM.
 */

const { areasFromSite } = require('./local-opportunity');

function daysAgoIso(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

function normSuburb(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function suburbFromLead(lead) {
  const d = (lead && lead.details) || {};
  return (
    d.suburb ||
    d.area ||
    d.location ||
    d.service_area ||
    d.region ||
    (lead && lead.suburb) ||
    null
  );
}

function matchArea(suburb, areas) {
  const needle = normSuburb(suburb);
  if (!needle) return null;
  for (let i = 0; i < areas.length; i++) {
    const a = normSuburb(areas[i]);
    if (!a) continue;
    if (needle === a || needle.indexOf(a) >= 0 || a.indexOf(needle) >= 0) return areas[i];
  }
  return null;
}

/**
 * Pure rollup from lead rows (+ optional quote value map).
 * @param {object} site
 * @param {Array<object>} leads
 * @param {{ days?: number, avgJobValueCents?: number, quoteValueByLeadId?: object }} [opts]
 */
function buildCrmOutcomes(site, leads, opts) {
  const o = opts || {};
  const days = Math.max(1, Math.min(90, o.days || 28));
  let areas = [];
  try {
    areas = areasFromSite(site) || [];
  } catch (_e) {
    areas = [];
  }
  let avgJob = 150000; // $1500 default modelled
  try {
    avgJob =
      o.avgJobValueCents != null
        ? Number(o.avgJobValueCents)
        : site && site.config && site.config.avgJobValueCents != null
          ? Number(site.config.avgJobValueCents)
          : 150000;
    if (!Number.isFinite(avgJob) || avgJob < 0) avgJob = 150000;
  } catch (_e) {
    avgJob = 150000;
  }

  const byStatus = { new: 0, contacted: 0, won: 0, lost: 0, other: 0 };
  const byArea = {};
  areas.forEach(function (a) {
    byArea[a] = { area: a, leads: 0, won: 0, lost: 0, valueCents: 0 };
  });
  byArea['(unmatched)'] = { area: '(unmatched)', leads: 0, won: 0, lost: 0, valueCents: 0 };

  let measuredValueCents = 0;
  let modelledValueCents = 0;
  let quoteWins = 0;

  (leads || []).forEach(function (lead) {
    const st = String((lead && lead.status) || 'new').toLowerCase();
    if (byStatus[st] != null) byStatus[st] += 1;
    else byStatus.other += 1;

    const suburb = suburbFromLead(lead);
    const area = matchArea(suburb, areas) || '(unmatched)';
    if (!byArea[area]) {
      byArea[area] = { area: area, leads: 0, won: 0, lost: 0, valueCents: 0 };
    }
    byArea[area].leads += 1;
    if (st === 'won') byArea[area].won += 1;
    if (st === 'lost') byArea[area].lost += 1;

    if (st === 'won') {
      const qMap = o.quoteValueByLeadId || {};
      const qCents = lead.id && qMap[lead.id] != null ? Number(qMap[lead.id]) : null;
      if (qCents != null && Number.isFinite(qCents) && qCents > 0) {
        measuredValueCents += qCents;
        byArea[area].valueCents += qCents;
        quoteWins += 1;
      } else {
        modelledValueCents += avgJob;
        byArea[area].valueCents += avgJob;
      }
    }
  });

  const total = (leads || []).length;
  const won = byStatus.won;
  const lost = byStatus.lost;
  const decided = won + lost;
  const winRate = decided > 0 ? won / decided : null;
  const totalValueCents = measuredValueCents + modelledValueCents;

  const areaRows = Object.keys(byArea)
    .map(function (k) {
      const row = byArea[k];
      const d = row.won + row.lost;
      return Object.assign({}, row, {
        winRate: d > 0 ? row.won / d : null,
        valueDollars: Math.round(row.valueCents / 100)
      });
    })
    .filter(function (r) {
      return r.leads > 0 || (areas.length && r.area !== '(unmatched)');
    })
    .sort(function (a, b) {
      return b.won - a.won || b.leads - a.leads;
    });

  const findings = [];
  // Weak area: service area with zero won leads but site has wins elsewhere
  if (won >= 1 && areas.length) {
    areas.forEach(function (a) {
      const row = byArea[a];
      if (row && row.leads >= 2 && row.won === 0) {
        findings.push({
          id: 'crm:area_no_wins:' + a.replace(/\s+/g, '_').slice(0, 40),
          code: 'crm_area_no_wins',
          recipeId: 'location_service_gap',
          title: 'No booked jobs in ' + a,
          plainLanguage:
            a +
            ' has ' +
            row.leads +
            ' lead(s) but no won jobs in this window. Strengthen local pages and follow-up.',
          severity: 'medium',
          status: 'open',
          actions: ['page_optimiser', 'create_task'],
          autoFixAllowed: false,
          evidence: { source: 'crm_outcomes', area: a, leads: row.leads, won: 0 },
          labelClass: 'measured'
        });
      }
    });
  }

  return {
    ok: true,
    available: total > 0,
    days: days,
    totalLeads: total,
    byStatus: byStatus,
    won: won,
    lost: lost,
    winRate: winRate,
    measuredValueCents: measuredValueCents,
    modelledValueCents: modelledValueCents,
    totalValueCents: totalValueCents,
    totalValueDollars: Math.round(totalValueCents / 100),
    quoteWins: quoteWins,
    avgJobValueCents: avgJob,
    byArea: areaRows.slice(0, 24),
    areaCount: areas.length,
    findings: findings.slice(0, 8),
    labelClass: quoteWins > 0 ? (modelledValueCents > 0 ? 'modelled' : 'measured') : 'modelled',
    note:
      total === 0
        ? 'No CRM leads in this window. Won leads and accepted quotes populate multi-location outcomes.'
        : quoteWins > 0
          ? 'Value mixes accepted quote totals (measured) with modelled avg job value where quotes are missing.'
          : 'Booked value modelled from won leads × avg job value ($' +
            Math.round(avgJob / 100) +
            '). Connect quote accepts for measured revenue.'
  };
}

/**
 * Load leads (+ optional accepted quote cents) and build outcomes.
 */
async function loadCrmOutcomes(admin, site, opts) {
  const o = opts || {};
  const days = Math.max(1, Math.min(90, o.days || 28));
  const empty = buildCrmOutcomes(site, [], { days: days });
  if (!admin || !site || !site.id) return empty;

  const since = daysAgoIso(days);
  try {
    let leads = [];
    try {
      const { data, error } = await admin
        .from('leads')
        .select('id,status,details,created_at')
        .eq('site_id', site.id)
        .gte('created_at', since)
        .limit(2000);
      if (error) return empty;
      leads = data || [];
    } catch (_e) {
      return empty;
    }

    const quoteValueByLeadId = {};
    try {
      const leadIds = leads
        .map(function (l) {
          return l.id;
        })
        .filter(Boolean);
      if (leadIds.length) {
        const { data: sessions, error: sessErr } = await admin
          .from('quote_sessions')
          .select('id,lead_id,status')
          .eq('site_id', site.id)
          .eq('status', 'accepted')
          .in('lead_id', leadIds.slice(0, 500));
        if (!sessErr && sessions && sessions.length) {
          const sessionIds = sessions.map(function (s) {
            return s.id;
          });
          const leadBySession = {};
          sessions.forEach(function (s) {
            if (s.lead_id) leadBySession[s.id] = s.lead_id;
          });
          if (sessionIds.length) {
            const { data: versions, error: verErr } = await admin
              .from('quote_versions')
              .select('session_id,total_cents')
              .in('session_id', sessionIds.slice(0, 500))
              .order('created_at', { ascending: false })
              .limit(1000);
            if (!verErr) {
              (versions || []).forEach(function (v) {
                const lid = leadBySession[v.session_id];
                if (!lid || quoteValueByLeadId[lid] != null) return;
                if (v.total_cents != null) quoteValueByLeadId[lid] = Number(v.total_cents);
              });
            }
          }
        }
      }
    } catch (_e) {
      /* quote tables optional */
    }

    return buildCrmOutcomes(site, leads, {
      days: days,
      avgJobValueCents: o.avgJobValueCents,
      quoteValueByLeadId: quoteValueByLeadId
    });
  } catch (_e) {
    return empty;
  }
}

module.exports = {
  normSuburb: normSuburb,
  suburbFromLead: suburbFromLead,
  matchArea: matchArea,
  buildCrmOutcomes: buildCrmOutcomes,
  loadCrmOutcomes: loadCrmOutcomes
};
