// api/partner-lead.js — POST a business-owner enquiry into partner_leads.
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  res.setHeader('Content-Type','application/json');
  const origin = req.headers.origin || req.headers.referer || '';
  if (!origin.includes('leadpages.com.au') && !origin.includes('localhost')) {
    return res.status(403).json({ ok:false, error:'Forbidden' });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method not allowed' });

  let b = {};
  try { b = (typeof req.body === 'object' && req.body) ? req.body : JSON.parse(req.body || '{}'); }
  catch (_) { return res.status(400).json({ ok:false, error:'Invalid JSON' }); }

  const business = String(b.business_name || '').trim().slice(0, 200);
  const email    = String(b.email || '').trim().slice(0, 200);
  if (!business) return res.status(400).json({ ok:false, error:'Please tell us your business name.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ ok:false, error:'Please enter a valid email address.' });

  const row = {
    business_name: business,
    contact_name: String(b.contact_name || '').trim().slice(0, 120) || null,
    email,
    phone:  String(b.phone  || '').trim().slice(0, 40)  || null,
    suburb: String(b.suburb || '').trim().slice(0, 120) || null,
    state:  String(b.state  || '').trim().toUpperCase().slice(0, 3) || null,
    message: String(b.message || '').trim().slice(0, 2000) || null
  };
  const { error } = await supabase.from('partner_leads').insert(row);
  if (error) return res.status(500).json({ ok:false, error:'Could not save your enquiry - please try again.' });
  return res.status(200).json({ ok:true });
};
