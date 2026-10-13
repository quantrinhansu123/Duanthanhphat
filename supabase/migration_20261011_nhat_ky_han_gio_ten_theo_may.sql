-- ============================================================
-- Nhật ký hàn: giờ hàn + tên mối hàn theo máy
-- Báo cáo ngày: tên mối hàn + máy hàn ray liên kết danh mục máy
-- Chạy trong: Supabase Dashboard → SQL Editor (có thể chạy lại an toàn).
-- Chạy sau: migration_20260924_ca_han_nhat_ky_han.sql
-- ============================================================

-- 1. Nhật ký hàn
alter table public.lich_su_moi_han
  add column if not exists gio_han time;

alter table public.lich_su_moi_han
  add column if not exists ten_moi_han_theo_may text;

comment on column public.lich_su_moi_han.gio_han is
  'Giờ thực hiện mối hàn (kết hợp ngay_thuc_hien để sắp xếp theo thời gian hàn).';
comment on column public.lich_su_moi_han.ten_moi_han_theo_may is
  'Tên/mã mối hàn ghi trên máy hàn, nhập tay khi khác mã mặc định.';

create index if not exists idx_lich_su_moi_han_ngay_gio
  on public.lich_su_moi_han (ngay_thuc_hien desc nulls last, gio_han desc nulls last);

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
  ls.ten_moi_han_theo_may
from public.lich_su_moi_han ls
join public.du_an da on da.id = ls.du_an_id
join public.nhan_su ns on ns.employee_id = ls.tho_han_id
left join public.thiet_bi tb on tb.id = ls.may_id;

grant select on public.bao_cao_moi_han_theo_du_an to anon, authenticated;

-- 2. Báo cáo ngày
alter table public.bao_cao_ngay_cong_viec
  add column if not exists ten_moi_han text;

alter table public.bao_cao_ngay_cong_viec
  add column if not exists may_id uuid references public.thiet_bi (id) on delete set null;

comment on column public.bao_cao_ngay_cong_viec.ten_moi_han is
  'Tên/mã mối hàn thực hiện trong hạng mục công việc.';
comment on column public.bao_cao_ngay_cong_viec.may_id is
  'Máy hàn ray chọn từ danh mục thiết bị (loai_may giữ tên hiển thị).';

notify pgrst, 'reload schema';
