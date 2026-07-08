-- Partner bank account details for commission payouts (locked after partner confirms).

ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS bank_account_name text;
ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS bank_bsb text;
ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS bank_account_number text;
ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS bank_details_locked boolean NOT NULL DEFAULT false;
ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS bank_details_locked_at timestamptz;
