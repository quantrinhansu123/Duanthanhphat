-- Nhân sự: ảnh chữ ký (tải lên Cloudinary) để tự động ký trên biên bản nghiệm thu. Chạy lại nhiều lần cũng không sao.
begin;

alter table public.nhan_su add column if not exists chu_ky text;

notify pgrst,'reload schema';
commit;
