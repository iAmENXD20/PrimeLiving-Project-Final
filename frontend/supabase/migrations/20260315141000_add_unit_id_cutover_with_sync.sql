begin;

create or replace function public.sync_unit_and_apartment_ids()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.unit_id is null and new.apartment_id is not null then
    new.unit_id := new.apartment_id;
  elsif new.apartment_id is null and new.unit_id is not null then
    new.apartment_id := new.unit_id;
  elsif new.unit_id is not null and new.apartment_id is not null and new.unit_id <> new.apartment_id then
    new.apartment_id := new.unit_id;
  end if;

  return new;
end;
$$;

-- tenants
alter table public.tenants add column if not exists unit_id uuid;
update public.tenants set unit_id = apartment_id where unit_id is null and apartment_id is not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tenants_unit_id_fkey' and conrelid = 'public.tenants'::regclass) then
    alter table public.tenants add constraint tenants_unit_id_fkey foreign key (unit_id) references public.units(id) on delete set null;
  end if;
end $$;
create index if not exists idx_tenants_unit_id on public.tenants(unit_id);
drop trigger if exists trg_sync_unit_apartment_ids_tenants on public.tenants;
create trigger trg_sync_unit_apartment_ids_tenants
before insert or update on public.tenants
for each row execute function public.sync_unit_and_apartment_ids();

-- payments
alter table public.payments add column if not exists unit_id uuid;
update public.payments set unit_id = apartment_id where unit_id is null and apartment_id is not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_unit_id_fkey' and conrelid = 'public.payments'::regclass) then
    alter table public.payments add constraint payments_unit_id_fkey foreign key (unit_id) references public.units(id) on delete set null;
  end if;
end $$;
create index if not exists idx_payments_unit_id on public.payments(unit_id);
drop trigger if exists trg_sync_unit_apartment_ids_payments on public.payments;
create trigger trg_sync_unit_apartment_ids_payments
before insert or update on public.payments
for each row execute function public.sync_unit_and_apartment_ids();

-- documents
alter table public.documents add column if not exists unit_id uuid;
update public.documents set unit_id = apartment_id where unit_id is null and apartment_id is not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'documents_unit_id_fkey' and conrelid = 'public.documents'::regclass) then
    alter table public.documents add constraint documents_unit_id_fkey foreign key (unit_id) references public.units(id) on delete set null;
  end if;
end $$;
create index if not exists idx_documents_unit_id on public.documents(unit_id);
drop trigger if exists trg_sync_unit_apartment_ids_documents on public.documents;
create trigger trg_sync_unit_apartment_ids_documents
before insert or update on public.documents
for each row execute function public.sync_unit_and_apartment_ids();

-- maintenance
alter table public.maintenance add column if not exists unit_id uuid;
update public.maintenance set unit_id = apartment_id where unit_id is null and apartment_id is not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'maintenance_unit_id_fkey' and conrelid = 'public.maintenance'::regclass) then
    alter table public.maintenance add constraint maintenance_unit_id_fkey foreign key (unit_id) references public.units(id) on delete set null;
  end if;
end $$;
create index if not exists idx_maintenance_unit_id on public.maintenance(unit_id);
drop trigger if exists trg_sync_unit_apartment_ids_maintenance on public.maintenance;
create trigger trg_sync_unit_apartment_ids_maintenance
before insert or update on public.maintenance
for each row execute function public.sync_unit_and_apartment_ids();

-- revenues
alter table public.revenues add column if not exists unit_id uuid;
update public.revenues set unit_id = apartment_id where unit_id is null and apartment_id is not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'revenues_unit_id_fkey' and conrelid = 'public.revenues'::regclass) then
    alter table public.revenues add constraint revenues_unit_id_fkey foreign key (unit_id) references public.units(id) on delete set null;
  end if;
end $$;
create index if not exists idx_revenues_unit_id on public.revenues(unit_id);
drop trigger if exists trg_sync_unit_apartment_ids_revenues on public.revenues;
create trigger trg_sync_unit_apartment_ids_revenues
before insert or update on public.revenues
for each row execute function public.sync_unit_and_apartment_ids();

comment on column public.tenants.unit_id is 'Canonical unit reference. Legacy apartment_id retained temporarily for compatibility.';
comment on column public.payments.unit_id is 'Canonical unit reference. Legacy apartment_id retained temporarily for compatibility.';
comment on column public.documents.unit_id is 'Canonical unit reference. Legacy apartment_id retained temporarily for compatibility.';
comment on column public.maintenance.unit_id is 'Canonical unit reference. Legacy apartment_id retained temporarily for compatibility.';
comment on column public.revenues.unit_id is 'Canonical unit reference. Legacy apartment_id retained temporarily for compatibility.';

commit;
