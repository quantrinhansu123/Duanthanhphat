-- ============================================================
-- Đồng bộ Autolisp: 4 dải mã điểm HT / HP / TT / TP
-- Chạy trong: Supabase Dashboard → SQL Editor (idempotent).
-- ============================================================

comment on column public.toa_do.ma_diem is
  'Mã Autolisp: HT hạ trái, HP hạ phải, TT thượng trái, TP thượng phải + số TT (vd HT0001, TT0166).';

comment on column public.lich_su_moi_han.ma_hien_truong is
  'Mã sơn bụng ray / hiện trường: {CN}-{DD}-{MM}-{YY}-{xxxx} (vd FBW-25-10-26-0001).';

comment on column public.lich_su_moi_han.ten_moi_han_theo_may is
  'Mã trong máy: UN5 = YYYY-M-D-xxx (reset ngày); K922 = số TT cộng dồn; khác = DD-MM-YY-xxxx.';

-- Sequence riêng theo từng dải Autolisp (giữ toa_do_ma_diem_seq = TT cho tương thích RPC cũ).
create sequence if not exists public.toa_do_ma_diem_ht_seq;
create sequence if not exists public.toa_do_ma_diem_hp_seq;
create sequence if not exists public.toa_do_ma_diem_tt_seq;
create sequence if not exists public.toa_do_ma_diem_tp_seq;

do $$
declare
  max_ht bigint;
  max_hp bigint;
  max_tt bigint;
  max_tp bigint;
begin
  select coalesce(max(substring(ma_diem from '^HT([0-9]+)$')::bigint), 0)
  into max_ht from public.toa_do where ma_diem ~ '^HT[0-9]+$';
  select coalesce(max(substring(ma_diem from '^HP([0-9]+)$')::bigint), 0)
  into max_hp from public.toa_do where ma_diem ~ '^HP[0-9]+$';
  select coalesce(max(substring(ma_diem from '^TT([0-9]+)$')::bigint), 0)
  into max_tt from public.toa_do where ma_diem ~ '^TT[0-9]+$';
  select coalesce(max(substring(ma_diem from '^TP([0-9]+)$')::bigint), 0)
  into max_tp from public.toa_do where ma_diem ~ '^TP[0-9]+$';

  if max_ht > 0 then
    perform setval('public.toa_do_ma_diem_ht_seq', max_ht, true);
  end if;
  if max_hp > 0 then
    perform setval('public.toa_do_ma_diem_hp_seq', max_hp, true);
  end if;
  if max_tt > 0 then
    perform setval('public.toa_do_ma_diem_tt_seq', max_tt, true);
    perform setval('public.toa_do_ma_diem_seq', max_tt, true);
  end if;
  if max_tp > 0 then
    perform setval('public.toa_do_ma_diem_tp_seq', max_tp, true);
  end if;
end $$;

create or replace function public.next_toa_do_ma_diem(p_prefix text default 'TT')
returns text
language plpgsql
as $$
declare
  prefix text := upper(btrim(coalesce(p_prefix, 'TT')));
  next_no bigint;
begin
  if prefix not in ('HT', 'HP', 'TT', 'TP') then
    raise exception 'Tiền tố Autolisp không hợp lệ: % (chỉ HT/HP/TT/TP)', prefix;
  end if;

  if prefix = 'HT' then
    next_no := nextval('public.toa_do_ma_diem_ht_seq');
  elsif prefix = 'HP' then
    next_no := nextval('public.toa_do_ma_diem_hp_seq');
  elsif prefix = 'TP' then
    next_no := nextval('public.toa_do_ma_diem_tp_seq');
  else
    next_no := nextval('public.toa_do_ma_diem_tt_seq');
  end if;

  return prefix || lpad(next_no::text, 4, '0');
end;
$$;

comment on function public.next_toa_do_ma_diem(text) is
  'Sinh mã Autolisp tiếp theo theo dải HT/HP/TT/TP.';

grant execute on function public.next_toa_do_ma_diem(text) to anon, authenticated;
grant usage, select on sequence public.toa_do_ma_diem_ht_seq to anon, authenticated;
grant usage, select on sequence public.toa_do_ma_diem_hp_seq to anon, authenticated;
grant usage, select on sequence public.toa_do_ma_diem_tt_seq to anon, authenticated;
grant usage, select on sequence public.toa_do_ma_diem_tp_seq to anon, authenticated;

create index if not exists idx_lich_su_moi_han_ma_hien_truong
  on public.lich_su_moi_han (ma_hien_truong);

create index if not exists idx_lich_su_moi_han_ten_moi_han_theo_may
  on public.lich_su_moi_han (ten_moi_han_theo_may);

notify pgrst, 'reload schema';
