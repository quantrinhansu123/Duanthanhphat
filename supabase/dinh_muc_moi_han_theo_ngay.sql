-- Định mức theo dự án:
--   • Có ngày thực hiện: mỗi ngày = count(bản ghi) + 5
--   • Chỉ có năm: mốc YYYY-01-01 = count(năm) + 5 (bỏ qua nếu năm đó đã có ngày chi tiết)
-- Lưu vào du_an.tien_do_ly_thuyet.

create or replace function public.dong_bo_dinh_muc_moi_han(p_du_an_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tien_do jsonb;
  v_tong_dinh_muc integer;
  v_ngay_bat_dau date;
  v_ngay_ket_thuc date;
begin
  if p_du_an_id is null then
    return;
  end if;

  with thuc_te_ngay as (
    select
      ngay_thuc_hien as ngay,
      count(*)::integer as so_moi_han
    from public.lich_su_moi_han
    where du_an_id = p_du_an_id
      and ngay_thuc_hien is not null
    group by ngay_thuc_hien
  ),
  nam_co_ngay as (
    select distinct extract(year from ngay)::integer as nam
    from thuc_te_ngay
  ),
  thuc_te_nam as (
    select
      make_date(nam_thuc_hien, 1, 1) as ngay,
      count(*)::integer as so_moi_han
    from public.lich_su_moi_han
    where du_an_id = p_du_an_id
      and ngay_thuc_hien is null
      and nam_thuc_hien is not null
      and nam_thuc_hien not in (select nam from nam_co_ngay)
    group by nam_thuc_hien
  ),
  hop as (
    select ngay, so_moi_han from thuc_te_ngay
    union all
    select ngay, so_moi_han from thuc_te_nam
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'ngay', ngay::text,
          'so_moi_han', so_moi_han + 5
        )
        order by ngay
      ),
      '[]'::jsonb
    ),
    coalesce(sum(so_moi_han + 5), 0)::integer,
    min(ngay),
    max(ngay)
  into v_tien_do, v_tong_dinh_muc, v_ngay_bat_dau, v_ngay_ket_thuc
  from hop;

  if v_ngay_bat_dau is null then
    update public.du_an
    set tien_do_ly_thuyet = '[]'::jsonb,
        tong_moi_han_du_kien = 0,
        updated_at = now()
    where id = p_du_an_id;
    return;
  end if;

  update public.du_an
  set ngay_bat_dau = v_ngay_bat_dau,
      ngay_ket_thuc = v_ngay_ket_thuc,
      tong_moi_han_du_kien = v_tong_dinh_muc,
      updated_at = now()
  where id = p_du_an_id;

  update public.du_an
  set tien_do_ly_thuyet = v_tien_do,
      tong_moi_han_du_kien = v_tong_dinh_muc,
      updated_at = now()
  where id = p_du_an_id;
end;
$$;

comment on function public.dong_bo_dinh_muc_moi_han(uuid) is
  'Đồng bộ tien_do_ly_thuyet: thực tế + 5 (theo ngày hoặc theo năm nếu thiếu ngày)';

create or replace function public.dong_bo_dinh_muc_moi_han_tat_ca()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_du_an_id uuid;
  v_count integer := 0;
begin
  for v_du_an_id in select id from public.du_an
  loop
    perform public.dong_bo_dinh_muc_moi_han(v_du_an_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.dong_bo_dinh_muc_moi_han(uuid) to anon, authenticated, service_role;
grant execute on function public.dong_bo_dinh_muc_moi_han_tat_ca() to anon, authenticated, service_role;

create or replace function public.trg_dong_bo_dinh_muc_sau_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_du_an_id uuid;
begin
  for v_du_an_id in select distinct du_an_id from new_rows where du_an_id is not null
  loop
    perform public.dong_bo_dinh_muc_moi_han(v_du_an_id);
  end loop;
  return null;
end;
$$;

create or replace function public.trg_dong_bo_dinh_muc_sau_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_du_an_id uuid;
begin
  for v_du_an_id in select distinct du_an_id from old_rows where du_an_id is not null
  loop
    perform public.dong_bo_dinh_muc_moi_han(v_du_an_id);
  end loop;
  return null;
end;
$$;

create or replace function public.trg_dong_bo_dinh_muc_sau_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_du_an_id uuid;
begin
  for v_du_an_id in
    select du_an_id from new_rows where du_an_id is not null
    union
    select du_an_id from old_rows where du_an_id is not null
  loop
    perform public.dong_bo_dinh_muc_moi_han(v_du_an_id);
  end loop;
  return null;
end;
$$;

drop trigger if exists trg_dong_bo_dinh_muc_sau_insert on public.lich_su_moi_han;
create trigger trg_dong_bo_dinh_muc_sau_insert
  after insert on public.lich_su_moi_han
  referencing new table as new_rows
  for each statement execute function public.trg_dong_bo_dinh_muc_sau_insert();

drop trigger if exists trg_dong_bo_dinh_muc_sau_delete on public.lich_su_moi_han;
create trigger trg_dong_bo_dinh_muc_sau_delete
  after delete on public.lich_su_moi_han
  referencing old table as old_rows
  for each statement execute function public.trg_dong_bo_dinh_muc_sau_delete();

drop trigger if exists trg_dong_bo_dinh_muc_sau_update on public.lich_su_moi_han;
create trigger trg_dong_bo_dinh_muc_sau_update
  after update on public.lich_su_moi_han
  referencing old table as old_rows new table as new_rows
  for each statement execute function public.trg_dong_bo_dinh_muc_sau_update();

select public.dong_bo_dinh_muc_moi_han_tat_ca() as so_du_an_da_dong_bo;

notify pgrst, 'reload schema';
