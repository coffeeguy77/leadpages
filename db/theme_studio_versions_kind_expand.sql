-- Expand theme_studio_versions.kind for Website Studio flows
-- (approve / restore / direct edit / image persist). Safe to re-run.

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'theme_studio_versions'
  ) then
    alter table public.theme_studio_versions
      drop constraint if exists theme_studio_versions_kind_check;

    alter table public.theme_studio_versions
      add constraint theme_studio_versions_kind_check
      check (kind in (
        'generate',
        'refine',
        'select',
        'apply',
        'template',
        'direct_edit',
        'manual_edit',
        'restore',
        'approve',
        'images'
      ));
  end if;
end $$;
