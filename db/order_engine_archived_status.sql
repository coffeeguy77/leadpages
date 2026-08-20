-- Allow archived status for historical / imported orders (reorderable, not in active queue).
-- Safe to re-run.

DO $$
DECLARE
  con_name text;
BEGIN
  SELECT c.conname INTO con_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'order_orders'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%status%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE order_orders DROP CONSTRAINT %I', con_name);
  END IF;

  ALTER TABLE order_orders
    ADD CONSTRAINT order_orders_status_check
    CHECK (status IN (
      'draft', 'awaiting_deposit', 'confirmed', 'changes_open', 'locked',
      'in_preparation', 'ready', 'collected', 'completed', 'archived',
      'cancelled', 'refunded'
    ));
END $$;

-- Move previously imported history into archived (keeps them out of the active queue).
UPDATE order_orders
SET status = 'archived',
    completed_at = COALESCE(completed_at, collected_at, confirmed_at, updated_at, now()),
    editing_state = 'locked',
    updated_at = now()
WHERE source = 'system'
  AND status = 'completed'
  AND (
    internal_notes ILIKE '%Imported%'
    OR external_order_number IS NOT NULL
  );
