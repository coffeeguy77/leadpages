'use strict';

/**
 * Configurable hire cancellation + reschedule anti-avoidance.
 * Default customer policy (overridable via settings / policy versions):
 *  - > 48h before protected start: no fee (refund rental)
 *  - 24h–48h: $50 fee
 *  - < 24h: retain full rental; refund bond/eligible extras only
 */

function clampNonNeg(n) {
  n = Math.round(Number(n) || 0);
  return n < 0 ? 0 : n;
}

function hoursUntil(fromDate, toDate) {
  return (toDate.getTime() - fromDate.getTime()) / 3600000;
}

function defaultRules() {
  return [
    { id: 'gt_48h', min_hours_before: 48, fee_type: 'none' },
    {
      id: '24_to_48',
      min_hours_before: 24,
      max_hours_before: 48,
      fee_type: 'fixed',
      fee_cents: 5000
    },
    { id: 'lt_24', max_hours_before: 24, fee_type: 'retain_rental' }
  ];
}

function resolveRules(system, policy) {
  if (policy && Array.isArray(policy.rules_json) && policy.rules_json.length) {
    return policy.rules_json;
  }
  const hire = (system && system.settings && system.settings.hire) || {};
  if (Array.isArray(hire.cancellation_rules) && hire.cancellation_rules.length) {
    return hire.cancellation_rules;
  }
  return defaultRules();
}

function pickRule(rules, hoursBefore) {
  // Prefer most specific matching band
  let match = null;
  rules.forEach(function (r) {
    const minOk = r.min_hours_before == null || hoursBefore >= Number(r.min_hours_before);
    const maxOk = r.max_hours_before == null || hoursBefore < Number(r.max_hours_before);
    if (minOk && maxOk) {
      if (!match) match = r;
      else {
        // Prefer tighter max_hours_before when present
        const curMax = match.max_hours_before != null ? Number(match.max_hours_before) : Infinity;
        const nextMax = r.max_hours_before != null ? Number(r.max_hours_before) : Infinity;
        if (nextMax < curMax) match = r;
      }
    }
  });
  return match || rules[rules.length - 1] || { id: 'fallback', fee_type: 'none' };
}

/**
 * @param {object} input
 * @param {object} input.system
 * @param {object} [input.policy]
 * @param {Date|string} input.now
 * @param {Date|string} input.protectedStartsAt — anti-avoidance protected start
 * @param {number} input.rentalCents — hire/rental total (ex bond)
 * @param {number} [input.bondCents]
 * @param {number} [input.refundableExtrasCents]
 * @param {number} [input.amountPaidCents]
 * @param {number} [input.feeFloorCents] — preserved liability from prior reschedules
 * @param {boolean} [input.adminOverride]
 * @param {number} [input.overrideFeeCents]
 */
