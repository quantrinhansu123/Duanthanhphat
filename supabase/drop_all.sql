-- ============================================================
-- Xóa toàn bộ bảng cũ trong schema public (Supabase)
-- Chạy trong: SQL Editor → New query → Run
-- ============================================================

-- Bảng demo cũ (categories ← tasks)
drop table if exists public.tasks cascade;
drop table if exists public.categories cascade;

-- Schema nhân sự / hàn ray
drop table if exists public.nhan_su_du_an cascade;
drop table if exists public.chung_chi cascade;
drop table if exists public.dao_tao cascade;
drop table if exists public.thong_so_moi_han cascade;
drop table if exists public.nhat_ky_chay_may cascade;
drop table if exists public.thiet_bi cascade;
drop table if exists public.du_an cascade;
drop table if exists public.nhan_su cascade;

-- Function helper (nếu có)
drop function if exists public.set_updated_at() cascade;
