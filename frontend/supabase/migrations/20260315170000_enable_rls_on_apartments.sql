begin;

alter table public.apartments enable row level security;

-- Remove old permissive policy if present
 drop policy if exists "Allow all access to apartments" on public.apartments;
 drop policy if exists "allow_all_apartments" on public.apartments;

-- Authenticated users can read apartments
create policy "authenticated_select_apartments"
on public.apartments
as permissive
for select
to authenticated
using (true);

-- Writes are handled by backend service role; do not expose direct client writes.

commit;
