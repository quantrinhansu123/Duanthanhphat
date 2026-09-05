-- ============================================================
-- Đổi "Lý trình" (từ/đến Km) trong lịch chạy máy thành "Vị trí" (1 trường duy nhất).
-- Chạy sau: lich_chay_may.sql
-- Có thể chạy lại an toàn.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Thêm cột vị trí, gộp dữ liệu lý trình cũ (nếu có) làm giá trị khởi tạo.
-- ------------------------------------------------------------
alter table public.nhat_ky_chay_may
  add column if not exists vi_tri text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'nhat_ky_chay_may'
      and column_name = 'ly_trinh_tu'
  ) then
    update public.nhat_ky_chay_may
    set vi_tri = coalesce(
      nullif(btrim(vi_tri), ''),
      nullif(btrim(concat_ws(' → ', nullif(btrim(ly_trinh_tu), ''), nullif(btrim(ly_trinh_den), ''))), '')
    )
    where nullif(btrim(vi_tri), '') is null;
  end if;
end;
$$;

update public.nhat_ky_chay_may
set vi_tri = 'Chưa cập nhật'
where nullif(btrim(vi_tri), '') is null;

alter table public.nhat_ky_chay_may
  alter column vi_tri set not null;

-- ------------------------------------------------------------
-- 2. Cập nhật view báo cáo lịch chạy máy TRƯỚC (view cũ còn tham chiếu
--    ly_trinh_tu/ly_trinh_den nên phải gỡ phụ thuộc trước khi drop cột).
-- ------------------------------------------------------------
drop view if exists public.bao_cao_lich_chay_may;

create view public.bao_cao_lich_chay_may
with (security_invoker = true)
as
select
  nk.id,
  nk.ngay,
  tb.id as may_id,
  tb.ma_may,
  tb.ten_may,
  nk.vi_tri,
  nk.so_gio_hoat_dong,
  da.id as du_an_id,
  da.ma_du_an,
  da.du_an,
  ns.employee_id as nguoi_phu_trach_id,
  ns.ma_nhan_su,
  ns.ho_ten as nguoi_phu_trach,
  nk.created_at,
  nk.updated_at,
  ns.to_han
from public.nhat_ky_chay_may nk
join public.thiet_bi tb on tb.id = nk.may
join public.du_an da on da.id = nk.du_an
join public.nhan_su ns on ns.employee_id = nk.nguoi_phu_trach;

grant select on public.bao_cao_lich_chay_may to anon, authenticated;

-- ------------------------------------------------------------
-- 3. Bỏ ràng buộc và cột lý trình cũ.
-- ------------------------------------------------------------
alter table public.nhat_ky_chay_may
  drop constraint if exists nhat_ky_chay_may_ly_trinh_check;

alter table public.nhat_ky_chay_may
  drop column if exists ly_trinh_tu,
  drop column if exists ly_trinh_den;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nhat_ky_chay_may_vi_tri_check'
      and conrelid = 'public.nhat_ky_chay_may'::regclass
  ) then
    alter table public.nhat_ky_chay_may
      add constraint nhat_ky_chay_may_vi_tri_check
      check (btrim(vi_tri) <> '');
  end if;
end;
$$;

comment on column public.nhat_ky_chay_may.vi_tri is 'Vị trí máy chạy (VD: Hà Nội, ga Đà Nẵng)';

notify pgrst, 'reload schema';
