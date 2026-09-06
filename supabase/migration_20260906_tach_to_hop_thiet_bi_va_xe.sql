-- ==============================================================================
-- Migration: Tách tổ hợp máy hàn thành 2 phần: Máy hàn & Phương tiện vận chuyển
-- Ngày tạo: 06/09/2026
-- Mục đích: Bổ sung các trường JSONB lưu riêng thông số máy hàn và xe vận chuyển
--           đảm bảo tương thích ngược 100% với dữ liệu cũ trong thiet_bi
-- ==============================================================================

alter table if exists public.thiet_bi
  add column if not exists thong_so_may_han jsonb default null,
  add column if not exists phuong_tien_van_chuyen jsonb default null;

comment on column public.thiet_bi.thong_so_may_han is 'Thông số kỹ thuật & ảnh riêng của phần máy hàn trong tổ hợp';
comment on column public.thiet_bi.phuong_tien_van_chuyen is 'Thông số kỹ thuật, biển số & ảnh riêng của phương tiện vận chuyển/xe';
