-- ==============================================================================
-- Migration: Bổ sung mã khuyết tật mối hàn chuẩn NDT (Ảnh 11)
-- Ngày tạo: 06/09/2026
-- Mã khuyết tật chuẩn: LOF, LOP, C, S, Po, La
-- ==============================================================================

alter table if exists public.lich_su_moi_han
  add column if not exists ma_khuyet_tat text[] default null;

comment on column public.lich_su_moi_han.ma_khuyet_tat is 'Mảng mã khuyết tật NDT: LOF (Lack of fusion), LOP (Lack of Penetration), C (Crack), S (Slag), Po (Porosity), La (Lamination)';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lich_su_moi_han_ma_khuyet_tat_hop_le'
      and conrelid = 'public.lich_su_moi_han'::regclass
  ) then
    alter table public.lich_su_moi_han
      add constraint lich_su_moi_han_ma_khuyet_tat_hop_le
      check (
        ma_khuyet_tat is null
        or ma_khuyet_tat <@ array['LOF', 'LOP', 'C', 'S', 'Po', 'La']::text[]
      );
  end if;
end
$$;

create index if not exists idx_lich_su_moi_han_ma_khuyet_tat
  on public.lich_su_moi_han using gin (ma_khuyet_tat)
  where ma_khuyet_tat is not null;

-- Bọc RPC tạo nhật ký/GPS hiện có để việc ghi mã NDT nằm trong cùng một
-- transaction. Nếu mã không hợp lệ hoặc update thất bại, bản ghi nhật ký và
-- điểm GPS do RPC bên trong tạo ra cũng được rollback.
create or replace function public.them_nhat_ky_han_co_toa_do_ndt(
  p_ma_lich_su text,
  p_du_an_id uuid,
  p_tho_han_id uuid,
  p_nam_thuc_hien smallint,
  p_ngay_thuc_hien date,
  p_loai_ray text,
  p_loai_moi_han text,
  p_cong_nghe_han text,
  p_so_luong_loi integer,
  p_nguyen_nhan_loi text,
  p_ghi_chu text,
  p_moi_han_lien_ket text,
  p_may_id uuid,
  p_chung_chi_su_dung text,
  p_hach_toan text,
  p_toa_do_id uuid default null,
  p_kinh_do double precision default null,
  p_vi_do double precision default null,
  p_ly_trinh text default null,
  p_ma_khuyet_tat text[] default null
)
returns uuid
language plpgsql
as $$
declare
  weld_id uuid;
begin
  weld_id := public.them_nhat_ky_han_co_toa_do(
    p_ma_lich_su,
    p_du_an_id,
    p_tho_han_id,
    p_nam_thuc_hien,
    p_ngay_thuc_hien,
    p_loai_ray,
    p_loai_moi_han,
    p_cong_nghe_han,
    p_so_luong_loi,
    p_nguyen_nhan_loi,
    p_ghi_chu,
    p_moi_han_lien_ket,
    p_may_id,
    p_chung_chi_su_dung,
    p_hach_toan,
    p_toa_do_id,
    p_kinh_do,
    p_vi_do,
    p_ly_trinh
  );

  update public.lich_su_moi_han
  set ma_khuyet_tat = case
    when coalesce(cardinality(p_ma_khuyet_tat), 0) = 0 then null
    else p_ma_khuyet_tat
  end
  where id = weld_id;

  if not found then
    raise exception 'Không tìm thấy nhật ký vừa tạo % để lưu mã NDT', weld_id;
  end if;

  return weld_id;
end;
$$;

revoke execute on function public.them_nhat_ky_han_co_toa_do_ndt(
  text, uuid, uuid, smallint, date, text, text, text, integer, text, text, text,
  uuid, text, text, uuid, double precision, double precision, text, text[]
) from public;
grant execute on function public.them_nhat_ky_han_co_toa_do_ndt(
  text, uuid, uuid, smallint, date, text, text, text, integer, text, text, text,
  uuid, text, text, uuid, double precision, double precision, text, text[]
) to anon, authenticated;

-- Giữ nguyên thứ tự/cấu trúc view cũ và chỉ nối thêm cột mới ở cuối để
-- CREATE OR REPLACE VIEW chạy được trên cơ sở dữ liệu đang vận hành.
create or replace view public.bao_cao_moi_han_theo_du_an with (security_invoker = true) as
select
  ls.id,
  ls.ma_lich_su,
  da.id as du_an_id,
  da.ma_du_an,
  da.du_an,
  ls.nam_thuc_hien,
  ls.loai_ray,
  ls.loai_moi_han,
  ls.cong_nghe_han,
  ls.so_luong_thuc_hien,
  ls.so_luong_loi,
  ns.employee_id as tho_han_id,
  ns.ma_nhan_su,
  ns.ho_ten as ten_tho_han,
  ls.nguyen_nhan_loi,
  ls.nguon_du_lieu,
  ls.dong_nguon,
  ls.ghi_chu,
  ls.moi_han_lien_ket,
  tb.id as may_id,
  tb.ma_may,
  tb.ten_may,
  ns.to_han,
  ns.chung_chi as chung_chi_nhan_su,
  ls.chung_chi_su_dung,
  ls.ngay_thuc_hien,
  ls.chung_chi_id,
  ls.hach_toan,
  ls.ma_khuyet_tat
from public.lich_su_moi_han ls
join public.du_an da on da.id = ls.du_an_id
join public.nhan_su ns on ns.employee_id = ls.tho_han_id
left join public.thiet_bi tb on tb.id = ls.may_id;

grant select on public.bao_cao_moi_han_theo_du_an to anon, authenticated;
