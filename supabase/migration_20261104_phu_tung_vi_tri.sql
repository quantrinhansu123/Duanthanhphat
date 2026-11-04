-- ============================================================
-- Phụ tùng thay thế: 1 mã, tồn kho chia theo nhiều vị trí (kho / dự án).
-- Định dạng: [{"kind":"warehouse","id":"<id kho>","quantity":100}, {"kind":"project","id":"<id dự án>","quantity":400}]
-- Chạy trong: Supabase Dashboard → SQL Editor (idempotent).
-- ============================================================

alter table public.phu_tung_thay_the
  add column if not exists vi_tri_ton_kho jsonb not null default '[]'::jsonb;

comment on column public.phu_tung_thay_the.vi_tri_ton_kho is 'Tồn kho theo vị trí; khi có dữ liệu thì ton_kho = tổng số lượng các vị trí';

notify pgrst, 'reload schema';
