begin;

-- A partial RFI needs a completed, passing complementary RFI for every accepted weld.
-- Historical RFIs without explicit scope keep their combined scope.
create or replace function public.kiem_tra_du_hai_phan_rfi(p_dot uuid, p_moi uuid)
returns void language plpgsql set search_path = public, pg_temp as $$
declare d public.dot_nghiem_thu; p public.phieu_yeu_cau_nghiem_thu;
  k text; field text; covered boolean; reference_id uuid;
begin
  select * into strict d from public.dot_nghiem_thu where id=p_dot;
  select * into strict p from public.phieu_yeu_cau_nghiem_thu where id=d.phieu_id;
  if d.ngay_nghiem_thu < p.ngay_moi then raise exception 'Ngày nghiệm thu không được trước ngày mời RFI.'; end if;
  foreach k in array array['hinh-hoc','sieu-am'] loop
    field := case when k='hinh-hoc' then 'nt_hinh_hoc' else 'nt_sieu_am' end;
    covered := case when not (p.thong_tin ? 'nt_hinh_hoc' or p.thong_tin ? 'nt_sieu_am') then true
      else coalesce(p.thong_tin->>field,'') in ('1','true') end;
    if covered then continue; end if;
    field := case when k='hinh-hoc' then 'rfi_hinh_hoc_id' else 'rfi_sieu_am_id' end;
    reference_id := nullif(d.thong_tin->>field,'')::uuid;
    if not exists (
      select 1 from public.phieu_nt_tach t join public.phieu_nt_tach_moi m on m.phieu_id=t.id
      where t.id=reference_id and t.du_an_id=p.du_an_id and t.loai=k
        and t.ngay_nghiem_thu is not null and t.ngay_nghiem_thu<=d.ngay_nghiem_thu
        and m.moi_han_id=p_moi and m.ket_qua='Đạt'
    ) then raise exception 'Đề nghị cung cấp RFI % đã nghiệm thu Đạt cho mối % trước khi hoàn thành hoặc ký biên bản.',
      case when k='hinh-hoc' then 'kích thước hình học' else 'siêu âm' end, p_moi;
    end if;
  end loop;
end $$;

create or replace function public.chan_chot_thieu_phan_rfi()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.ket_qua='Đạt' then perform public.kiem_tra_du_hai_phan_rfi(new.dot_id,new.moi_han_id); end if;
  return new;
end $$;
drop trigger if exists chan_chot_thieu_phan_rfi on public.dot_nghiem_thu_moi;
create trigger chan_chot_thieu_phan_rfi before insert or update on public.dot_nghiem_thu_moi
for each row execute function public.chan_chot_thieu_phan_rfi();

create or replace function public.chan_ky_thieu_phan_rfi()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare m record;
begin
  if new.tinh_trang_ky='Đã ký' then
    for m in select moi_han_id from public.dot_nghiem_thu_moi where dot_id=new.dot_id and ket_qua='Đạt' loop
      perform public.kiem_tra_du_hai_phan_rfi(new.dot_id,m.moi_han_id);
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists chan_ky_thieu_phan_rfi on public.ho_so_nghiem_thu;
create trigger chan_ky_thieu_phan_rfi before insert or update on public.ho_so_nghiem_thu
for each row execute function public.chan_ky_thieu_phan_rfi();

create or replace function public.bao_ve_pham_vi_rfi()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare old_geometry boolean; old_ultrasound boolean; new_geometry boolean; new_ultrasound boolean;
begin
  new_geometry := case when not(new.thong_tin ? 'nt_hinh_hoc' or new.thong_tin ? 'nt_sieu_am') then true else coalesce(new.thong_tin->>'nt_hinh_hoc','') in ('1','true') end;
  new_ultrasound := case when not(new.thong_tin ? 'nt_hinh_hoc' or new.thong_tin ? 'nt_sieu_am') then true else coalesce(new.thong_tin->>'nt_sieu_am','') in ('1','true') end;
  if coalesce(new.thong_tin->>'loai_rfi','')<>'theo-doi' and not(new_geometry or new_ultrasound) then
    raise exception 'Chọn ít nhất một nội dung nghiệm thu.';
  end if;
  if tg_op='UPDATE' then
    old_geometry := case when not(old.thong_tin ? 'nt_hinh_hoc' or old.thong_tin ? 'nt_sieu_am') then true else coalesce(old.thong_tin->>'nt_hinh_hoc','') in ('1','true') end;
    old_ultrasound := case when not(old.thong_tin ? 'nt_hinh_hoc' or old.thong_tin ? 'nt_sieu_am') then true else coalesce(old.thong_tin->>'nt_sieu_am','') in ('1','true') end;
    if (old_geometry,old_ultrasound) is distinct from (new_geometry,new_ultrasound) then
      raise exception 'Không đổi nội dung nghiệm thu của phiếu đã phát; cần phát phiếu bổ sung.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists bao_ve_pham_vi_rfi on public.phieu_yeu_cau_nghiem_thu;
create trigger bao_ve_pham_vi_rfi before insert or update on public.phieu_yeu_cau_nghiem_thu
for each row execute function public.bao_ve_pham_vi_rfi();

revoke all on function public.kiem_tra_du_hai_phan_rfi(uuid,uuid) from public,anon,authenticated;
grant execute on function public.kiem_tra_du_hai_phan_rfi(uuid,uuid) to service_role;
revoke all on function public.chan_chot_thieu_phan_rfi(), public.chan_ky_thieu_phan_rfi(), public.bao_ve_pham_vi_rfi() from public,anon,authenticated;
grant execute on function public.chan_chot_thieu_phan_rfi(), public.chan_ky_thieu_phan_rfi(), public.bao_ve_pham_vi_rfi() to service_role;
commit;
