-- Locked partner designs (10 Nov 2026)
-- STATUS: applied to Supabase 10 Nov 2026.
--
-- Corrects 20261109: only designs LeadPages (a super admin) adds for a partner are locked.
-- Designs a partner saves themselves stay deletable by that partner.
--
-- partner_themes.locked:
--   * set automatically when a super admin inserts a design (e.g. "Save as theme" while
--     viewing a partner's desk); can also be set directly by LeadPages
--   * partners cannot change it (trigger keeps the old value for non-super users)
--   * partners can delete their own designs only when locked = false

alter table public.partner_themes add column if not exists locked boolean not null default false;

create or replace function public.partner_themes_lock_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if public.is_super() then new.locked := true;
    elsif auth.uid() is not null then new.locked := false;
    end if;
  elsif tg_op = 'UPDATE' then
    if auth.uid() is not null and not public.is_super() then new.locked := old.locked; end if;
  end if;
  return new;
end $$;

drop trigger if exists partner_themes_lock_guard on public.partner_themes;
create trigger partner_themes_lock_guard before insert or update on public.partner_themes
  for each row execute function public.partner_themes_lock_guard();

drop policy if exists themes_self_del on public.partner_themes;
create policy themes_self_del on public.partner_themes for delete
  using (locked = false and partner_id in (select id from public.partners where user_id = auth.uid()));

-- Duncan's two custom designs (made by LeadPages, 8 Nov 2026)
update public.partner_themes set locked = true
 where id in ('491f3b12-60b5-4160-a595-9cf5da47341d', 'd9044e0b-807a-493d-9aa5-3a42b0f43b57');
