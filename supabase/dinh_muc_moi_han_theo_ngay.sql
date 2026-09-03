-- Định mức theo từng dự án/ngày = tổng thực tế của ngày + 1 mối.
-- Dữ liệu được lưu trong du_an.tien_do_ly_thuyet để biểu đồ "Dự kiến" sử dụng trực tiếp.

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

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'ngay', ngay_thuc_hien::text,
          'so_moi_han', so_luong_thuc_hien + 1
        )
        order by ngay_thuc_hien
      ),
      '[]'::jsonb
    ),
    coalesce(sum(so_luong_thuc_hien + 1), 0)::integer,
    min(ngay_thuc_hien),
    max(ngay_thuc_hien)
  into v_tien_do, v_tong_dinh_muc, v_ngay_bat_dau, v_ngay_ket_thuc
  from (
    select
      ngay_thuc_hien,
      sum(so_luong_thuc_hien)::integer as so_luong_thuc_hien
    from public.lich_su_moi_han
    where du_an_id = p_du_an_id
      and ngay_thuc_hien is not null
    group by ngay_thuc_hien
  ) as thuc_te_theo_ngay;

  if v_ngay_bat_dau is null then
    update public.du_an
    set tong_moi_han_du_kien = 0,
        tien_do_ly_thuyet = '[]'::jsonb
    where id = p_du_an_id;
    return;
  end if;

  -- Trigger hiện có của du_an sẽ tạo kế hoạch tạm khi cập nhật tổng/ngày.
  update public.du_an
  set ngay_bat_dau = v_ngay_bat_dau,
      ngay_ket_thuc = v_ngay_ket_thuc,
      tong_moi_han_du_kien = v_tong_dinh_muc
  where id = p_du_an_id;

  -- Ghi đè bằng định mức chính xác dựa trên dữ liệu thực tế từng ngày.
  update public.du_an
  set tien_do_ly_thuyet = v_tien_do
  where id = p_du_an_id;
end;
$$;

comment on function public.dong_bo_dinh_muc_moi_han(uuid) is
  'Đồng bộ du_an.tien_do_ly_thuyet: định mức mỗi dự án/ngày bằng tổng thực tế + 1 mối';

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

-- Đồng bộ ngay toàn bộ dự án đang có dữ liệu.
do $$
declare
  v_du_an_id uuid;
begin
  for v_du_an_id in select id from public.du_an
  loop
    perform public.dong_bo_dinh_muc_moi_han(v_du_an_id);
  end loop;
end;
$$;

-- Kiểm tra: mọi dự án/ngày phải có định mức = thực tế + 1.
do $$
begin
  if exists (
    with thuc_te as (
      select du_an_id, ngay_thuc_hien as ngay, sum(so_luong_thuc_hien)::integer as so_moi_han
      from public.lich_su_moi_han
      where ngay_thuc_hien is not null
      group by du_an_id, ngay_thuc_hien
    ),
    dinh_muc as (
      select
        du_an.id as du_an_id,
        (item ->> 'ngay')::date as ngay,
        (item ->> 'so_moi_han')::integer as so_moi_han
      from public.du_an
      cross join lateral jsonb_array_elements(du_an.tien_do_ly_thuyet) as item
    )
    select 1
    from thuc_te
    full join dinh_muc using (du_an_id, ngay)
    where dinh_muc.so_moi_han is distinct from thuc_te.so_moi_han + 1
  ) then
    raise exception 'Định mức chưa khớp thực tế + 1';
  end if;
end;
$$;

notify pgrst, 'reload schema';
