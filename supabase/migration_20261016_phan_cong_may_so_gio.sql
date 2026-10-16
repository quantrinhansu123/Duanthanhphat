-- ============================================================
-- Lịch chạy máy: lưu tổng giờ hoạt động (ưu tiên giờ thực tế từ nhật ký)
-- Chạy trong: Supabase Dashboard → SQL Editor (có thể chạy lại an toàn).
-- ============================================================

alter table public.phan_cong_may
  add column if not exists so_gio_hoat_dong numeric(10, 2);

comment on column public.phan_cong_may.so_gio_hoat_dong is
  'Tổng giờ hoạt động: cộng giờ thực tế từ nhật ký (gio_bat_dau/gio_ket_thuc); thiếu giờ thì ước 8h/ca.';

notify pgrst, 'reload schema';
