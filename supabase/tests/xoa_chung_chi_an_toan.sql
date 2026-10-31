-- Chạy sau migration_20261031_xoa_chung_chi_an_toan.sql.
-- Mọi thay đổi của bài kiểm tra được rollback, kể cả khi dùng dữ liệu thật.
begin;
do $$
declare
  v_group uuid := gen_random_uuid();
  v_cert uuid := gen_random_uuid();
  v_keep uuid := gen_random_uuid();
  v_title text := 'TEST DELETE ' || gen_random_uuid()::text;
  v_history uuid;
  v_person uuid;
  v_before jsonb;
begin
  select id, tho_han_id, to_jsonb(l) - 'chung_chi_id' - 'updated_at'
    into v_history, v_person, v_before from public.lich_su_moi_han l where tho_han_id is not null limit 1;
  if v_person is null then raise exception 'Bài kiểm tra cần một mối hàn có thợ hàn'; end if;
  insert into public.chung_chi_nhom(id,ten_nhom,ngay_cap,ngay_het_han) values(v_group,v_title,current_date,current_date + 365);
  insert into public.chung_chi(id,ten_chung_chi,employee_id,nhom_id,ngay_cap,ngay_het_han) values
    (v_cert,v_title,v_person,v_group,current_date,current_date + 365),
    (v_keep,v_title,v_person,v_group,current_date,current_date + 365);
  insert into public.chung_chi_ho_so(nhan_su_id,ten_chung_chi,ngay_cap,ngay_het_han,trang_thai)
    values(v_person,v_title,current_date,current_date + 365,'Còn hiệu lực');
  update public.nhan_su set chung_chi = array_append(chung_chi,'TEST unrelated cache') where employee_id = v_person;
  update public.lich_su_moi_han set chung_chi_id = v_cert where id = v_history;

  perform public.xoa_chung_chi_an_toan(p_chung_chi_id => v_cert);
  if exists(select 1 from public.chung_chi where id=v_cert) or not exists(select 1 from public.chung_chi where id=v_keep) then
    raise exception 'Xóa một hồ sơ đã ảnh hưởng hồ sơ khác';
  end if;
  if not exists(select 1 from public.chung_chi_nhom where id=v_group) then raise exception 'Xóa hồ sơ không được xóa loại'; end if;
  if not exists(select 1 from public.nhan_su where employee_id=v_person and v_title=any(chung_chi) and 'TEST unrelated cache'=any(chung_chi)) then
    raise exception 'Mất chứng chỉ còn giữ hoặc cache không liên quan';
  end if;
  perform public.xoa_chung_chi_an_toan(p_nhom_id => v_group);
  if exists(select 1 from public.chung_chi_nhom where id=v_group) or exists(select 1 from public.chung_chi where id=v_keep) then
    raise exception 'Chưa xóa hết loại và hồ sơ';
  end if;
  if not exists(select 1 from public.nhan_su where employee_id=v_person and not(v_title=any(chung_chi)) and 'TEST unrelated cache'=any(chung_chi)) then
    raise exception 'Cache đã xóa vẫn còn hoặc mất cache khác';
  end if;
  if not exists(select 1 from public.lich_su_moi_han l where id=v_history and chung_chi_id is null
    and to_jsonb(l) - 'chung_chi_id' - 'updated_at' = v_before) then raise exception 'Nội dung lịch sử đã thay đổi'; end if;
  if exists(select 1 from pg_trigger where tgname='trg_kiem_tra_chung_chi_moi_han' and tgenabled <> 'O') then
    raise exception 'Trigger kiểm tra chứng chỉ chưa được bật lại';
  end if;
  if has_function_privilege('anon','public.xoa_chung_chi_an_toan(uuid,text,uuid)','execute')
    or has_function_privilege('authenticated','public.xoa_chung_chi_an_toan(uuid,text,uuid)','execute') then
    raise exception 'RPC xóa chỉ được gọi qua máy chủ đã kiểm tra quyền';
  end if;
end $$;
select 'PASS certificate deletion: record, type, cache, historical data, trigger and RPC permissions' as result;
rollback;
