-- Lịch sử bảo trì máy, gồm ghi chú và nhiều ảnh Cloudinary cho mỗi lần bảo trì.

create table if not exists public.lich_su_bao_tri_may (
  id uuid primary key default gen_random_uuid(),
  may_id uuid not null references public.thiet_bi (id) on delete cascade,
  ngay date not null,
  gio time not null default '08:00',
  thoi_luong_phut integer not null default 60 check (thoi_luong_phut > 0),
  cong_viec text not null check (nullif(btrim(cong_viec), '') is not null),
  loai text not null check (loai in ('Bảo dưỡng', 'Sửa chữa', 'Kiểm định', 'Thay phụ tùng')),
  trang_thai text not null check (trang_thai in ('Đã xong', 'Đang làm', 'Chờ xác nhận')),
  nhan_su text[] not null default '{}'::text[],
  ghi_chu text,
  hinh_anh jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lich_su_bao_tri_may_hinh_anh_array_check
    check (jsonb_typeof(hinh_anh) = 'array')
);

create index if not exists lich_su_bao_tri_may_may_ngay_idx
  on public.lich_su_bao_tri_may (may_id, ngay desc, gio desc);

drop trigger if exists trg_lich_su_bao_tri_may_updated_at on public.lich_su_bao_tri_may;
create trigger trg_lich_su_bao_tri_may_updated_at
  before update on public.lich_su_bao_tri_may
  for each row execute function public.set_updated_at();

alter table public.lich_su_bao_tri_may enable row level security;

drop policy if exists "anon_all_lich_su_bao_tri_may" on public.lich_su_bao_tri_may;
create policy "anon_all_lich_su_bao_tri_may"
  on public.lich_su_bao_tri_may for all to anon
  using (true) with check (true);

drop policy if exists "authenticated_all_lich_su_bao_tri_may" on public.lich_su_bao_tri_may;
create policy "authenticated_all_lich_su_bao_tri_may"
  on public.lich_su_bao_tri_may for all to authenticated
  using (true) with check (true);

grant select, insert, update, delete on public.lich_su_bao_tri_may to anon, authenticated;

comment on table public.lich_su_bao_tri_may is
  'Lịch sử bảo dưỡng, sửa chữa và kiểm định theo từng máy.';
comment on column public.lich_su_bao_tri_may.hinh_anh is
  'Mảng metadata ảnh Cloudinary: publicId, secureUrl, name và bytes.';
