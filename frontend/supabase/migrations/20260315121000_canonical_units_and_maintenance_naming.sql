begin;

-- Canonical naming: apartments -> units
-- Keep backward compatibility via updatable view: apartments -> units

do $$
begin
  if to_regclass('public.units') is null and to_regclass('public.apartments') is not null then
    execute 'alter table public.apartments rename to units';
  end if;
end $$;

do $$
begin
  if to_regclass('public.apartments') is null and to_regclass('public.units') is not null then
    execute 'create view public.apartments with (security_invoker = true) as select * from public.units';
  end if;
end $$;

-- Canonical naming: maintenance_requests -> maintenance
-- Keep backward compatibility via updatable view: maintenance_requests -> maintenance

do $$
begin
  if to_regclass('public.maintenance') is null and to_regclass('public.maintenance_requests') is not null then
    execute 'alter table public.maintenance_requests rename to maintenance';
  end if;
end $$;

do $$
begin
  if to_regclass('public.maintenance_requests') is null and to_regclass('public.maintenance') is not null then
    execute 'create view public.maintenance_requests with (security_invoker = true) as select * from public.maintenance';
  end if;
end $$;

-- Ensure API roles can still use legacy view names safely

do $$
begin
  if to_regclass('public.apartments') is not null then
    execute 'grant select, insert, update, delete on public.apartments to anon, authenticated, service_role';
  end if;

  if to_regclass('public.maintenance_requests') is not null then
    execute 'grant select, insert, update, delete on public.maintenance_requests to anon, authenticated, service_role';
  end if;
end $$;

comment on table public.units is 'Canonical units table (legacy name: apartments).';
comment on view public.apartments is 'Legacy compatibility view mapped to public.units.';
comment on table public.maintenance is 'Canonical maintenance table (legacy name: maintenance_requests).';
comment on view public.maintenance_requests is 'Legacy compatibility view mapped to public.maintenance.';

commit;
