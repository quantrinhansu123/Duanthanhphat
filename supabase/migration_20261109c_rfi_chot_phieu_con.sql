-- A parent RFI remains visible, but releases its welds when every requested
-- child is complete. A geometry-only RFI can then be followed by a new RFI
-- for ultrasound.
create or replace function public.chot_rfi_khi_xong_phieu_con()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  parent_info jsonb;
begin
  select thong_tin into parent_info
  from public.phieu_yeu_cau_nghiem_thu
  where id = new.phieu_rfi_id and trang_thai = 'Đã phát hành'
  for update;

  if not found or not (parent_info ? 'nt_hinh_hoc' or parent_info ? 'nt_sieu_am') then
    return new;
  end if;

  if exists (
    select 1
    from (values ('hinh-hoc', 'nt_hinh_hoc'), ('sieu-am', 'nt_sieu_am')) as scope(loai, flag)
    where parent_info->>scope.flag in ('1', 'true')
      and not exists (
        select 1 from public.phieu_nt_tach ticket
        where ticket.phieu_rfi_id = new.phieu_rfi_id and ticket.loai = scope.loai
          and ticket.ngay_nghiem_thu is not null
      )
  ) then
    return new;
  end if;

  update public.phieu_yeu_cau_nghiem_thu_moi
    set con_hieu_luc = false where phieu_id = new.phieu_rfi_id and con_hieu_luc;
  update public.phieu_yeu_cau_nghiem_thu
    set trang_thai = 'Đã hoàn thành' where id = new.phieu_rfi_id;
  return new;
end;
$$;

drop trigger if exists trg_chot_rfi_khi_xong_phieu_con on public.phieu_nt_tach;
create trigger trg_chot_rfi_khi_xong_phieu_con
after update of ngay_nghiem_thu on public.phieu_nt_tach
for each row when (old.ngay_nghiem_thu is null and new.ngay_nghiem_thu is not null and new.phieu_rfi_id is not null)
execute function public.chot_rfi_khi_xong_phieu_con();
