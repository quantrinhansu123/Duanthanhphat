-- ============================================================
-- Phụ tùng thay thế / phụ kiện dự phòng: lưu vào database (trước đây chỉ giữ trong bộ nhớ trình duyệt).
-- Chạy trong: Supabase Dashboard → SQL Editor (idempotent).
-- ============================================================

create table if not exists public.phu_tung_thay_the (
  id               uuid primary key default gen_random_uuid(),
  ma_phu_tung      text not null,
  ten_phu_tung     text not null,
  nha_san_xuat     text not null default '',
  model_tuong_thich text[] not null default '{}',
  nhom             text not null default 'Khác',
  don_vi           text not null default 'cái',
  ton_kho          numeric not null default 0 check (ton_kho >= 0),
  ton_toi_thieu    numeric not null default 0 check (ton_toi_thieu >= 0),
  don_gia_vnd      numeric not null default 0 check (don_gia_vnd >= 0),
  trang_thai       text not null default 'Còn hàng',
  ghi_chu          text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint phu_tung_thay_the_ma_unique unique (ma_phu_tung)
);

comment on table public.phu_tung_thay_the is 'Danh mục phụ tùng thay thế / phụ kiện dự phòng của máy hàn';

drop trigger if exists trg_phu_tung_thay_the_updated_at on public.phu_tung_thay_the;
create trigger trg_phu_tung_thay_the_updated_at
  before update on public.phu_tung_thay_the
  for each row execute function public.set_updated_at();

alter table public.phu_tung_thay_the enable row level security;

drop policy if exists "authenticated_all_phu_tung_thay_the" on public.phu_tung_thay_the;
create policy "authenticated_all_phu_tung_thay_the"
  on public.phu_tung_thay_the for all to authenticated
  using (true) with check (true);

drop policy if exists "anon_all_phu_tung_thay_the" on public.phu_tung_thay_the;
create policy "anon_all_phu_tung_thay_the"
  on public.phu_tung_thay_the for all to anon
  using (true) with check (true);

notify pgrst, 'reload schema';
