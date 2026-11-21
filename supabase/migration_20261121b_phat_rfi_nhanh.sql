-- Phát RFI bị statement timeout: hàm SQL quét view nặng nhiều lần.
--  1) phat_hanh_rfi_moi_han: kiểm điều kiện từng mối bằng cột cache (migration 20261120/20261121), chỉ fallback view khi cache không đạt.
--  0) Trigger cache (20261120) chạy mỗi dòng chèn vào dot_nghiem_thu_moi / phieu_nt_tach_moi / ho_so_nghiem_thu → phát 20 mối gọi ~120 lần
--     hàm tính tình trạng (rất nặng). Khi phát RFI: tắt trigger bằng cờ giao dịch app.bo_qua_cache_chat_luong, cuối cùng chỉ tính lại 1 lần cho các mối của phiếu.
--  2) phat_hanh_rfi_va_phieu_con: tính dieu_kien_nt_tach MỘT lần cho đúng các mối của phiếu (moi_han_id = any(mảng)) thay vì join cả view 2 lần.
-- Cần chạy sau migration_20261120_tinh_trang_chat_luong_cache.sql và migration_20261121_du_dieu_kien_rfi_cache.sql. Chạy lại nhiều lần không sao.
begin;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='lich_su_moi_han' and column_name='du_dieu_kien_rfi')
    or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='lich_su_moi_han' and column_name='tinh_trang_chat_luong') then
    raise exception 'Chạy migration_20261120_tinh_trang_chat_luong_cache.sql và migration_20261121_du_dieu_kien_rfi_cache.sql trước.';
  end if;
end $$;

create or replace function public.trg_cap_nhat_tinh_trang_chat_luong_phieu_moi()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(current_setting('app.bo_qua_cache_chat_luong', true), '') = '1' then return coalesce(new, old); end if;
  perform public.cap_nhat_tinh_trang_chat_luong(coalesce(new.moi_han_id, old.moi_han_id));
  return coalesce(new, old);
end $$;

create or replace function public.trg_cap_nhat_tinh_trang_chat_luong_phieu_nt_tach()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(current_setting('app.bo_qua_cache_chat_luong', true), '') = '1' then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' and new.da_ky is not distinct from old.da_ky then return new; end if;
  perform public.cap_nhat_tinh_trang_chat_luong(m.moi_han_id)
  from public.phieu_nt_tach_moi m where m.phieu_id = coalesce(new.id, old.id);
  return coalesce(new, old);
end $$;

create or replace function public.trg_cap_nhat_tinh_trang_chat_luong_ho_so()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(current_setting('app.bo_qua_cache_chat_luong', true), '') = '1' then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' and new.tinh_trang_ky is not distinct from old.tinh_trang_ky then return new; end if;
  perform public.cap_nhat_tinh_trang_chat_luong(m.moi_han_id)
  from public.dot_nghiem_thu_moi m where m.dot_id = coalesce(new.dot_id, old.dot_id);
  return coalesce(new, old);
end $$;

create or replace function public.phat_hanh_rfi_moi_han(
  p_id uuid, p_du_an_id uuid, p_so_phieu text, p_ngay_moi date, p_moi_han_ids uuid[],
  p_nguoi_lap text, p_thong_tin jsonb default '{}'::jsonb
)
returns uuid language plpgsql set search_path = public, pg_temp as $$
declare
  existing public.phieu_yeu_cau_nghiem_thu;
  weld_id uuid;
  selected_ids uuid[];
  draft_id uuid;
  snapshot jsonb;
