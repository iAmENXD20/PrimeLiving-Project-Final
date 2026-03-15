begin;

create or replace function public.create_initial_tenant_payment()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  monthly_rent_value numeric := 0;
  period_start date;
  period_end date;
  computed_status text;
  resolved_unit_id uuid;
begin
  if new.status is distinct from 'active' then
    return new;
  end if;

  resolved_unit_id := coalesce(new.unit_id, new.apartment_id);

  if resolved_unit_id is null or new.client_id is null or new.move_in_date is null then
    return new;
  end if;

  select coalesce(u.monthly_rent, 0)
    into monthly_rent_value
  from public.units u
  where u.id = resolved_unit_id;

  period_start := new.move_in_date::date;
  period_end := (period_start + interval '1 month')::date;

  computed_status := case
    when current_date > (period_end + interval '3 days')::date then 'overdue'
    else 'pending'
  end;

  insert into public.payments (
    client_id,
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
  ) values (
    new.client_id,
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
  on conflict (tenant_id, period_from) where period_from is not null do nothing;

  return new;
end;
$function$;

commit;
