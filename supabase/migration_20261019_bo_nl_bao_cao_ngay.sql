-- Bỏ nhân lực bắt đầu / kết thúc khỏi hạng mục báo cáo ngày.
alter table public.bao_cao_ngay_cong_viec drop column if exists nl_bat_dau;
alter table public.bao_cao_ngay_cong_viec drop column if exists nl_ket_thuc;
