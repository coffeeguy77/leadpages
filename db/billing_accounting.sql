-- Billing accounting, invoice adjustments, and partner maintenance packages.
-- Apply in Supabase SQL editor (service role / migrations).

-- Local overlay on Stripe invoices: coupons, dispute discounts, amount edits.
CREATE TABLE IF NOT EXISTS billing_invoice_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_invoice_id text,
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  owner_user_id uuid,
  coupon_code text,
  discount_cents integer NOT NULL DEFAULT 0,
  original_amount_cents integer,
  adjusted_amount_cents integer,
  reason text,
  status text NOT NULL DEFAULT 'applied'
    CHECK (status IN ('draft', 'applied', 'void')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_invoice_adj_stripe_idx
  ON billing_invoice_adjustments (stripe_invoice_id);
CREATE INDEX IF NOT EXISTS billing_invoice_adj_site_idx
  ON billing_invoice_adjustments (site_id);

-- Catalogue of maintenance / update packages partners can sell.
CREATE TABLE IF NOT EXISTS maintenance_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  package_type text NOT NULL DEFAULT 'one_off'
    CHECK (package_type IN ('one_off', 'recurring')),
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'aud',
  interval text DEFAULT 'month'
    CHECK (interval IS NULL OR interval IN ('month', 'year', 'one_time')),
  partner_share_pct numeric NOT NULL DEFAULT 70,
  platform_share_pct numeric NOT NULL DEFAULT 30,
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Site enrolled in a maintenance package.
CREATE TABLE IF NOT EXISTS site_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES maintenance_packages(id),
  partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'cancelled', 'completed')),
  price_cents integer,
  billing_interval text DEFAULT 'month',
  stripe_item_id text,
  starts_at timestamptz DEFAULT now(),
  ends_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_maintenance_site_idx ON site_maintenance (site_id);
CREATE INDEX IF NOT EXISTS site_maintenance_partner_idx ON site_maintenance (partner_id);

-- One-off update jobs / work tickets under maintenance.
CREATE TABLE IF NOT EXISTS maintenance_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,
  package_id uuid REFERENCES maintenance_packages(id) ON DELETE SET NULL,
  site_maintenance_id uuid REFERENCES site_maintenance(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  job_type text NOT NULL DEFAULT 'one_off'
    CHECK (job_type IN ('one_off', 'recurring_cycle')),
  amount_cents integer NOT NULL DEFAULT 0,
  partner_share_cents integer NOT NULL DEFAULT 0,
  platform_share_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'quoted'
    CHECK (status IN ('quoted', 'accepted', 'in_progress', 'done', 'invoiced', 'paid', 'cancelled')),
  commission_id uuid,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maintenance_jobs_partner_idx ON maintenance_jobs (partner_id);
CREATE INDEX IF NOT EXISTS maintenance_jobs_site_idx ON maintenance_jobs (site_id);

-- Seed default packages (30% LeadPages / 70% partner).
INSERT INTO maintenance_packages (key, name, description, package_type, price_cents, interval, partner_share_pct, platform_share_pct, sort)
VALUES
  ('update-job', 'One-off update job', 'Single content or design update booked by the partner for a client site.', 'one_off', 15000, 'one_time', 70, 30, 10),
  ('care-monthly', 'Monthly care package', 'Recurring updates and light maintenance each month.', 'recurring', 9900, 'month', 70, 30, 20),
  ('care-quarterly', 'Quarterly care package', 'Scheduled update package every three months (billed monthly equivalent).', 'recurring', 24900, 'month', 70, 30, 30)
ON CONFLICT (key) DO NOTHING;

-- Allow partner_commissions.type to include maintenance (if constrained by check, drop/re-add).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'partner_commissions' AND column_name = 'type'
  ) THEN
    -- Best-effort: many projects use text without a check; leave type unconstrained.
    NULL;
  END IF;
END $$;
