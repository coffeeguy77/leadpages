// api/create-site.js — creates a new site from the builder form.
// Password-gated (ADMIN_PASSWORD). Writes one row to `sites`; the renderer makes
// it instantly live at /s/<slug>.

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// "(02) 6100 0000" -> "+61261000000"
function telFrom(text) {
  const d = String(text || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('61')) return '+' + d;
  if (d.startsWith('0'))  return '+61' + d.slice(1);
  return '+61' + d;
}

const slugify = s => String(s || '').toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const b = req.body || {};
    if (!process.env.ADMIN_PASSWORD) return res.status(500).json({ error: 'ADMIN_PASSWORD is not set.' });
    if (b.password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });

    if (!b.businessName || !b.vertical) return res.status(400).json({ error: 'Business name and type are required.' });
    if (!['broker', 'trade'].includes(b.vertical)) return res.status(400).json({ error: 'Type must be broker or trade.' });

    const slug = slugify(b.slug || b.businessName);
    if (!slug) return res.status(400).json({ error: 'Could not build a valid slug from that name.' });

    const config = {
      phone:     telFrom(b.phoneText),
      phoneText: b.phoneText || '',
      email:     b.email || '',
      region:    b.region || ''
    };
    if (b.suburb) config.suburb = b.suburb;

    if (b.vertical === 'broker') {
      config.rates = {
        rateSource: 'override',
        variableRate: Number(b.variableRate) || 6.04,
        comparisonRate: Number(b.comparisonRate) || 6.18,
        updatedAt: new Date().toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
      };
    }
    if (b.vertical === 'trade' && b.licence) config.licence = b.licence;

    const theme = b.vertical === 'broker' ? 'eucalypt-brass' : 'charcoal-hivis';

    const { error } = await supabase.from('sites').insert({
      slug, business_name: b.businessName, vertical: b.vertical, theme, config, status: 'live'
    });

    if (error) {
      if (error.code === '23505' || /duplicate|unique/i.test(error.message || '')) {
        return res.status(409).json({ error: `The slug "${slug}" is already taken — pick another.` });
      }
      console.error('create-site insert failed:', error);
      return res.status(500).json({ error: 'Could not create the site.' });
    }

    return res.status(200).json({ ok: true, slug, url: `/s/${slug}` });
  } catch (e) {
    console.error('create-site error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};
