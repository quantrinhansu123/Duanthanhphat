-- ============================================================
-- MIGRATION: TÌM KIẾM LỊCH SỬ HÀN KHÔNG DẤU & ĐA TỪ ĐỘC LẬP
-- Ngày tạo: 2026-09-06
-- Mục tiêu:
--  1. Tạo hàm f_unaccent chuyển đổi tiếng Việt có dấu sang không dấu
--  2. Bổ sung cột tim_kiem_khong_dau vào v_lich_su_moi_han_chi_tiet
--  3. Cập nhật RPC thong_ke_lich_su_moi_han để tìm kiếm không dấu
--     và tìm kiếm độc lập từng từ trong chuỗi tìm kiếm
-- ============================================================

-- 1. Kích hoạt extension unaccent nếu chưa có
create extension if not exists unaccent;

-- 2. Hàm chuẩn hóa bỏ dấu tiếng Việt chuẩn & tốc độ cao
create or replace function public.f_unaccent(text)
returns text
language sql
immutable
parallel safe
as $$
  select translate(
    lower(coalesce($1, '')),
    'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
  );
$$;

grant execute on function public.f_unaccent(text) to authenticated, anon;

-- 3. Cập nhật view v_lich_su_moi_han_chi_tiet
create or replace view public.v_lich_su_moi_han_chi_tiet with (security_invoker = true) as
select
  ls.id,
  ls.ma_lich_su,
  ls.ngay_thuc_hien,
  ls.nam_thuc_hien,
  ls.loai_ray,
  ls.loai_moi_han,
  ls.cong_nghe_han,
  ls.so_luong_thuc_hien,
  ls.so_luong_loi,
  ls.hach_toan,
  ls.moi_han_lien_ket,
  ls.ghi_chu,
  ls.tho_han_id,
  ns.ho_ten as ten_tho_han,
  ns.ma_nhan_su,
  ls.du_an_id,
  da.du_an as ten_du_an,
  da.ma_du_an,
  ls.may_id,
  tb.ma_may as ten_may,
  case
    when ls.ghi_chu ilike '%Kết quả: Sửa chữa%' or (coalesce(ls.so_luong_loi, 0) > 0 and (ls.ghi_chu ilike '%sửa chữa%' or ls.moi_han_lien_ket ilike 'SC-%')) then 'Sửa chữa'
    when ls.ghi_chu ilike '%Kết quả: Không đạt%' or (coalesce(ls.so_luong_loi, 0) > 0) then 'Không đạt'
    else 'Đạt'
  end as ket_qua,
  case
    when ls.ghi_chu ilike '%Ca 2%' then 'Ca 2'
    when ls.ghi_chu ilike '%Ca 3%' then 'Ca 3'
    else 'Ca 1'
  end as ca_han,
  public.f_unaccent(
    coalesce(ls.ma_lich_su, '') || ' ' ||
    coalesce(ls.moi_han_lien_ket, '') || ' ' ||
    coalesce(ls.ghi_chu, '') || ' ' ||
    coalesce(ns.ho_ten, '') || ' ' ||
    coalesce(ns.ma_nhan_su, '') || ' ' ||
    coalesce(da.du_an, '') || ' ' ||
    coalesce(da.ma_du_an, '') || ' ' ||
    coalesce(tb.ma_may, '') || ' ' ||
    coalesce(tb.ten_may, '') || ' ' ||
    coalesce(ls.hach_toan, '')
  ) as tim_kiem_khong_dau
from public.lich_su_moi_han ls
left join public.nhan_su ns on ns.employee_id = ls.tho_han_id
left join public.du_an da on da.id = ls.du_an_id
left join public.thiet_bi tb on tb.id = ls.may_id;

-- 4. Cập nhật RPC thong_ke_lich_su_moi_han
create or replace function public.thong_ke_lich_su_moi_han(
  p_date_from date default null,
  p_date_to date default null,
  p_welder text default null,
  p_result text default null,
  p_machines text[] default null,
  p_rails text[] default null,
  p_projects text[] default null,
  p_shifts text[] default null,
  p_accounting_codes text[] default null,
  p_query text default null
)
returns table (
  tong bigint,
  dat bigint,
  khong_dat bigint,
  sua_chua bigint,
  thong_ke_hach_toan jsonb
)
language sql
stable
as $$
  with filtered as (
    select *
    from public.v_lich_su_moi_han_chi_tiet row_data
    where (p_date_from is null or row_data.ngay_thuc_hien >= p_date_from)
      and (p_date_to is null or row_data.ngay_thuc_hien <= p_date_to)
      and (nullif(btrim(p_welder), '') is null or row_data.ten_tho_han = p_welder)
      and (nullif(btrim(p_result), '') is null or row_data.ket_qua = p_result)
      and (coalesce(cardinality(p_machines), 0) = 0 or row_data.ten_may = any(p_machines))
      and (coalesce(cardinality(p_rails), 0) = 0 or row_data.loai_ray = any(p_rails))
      and (coalesce(cardinality(p_projects), 0) = 0 or row_data.ten_du_an = any(p_projects))
      and (coalesce(cardinality(p_shifts), 0) = 0 or row_data.ca_han = any(p_shifts))
      and (coalesce(cardinality(p_accounting_codes), 0) = 0 or row_data.hach_toan = any(p_accounting_codes))
      and (
        nullif(btrim(p_query), '') is null
        or not exists (
          select 1
          from unnest(regexp_split_to_array(trim(public.f_unaccent(p_query)), '\s+')) as token
          where token <> '' and (
            row_data.tim_kiem_khong_dau is null
            or row_data.tim_kiem_khong_dau not like '%' || token || '%'
          )
        )
      )
  ),
  totals as (
    select
      count(*) as tong,
      count(*) filter (where ket_qua = 'Đạt') as dat,
      count(*) filter (where ket_qua = 'Không đạt') as khong_dat,
      count(*) filter (where ket_qua = 'Sửa chữa') as sua_chua
    from filtered
  ),
  accounting as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object('code', hach_toan, 'count', so_luong)
        order by so_luong desc, hach_toan
      ),
      '[]'::jsonb
    ) as payload
    from (
      select hach_toan, count(*) as so_luong
      from filtered
      where nullif(btrim(hach_toan), '') is not null
      group by hach_toan
    ) grouped
  )
  select totals.tong, totals.dat, totals.khong_dat, totals.sua_chua, accounting.payload
  from totals cross join accounting;
$$;

revoke execute on function public.thong_ke_lich_su_moi_han(date, date, text, text, text[], text[], text[], text[], text[], text) from public;
grant execute on function public.thong_ke_lich_su_moi_han(date, date, text, text, text[], text[], text[], text[], text[], text) to authenticated, anon;
