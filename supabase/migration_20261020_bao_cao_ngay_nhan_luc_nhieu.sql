-- ============================================================
-- Báo cáo ngày: mỗi vai trò nhân lực chọn được nhiều người
-- Chạy trong: Supabase Dashboard → SQL Editor (có thể chạy lại an toàn).
-- ============================================================

alter table public.bao_cao_ngay_cong_viec
  add column if not exists nhan_luc jsonb not null default '{}'::jsonb;

comment on column public.bao_cao_ngay_cong_viec.nhan_luc is
  'Nhân lực nhiều người theo vai trò: {cht,ky_su,lai_may,tho_van_hanh,cong_nhan,thuc_hien:[{id,ten}]}. thuc_hien dùng cho Ngày tiếp theo. Các cột *_id/*_ten giữ người đầu tiên để tương thích.';

notify pgrst, 'reload schema';
