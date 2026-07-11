-- Partner Website profile — structured content for public agency pages
-- Safe additive migration; existing showcase_config and columns remain authoritative fallbacks.

ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS website_profile jsonb;
ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS website_profile_updated_at timestamptz;

COMMENT ON COLUMN partner_profiles.website_profile IS 'Structured Partner Website content: biography, positioning, services, testimonials, case studies, FAQs, SEO, enquiry form config';
