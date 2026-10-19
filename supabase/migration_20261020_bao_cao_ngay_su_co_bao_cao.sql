-- ============================================================
-- Báo cáo ngày · sự cố: Người báo cáo + Bộ phận báo cáo
-- Chạy trong: Supabase Dashboard → SQL Editor (có thể chạy lại an toàn).
-- ============================================================

alter table public.bao_cao_ngay_su_co
  add column if not exists nguoi_bao_cao text,
  add column if not exists bo_phan_bao_cao text;

comment on column public.bao_cao_ngay_su_co.nguoi_bao_cao is
  'Người báo cáo sự cố / khó khăn / vướng mắc';

comment on column public.bao_cao_ngay_su_co.bo_phan_bao_cao is
  'Bộ phận báo cáo sự cố / khó khăn / vướng mắc';

notify pgrst, 'reload schema';
