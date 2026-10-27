-- ============================================================
-- Nhật ký hàn: giờ nghỉ trưa nhập tay (giờ). Chỉ trừ khỏi giờ chạy máy, không in ra báo cáo nào.
-- Chạy trong: Supabase Dashboard → SQL Editor (idempotent).
-- ============================================================

alter table public.lich_su_moi_han
  add column if not exists gio_nghi_trua numeric(4,2) not null default 0
  check (gio_nghi_trua >= 0 and gio_nghi_trua <= 8);

comment on column public.lich_su_moi_han.gio_nghi_trua is
  'Giờ nghỉ trưa nhập tay (0–8). Giờ chạy máy = (gio_ket_thuc - gio_bat_dau) - gio_nghi_trua.';

notify pgrst, 'reload schema';
