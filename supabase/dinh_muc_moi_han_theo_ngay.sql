-- Đã tắt. Mối hàn dự kiến của dự án độc lập với nhật ký hàn.
-- Không còn trigger ghi đè du_an.tien_do_ly_thuyet khi sửa lich_su_moi_han.
-- Chi tiết: supabase/migration_20261002_du_an_du_kien_doc_lap.sql

drop trigger if exists trg_dong_bo_dinh_muc_sau_insert on public.lich_su_moi_han;
drop trigger if exists trg_dong_bo_dinh_muc_sau_delete on public.lich_su_moi_han;
drop trigger if exists trg_dong_bo_dinh_muc_sau_update on public.lich_su_moi_han;
