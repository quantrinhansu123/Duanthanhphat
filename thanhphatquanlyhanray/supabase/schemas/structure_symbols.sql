-- Chạy file này trong Supabase Dashboard > SQL Editor (một lần).
-- Bản mới đồng bộ: ../../supabase/migration_20261017_structure_symbols.sql (repo gốc).
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

-- Nâng cấp bảng cũ (nếu đã tạo trước đó): thêm tên tiếng Anh, bỏ cột loại ký hiệu.
alter table public.structure_symbols add column if not exists name_en text;
alter table public.structure_symbols drop column if exists kind;

alter table public.structure_symbols enable row level security;

-- Chưa có đăng nhập: cho phép role anon đọc/ghi. Siết lại khi thêm auth.
create policy "anon all structure_symbols" on public.structure_symbols
  for all to anon, authenticated using (true) with check (true);

-- Bucket ảnh đại diện (public)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('structure-images', 'structure-images', true, 5242880,
  array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "anon read structure images" on storage.objects
  for select to anon, authenticated using (bucket_id = 'structure-images');
create policy "anon upload structure images" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'structure-images');
create policy "anon delete structure images" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'structure-images');
