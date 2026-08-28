-- ============================================================
-- Tài liệu PDF — metadata + Storage bucket
-- Chạy trong: Supabase Dashboard → SQL Editor
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists public.tai_lieu (
  id          uuid primary key default gen_random_uuid(),
  ten         text not null,
  mo_ta       text,
  file_path   text not null,
  file_url    text not null,
  file_size   bigint,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.tai_lieu is 'Danh mục tài liệu PDF';

create index if not exists idx_tai_lieu_created on public.tai_lieu (created_at desc);

drop trigger if exists trg_tai_lieu_updated_at on public.tai_lieu;
create trigger trg_tai_lieu_updated_at
  before update on public.tai_lieu
  for each row execute function public.set_updated_at();

alter table public.tai_lieu enable row level security;

drop policy if exists "authenticated_all_tai_lieu" on public.tai_lieu;
create policy "authenticated_all_tai_lieu"
  on public.tai_lieu for all to authenticated
  using (true) with check (true);

drop policy if exists "anon_all_tai_lieu" on public.tai_lieu;
create policy "anon_all_tai_lieu"
  on public.tai_lieu for all to anon
  using (true) with check (true);

-- Storage bucket PDF (public read)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tai-lieu', 'tai-lieu', true, 52428800, array['application/pdf'])
on conflict (id) do update
  set public = true,
      file_size_limit = 52428800,
      allowed_mime_types = array['application/pdf'];

drop policy if exists "anon_read_tai_lieu_storage" on storage.objects;
create policy "anon_read_tai_lieu_storage"
  on storage.objects for select to anon
  using (bucket_id = 'tai-lieu');

drop policy if exists "anon_insert_tai_lieu_storage" on storage.objects;
create policy "anon_insert_tai_lieu_storage"
  on storage.objects for insert to anon
  with check (bucket_id = 'tai-lieu');

drop policy if exists "anon_delete_tai_lieu_storage" on storage.objects;
create policy "anon_delete_tai_lieu_storage"
  on storage.objects for delete to anon
  using (bucket_id = 'tai-lieu');

drop policy if exists "authenticated_all_tai_lieu_storage" on storage.objects;
create policy "authenticated_all_tai_lieu_storage"
  on storage.objects for all to authenticated
  using (bucket_id = 'tai-lieu')
  with check (bucket_id = 'tai-lieu');
