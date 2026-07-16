/**
 * Maintenance revenue split — LeadPages 30% / Partner 70%.
 */
function maintenanceSplitCents(amountCents, partnerPct) {
  const gross = Math.max(0, Math.round(amountCents || 0));
  const pct = partnerPct != null ? Number(partnerPct) : 70;
  const partnerShare = Math.min(100, Math.max(0, pct)) / 100;
  const partner = Math.round(gross * partnerShare);
  return {
    gross: gross,
    partner: partner,
    platform: gross - partner,
    partnerPct: partnerShare * 100,
    platformPct: 100 - partnerShare * 100
  };
}

module.exports = { maintenanceSplitCents };
