begin;

drop view if exists public.maintenance_requests;

comment on table public.maintenance is 'Canonical maintenance table. Legacy maintenance_requests view removed.';

commit;
