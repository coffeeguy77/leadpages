-- Friendly site names (10 Nov 2026)
-- STATUS: applied to Supabase 10 Nov 2026.
--
-- sites.site_label: a name only the partner sees in their console (e.g. "Blocked Drains page").
-- sites.business_name stays the trading name, because the page uses it ({{businessName}}),
-- e.g. the quote form's thank-you message. Empty = the console shows business_name as before.
-- No RLS change: partners already update their own sites (Rename / Publish in the console).

alter table public.sites add column if not exists site_label text;
