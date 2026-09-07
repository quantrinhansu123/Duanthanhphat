-- Bổ sung quyền cho database đã chạy migration metadata QLCL ngày 06/09/2026.
-- Client anon/authenticated vẫn không thể truy cập trực tiếp; chỉ Route Handler
-- dùng SUPABASE_SERVICE_ROLE_KEY được phép thao tác hai bảng này.

revoke all on public.chung_chi_qlcl_cong_ty from anon, authenticated;
revoke all on public.danh_gia_tieu_chuan_qlcl from anon, authenticated;

grant select, insert, update, delete on public.chung_chi_qlcl_cong_ty to service_role;
grant select, insert, update, delete on public.danh_gia_tieu_chuan_qlcl to service_role;
