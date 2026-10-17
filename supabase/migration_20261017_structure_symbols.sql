create table if not exists public.structure_symbols (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  name_en text,
  line text,
  km_start numeric,
  km_end numeric,
  status text not null default 'active' check (status in ('active','maintenance','inactive')),
  managing_unit text,
  note text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.structure_symbols add column if not exists name_en text;
alter table public.structure_symbols drop column if exists kind;

alter table public.structure_symbols enable row level security;

drop policy if exists "anon all structure_symbols" on public.structure_symbols;
create policy "anon all structure_symbols" on public.structure_symbols
  for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.structure_symbols to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'structure-images',
  'structure-images',
  true,
  5242880,
  array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "anon read structure images" on storage.objects;
drop policy if exists "anon upload structure images" on storage.objects;
drop policy if exists "anon delete structure images" on storage.objects;

create policy "anon read structure images" on storage.objects
  for select to anon, authenticated using (bucket_id = 'structure-images');
create policy "anon upload structure images" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'structure-images');
create policy "anon delete structure images" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'structure-images');

notify pgrst, 'reload schema';
