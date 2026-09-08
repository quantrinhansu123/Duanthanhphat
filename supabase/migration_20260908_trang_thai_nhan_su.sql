-- Bổ sung trạng thái hoạt động / khóa cho nhân sự (thợ hàn).
-- Trước đây trạng thái chỉ tồn tại ở client nên thao tác "Khóa" thợ hàn
-- không được lưu lại sau khi tải lại danh sách.

alter table public.nhan_su
  add column if not exists trang_thai text;

update public.nhan_su
set trang_thai = 'Hoạt động'
where trang_thai is null;

alter table public.nhan_su
  alter column trang_thai set default 'Hoạt động',
  alter column trang_thai set not null;

alter table public.nhan_su
  drop constraint if exists nhan_su_trang_thai_check;

alter table public.nhan_su
  add constraint nhan_su_trang_thai_check
  check (trang_thai in ('Hoạt động', 'Khóa'));

comment on column public.nhan_su.trang_thai is 'Trạng thái nhân sự: Hoạt động hoặc Khóa';
