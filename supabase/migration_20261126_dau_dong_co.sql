-- Dầu động cơ trên báo cáo lịch chạy máy: số lít mỗi lần đổ và số giờ báo trên máy phát.
-- Dầu máy phát vẫn dùng cột do_them (số lít đã đổ). Mốc thay dầu động cơ: 275 giờ hoạt động.

begin;

alter table public.cap_dau_hang_ngay
  add column if not exists dau_dong_co numeric,
  add column if not exists gio_may_phat numeric;

comment on column public.cap_dau_hang_ngay.dau_dong_co is
  'Số lít dầu động cơ đổ trong ngày. Null = không đổ dầu động cơ.';
comment on column public.cap_dau_hang_ngay.gio_may_phat is
  'Số giờ báo trên máy phát tại lần đổ dầu động cơ.';

notify pgrst, 'reload schema';

commit;
