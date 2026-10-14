-- ============================================================
-- Danh mục chứng chỉ: nhà cung cấp + loại dây hàn
-- Chạy trong: Supabase Dashboard → SQL Editor (có thể chạy lại an toàn).
-- ============================================================

alter table public.chung_chi_nhom
  add column if not exists nha_cung_cap text;

alter table public.chung_chi_nhom
  add column if not exists loai_day_han text;

comment on column public.chung_chi_nhom.nha_cung_cap is
  'Nhà cung cấp gắn với loại chứng chỉ (hiện tóm tắt dưới tên chứng chỉ).';
comment on column public.chung_chi_nhom.loai_day_han is
  'Loại dây hàn gắn với loại chứng chỉ (hiện tóm tắt dưới tên chứng chỉ).';

notify pgrst, 'reload schema';
