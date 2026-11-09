-- Thanh toán theo mối hàn: tỷ lệ thanh toán (30 / 50 / 70 / 100 %, mặc định 100) + ghi chú.
-- Chạy lại nhiều lần cũng không sao.
alter table public.thanh_toan_moi_han
  add column if not exists ty_le integer not null default 100;
alter table public.thanh_toan_moi_han drop constraint if exists thanh_toan_moi_han_ty_le_check;
alter table public.thanh_toan_moi_han
  add constraint thanh_toan_moi_han_ty_le_check check (ty_le in (30, 50, 70, 100));
notify pgrst, 'reload schema';
