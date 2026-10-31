-- RFI chỉ lấy mối "Chờ siêu âm và nghiệm thu".
-- Sau khi phát RFI: tạo sẵn đợt nháp + 3 hồ sơ để in mang đi hiện trường.
-- Hoàn thành nghiệm thu: cập nhật đợt nháp (không sinh bộ hồ sơ thứ hai).

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
  foreach weld_id in array selected_ids loop
    if not exists (
      select 1 from public.chat_luong_moi_han
      where moi_han_id = weld_id and du_an_id = p_du_an_id
        and du_dieu_kien_rfi
        and tinh_trang in ('Chờ siêu âm và nghiệm thu', 'Chờ thí nghiệm')
    ) then
      raise exception 'Mối % chưa ở trạng thái Chờ siêu âm và nghiệm thu (hoặc sai dự án / đã chờ ký biên bản)', weld_id;
    end if;
  end loop;
  insert into public.phieu_yeu_cau_nghiem_thu(id,du_an_id,so_phieu,ngay_moi,nguoi_lap,thong_tin)
    values (p_id,p_du_an_id,btrim(p_so_phieu),p_ngay_moi,btrim(p_nguoi_lap),p_thong_tin);
  insert into public.phieu_yeu_cau_nghiem_thu_moi(phieu_id,moi_han_id,du_lieu_chot)
    select p_id,ls.id,jsonb_build_object('moi_han',to_jsonb(ls),'kiem_tra',to_jsonb(kt),'tieu_chuan',to_jsonb(tc))
    from public.lich_su_moi_han ls join public.kiem_tra_moi_han kt on kt.moi_han_id = ls.id
    join public.tieu_chuan_nghiem_thu_moi_han tc on tc.id = kt.tieu_chuan_id where ls.id = any(selected_ids);

  -- Đợt nháp + 3 hồ sơ để in ngay sau phát RFI.
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

create or replace function public.hoan_thanh_nghiem_thu_moi_han(
  p_id uuid, p_phieu_id uuid, p_ngay_nghiem_thu date, p_nguoi_lap text, p_ket_qua jsonb,
  p_thong_tin jsonb default '{}'::jsonb
)
returns uuid language plpgsql set search_path = public, pg_temp as $$
declare
  phieu public.phieu_yeu_cau_nghiem_thu;
  existing public.dot_nghiem_thu;
  draft public.dot_nghiem_thu;
  item jsonb;
  weld_id uuid;
  n integer;
  snapshot jsonb;
  target_id uuid;