begin
  if coalesce(cardinality(p_moi_han_ids),0) = 0 or array_position(p_moi_han_ids,null) is not null or
    cardinality(p_moi_han_ids) <> (select count(distinct id) from unnest(p_moi_han_ids) id) then
    raise exception 'Danh sách mối phải khác rỗng và không trùng';
  end if;
  select array_agg(id order by id) into selected_ids from unnest(p_moi_han_ids) id;
  select * into existing from public.phieu_yeu_cau_nghiem_thu where id = p_id;
  if found then
    if (existing.du_an_id,existing.so_phieu,existing.ngay_moi,existing.nguoi_lap,existing.thong_tin)
      is distinct from (p_du_an_id,btrim(p_so_phieu),p_ngay_moi,btrim(p_nguoi_lap),p_thong_tin)
      or selected_ids is distinct from (select array_agg(moi_han_id order by moi_han_id) from public.phieu_yeu_cau_nghiem_thu_moi where phieu_id = p_id) then
      raise exception 'Mã yêu cầu đã được dùng với nội dung khác';
    end if;
    return p_id;
  end if;
  perform 1 from public.lich_su_moi_han where id = any(selected_ids) order by id for update;
  if exists (select 1 from public.phieu_yeu_cau_nghiem_thu where id = p_id) then
    return public.phat_hanh_rfi_moi_han(p_id,p_du_an_id,p_so_phieu,p_ngay_moi,p_moi_han_ids,p_nguoi_lap,p_thong_tin);
  end if;
  -- Nhanh: đọc cờ cache trên lich_su_moi_han (một truy vấn cho cả danh sách) thay vì quét view chat_luong_moi_han từng mối.
  -- Mối nào không đạt theo cache thì kiểm lại bằng view (chính xác như cũ) để cache lệch không chặn nhầm.
  for weld_id in
    select s.id from unnest(selected_ids) s(id)
    where not exists (
      select 1 from public.lich_su_moi_han ls
      where ls.id = s.id and ls.du_an_id = p_du_an_id and ls.du_dieu_kien_rfi
        and ls.tinh_trang_chat_luong in ('Mài xong', 'Chờ siêu âm', 'Chờ siêu âm và nghiệm thu', 'Chờ nghiệm thu', 'Chờ thí nghiệm')
    )
  loop
    if not exists (
      select 1 from public.chat_luong_moi_han
      where moi_han_id = weld_id and du_an_id = p_du_an_id
        and du_dieu_kien_rfi
        and tinh_trang in ('Mài xong', 'Chờ siêu âm', 'Chờ siêu âm và nghiệm thu', 'Chờ nghiệm thu', 'Chờ thí nghiệm')
    ) then
      raise exception 'Mối % chưa đủ điều kiện phát RFI (cần Mài xong / Chờ siêu âm / Chờ nghiệm thu, đúng dự án, chưa thuộc RFI khác, chưa chờ ký)', weld_id;
    end if;
  end loop;
  insert into public.phieu_yeu_cau_nghiem_thu(id,du_an_id,so_phieu,ngay_moi,nguoi_lap,thong_tin)
    values (p_id,p_du_an_id,btrim(p_so_phieu),p_ngay_moi,btrim(p_nguoi_lap),p_thong_tin);
  insert into public.phieu_yeu_cau_nghiem_thu_moi(phieu_id,moi_han_id,du_lieu_chot)
    select p_id,ls.id,jsonb_build_object('moi_han',to_jsonb(ls) || coalesce((select to_jsonb(b) from public.bao_cao_moi_han_theo_du_an b where b.id=ls.id),'{}'::jsonb) || coalesce((select jsonb_build_object('ly_trinh',p.ly_trinh,'ma_diem',p.ma_diem) from public.toa_do p where p.lich_su_moi_han_id=ls.id order by p.ma_diem limit 1),'{}'::jsonb),'kiem_tra',to_jsonb(kt),'tieu_chuan',to_jsonb(tc))
    from public.lich_su_moi_han ls join public.kiem_tra_moi_han kt on kt.moi_han_id = ls.id
    left join public.tieu_chuan_nghiem_thu_moi_han tc on tc.id = kt.tieu_chuan_id where ls.id = any(selected_ids);

  draft_id := gen_random_uuid();
  insert into public.dot_nghiem_thu(id,phieu_id,ngay_nghiem_thu,nguoi_lap,yeu_cau,thong_tin)
    values (
      draft_id, p_id, p_ngay_moi, btrim(p_nguoi_lap),
      (select coalesce(jsonb_agg(jsonb_build_object(
        'moi_han_id', pm.moi_han_id,
        'phien_ban', coalesce((pm.du_lieu_chot->'kiem_tra'->>'phien_ban')::int, 1),
        'ket_qua', 'Chưa nghiệm thu',
        'ly_do', 'Chờ siêu âm / nghiệm thu tại hiện trường'
      ) order by pm.moi_han_id), '[]'::jsonb)
       from public.phieu_yeu_cau_nghiem_thu_moi pm where pm.phieu_id = p_id),
      jsonb_build_object('draft', true, 'nguon', 'phat_rfi')
    );
  insert into public.dot_nghiem_thu_moi(dot_id,moi_han_id,ket_qua,ly_do,du_lieu_chot)
    select draft_id, pm.moi_han_id, 'Chưa nghiệm thu', 'Chờ siêu âm / nghiệm thu tại hiện trường', pm.du_lieu_chot
    from public.phieu_yeu_cau_nghiem_thu_moi pm where pm.phieu_id = p_id;
  select jsonb_build_object(
    'rfi', to_jsonb(p),
    'dot', to_jsonb(d),
    'cac_moi', (select jsonb_agg(to_jsonb(dm) order by dm.moi_han_id) from public.dot_nghiem_thu_moi dm where dm.dot_id = draft_id)
  ) into snapshot
  from public.phieu_yeu_cau_nghiem_thu p, public.dot_nghiem_thu d
  where p.id = p_id and d.id = draft_id;
  insert into public.ho_so_nghiem_thu(dot_id,loai,du_lieu_chot,tinh_trang_ky)
    select draft_id, loai, snapshot, 'Chờ ký'
    from unnest(array['Phụ lục công việc','Giai đoạn xây dựng','Hoàn thành công việc']) loai;
  return p_id;
