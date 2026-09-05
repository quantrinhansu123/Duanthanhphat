-- ============================================================
-- Đổi "Lý trình" (từ/đến Km) của dự án thành "Vị trí" (1 trường duy nhất).
-- Chạy sau: schema.sql, du_an_tien_do_ly_thuyet.sql
-- Có thể chạy lại an toàn.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Thêm cột vị trí, gộp dữ liệu lý trình cũ (nếu có) làm giá trị khởi tạo.
-- ------------------------------------------------------------
alter table public.du_an
  add column if not exists vi_tri text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'du_an'
      and column_name = 'ly_trinh_tu'
  ) then
    update public.du_an
    set vi_tri = coalesce(
      nullif(btrim(vi_tri), ''),
      nullif(btrim(concat_ws(' → ', nullif(btrim(ly_trinh_tu), ''), nullif(btrim(ly_trinh_den), ''))), '')
    )
    where nullif(btrim(vi_tri), '') is null;
  end if;
end;
$$;

update public.du_an
set vi_tri = 'Chưa cập nhật'
where nullif(btrim(vi_tri), '') is null;

alter table public.du_an
  alter column vi_tri set default 'Chưa cập nhật',
  alter column vi_tri set not null;

-- ------------------------------------------------------------
-- 2. Cập nhật view tiến độ lý thuyết theo ngày TRƯỚC (view cũ còn tham
--    chiếu ly_trinh_tu/ly_trinh_den nên phải gỡ phụ thuộc trước khi drop cột).
-- ------------------------------------------------------------
drop view if exists public.bao_cao_ke_hoach_moi_han_theo_ngay;

create view public.bao_cao_ke_hoach_moi_han_theo_ngay
with (security_invoker = true)
as
select
  da.id as du_an_id,
  da.ma_du_an,
  da.du_an,
  da.vi_tri,
  da.ngay_bat_dau,
  da.ngay_ket_thuc,
  da.tong_moi_han_du_kien,
  (ke_hoach ->> 'ngay')::date as ngay,
  (ke_hoach ->> 'so_moi_han')::integer as so_moi_han_ke_hoach
from public.du_an da
cross join lateral jsonb_array_elements(da.tien_do_ly_thuyet) as ke_hoach;

grant select on public.bao_cao_ke_hoach_moi_han_theo_ngay to anon, authenticated;

-- ------------------------------------------------------------
-- 3. Bỏ cột lý trình cũ.
-- ------------------------------------------------------------
alter table public.du_an
  drop column if exists ly_trinh_tu,
  drop column if exists ly_trinh_den;

comment on column public.du_an.vi_tri is 'Vị trí của dự án (VD: Hà Nội, Đà Nẵng)';

notify pgrst, 'reload schema';
