-- Cột mối hàn liên kết (text) cho nhật ký hàn — chạy sau lich_su_moi_han.sql

alter table public.lich_su_moi_han
  add column if not exists moi_han_lien_ket text;

comment on column public.lich_su_moi_han.moi_han_lien_ket is
  'Mã/tên mối hàn lỗi được liên kết (nhật ký hàn)';

create or replace view public.bao_cao_moi_han_theo_du_an
with (security_invoker = true)
as
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
  ls.moi_han_lien_ket
from public.lich_su_moi_han ls
join public.du_an da on da.id = ls.du_an_id
join public.nhan_su ns on ns.employee_id = ls.tho_han_id;
