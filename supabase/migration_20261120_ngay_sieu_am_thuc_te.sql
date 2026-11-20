begin;

alter table public.phieu_nt_tach_moi add column if not exists ngay_sieu_am_thuc_te date;
alter table public.phieu_nt_tach add column if not exists nhat_ky_theo_ngay_sieu_am boolean not null default false;

create index if not exists phieu_nt_tach_moi_ngay_sieu_am_idx
  on public.phieu_nt_tach_moi (ngay_sieu_am_thuc_te, phieu_id)
  where loai = 'sieu-am' and ngay_sieu_am_thuc_te is not null;

create or replace function public.ghi_ngay_sieu_am_thuc_te(
  p_phieu_id uuid, p_du_an_id uuid, p_moi_han_ids uuid[], p_ngay date
) returns integer language plpgsql set search_path = public, pg_temp as $$
declare
  saved integer;
begin
  if coalesce(cardinality(p_moi_han_ids), 0) not between 1 and 2000 then
    raise exception 'Danh sách mối không hợp lệ.';
  end if;
  if p_ngay > (now() at time zone 'Asia/Ho_Chi_Minh')::date then
    raise exception 'Ngày siêu âm thực tế không hợp lệ.';
  end if;

  update phieu_nt_tach
  set nhat_ky_theo_ngay_sieu_am = nhat_ky_theo_ngay_sieu_am or p_ngay is not null
  where id = p_phieu_id and du_an_id = p_du_an_id and loai = 'sieu-am';
  if not found then
    raise exception 'Danh sách mối không khớp với phiếu siêu âm. Tải lại phiếu rồi thử lại.';
  end if;

  update phieu_nt_tach_moi
  set ngay_sieu_am_thuc_te = p_ngay
  where phieu_id = p_phieu_id and loai = 'sieu-am' and moi_han_id = any(p_moi_han_ids);
  get diagnostics saved = row_count;
  if saved <> cardinality(p_moi_han_ids) then
    raise exception 'Danh sách mối không khớp với phiếu siêu âm. Tải lại phiếu rồi thử lại.';
  end if;
  return saved;
end $$;

revoke all on function public.ghi_ngay_sieu_am_thuc_te(uuid, uuid, uuid[], date) from public, anon, authenticated;
grant execute on function public.ghi_ngay_sieu_am_thuc_te(uuid, uuid, uuid[], date) to service_role;

notify pgrst, 'reload schema';
commit;
