-- Ảnh phụ tùng thay thế (URL Cloudinary). Chạy trong Supabase SQL Editor (idempotent).
alter table public.phu_tung_thay_the add column if not exists anh_url text not null default '';
notify pgrst, 'reload schema';
