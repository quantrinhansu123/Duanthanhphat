-- Xóa chứng chỉ trong một giao dịch; giữ nội dung nhật ký hàn đã sử dụng.
begin;
create or replace function public.xoa_chung_chi_an_toan(
  p_nhom_id uuid default null, p_ten_chung_chi text default null, p_chung_chi_id uuid default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_title text;
  v_employee uuid;
  v_ids uuid[];
  v_people uuid[];
  v_cache jsonb;
begin
  lock table public.chung_chi_nhom, public.chung_chi, public.chung_chi_ho_so,
    public.nhan_su, public.lich_su_moi_han, public.dao_tao, public.dao_tao_hoc_vien in share row exclusive mode;
  if p_chung_chi_id is not null then
    select ten_chung_chi, employee_id into v_title, v_employee from public.chung_chi where id = p_chung_chi_id;
    if not found then raise exception 'Chứng chỉ không còn tồn tại'; end if;
  elsif p_nhom_id is not null then
    select ten_nhom into v_title from public.chung_chi_nhom where id = p_nhom_id;
    if not found then raise exception 'Loại chứng chỉ không còn tồn tại'; end if;
  else
    v_title := nullif(btrim(p_ten_chung_chi), '');
  end if;
  if v_title is null then raise exception 'Thiếu tên hoặc mã chứng chỉ'; end if;

  select coalesce(array_agg(id), '{}') into v_ids from public.chung_chi c
  where (p_chung_chi_id is not null and c.id = p_chung_chi_id)
    or (p_chung_chi_id is null and (c.nhom_id = p_nhom_id or lower(btrim(c.ten_chung_chi)) = lower(btrim(v_title))));
  select coalesce(array_agg(ns.employee_id), '{}'), coalesce(jsonb_object_agg(ns.employee_id::text, coalesce(to_jsonb(ns.chung_chi), '[]')), '{}')
    into v_people, v_cache from public.nhan_su ns
  where (p_chung_chi_id is not null and ns.employee_id = v_employee)
    or (p_chung_chi_id is null and (
      exists (select 1 from public.chung_chi c where c.id = any(v_ids) and c.employee_id = ns.employee_id)
      or exists (select 1 from public.chung_chi_ho_so h where h.nhan_su_id = ns.employee_id and lower(btrim(h.ten_chung_chi)) = lower(btrim(v_title)))
      or exists (select 1 from unnest(ns.chung_chi) t where lower(btrim(t)) = lower(btrim(v_title)))
    ));

  -- Chỉ bỏ FK tới chứng chỉ bị xóa, giữ tên chứng chỉ và toàn bộ nội dung mối hàn.
  if exists (select 1 from public.lich_su_moi_han where chung_chi_id = any(v_ids)) then
    alter table public.lich_su_moi_han disable trigger trg_kiem_tra_chung_chi_moi_han;
    update public.lich_su_moi_han set chung_chi_id = null where chung_chi_id = any(v_ids);
    alter table public.lich_su_moi_han enable trigger trg_kiem_tra_chung_chi_moi_han;
  end if;
  delete from public.chung_chi_ho_so h where lower(btrim(h.ten_chung_chi)) = lower(btrim(v_title))
    and (p_chung_chi_id is null or (h.nhan_su_id = v_employee and not exists (
      select 1 from public.chung_chi c where c.employee_id = v_employee
        and lower(btrim(c.ten_chung_chi)) = lower(btrim(v_title)) and not (c.id = any(v_ids))
    )));
  delete from public.chung_chi where id = any(v_ids);
  if p_chung_chi_id is null then
    delete from public.chung_chi_nhom where id = p_nhom_id or lower(btrim(ten_nhom)) = lower(btrim(v_title));
  end if;
  -- Giữ nguyên các tên cache cũ khác; trigger hồ sơ không được làm mất chúng.
  update public.nhan_su ns set chung_chi = coalesce((
    select array_agg(distinct title order by title) from (
      select value as title from jsonb_array_elements_text(v_cache -> ns.employee_id::text)
        where lower(btrim(value)) <> lower(btrim(v_title))
      union
      select ten_chung_chi from public.chung_chi c where c.employee_id = ns.employee_id
        and c.trang_thai = 'Còn hiệu lực' and (c.ngay_het_han is null or c.ngay_het_han >= current_date)
    ) kept
  ), '{}') where ns.employee_id = any(v_people);
end $$;
revoke all on function public.xoa_chung_chi_an_toan(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.xoa_chung_chi_an_toan(uuid,text,uuid) to service_role;
commit;
