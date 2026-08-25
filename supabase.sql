drop table if exists public.empresas;

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  instagram text,
  sector text,
  mensaje text,
  estado text not null default 'PENDIENTE',
  fecha_contacto timestamptz,
  notas text,
  created_at timestamptz not null default now()
);

alter table public.empresas
add constraint empresas_estado_check
check (
  estado in (
    'PENDIENTE',
    'CONTACTADA',
    'RESPONDIDO',
    'INTERESADA',
    'COLABORACION',
    'DESCARTADA'
  )
);

-- VERSIÓN DE ARRANQUE SIN LOGIN:
-- permite al frontend con la publishable/anon key leer y escribir.
-- Úsalo solo para probar. Después conviene activar Auth + RLS.

alter table public.empresas enable row level security;

create policy "crm_select_empresas"
on public.empresas
for select
to anon, authenticated
using (true);

create policy "crm_insert_empresas"
on public.empresas
for insert
to anon, authenticated
with check (true);

create policy "crm_update_empresas"
on public.empresas
for update
to anon, authenticated
using (true)
with check (true);

create policy "crm_delete_empresas"
on public.empresas
for delete
to anon, authenticated
using (true);
