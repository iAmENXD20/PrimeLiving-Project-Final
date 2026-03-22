-- Fix migration: Rename client_id → apartmentowner_id on tables missed by the
-- original 20260322_rename_client_id_to_apartmentowner_id migration.
--
-- Issues fixed:
--   1. units table still has client_id (was never renamed)
--   2. maintenance table still has client_id (the original migration targeted
--      maintenance_requests which is now a VIEW, not the real table)
--   3. create_initial_tenant_payment trigger function references client_id
--      on both tenants (NEW row) and payments (INSERT target)

BEGIN;

-- ── 1. Rename client_id → apartmentowner_id on the units table ──────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'units' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE public.units RENAME COLUMN client_id TO apartmentowner_id;
  END IF;
END $$;

-- ── 2. Rename client_id → apartmentowner_id on the maintenance table ────
--    (the original migration tried maintenance_requests which is a view)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'maintenance' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE public.maintenance RENAME COLUMN client_id TO apartmentowner_id;
  END IF;
END $$;

-- ── 3. Recreate trigger function with apartmentowner_id ─────────────────
CREATE OR REPLACE FUNCTION public.create_initial_tenant_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  monthly_rent_value numeric := 0;
  period_start date;
  period_end date;
  computed_status text;
  resolved_unit_id uuid;
BEGIN
  IF new.status IS DISTINCT FROM 'active' THEN
    RETURN new;
  END IF;

  resolved_unit_id := coalesce(new.unit_id, new.apartment_id);

  IF resolved_unit_id IS NULL OR new.apartmentowner_id IS NULL OR new.move_in_date IS NULL THEN
    RETURN new;
  END IF;

  SELECT coalesce(u.monthly_rent, 0)
    INTO monthly_rent_value
  FROM public.units u
  WHERE u.id = resolved_unit_id;

  period_start := new.move_in_date::date;
  period_end   := (period_start + interval '1 month')::date;

  computed_status := CASE
    WHEN current_date > (period_end + interval '3 days')::date THEN 'overdue'
    ELSE 'pending'
  END;

  INSERT INTO public.payments (
    apartmentowner_id,
    tenant_id,
    unit_id,
    apartment_id,
    amount,
    payment_date,
    status,
    description,
    payment_mode,
    receipt_url,
    verification_status,
    period_from,
    period_to
  ) VALUES (
    new.apartmentowner_id,
    new.id,
    resolved_unit_id,
    resolved_unit_id,
    monthly_rent_value,
    period_end::timestamp,
    computed_status,
    'Monthly rent - ' || period_start::text || ' to ' || period_end::text,
    null,
    null,
    null,
    period_start,
    period_end
  )
  ON CONFLICT (tenant_id, period_from) WHERE period_from IS NOT NULL DO NOTHING;

  RETURN new;
END;
$function$;

COMMIT;
