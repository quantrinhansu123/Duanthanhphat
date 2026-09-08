-- Nhật ký vận hành thực tế: nhiên liệu, bơm, tình trạng, đề nghị và hình ảnh.

alter table public.nhat_ky_chay_may
  add column if not exists nhien_lieu_bo_sung_lit numeric(8,2) not null default 0,
  add column if not exists bom_mo boolean not null default false,
  add column if not exists tinh_trang_may text not null default 'Bình thường',
  add column if not exists mo_ta_tinh_trang text,
  add column if not exists de_nghi text,
  add column if not exists hinh_anh jsonb not null default '[]'::jsonb;

alter table public.nhat_ky_chay_may
  drop constraint if exists nhat_ky_chay_may_nhien_lieu_check,
  drop constraint if exists nhat_ky_chay_may_tinh_trang_check,
  drop constraint if exists nhat_ky_chay_may_hinh_anh_check;

-- Chuẩn hóa dữ liệu cũ: "Hoạt động bình thường" -> "Bình thường".
update public.nhat_ky_chay_may
  set tinh_trang_may = 'Bình thường'
  where lower(btrim(tinh_trang_may)) = 'hoạt động bình thường';

alter table public.nhat_ky_chay_may
  alter column tinh_trang_may set default 'Bình thường';

alter table public.nhat_ky_chay_may
  add constraint nhat_ky_chay_may_nhien_lieu_check
    check (nhien_lieu_bo_sung_lit >= 0),
  add constraint nhat_ky_chay_may_tinh_trang_check
    check (nullif(btrim(tinh_trang_may), '') is not null),
  add constraint nhat_ky_chay_may_hinh_anh_check
    check (jsonb_typeof(hinh_anh) = 'array');

create or replace view public.bao_cao_lich_chay_may
with (security_invoker = true)
as
select
  nk.id,
  nk.ngay,
  tb.id as may_id,
  tb.ma_may,
  tb.ten_may,
  nk.vi_tri,
  nk.so_gio_hoat_dong,
  da.id as du_an_id,
  da.ma_du_an,
  da.du_an,
  ns.employee_id as nguoi_phu_trach_id,
  ns.ma_nhan_su,
  ns.ho_ten as nguoi_phu_trach,
  nk.created_at,
  nk.updated_at,
  ns.to_han,
  nk.nhien_lieu_bo_sung_lit,
  nk.bom_mo,
  nk.tinh_trang_may,
  nk.mo_ta_tinh_trang,
  nk.de_nghi,
  nk.hinh_anh
from public.nhat_ky_chay_may nk
join public.thiet_bi tb on tb.id = nk.may
join public.du_an da on da.id = nk.du_an
join public.nhan_su ns on ns.employee_id = nk.nguoi_phu_trach;

grant select on public.bao_cao_lich_chay_may to anon, authenticated;

create index if not exists idx_nhat_ky_chay_may_tinh_trang_created
  on public.nhat_ky_chay_may (tinh_trang_may, created_at desc);

comment on column public.nhat_ky_chay_may.nhien_lieu_bo_sung_lit is 'Số lít dầu/nhiên liệu bổ sung trong lượt vận hành';
comment on column public.nhat_ky_chay_may.bom_mo is 'Bơm được mở trong lượt vận hành';
comment on column public.nhat_ky_chay_may.tinh_trang_may is 'Tóm tắt tình trạng chính, cho phép nhập tự do';
comment on column public.nhat_ky_chay_may.mo_ta_tinh_trang is 'Mô tả chi tiết hiện tượng hoặc sự cố';
comment on column public.nhat_ky_chay_may.de_nghi is 'Đề nghị xử lý hoặc theo dõi tiếp theo';
comment on column public.nhat_ky_chay_may.hinh_anh is 'Mảng metadata ảnh Cloudinary của lượt vận hành';

notify pgrst, 'reload schema';