end $$;

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
  dieu_kien jsonb;
begin
  perform set_config('app.bo_qua_cache_chat_luong','1',true);
  parent_id := public.phat_hanh_rfi_moi_han(p_id,p_du_an_id,p_so_phieu,p_ngay_moi,p_moi_han_ids,p_nguoi_lap,p_thong_tin);
  -- Serialize retries so a repeated request cannot create a second child.
  perform 1 from phieu_yeu_cau_nghiem_thu where id=parent_id for update;
  -- Một lần cho cả hai loại phiếu con, chỉ với các mối của phiếu này.
  select coalesce(jsonb_object_agg(q.moi_han_id::text, to_jsonb(q)),'{}'::jsonb) into dieu_kien
    from public.dieu_kien_nt_tach q
    where q.moi_han_id = any(array(select moi_han_id from phieu_yeu_cau_nghiem_thu_moi where phieu_id=parent_id));
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
        coalesce(dieu_kien->(pm.moi_han_id::text),'{}'::jsonb) || pm.du_lieu_chot
      from phieu_yeu_cau_nghiem_thu_moi pm
      join lich_su_moi_han ls on ls.id=pm.moi_han_id
      where pm.phieu_id=parent_id;
  end loop;
  -- Bật lại trigger và đồng bộ cache một lần cho các mối của phiếu.
  perform set_config('app.bo_qua_cache_chat_luong','',true);
  perform public.cap_nhat_tinh_trang_chat_luong(w) from unnest(p_moi_han_ids) w;
  return parent_id;
end $$;

revoke all on function public.phat_hanh_rfi_moi_han(uuid,uuid,text,date,uuid[],text,jsonb) from public,anon,authenticated;
grant execute on function public.phat_hanh_rfi_moi_han(uuid,uuid,text,date,uuid[],text,jsonb) to service_role;
revoke all on function public.phat_hanh_rfi_va_phieu_con(uuid,uuid,text,date,uuid[],text,jsonb) from public,anon,authenticated;
grant execute on function public.phat_hanh_rfi_va_phieu_con(uuid,uuid,text,date,uuid[],text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
