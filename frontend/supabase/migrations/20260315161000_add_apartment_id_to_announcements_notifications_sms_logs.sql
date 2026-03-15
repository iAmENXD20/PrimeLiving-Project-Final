begin;

-- announcements.apartment_id
alter table public.announcements add column if not exists apartment_id uuid;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'announcements_apartment_id_fkey'
      and conrelid = 'public.announcements'::regclass
  ) then
    alter table public.announcements
      add constraint announcements_apartment_id_fkey
      foreign key (apartment_id) references public.apartments(id)
      on delete set null;
  end if;
end $$;
create index if not exists idx_announcements_apartment_id on public.announcements(apartment_id);

-- notifications.apartment_id
alter table public.notifications add column if not exists apartment_id uuid;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notifications_apartment_id_fkey'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_apartment_id_fkey
      foreign key (apartment_id) references public.apartments(id)
      on delete set null;
  end if;
end $$;
create index if not exists idx_notifications_apartment_id on public.notifications(apartment_id);

-- sms_logs.apartment_id
alter table public.sms_logs add column if not exists apartment_id uuid;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sms_logs_apartment_id_fkey'
      and conrelid = 'public.sms_logs'::regclass
  ) then
    alter table public.sms_logs
      add constraint sms_logs_apartment_id_fkey
      foreign key (apartment_id) references public.apartments(id)
      on delete set null;
  end if;
end $$;
create index if not exists idx_sms_logs_apartment_id on public.sms_logs(apartment_id);

-- Backfill announcements and notifications via client -> first apartment mapping
with first_apartment_per_client as (
  select distinct on (a.client_id)
    a.client_id,
    a.id as apartment_id
  from public.apartments a
  where a.client_id is not null
  order by a.client_id, a.created_at asc
)
update public.announcements an
set apartment_id = m.apartment_id
from first_apartment_per_client m
where an.apartment_id is null
  and an.client_id = m.client_id;

with first_apartment_per_client as (
  select distinct on (a.client_id)
    a.client_id,
    a.id as apartment_id
  from public.apartments a
  where a.client_id is not null
  order by a.client_id, a.created_at asc
)
update public.notifications n
set apartment_id = m.apartment_id
from first_apartment_per_client m
where n.apartment_id is null
  and n.client_id = m.client_id;

comment on column public.announcements.apartment_id is 'Property-level apartment reference for targeted announcements.';
comment on column public.notifications.apartment_id is 'Property-level apartment reference for notification scoping.';
comment on column public.sms_logs.apartment_id is 'Property-level apartment reference for SMS traceability.';

commit;
