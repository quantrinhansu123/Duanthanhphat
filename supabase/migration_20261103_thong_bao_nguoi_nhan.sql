-- Thông báo gửi đúng người: nguoi_nhan = danh sách tên gọi bỏ dấu, chữ thường (vd 'phuc,thanh,tien').
-- Để trống = mọi người đều thấy.
alter table public.thong_bao add column if not exists nguoi_nhan text not null default '';
comment on column public.thong_bao.nguoi_nhan is 'Tên gọi người nhận (từ cuối họ tên, bỏ dấu, thường), cách nhau dấu phẩy; trống = tất cả';
notify pgrst, 'reload schema';
