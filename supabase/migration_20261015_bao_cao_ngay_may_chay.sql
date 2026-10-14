-- ============================================================
-- Báo cáo ngày: nhiều máy / 1 hạng mục, mỗi máy có giờ bắt đầu – giờ kết thúc
-- Chạy trong: Supabase Dashboard → SQL Editor (có thể chạy lại an toàn).
-- Chạy sau: bao_cao_ngay.sql
-- ============================================================

alter table public.bao_cao_ngay_cong_viec
  add column if not exists may_chay jsonb not null default '[]'::jsonb;

comment on column public.bao_cao_ngay_cong_viec.may_chay is
  'Danh sách máy chọn từ nhật ký chạy máy: [{may_id, ma_may, ten_may, so_luong, gio_bat_dau, gio_ket_thuc}]. loai_may / may_bat_dau / may_ket_thuc giữ máy đầu tiên cho dữ liệu cũ.';

notify pgrst, 'reload schema';
