-- Bookings hire tables: switch on row level security.
--
-- bookings_hire.sql created these tables without RLS. Supabase grants the public
-- `anon` and `authenticated` roles full table privileges by default, so without
-- RLS anyone holding the site's public anon key could read, change or delete them
-- through the REST API — including OAuth token and saved-card tables.
--
-- Every API that uses these tables (api/bookings/**, api/cron/bookings-*, lib/bookings/**)
-- connects with the service role, which bypasses RLS, so enabling RLS with no
-- policies blocks the public roles and changes nothing for the app.
--
-- Safe to run more than once.

do $$
declare t text;
begin
  foreach t in array array[
    'booking_hire_details',
    'booking_hire_reschedule_history',
    'booking_hire_lock_events',
    'booking_hire_capacity_overrides',
    'booking_cancellation_policies',
    'booking_cancellation_calculations',
    'booking_payment_methods',
    'booking_google_connections',
    'booking_google_event_links',
    'booking_google_sync_conflicts',
    'booking_google_contact_links',
    'booking_xero_connections',
    'booking_xero_contact_links',
    'booking_xero_invoices',
    'booking_xero_payments',
    'booking_agreement_templates',
    'booking_agreement_versions'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      -- Belt and braces: the public roles never need direct access to these tables.
      execute format('revoke all on table public.%I from anon', t);
    end if;
  end loop;
end $$;
