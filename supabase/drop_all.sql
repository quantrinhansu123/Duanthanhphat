-- ============================================================
-- Xóa toàn bộ bảng cũ trong schema public (Supabase)
-- Chạy trong: SQL Editor → New query → Run
-- ============================================================

-- Bảng demo cũ (categories ← tasks)
drop table if exists public.tasks cascade;
drop table if exists public.categories cascade;

-- Schema nhân sự / hàn ray
drop view if exists public.canh_bao_du_lieu_moi_han cascade;
drop view if exists public.bao_cao_may cascade;
drop view if exists public.bao_cao_lich_chay_may cascade;
drop view if exists public.bao_cao_moi_han_theo_du_an cascade;
drop view if exists public.bao_cao_moi_han_theo_tho cascade;
drop view if exists public.bao_cao_moi_han_theo_nam cascade;
drop view if exists public.bao_cao_ke_hoach_moi_han_theo_ngay cascade;
drop table if exists public.tong_moi_han_nam_loai_moi cascade;
drop table if exists public.tong_moi_han_nam_phuong_phap cascade;
drop table if exists public.tong_moi_han_nam_nhan_su cascade;
drop table if exists public.tong_moi_han_nam_du_an cascade;
drop table if exists public.tong_moi_han_nam cascade;
drop table if exists public.lich_su_moi_han cascade;
drop table if exists public.tai_lieu cascade;
drop table if exists public.toa_do cascade;
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
drop function if exists public.tao_ke_hoach_moi_han_theo_ngay() cascade;
drop function if exists public.kiem_tra_chung_chi_moi_han() cascade;
