-- Partner showcase manager (Nov 2026): per-site picture, auto-scroll and "LeadPages pick".
-- Managed by super admins in /manage → Settings → Partner showcase. Safe to run more than once.

alter table public.partner_showcase_library
  add column if not exists image_url text,
  add column if not exists image_pid text,
  add column if not exists auto_scroll boolean not null default false,
  add column if not exists featured boolean not null default false;

comment on column public.partner_showcase_library.image_url is 'Optional feature picture shown on partner pages instead of the live preview (https only).';
comment on column public.partner_showcase_library.auto_scroll is 'Live preview slowly scrolls down the site to catch attention.';
comment on column public.partner_showcase_library.featured is 'LeadPages pick: listed first for partners.';
