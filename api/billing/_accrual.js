// api/billing/_accrual.js — monthly contra accrual.
// For a client whose contra account has accrue_monthly = true, once per calendar month
// we add their plan's monthly fee to the contra ledger as a "charge" (debit). This is
// what makes the balance climb each month. The account's optional limit_cents is the
// contra ceiling: once the amount they owe reaches it, we STOP accruing to contra and
// raise over_limit so the card-on-file takes over from there (the actual card charge is
// wired separately). Idempotent per month via last_accrual_month ('YYYY-MM').

function monthKey(d) { return (d || new Date()).toISOString().slice(0, 7); }

async function accrueOwner(sb, ownerId, opts) {
  opts = opts || {};
  const month = monthKey();

  const { data: acc } = await sb.from('contra_accounts').select('*').eq('owner_user_id', ownerId).maybeSingle();
  if (!acc) return { ownerId, skipped: 'no-account' };
  if (acc.enabled === false) return { ownerId, skipped: 'disabled' };
  if (!acc.accrue_monthly) return { ownerId, skipped: 'accrue-off' };
  if (!opts.force && acc.last_accrual_month === month) return { ownerId, skipped: 'already-' + month };

  // Monthly amount = sum of the client's billed sites' monthly_amount.
  const { data: sites } = await sb.from('sites').select('monthly_amount,plan_key').eq('owner_user_id', ownerId);
  const monthly = (sites || []).filter((s) => s.plan_key).reduce((n, s) => n + (s.monthly_amount || 0), 0);
  if (monthly <= 0) {
    await sb.from('contra_accounts').update({ last_accrual_month: month }).eq('owner_user_id', ownerId);
    return { ownerId, skipped: 'no-monthly' };
  }

  // Current amount owed = debits - credits.
  const { data: led } = await sb.from('contra_ledger').select('direction,amount_cents').eq('owner_user_id', ownerId);
  let credit = 0, debit = 0;
  (led || []).forEach((e) => { if (e.direction === 'credit') credit += (e.amount_cents || 0); else debit += (e.amount_cents || 0); });
  const owed = debit - credit;
  const limit = (acc.limit_cents == null) ? null : acc.limit_cents;

  // At/over the ceiling already -> don't accrue to contra; flag for the card.
  if (limit != null && owed >= limit) {
    await sb.from('contra_accounts').update({ over_limit: true, last_accrual_month: month }).eq('owner_user_id', ownerId);
    return { ownerId, skipped: 'over-limit', owed, limit, cardDue: monthly, month };
  }

  // Accrue this month's hosting fee to contra.
  const { error } = await sb.from('contra_ledger').insert({
    owner_user_id: ownerId, direction: 'debit', amount_cents: monthly,
    kind: 'hosting', description: 'Monthly hosting', ref: 'Auto ' + month, created_by: 'system',
  });
  if (error) return { ownerId, error: error.message };

  const newOwed = owed + monthly;
  const over = (limit != null && newOwed >= limit);
  await sb.from('contra_accounts').update({ last_accrual_month: month, over_limit: over }).eq('owner_user_id', ownerId);
  return { ownerId, accrued: monthly, owed: newOwed, over, month };
}

module.exports = { accrueOwner, monthKey };
