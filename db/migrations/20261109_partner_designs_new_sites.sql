-- Partner designs & new sites (9 Nov 2026)
-- STATUS: applied to Supabase 10 Nov 2026.
--
-- 1. partners.can_create_sites: a super-admin switch. When on, the partner gets a
--    "New website" button that makes a draft client site from one of their designs
--    (no Buy Now bar, no paid-quote step). Only super admins can change it
--    (partners has no partner UPDATE policy).
-- 2. Partners can no longer delete saved designs (partner_themes). Only super admins can.
--    SUPERSEDED by 20261110_partner_themes_locked.sql: only LeadPages-made (locked) designs are protected.
--    Partners keep select / insert / update on their own designs.

alter table public.partners add column if not exists can_create_sites boolean not null default false;

drop policy if exists themes_self on public.partner_themes;
drop policy if exists themes_self_sel on public.partner_themes;
drop policy if exists themes_self_ins on public.partner_themes;
drop policy if exists themes_self_upd on public.partner_themes;

create policy themes_self_sel on public.partner_themes for select
  using (partner_id in (select id from public.partners where user_id = auth.uid()));
create policy themes_self_ins on public.partner_themes for insert
  with check (partner_id in (select id from public.partners where user_id = auth.uid()));
create policy themes_self_upd on public.partner_themes for update
  using (partner_id in (select id from public.partners where user_id = auth.uid()))
  with check (partner_id in (select id from public.partners where user_id = auth.uid()));
-- Delete: super admins only, via the existing pt_super_all / themes_super policies.

-- Jason Duncan (Duncan's Plumbing) builds his own sites from his designs.
update public.partners set can_create_sites = true where id = '40782913-f134-4569-90aa-d0e5dc3f35e9';
