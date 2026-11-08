-- Phiếu tách (hình học / siêu âm): lưu thông tin in phiếu như RFI chính
-- (địa điểm, bên mời, bên nhận, phạm vi, tuyến thượng/hạ, giờ bắt đầu). Chạy lại nhiều lần cũng không sao.
begin;

alter table public.phieu_nt_tach add column if not exists thong_tin jsonb not null default '{}'::jsonb;

notify pgrst,'reload schema';
commit;
