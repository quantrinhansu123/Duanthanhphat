-- =====================================================================
-- Bổ sung cột hạch toán (hach_toan) cho bảng public.lich_su_moi_han
-- Phục vụ quản lý, đối soát chi phí/hạng mục theo thợ hàn & mối hàn
-- =====================================================================

alter table public.lich_su_moi_han
  add column if not exists hach_toan text;

comment on column public.lich_su_moi_han.hach_toan is
  'Mã hạch toán chi phí hoặc nhóm hạng mục thực hiện (ví dụ: HT-SX01, HT-TN01, HT-SC01, HT-M01)';

-- Đánh index để hỗ trợ lọc và thống kê nhanh theo mã hạch toán
create index if not exists idx_lich_su_moi_han_hach_toan
  on public.lich_su_moi_han (hach_toan);
