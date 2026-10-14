-- ============================================================
-- Nhật ký hàn: mã hiện trường + giờ làm (từ giờ → đến giờ)
-- Chạy trong: Supabase Dashboard → SQL Editor (có thể chạy lại an toàn).
-- Chạy sau: migration_20261011_nhat_ky_han_gio_ten_theo_may.sql
-- ============================================================

alter table public.lich_su_moi_han
  add column if not exists ma_hien_truong text;

alter table public.lich_su_moi_han
  add column if not exists gio_bat_dau time;

alter table public.lich_su_moi_han
  add column if not exists gio_ket_thuc time;

comment on column public.lich_su_moi_han.ma_hien_truong is
  'Mã mối hàn đánh dấu ngoài hiện trường.';
comment on column public.lich_su_moi_han.gio_bat_dau is
  'Giờ bắt đầu làm của ca hàn.';
comment on column public.lich_su_moi_han.gio_ket_thuc is
  'Giờ kết thúc làm; nhỏ hơn giờ bắt đầu nghĩa là qua đêm.';
comment on column public.lich_su_moi_han.ten_moi_han_theo_may is
  'Mã theo máy: mã mối hàn ghi trên máy hàn, nhập tay khi khác mã mặc định.';

-- View chỉ được THÊM cột ở CUỐI (tránh lỗi 42P16).
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
  ls.ma_khuyet_tat,
  ls.tinh_trang_thi_nghiem,
  ls.created_at,
  ls.anh_moi_han_lien_ket,
  ls.ca_han,
  ls.gio_han,
  ls.ten_moi_han_theo_may,
  ls.ma_hien_truong,
  ls.gio_bat_dau,
  ls.gio_ket_thuc
from public.lich_su_moi_han ls
join public.du_an da on da.id = ls.du_an_id
join public.nhan_su ns on ns.employee_id = ls.tho_han_id
left join public.thiet_bi tb on tb.id = ls.may_id;

grant select on public.bao_cao_moi_han_theo_du_an to anon, authenticated;

notify pgrst, 'reload schema';
