-- Báo cáo mức dầu: thay trạng thái bơm bằng đơn vị đo.

alter table public.cap_dau_hang_ngay
  add column if not exists don_vi text not null default 'lít';

comment on column public.cap_dau_hang_ngay.don_vi is
  'Đơn vị đo mức dầu tại thời điểm báo cáo (vd: lít, %, cm)';
comment on column public.cap_dau_hang_ngay.so_lit is
  'Mức dầu tại thời điểm báo cáo (theo đơn vị don_vi)';
comment on table public.cap_dau_hang_ngay is
  'Báo cáo mức dầu theo máy / ngày';

-- CREATE OR REPLACE không được chèn/đổi thứ tự cột view → cần DROP rồi tạo lại.
drop view if exists public.bao_cao_cap_dau_hang_ngay;

create view public.bao_cao_cap_dau_hang_ngay
with (security_invoker = true)
as
select
  cd.id,
  cd.ngay,
  tb.id as may_id,
  tb.ma_may,
  tb.ten_may,
  cd.so_lit,
  cd.bom_mo,
  cd.don_vi,
  ns.employee_id as nguoi_cap_id,
  ns.ma_nhan_su,
  ns.ho_ten as nguoi_cap,
  cd.ghi_chu,
  cd.created_at,
  cd.updated_at
from public.cap_dau_hang_ngay cd
join public.thiet_bi tb on tb.id = cd.may
left join public.nhan_su ns on ns.employee_id = cd.nguoi_cap;

grant select on public.bao_cao_cap_dau_hang_ngay to anon, authenticated;

notify pgrst, 'reload schema';
