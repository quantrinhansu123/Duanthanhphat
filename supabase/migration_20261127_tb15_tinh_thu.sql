-- Bản lưu tính thử kiểm toán nền đường có ba lát.
-- Chạy trong Supabase Dashboard > SQL Editor.

begin;

create table if not exists public.tb15_tinh_thu (
  id uuid primary key default gen_random_uuid(),
  tieu_de text not null,
  dat boolean not null,
  nhiet_do_khoa double precision,
  khi_hau text not null default '',
  du_lieu_gan jsonb not null default '[]'::jsonb,
  dau_vao jsonb not null,
  ket_qua jsonb not null,
  nguon jsonb not null default '{}'::jsonb,
  thong_so jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint tb15_tinh_thu_tieu_de_check check (char_length(tieu_de) between 1 and 120)
);

alter table public.tb15_tinh_thu
  add column if not exists thong_so jsonb not null default '[]'::jsonb;

create index if not exists tb15_tinh_thu_created_at_idx
  on public.tb15_tinh_thu (created_at desc);

alter table public.tb15_tinh_thu enable row level security;

drop policy if exists "tb15_all_tb15_tinh_thu" on public.tb15_tinh_thu;
create policy "tb15_all_tb15_tinh_thu"
  on public.tb15_tinh_thu
  for all
  to anon, authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.tb15_tinh_thu to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