begin
  select * into strict phieu from public.phieu_yeu_cau_nghiem_thu where id = p_phieu_id for update;
  select * into existing from public.dot_nghiem_thu where id = p_id;
  if found then
    if (existing.phieu_id,existing.ngay_nghiem_thu,existing.nguoi_lap,existing.yeu_cau,existing.thong_tin)
      is distinct from (p_phieu_id,p_ngay_nghiem_thu,btrim(p_nguoi_lap),p_ket_qua,p_thong_tin) then
      raise exception 'Mã yêu cầu đã được dùng với nội dung khác';
    end if;
    return p_id;
  end if;
  if phieu.trang_thai <> 'Đã phát hành' then raise exception 'RFI không còn hiệu lực'; end if;
  if p_ket_qua is null or jsonb_typeof(p_ket_qua) <> 'array' then raise exception 'Danh sách kết quả không hợp lệ'; end if;
  n := jsonb_array_length(p_ket_qua);
  if n = 0 or not exists (select 1 from jsonb_array_elements(p_ket_qua) r where r->>'ket_qua' = 'Đạt') then
    raise exception 'Cần ít nhất một mối được chấp nhận';
  end if;
  if n <> (select count(distinct (r->>'moi_han_id')::uuid) from jsonb_array_elements(p_ket_qua) r) then
    raise exception 'Mối kết quả bị thiếu ID hoặc trùng';
  end if;
  perform 1 from public.lich_su_moi_han ls join public.phieu_yeu_cau_nghiem_thu_moi pm on pm.moi_han_id = ls.id
    where pm.phieu_id = p_phieu_id and pm.con_hieu_luc order by ls.id for update of ls;
  if n <> (select count(*) from public.phieu_yeu_cau_nghiem_thu_moi where phieu_id = p_phieu_id and con_hieu_luc) then
    raise exception 'Cần kết quả cho đủ các mối còn lại trong RFI';
  end if;
  for item in select * from jsonb_array_elements(p_ket_qua) loop
    weld_id := (item->>'moi_han_id')::uuid;
    if jsonb_typeof(item) <> 'object' or item->>'ket_qua' is null or item->>'ket_qua' not in ('Đạt','Không đạt','Chưa nghiệm thu')
      or not exists (select 1 from public.phieu_yeu_cau_nghiem_thu_moi where phieu_id = p_phieu_id and moi_han_id = weld_id and con_hieu_luc) then
      raise exception 'Kết quả hoặc mối không thuộc RFI hiệu lực';
    end if;
    if not exists (select 1 from public.chat_luong_moi_han where moi_han_id = weld_id and du_an_id = phieu.du_an_id
      and phien_ban = (item->>'phien_ban')::integer) then raise exception 'Dữ liệu đã thay đổi; hãy tải lại'; end if;
    if item->>'ket_qua' = 'Đạt' and not exists (select 1 from public.chat_luong_moi_han
      where moi_han_id = weld_id and du_dieu_kien_nghiem_thu and tinh_trang <> 'Đạt') then
      raise exception 'Mối % chưa đủ điều kiện hoàn thành',weld_id;
    end if;
    if item->>'ket_qua' <> 'Đạt' and nullif(btrim(item->>'ly_do'),'') is null then raise exception 'Thiếu lý do loại trừ'; end if;
  end loop;

  -- Ưu tiên cập nhật đợt nháp đã tạo lúc phát RFI.
  select * into draft from public.dot_nghiem_thu
    where phieu_id = p_phieu_id and coalesce(thong_tin->>'draft','') = 'true'
    order by created_at asc limit 1;
  if found then
    target_id := draft.id;
    update public.dot_nghiem_thu set
      ngay_nghiem_thu = p_ngay_nghiem_thu,
      nguoi_lap = btrim(p_nguoi_lap),
      yeu_cau = p_ket_qua,
      thong_tin = coalesce(p_thong_tin, '{}'::jsonb) || jsonb_build_object('draft', false, 'nguon', 'hoan_thanh')
    where id = target_id;
    delete from public.dot_nghiem_thu_moi where dot_id = target_id;
  else
    target_id := p_id;
    insert into public.dot_nghiem_thu(id,phieu_id,ngay_nghiem_thu,nguoi_lap,yeu_cau,thong_tin)
      values (target_id,p_phieu_id,p_ngay_nghiem_thu,btrim(p_nguoi_lap),p_ket_qua,p_thong_tin);
  end if;

  update public.kiem_tra_moi_han kt set ly_do_loai_nghiem_thu = btrim(r->>'ly_do')
    from jsonb_array_elements(p_ket_qua) r where kt.moi_han_id = (r->>'moi_han_id')::uuid and r->>'ket_qua' = 'Không đạt';
  insert into public.dot_nghiem_thu_moi(dot_id,moi_han_id,ket_qua,ly_do,du_lieu_chot)
    select target_id,ls.id,r->>'ket_qua',nullif(btrim(r->>'ly_do'),''),
      jsonb_build_object('moi_han',to_jsonb(ls),'kiem_tra',to_jsonb(kt),'tieu_chuan',to_jsonb(tc))
    from jsonb_array_elements(p_ket_qua) r join public.lich_su_moi_han ls on ls.id = (r->>'moi_han_id')::uuid
    join public.kiem_tra_moi_han kt on kt.moi_han_id = ls.id
    left join public.tieu_chuan_nghiem_thu_moi_han tc on tc.id = kt.tieu_chuan_id;
  update public.phieu_yeu_cau_nghiem_thu_moi pm set con_hieu_luc = false
    from jsonb_array_elements(p_ket_qua) r where pm.phieu_id = p_phieu_id and pm.moi_han_id = (r->>'moi_han_id')::uuid
    and r->>'ket_qua' <> 'Chưa nghiệm thu';
  if not exists (select 1 from public.phieu_yeu_cau_nghiem_thu_moi where phieu_id = p_phieu_id and con_hieu_luc) then
    update public.phieu_yeu_cau_nghiem_thu set trang_thai = 'Đã hoàn thành' where id = p_phieu_id;
  end if;
  select jsonb_build_object('rfi',to_jsonb(phieu),'dot',to_jsonb(d),
    'cac_moi', (select jsonb_agg(to_jsonb(dm) order by dm.moi_han_id) from public.dot_nghiem_thu_moi dm where dm.dot_id = target_id))
    into snapshot from public.dot_nghiem_thu d where d.id = target_id;
  if exists (select 1 from public.ho_so_nghiem_thu where dot_id = target_id) then
    update public.ho_so_nghiem_thu set du_lieu_chot = snapshot where dot_id = target_id;
  else
    insert into public.ho_so_nghiem_thu(dot_id,loai,du_lieu_chot,tinh_trang_ky)
      select target_id,loai,snapshot,'Chờ ký' from unnest(array['Phụ lục công việc','Giai đoạn xây dựng','Hoàn thành công việc']) loai;
  end if;
  return target_id;
end $$;

notify pgrst, 'reload schema';
