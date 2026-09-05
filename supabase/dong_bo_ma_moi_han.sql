-- Đồng bộ mã mối hàn: PHQ + FBW/ATW + DDMMYY + số TT (0001…)
-- Chạy trong Supabase SQL Editor (có thể chạy lại an toàn).

create or replace function public.dong_bo_ma_moi_han()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer := 0;
  v_updated integer := 0;
  v_has_link boolean := false;
begin
  select count(*) into v_total from public.lich_su_moi_han;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lich_su_moi_han'
      and column_name = 'moi_han_lien_ket'
  ) into v_has_link;

  create temporary table tmp_ma_moi_han_map (
    id uuid primary key,
    old_code text not null,
    new_code text not null
  ) on commit drop;

  insert into tmp_ma_moi_han_map (id, old_code, new_code)
  select
    ranked.id,
    ranked.old_code,
    'PHQ'
      || ranked.cong_nghe_han
      || to_char(ranked.ngay, 'DD')
      || to_char(ranked.ngay, 'MM')
      || to_char(ranked.ngay, 'YY')
      || lpad(ranked.seq::text, 4, '0') as new_code
  from (
    select
      ls.id,
      ls.ma_lich_su as old_code,
      ls.cong_nghe_han,
      coalesce(ls.ngay_thuc_hien, make_date(ls.nam_thuc_hien::integer, 1, 1)) as ngay,
      row_number() over (
        partition by
          ls.cong_nghe_han,
          coalesce(ls.ngay_thuc_hien, make_date(ls.nam_thuc_hien::integer, 1, 1))
        order by ls.ma_lich_su, ls.id
      ) as seq
    from public.lich_su_moi_han ls
  ) ranked;

  select count(*) into v_updated
  from tmp_ma_moi_han_map
  where old_code is distinct from new_code;

  if v_updated = 0 then
    return jsonb_build_object(
      'total', v_total,
      'updated', 0,
      'skipped', v_total
    );
  end if;

  -- Phase 1: mã tạm (tránh trùng unique)
  update public.lich_su_moi_han ls
  set ma_lich_su = '__SYNC_' || replace(ls.id::text, '-', '')
  from tmp_ma_moi_han_map m
  where ls.id = m.id
    and m.old_code is distinct from m.new_code;

  -- Phase 2: mã chuẩn
  update public.lich_su_moi_han ls
  set ma_lich_su = m.new_code
  from tmp_ma_moi_han_map m
  where ls.id = m.id
    and m.old_code is distinct from m.new_code;

  -- Cập nhật mối hàn liên kết (nếu có cột)
  if v_has_link then
    execute $sql$
      update public.lich_su_moi_han ls
      set moi_han_lien_ket = m.new_code
      from tmp_ma_moi_han_map m
      where ls.moi_han_lien_ket = m.old_code
        and m.old_code is distinct from m.new_code
    $sql$;
  end if;

  return jsonb_build_object(
    'total', v_total,
    'updated', v_updated,
    'skipped', greatest(v_total - v_updated, 0)
  );
end;
$$;

grant execute on function public.dong_bo_ma_moi_han() to anon, authenticated;

-- Chạy đồng bộ ngay trong SQL Editor (tuỳ chọn):
-- select public.dong_bo_ma_moi_han();
