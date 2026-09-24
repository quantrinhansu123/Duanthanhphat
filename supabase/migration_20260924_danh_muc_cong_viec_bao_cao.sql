-- ============================================================
-- Danh mục công việc báo cáo ngày — mỗi công việc = 1 tab
-- Chạy sau: bao_cao_ngay.sql, migration_20260922_bao_cao_ngay_nhan_luc.sql
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. Danh mục công việc (định nghĩa tab)
-- ------------------------------------------------------------
create table if not exists public.danh_muc_cong_viec_bao_cao (
  id                  uuid primary key default gen_random_uuid(),
  ma                  text not null,
  ten                 text not null,
  mo_ta               text,
  thu_tu              integer not null default 1 check (thu_tu >= 1),
  loai_may_mac_dinh   text,
  don_vi_mac_dinh     text not null default 'mối hàn',
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint uq_danh_muc_cong_viec_bao_cao_ma unique (ma)
);

comment on table public.danh_muc_cong_viec_bao_cao is
  'Danh mục công việc dùng làm tab trong Báo cáo công việc ngày';
comment on column public.danh_muc_cong_viec_bao_cao.ma is 'Mã ngắn ổn định (vd: HAN-NN)';
comment on column public.danh_muc_cong_viec_bao_cao.ten is 'Tên hiển thị trên tab';

create index if not exists idx_danh_muc_cv_active_thu_tu
  on public.danh_muc_cong_viec_bao_cao (active, thu_tu);

drop trigger if exists trg_danh_muc_cv_updated_at on public.danh_muc_cong_viec_bao_cao;
create trigger trg_danh_muc_cv_updated_at
  before update on public.danh_muc_cong_viec_bao_cao
  for each row execute function public.set_updated_at();

-- Seed 3 công việc chuẩn (idempotent theo ma)
insert into public.danh_muc_cong_viec_bao_cao (id, ma, ten, mo_ta, thu_tu, loai_may_mac_dinh, don_vi_mac_dinh, active)
values
  (
    'a1111111-1111-4111-8111-111111111101',
    'HAN-NN',
    'Hàn nhiệt nhôm trên tuyến',
    'Công việc hàn nhiệt nhôm (ATW) trên tuyến đường sắt',
    1,
    'Máy phát điện 5KVA',
    'mối hàn',
    true
  ),
  (
    'a1111111-1111-4111-8111-111111111102',
    'HAN-CGM-TUYEN',
    'Hàn cháy giáp mép trên tuyến',
    'Hàn tiếp xúc đối đầu (FBW) trên tuyến',
    2,
    'Máy hàn ray',
    'mối hàn',
    true
  ),
  (
    'a1111111-1111-4111-8111-111111111103',
    'HAN-CGM-BAI',
    'Hàn cháy giáp mép tại bãi hàn',
    'Hàn tiếp xúc đối đầu (FBW) tại bãi hàn',
    3,
    'Máy hàn ray',
    'mối hàn',
    true
  )
on conflict (ma) do update set
  ten = excluded.ten,
  mo_ta = excluded.mo_ta,
  thu_tu = excluded.thu_tu,
  loai_may_mac_dinh = excluded.loai_may_mac_dinh,
  don_vi_mac_dinh = excluded.don_vi_mac_dinh,
  active = excluded.active,
  updated_at = now();

-- ------------------------------------------------------------
-- 2. Gắn dòng công việc trong phiếu với danh mục
-- ------------------------------------------------------------
alter table public.bao_cao_ngay_cong_viec
  add column if not exists cong_viec_id uuid
    references public.danh_muc_cong_viec_bao_cao (id) on delete set null;

comment on column public.bao_cao_ngay_cong_viec.cong_viec_id is
  'Tham chiếu danh mục công việc (tab báo cáo)';

create index if not exists idx_bao_cao_ngay_cv_cong_viec
  on public.bao_cao_ngay_cong_viec (cong_viec_id);

-- Backfill theo tên hạng mục đã có
update public.bao_cao_ngay_cong_viec cv
set cong_viec_id = dm.id
from public.danh_muc_cong_viec_bao_cao dm
where cv.cong_viec_id is null
  and lower(btrim(cv.hang_muc)) = lower(btrim(dm.ten));

update public.bao_cao_ngay_cong_viec cv
set cong_viec_id = dm.id
from public.danh_muc_cong_viec_bao_cao dm
where cv.cong_viec_id is null
  and dm.ma = 'HAN-NN'
  and cv.hang_muc ilike '%nhiệt nhôm%';

update public.bao_cao_ngay_cong_viec cv
set cong_viec_id = dm.id
from public.danh_muc_cong_viec_bao_cao dm
where cv.cong_viec_id is null
  and dm.ma = 'HAN-CGM-TUYEN'
  and cv.hang_muc ilike '%giáp mép%tuyến%';

update public.bao_cao_ngay_cong_viec cv
set cong_viec_id = dm.id
from public.danh_muc_cong_viec_bao_cao dm
where cv.cong_viec_id is null
  and dm.ma = 'HAN-CGM-BAI'
  and (cv.hang_muc ilike '%giáp mép%bãi%' or cv.hang_muc ilike '%giáp mép%bai%');

-- ------------------------------------------------------------
-- 3. RLS + grants
-- ------------------------------------------------------------
alter table public.danh_muc_cong_viec_bao_cao enable row level security;

drop policy if exists "authenticated_all_danh_muc_cong_viec_bao_cao" on public.danh_muc_cong_viec_bao_cao;
create policy "authenticated_all_danh_muc_cong_viec_bao_cao"
  on public.danh_muc_cong_viec_bao_cao for all to authenticated
  using (true) with check (true);

drop policy if exists "anon_all_danh_muc_cong_viec_bao_cao" on public.danh_muc_cong_viec_bao_cao;
create policy "anon_all_danh_muc_cong_viec_bao_cao"
  on public.danh_muc_cong_viec_bao_cao for all to anon
  using (true) with check (true);

grant select, insert, update, delete on public.danh_muc_cong_viec_bao_cao to anon, authenticated;

notify pgrst, 'reload schema';