function calculateCancellation(input) {
  const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());
  const protectedStart =
    input.protectedStartsAt instanceof Date
      ? input.protectedStartsAt
      : new Date(input.protectedStartsAt);
  const hoursBefore = hoursUntil(now, protectedStart);
  const rules = resolveRules(input.system, input.policy);
  const rule = pickRule(rules, hoursBefore);

  const rental = clampNonNeg(input.rentalCents);
  const bond = clampNonNeg(input.bondCents);
  const extras = clampNonNeg(input.refundableExtrasCents);
  const paid = clampNonNeg(input.amountPaidCents);
  const floor = clampNonNeg(input.feeFloorCents);

  let cancellationFee = 0;
  let rentalRetained = 0;

  if (input.adminOverride && input.overrideFeeCents != null) {
    cancellationFee = clampNonNeg(input.overrideFeeCents);
    rentalRetained = 0;
  } else if (rule.fee_type === 'none') {
    cancellationFee = 0;
    rentalRetained = 0;
  } else if (rule.fee_type === 'fixed') {
    cancellationFee = clampNonNeg(rule.fee_cents);
    rentalRetained = 0;
  } else if (rule.fee_type === 'percent') {
    cancellationFee = Math.round(rental * (Number(rule.fee_bps) || 0) / 10000);
    rentalRetained = 0;
  } else if (rule.fee_type === 'retain_rental') {
    rentalRetained = rental;
    cancellationFee = 0;
  }

  let liability = Math.max(cancellationFee + rentalRetained, floor);
  // If floor exceeds computed fee, treat excess as retained rental/fee
  if (liability > cancellationFee + rentalRetained) {
    const gap = liability - (cancellationFee + rentalRetained);
    if (rule.fee_type === 'retain_rental') rentalRetained = Math.min(rental, rentalRetained + gap);
    else cancellationFee += gap;
  }

  const refundablePool = Math.max(0, paid - liability);
  // Bond + eligible extras refunded unless consumed by unpaid liability
  let bondRefund = bond;
  let extrasRefund = extras;
  const amountDue = Math.max(0, liability - paid);
  const refund = Math.max(0, paid - liability);

  return {
    ok: true,
    calculated_at: now.toISOString(),
    protected_starts_at: protectedStart.toISOString(),
    hours_before_protected: Math.round(hoursBefore * 10000) / 10000,
    rule_id: rule.id || '',
    fee_type: rule.fee_type,
    policy_version: (input.policy && input.policy.version) || 'default',
    rental_cents: rental,
    rental_retained_cents: rentalRetained,
    cancellation_fee_cents: cancellationFee,
    fee_floor_applied_cents: floor,
    liability_cents: liability,
    bond_cents: bond,
    bond_refund_cents: bondRefund,
    extras_refund_cents: extrasRefund,
    amount_paid_cents: paid,
    refund_cents: refund,
    amount_due_cents: amountDue,
    admin_override: !!input.adminOverride,
    breakdown: {
      rule: rule,
      message: describeCancellation({
        hoursBefore: hoursBefore,
        rule: rule,
        cancellationFee: cancellationFee,
        rentalRetained: rentalRetained,
        refund: refund,
        amountDue: amountDue,
        floor: floor
      })
    }
  };
}

function describeCancellation(parts) {
  const h = parts.hoursBefore;
  let when;
  if (h >= 48) when = 'More than 48 hours before the protected start';
  else if (h >= 24) when = 'Between 24 and 48 hours before the protected start';
  else when = 'Less than 24 hours before the protected start';

  const bits = [when + '.'];
  if (parts.floor > 0) {
    bits.push('A previously protected cancellation liability of $' + (parts.floor / 100).toFixed(2) + ' still applies.');
  }
  if (parts.rentalRetained > 0) {
    bits.push('Full rental charge of $' + (parts.rentalRetained / 100).toFixed(2) + ' is retained.');
  } else if (parts.cancellationFee > 0) {
    bits.push('Cancellation fee: $' + (parts.cancellationFee / 100).toFixed(2) + '.');
  } else {
    bits.push('No cancellation fee.');
  }
  if (parts.refund > 0) bits.push('Refund due: $' + (parts.refund / 100).toFixed(2) + '.');
  if (parts.amountDue > 0) bits.push('Amount still due: $' + (parts.amountDue / 100).toFixed(2) + '.');
  return bits.join(' ');
}

/**
 * When customer reschedules, compute fee floor to carry forward.
 */
function rescheduleFeeFloor(input) {
  const calc = calculateCancellation(input);
  const floor = Math.max(clampNonNeg(input.feeFloorCents), calc.liability_cents);
  return {
    ok: true,
    previous_fee_floor_cents: clampNonNeg(input.feeFloorCents),
    new_fee_floor_cents: floor,
    cancellation_preview: calc,
    acknowledgement_required: floor > 0,
    message:
      floor > 0
        ? 'If you later cancel, at least $' +
          (floor / 100).toFixed(2) +
          ' remains payable based on your original booking window.'
        : 'Rescheduling does not currently create a cancellation fee floor.'
  };
}

module.exports = {
  defaultRules,
  resolveRules,
  pickRule,
  calculateCancellation,
  rescheduleFeeFloor,
  hoursUntil
};
