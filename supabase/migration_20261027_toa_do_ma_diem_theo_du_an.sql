-- ============================================================
-- Mã tọa độ (HT/HP/TT/TP + số) chạy 1→n riêng cho từng tuyến (dự án).
-- Trước: unique (ma_diem) toàn hệ thống → 2 dự án không thể cùng HT0001.
-- Sau:   unique (du_an_id, ma_diem), NULLS NOT DISTINCT (điểm chưa gán dự án vẫn không được trùng mã).
-- Chạy trong: Supabase Dashboard → SQL Editor (idempotent, cần Postgres 15+).
-- ============================================================

alter table public.toa_do drop constraint if exists toa_do_ma_diem_unique;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'toa_do_du_an_ma_diem_unique' and conrelid = 'public.toa_do'::regclass
  ) then
    alter table public.toa_do
      add constraint toa_do_du_an_ma_diem_unique unique nulls not distinct (du_an_id, ma_diem);
  end if;
end $$;

comment on column public.toa_do.ma_diem is
  'Mã Autolisp: HT hạ trái, HP hạ phải, TT thượng trái, TP thượng phải + số TT (vd HT0001). Số chạy 1→n theo từng dự án (tuyến) + dải ray.';

comment on column public.lich_su_moi_han.ten_moi_han_theo_may is
  'Mã trong máy: DD-MM-YY-xxxx (mọi máy), TT 1→hết ngày, reset mỗi ngày.';

notify pgrst, 'reload schema';
