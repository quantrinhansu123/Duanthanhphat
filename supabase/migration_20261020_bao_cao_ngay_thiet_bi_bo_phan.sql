-- ============================================================
-- Báo cáo ngày · thiết bị: Bộ phận + Người sử dụng
-- Chạy trong: Supabase Dashboard → SQL Editor (có thể chạy lại an toàn).
-- ============================================================

alter table public.bao_cao_ngay_thiet_bi
  add column if not exists bo_phan text,
  add column if not exists nguoi_su_dung text;

comment on column public.bao_cao_ngay_thiet_bi.bo_phan is
  'Bộ phận sử dụng thiết bị';

comment on column public.bao_cao_ngay_thiet_bi.nguoi_su_dung is
  'Người sử dụng thiết bị';

notify pgrst, 'reload schema';
