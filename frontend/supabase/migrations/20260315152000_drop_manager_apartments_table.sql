begin;

drop table if exists public.manager_apartments;

comment on table public.units is 'Canonical unit table. Manager assignment uses units.manager_id.';

commit;
