-- Đồng bộ mã mối hàn: {mã dự án}-{công nghệ}-{DT|TN|CT|SX|TS}{3 số}.
-- VD: PHQ-ATW-SX001, PHQ-ATW-TN001. Số TT theo dự án + công nghệ + loại mối.
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
    ranked.site_prefix || '-' || ranked.cong_nghe_han || '-' || ranked.purpose_code
      || lpad(ranked.seq::text, 3, '0') as new_code
  from (
    select
      ls.id,
      ls.ma_lich_su as old_code,
      upper(btrim(coalesce(nullif(da.ma_du_an, ''), 'PHQ'))) as site_prefix,
      upper(btrim(coalesce(nullif(ls.cong_nghe_han, ''), 'FBW'))) as cong_nghe_han,
      case
        when lower(btrim(coalesce(ls.loai_moi_han, ''))) in ('thử nghiệm', 'thu nghiem') then 'TN'
        when lower(btrim(coalesce(ls.loai_moi_han, ''))) in ('đào tạo', 'dao tao') then 'DT'
        when lower(btrim(coalesce(ls.loai_moi_han, ''))) in ('chấp thuận', 'chap thuan') then 'CT'
        when lower(btrim(coalesce(ls.loai_moi_han, ''))) in ('tần suất', 'tan suat') then 'TS'
        else 'SX'
      end as purpose_code,
      coalesce(ls.ngay_thuc_hien, make_date(ls.nam_thuc_hien::integer, 1, 1)) as ngay,
      row_number() over (
        partition by
          upper(btrim(coalesce(nullif(da.ma_du_an, ''), 'PHQ'))),
          upper(btrim(coalesce(nullif(ls.cong_nghe_han, ''), 'FBW'))),
          case
            when lower(btrim(coalesce(ls.loai_moi_han, ''))) in ('thử nghiệm', 'thu nghiem') then 'TN'
            when lower(btrim(coalesce(ls.loai_moi_han, ''))) in ('đào tạo', 'dao tao') then 'DT'
            when lower(btrim(coalesce(ls.loai_moi_han, ''))) in ('chấp thuận', 'chap thuan') then 'CT'
            when lower(btrim(coalesce(ls.loai_moi_han, ''))) in ('tần suất', 'tan suat') then 'TS'
            else 'SX'
          end
        order by coalesce(ls.ngay_thuc_hien, make_date(ls.nam_thuc_hien::integer, 1, 1)), ls.ma_lich_su, ls.id
      ) as seq
    from public.lich_su_moi_han ls
    left join public.du_an da on da.id = ls.du_an_id
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
