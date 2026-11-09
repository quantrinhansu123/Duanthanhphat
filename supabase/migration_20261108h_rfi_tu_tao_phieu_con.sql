begin;

-- Publish the parent and its prepared child tickets in one transaction.
create or replace function public.phat_hanh_rfi_va_phieu_con(
  p_id uuid, p_du_an_id uuid, p_so_phieu text, p_ngay_moi date,
  p_moi_han_ids uuid[], p_nguoi_lap text, p_thong_tin jsonb default '{}'::jsonb
)
returns uuid language plpgsql set search_path=public,pg_temp as $$
declare
  parent_id uuid;
  child_id uuid;
  kind text;
  explicit_scope boolean := p_thong_tin ? 'nt_hinh_hoc' or p_thong_tin ? 'nt_sieu_am';
begin
  parent_id := public.phat_hanh_rfi_moi_han(p_id,p_du_an_id,p_so_phieu,p_ngay_moi,p_moi_han_ids,p_nguoi_lap,p_thong_tin);
  -- Serialize retries so a repeated request cannot create a second child.
  perform 1 from phieu_yeu_cau_nghiem_thu where id=parent_id for update;
  foreach kind in array array['hinh-hoc','sieu-am'] loop
    if explicit_scope and coalesce(p_thong_tin->>(case when kind='hinh-hoc' then 'nt_hinh_hoc' else 'nt_sieu_am' end),'') not in ('1','true') then
      continue;
    end if;
    if exists(select 1 from phieu_nt_tach where phieu_rfi_id=parent_id and loai=kind) then
      continue;
    end if;
    child_id := gen_random_uuid();
    insert into phieu_nt_tach(id,du_an_id,loai,so_phieu,ngay_moi,nguoi_lap,phieu_rfi_id,thong_tin)
      values(child_id,p_du_an_id,kind,btrim(p_so_phieu) || case when kind='hinh-hoc' then '-HH' else '-SA' end,
        p_ngay_moi,btrim(p_nguoi_lap),parent_id,p_thong_tin);
    -- Prepare ultrasound paperwork even before geometry passes. Eligibility is
    -- still checked by chot_phieu_nt_tach when recording acceptance results.
    insert into phieu_nt_tach_moi(phieu_id,loai,moi_han_id,ma_lich_su,du_lieu_chot)
      select child_id,kind,pm.moi_han_id,ls.ma_lich_su,
        coalesce(to_jsonb(q),'{}'::jsonb) || pm.du_lieu_chot
      from phieu_yeu_cau_nghiem_thu_moi pm
      join lich_su_moi_han ls on ls.id=pm.moi_han_id
      left join dieu_kien_nt_tach q on q.moi_han_id=pm.moi_han_id
      where pm.phieu_id=parent_id;
  end loop;
  return parent_id;
end $$;

revoke all on function public.phat_hanh_rfi_va_phieu_con(uuid,uuid,text,date,uuid[],text,jsonb) from public,anon,authenticated;
grant execute on function public.phat_hanh_rfi_va_phieu_con(uuid,uuid,text,date,uuid[],text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
