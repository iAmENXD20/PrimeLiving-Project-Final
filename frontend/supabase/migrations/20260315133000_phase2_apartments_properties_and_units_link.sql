begin;

-- Remove legacy writable apartments view, replace with canonical apartments table (property/building level)
drop trigger if exists trg_apartments_view_dml on public.apartments;
drop function if exists public.apartments_view_dml();
drop view if exists public.apartments;

create table if not exists public.apartments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid null references public.clients(id) on delete set null,
  name text not null,
  address text null,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_apartments_client_id on public.apartments(client_id);

-- Seed one apartment/property per client if missing
insert into public.apartments (client_id, name, address, status)
select
  c.id,
  coalesce(nullif(trim(c.name), ''), 'Apartment ' || left(c.id::text, 8)),
  c.apartment_address,
  case when c.status in ('active','inactive') then c.status else 'active' end
from public.clients c
where not exists (
  select 1 from public.apartments a where a.client_id = c.id
);

-- Link units to apartments
alter table public.units add column if not exists apartment_id uuid;

update public.units u
set apartment_id = a.id
from public.apartments a
where u.apartment_id is null
  and u.client_id is not null
  and a.client_id = u.client_id;

-- FK + index (nullable for safe rollout)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'units_apartment_id_fkey'
      and conrelid = 'public.units'::regclass
  ) then
    alter table public.units
      add constraint units_apartment_id_fkey
      foreign key (apartment_id) references public.apartments(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_units_apartment_id on public.units(apartment_id);

-- Manager apartment assignments (canonical relationship)
create table if not exists public.manager_apartments (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.managers(id) on delete cascade,
  apartment_id uuid not null references public.apartments(id) on delete cascade,
  status text not null default 'active' check (status in ('active','inactive')),
  assigned_at timestamptz not null default now(),
  unique (manager_id, apartment_id)
);

create index if not exists idx_manager_apartments_manager_id on public.manager_apartments(manager_id);
create index if not exists idx_manager_apartments_apartment_id on public.manager_apartments(apartment_id);

insert into public.manager_apartments (manager_id, apartment_id, status)
select distinct
  u.manager_id,
  u.apartment_id,
  'active'
from public.units u
where u.manager_id is not null
  and u.apartment_id is not null
on conflict (manager_id, apartment_id) do nothing;

comment on table public.apartments is 'Canonical property/apartment building table. Units belong to apartments via units.apartment_id.';
comment on table public.units is 'Canonical unit table. Legacy columns client_id/manager_id retained temporarily for compatibility.';
comment on table public.manager_apartments is 'Canonical manager-to-apartment assignment mapping.';

commit;
