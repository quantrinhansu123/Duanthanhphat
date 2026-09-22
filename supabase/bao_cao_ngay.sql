-- ============================================================
-- Báo cáo công việc ngày
-- Chạy sau: schema.sql (cần public.du_an, public.set_updated_at)
-- Có thể chạy lại an toàn (idempotent).
-- ============================================================

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 1. Phiếu báo cáo ngày (header)
-- ------------------------------------------------------------
create table if not exists public.bao_cao_ngay (
  id              uuid primary key default gen_random_uuid(),
  ngay_bao_cao    date not null default current_date,
  ngay_tiep_theo  date,
  du_an_id        uuid references public.du_an (id) on delete set null,
  nguoi_lap       text,
  ghi_chu         text,
  trang_thai      text not null default 'Nháp'
                  check (trang_thai in ('Nháp', 'Đã gửi', 'Đã duyệt')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.bao_cao_ngay is
  'Phiếu báo cáo công việc ngày — header (ngày, dự án, trạng thái)';
comment on column public.bao_cao_ngay.ngay_bao_cao is 'Ngày báo cáo';
comment on column public.bao_cao_ngay.ngay_tiep_theo is 'Ngày kế hoạch công việc phần B';
comment on column public.bao_cao_ngay.trang_thai is 'Nháp / Đã gửi / Đã duyệt';

-- Mỗi dự án tối đa 1 phiếu / ngày (du_an_id null = phiếu chung)
create unique index if not exists uq_bao_cao_ngay_ngay_du_an
  on public.bao_cao_ngay (ngay_bao_cao, coalesce(du_an_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists idx_bao_cao_ngay_ngay
  on public.bao_cao_ngay (ngay_bao_cao desc);

create index if not exists idx_bao_cao_ngay_du_an
  on public.bao_cao_ngay (du_an_id);

drop trigger if exists trg_bao_cao_ngay_updated_at on public.bao_cao_ngay;
create trigger trg_bao_cao_ngay_updated_at
  before update on public.bao_cao_ngay
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 2. Hạng mục công việc (A hôm nay / B ngày tiếp theo)
-- ------------------------------------------------------------
create table if not exists public.bao_cao_ngay_cong_viec (
  id                uuid primary key default gen_random_uuid(),
  bao_cao_id        uuid not null references public.bao_cao_ngay (id) on delete cascade,
  phan              text not null
                    check (phan in ('hom_nay', 'ngay_tiep_theo')),
  thu_tu            integer not null default 1 check (thu_tu >= 1),
  hang_muc          text not null default '',
  -- Vị trí
  tuyen_ha          text,
  tuyen_thuong      text,
  -- Năng suất
  don_vi            text,
  den_hom_qua       numeric(14, 2),
  hom_nay           numeric(14, 2),
  tich_luy          numeric(14, 2),
  thiet_ke          numeric(14, 2),
  -- Máy móc, thiết bị
  loai_may          text,
  may_bat_dau       text,   -- HH:MM hoặc text tự do
  may_ket_thuc      text,
  -- Nhân lực — chọn từ hồ sơ thợ hàn (nhan_su) theo chức vụ
  cht_id            uuid references public.nhan_su (employee_id) on delete set null,
  cht_ten           text,
  ky_su_id          uuid references public.nhan_su (employee_id) on delete set null,
  ky_su_ten         text,
  lai_may_id        uuid references public.nhan_su (employee_id) on delete set null,
  lai_may_ten       text,
  tho_van_hanh_id   uuid references public.nhan_su (employee_id) on delete set null,
  tho_van_hanh_ten  text,
  cong_nhan_id      uuid references public.nhan_su (employee_id) on delete set null,
  cong_nhan_ten     text,
  nl_bat_dau        text,
  nl_ket_thuc       text,
  ghi_chu           text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.bao_cao_ngay_cong_viec is
  'Chi tiết hạng mục công việc trong báo cáo ngày (phần A/B)';
comment on column public.bao_cao_ngay_cong_viec.phan is
  'hom_nay = A. Công việc ngày hôm nay; ngay_tiep_theo = B. Công việc ngày tiếp theo';

create index if not exists idx_bao_cao_ngay_cv_bao_cao
  on public.bao_cao_ngay_cong_viec (bao_cao_id, phan, thu_tu);

drop trigger if exists trg_bao_cao_ngay_cv_updated_at on public.bao_cao_ngay_cong_viec;
create trigger trg_bao_cao_ngay_cv_updated_at
  before update on public.bao_cao_ngay_cong_viec
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 3. Thiết bị sử dụng
-- ------------------------------------------------------------
create table if not exists public.bao_cao_ngay_thiet_bi (
  id              uuid primary key default gen_random_uuid(),
  bao_cao_id      uuid not null references public.bao_cao_ngay (id) on delete cascade,
  thu_tu          integer not null default 1 check (thu_tu >= 1),
  ten_thiet_bi    text not null default '',
  so_luong        numeric(12, 2),
  ghi_chu         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.bao_cao_ngay_thiet_bi is
  'Thiết bị sử dụng trong ngày báo cáo';

create index if not exists idx_bao_cao_ngay_tb_bao_cao
  on public.bao_cao_ngay_thiet_bi (bao_cao_id, thu_tu);

drop trigger if exists trg_bao_cao_ngay_tb_updated_at on public.bao_cao_ngay_thiet_bi;
create trigger trg_bao_cao_ngay_tb_updated_at
  before update on public.bao_cao_ngay_thiet_bi
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 4. Sự cố — Khó khăn — Vướng mắc
-- ------------------------------------------------------------
create table if not exists public.bao_cao_ngay_su_co (
  id                uuid primary key default gen_random_uuid(),
  bao_cao_id        uuid not null references public.bao_cao_ngay (id) on delete cascade,
  thu_tu            integer not null default 1 check (thu_tu >= 1),
  noi_dung          text not null default '',
  phuong_an_xu_ly   text,
  tinh_trang_xu_ly  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.bao_cao_ngay_su_co is
  'Sự cố / khó khăn / vướng mắc kèm phương án và tình trạng xử lý';

create index if not exists idx_bao_cao_ngay_sc_bao_cao
  on public.bao_cao_ngay_su_co (bao_cao_id, thu_tu);

drop trigger if exists trg_bao_cao_ngay_sc_updated_at on public.bao_cao_ngay_su_co;
create trigger trg_bao_cao_ngay_sc_updated_at
  before update on public.bao_cao_ngay_su_co
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 5. View tổng hợp 1 phiếu (tiện query / báo cáo)
-- ------------------------------------------------------------
create or replace view public.v_bao_cao_ngay_tom_tat as
select
  bc.id,
  bc.ngay_bao_cao,
  bc.ngay_tiep_theo,
  bc.du_an_id,
  da.du_an as ten_du_an,
  bc.nguoi_lap,
  bc.trang_thai,
  bc.ghi_chu,
  (select count(*)::int from public.bao_cao_ngay_cong_viec cv
    where cv.bao_cao_id = bc.id and cv.phan = 'hom_nay') as so_hang_muc_hom_nay,
  (select count(*)::int from public.bao_cao_ngay_cong_viec cv
    where cv.bao_cao_id = bc.id and cv.phan = 'ngay_tiep_theo') as so_hang_muc_tiep_theo,
  (select count(*)::int from public.bao_cao_ngay_thiet_bi tb
    where tb.bao_cao_id = bc.id) as so_thiet_bi,
  (select count(*)::int from public.bao_cao_ngay_su_co sc
    where sc.bao_cao_id = bc.id) as so_su_co,
  bc.created_at,
  bc.updated_at
from public.bao_cao_ngay bc
left join public.du_an da on da.id = bc.du_an_id;

comment on view public.v_bao_cao_ngay_tom_tat is
  'Tóm tắt phiếu báo cáo ngày kèm số dòng từng phần';

-- ------------------------------------------------------------
-- 6. RLS + grants (dev: anon + authenticated)
-- ------------------------------------------------------------
alter table public.bao_cao_ngay enable row level security;
alter table public.bao_cao_ngay_cong_viec enable row level security;
alter table public.bao_cao_ngay_thiet_bi enable row level security;
alter table public.bao_cao_ngay_su_co enable row level security;

drop policy if exists "authenticated_all_bao_cao_ngay" on public.bao_cao_ngay;
create policy "authenticated_all_bao_cao_ngay"
  on public.bao_cao_ngay for all to authenticated
  using (true) with check (true);

drop policy if exists "anon_all_bao_cao_ngay" on public.bao_cao_ngay;
create policy "anon_all_bao_cao_ngay"
  on public.bao_cao_ngay for all to anon
  using (true) with check (true);

drop policy if exists "authenticated_all_bao_cao_ngay_cong_viec" on public.bao_cao_ngay_cong_viec;
create policy "authenticated_all_bao_cao_ngay_cong_viec"
  on public.bao_cao_ngay_cong_viec for all to authenticated
  using (true) with check (true);

drop policy if exists "anon_all_bao_cao_ngay_cong_viec" on public.bao_cao_ngay_cong_viec;
create policy "anon_all_bao_cao_ngay_cong_viec"
  on public.bao_cao_ngay_cong_viec for all to anon
  using (true) with check (true);

drop policy if exists "authenticated_all_bao_cao_ngay_thiet_bi" on public.bao_cao_ngay_thiet_bi;
create policy "authenticated_all_bao_cao_ngay_thiet_bi"
  on public.bao_cao_ngay_thiet_bi for all to authenticated
  using (true) with check (true);

drop policy if exists "anon_all_bao_cao_ngay_thiet_bi" on public.bao_cao_ngay_thiet_bi;
create policy "anon_all_bao_cao_ngay_thiet_bi"
  on public.bao_cao_ngay_thiet_bi for all to anon
  using (true) with check (true);

drop policy if exists "authenticated_all_bao_cao_ngay_su_co" on public.bao_cao_ngay_su_co;
create policy "authenticated_all_bao_cao_ngay_su_co"
  on public.bao_cao_ngay_su_co for all to authenticated
  using (true) with check (true);

drop policy if exists "anon_all_bao_cao_ngay_su_co" on public.bao_cao_ngay_su_co;
create policy "anon_all_bao_cao_ngay_su_co"
  on public.bao_cao_ngay_su_co for all to anon
  using (true) with check (true);

grant select, insert, update, delete on public.bao_cao_ngay to anon, authenticated;
grant select, insert, update, delete on public.bao_cao_ngay_cong_viec to anon, authenticated;
grant select, insert, update, delete on public.bao_cao_ngay_thiet_bi to anon, authenticated;
grant select, insert, update, delete on public.bao_cao_ngay_su_co to anon, authenticated;
grant select on public.v_bao_cao_ngay_tom_tat to anon, authenticated;
