// POST /api/partner/save-bank-details
// Save and lock partner bank payout details. Locked rows cannot be changed by partners.

const { createClient } = require('@supabase/supabase-js');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function clean(s, max) {
  return String(s || '').trim().slice(0, max || 200);
}

function normaliseBsb(bsb) {
  const digits = String(bsb || '').replace(/\D/g, '');
  if (digits.length !== 6) return null;
  return digits.slice(0, 3) + '-' + digits.slice(3);
}

async function getPartner(token) {
  if (!token) return null;
  try {
    const ur = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    });
    const user = await ur.json();
    if (!user || !user.id) return null;
    const pr = await admin.from('partners').select('id,status').eq('user_id', user.id).maybeSingle();
    if (!pr.data || pr.data.status !== 'active') return null;
    return { userId: user.id, partnerId: pr.data.id };
  } catch (_e) {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const partner = await getPartner(token);
  if (!partner) return res.status(401).json({ ok: false, error: 'Active partner sign-in required' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_e) { body = {}; }
  }
  body = body || {};

  if (body.confirmLock !== true) {
    return res.status(400).json({ ok: false, error: 'Confirmation required to lock bank details.' });
  }

  const accountName = clean(body.accountName, 120);
  const bankName = clean(body.bankName, 120);
  const bsb = normaliseBsb(body.bsb);
  const accountNumber = String(body.accountNumber || '').replace(/\D/g, '').slice(0, 12);

  if (!accountName) return res.status(400).json({ ok: false, error: 'Account name is required.' });
  if (!bankName) return res.status(400).json({ ok: false, error: 'Bank name is required.' });
  if (!bsb) return res.status(400).json({ ok: false, error: 'Enter a valid 6-digit BSB.' });
  if (!accountNumber || accountNumber.length < 5) {
    return res.status(400).json({ ok: false, error: 'Enter a valid account number.' });
  }

  try {
    const existing = await admin
      .from('partner_profiles')
      .select('bank_details_locked')
      .eq('partner_id', partner.partnerId)
      .maybeSingle();

    if (existing.error && !/bank_details_locked/i.test(existing.error.message || '')) {
      return res.status(500).json({ ok: false, error: existing.error.message });
    }

    if (existing.data && existing.data.bank_details_locked) {
      return res.status(403).json({
        ok: false,
        error: 'Bank details are locked. Contact LeadPages support to request a change.',
        locked: true,
      });
    }

    const patch = {
      bank_account_name: accountName,
      bank_bsb: bsb,
      bank_account_number: accountNumber,
      bank_name: bankName,
      bank_details_locked: true,
      bank_details_locked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let upd = await admin
      .from('partner_profiles')
      .update(patch)
      .eq('partner_id', partner.partnerId)
      .select('bank_account_name,bank_bsb,bank_account_number,bank_name,bank_details_locked,bank_details_locked_at')
      .single();

    if (upd.error && /bank_/i.test(upd.error.message || '')) {
      return res.status(503).json({
        ok: false,
        error: 'Bank details storage is not set up yet. Run db/partner_bank_details.sql in Supabase.',
      });
    }

    if (upd.error || !upd.data) {
      return res.status(500).json({ ok: false, error: upd.error?.message || 'Could not save bank details.' });
    }

    return res.status(200).json({ ok: true, profile: upd.data, locked: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
