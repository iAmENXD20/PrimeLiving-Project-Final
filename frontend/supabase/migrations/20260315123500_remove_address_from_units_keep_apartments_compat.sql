begin;

-- 1) Backfill clients.apartment_address from existing unit addresses when missing
with src as (
  select client_id, max(address) as address
  from public.units
  where address is not null and btrim(address) <> ''
  group by client_id
)
update public.clients c
set apartment_address = src.address,
    updated_at = now()
from src
where c.id = src.client_id
  and (c.apartment_address is null or btrim(c.apartment_address) = '');

-- 2) Rebuild legacy apartments view so address comes from clients (property-level)
drop view if exists public.apartments;

alter table public.units
  drop column if exists address;

create view public.apartments
with (security_invoker = true)
as
select
  u.id,
  u.name,
  c.apartment_address as address,
  u.monthly_rent,
  u.client_id,
  u.manager_id,
  u.status,
  u.created_at,
  u.updated_at,
  u.total_units
from public.units u
left join public.clients c on c.id = u.client_id;

-- 3) Make apartments compatibility view writable
create or replace function public.apartments_view_dml()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  out_id uuid;
  resolved_client_id uuid;
begin
  if tg_op = 'INSERT' then
    insert into public.units (
      id,
      name,
      monthly_rent,
      client_id,
      manager_id,
      status,
      created_at,
      updated_at,
      total_units
    )
    values (
      coalesce(new.id, gen_random_uuid()),
      new.name,
      coalesce(new.monthly_rent, 0),
      new.client_id,
      new.manager_id,
      coalesce(new.status, 'active'),
      coalesce(new.created_at, now()),
      coalesce(new.updated_at, now()),
      coalesce(new.total_units, 0)
    )
    returning id, client_id into out_id, resolved_client_id;

    if resolved_client_id is not null and new.address is not null and btrim(new.address) <> '' then
      update public.clients
      set apartment_address = new.address,
          updated_at = now()
      where id = resolved_client_id;
    end if;

    return (select a from public.apartments a where a.id = out_id);
  end if;

  if tg_op = 'UPDATE' then
    update public.units u
    set
      name = coalesce(new.name, u.name),
      monthly_rent = coalesce(new.monthly_rent, u.monthly_rent),
      client_id = coalesce(new.client_id, u.client_id),
      manager_id = case
        when new.manager_id is distinct from old.manager_id then new.manager_id
        else u.manager_id
      end,
      status = coalesce(new.status, u.status),
      updated_at = coalesce(new.updated_at, now()),
      total_units = coalesce(new.total_units, u.total_units)
    where u.id = old.id
    returning u.id, u.client_id into out_id, resolved_client_id;

    if resolved_client_id is not null and new.address is not null and btrim(new.address) <> '' then
      update public.clients
      set apartment_address = new.address,
          updated_at = now()
      where id = resolved_client_id;
    end if;

    return (select a from public.apartments a where a.id = out_id);
  end if;

  if tg_op = 'DELETE' then
    delete from public.units where id = old.id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_apartments_view_dml on public.apartments;
create trigger trg_apartments_view_dml
instead of insert or update or delete
on public.apartments
for each row
execute function public.apartments_view_dml();

grant select, insert, update, delete on public.apartments to anon, authenticated, service_role;

comment on table public.units is 'Canonical units table (no address column; property address is stored in clients.apartment_address).';
comment on view public.apartments is 'Legacy writable compatibility view. Address is projected from clients.apartment_address.';

commit;
