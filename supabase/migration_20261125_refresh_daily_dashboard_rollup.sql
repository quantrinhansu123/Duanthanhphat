-- Rebuild the existing per-day summary for Vietnam yesterday and today.
-- The chart already reads thong_ke_moi_han_theo_ngay; this RPC repairs only
-- the two live days without scanning/replacing the historical rollup.

do $$
begin
  if to_regclass('public.thong_ke_moi_han_theo_ngay') is null then
    raise exception 'Missing public.thong_ke_moi_han_theo_ngay; apply the daily rollup migrations first.';
  end if;
end;
$$;

create or replace function public.rebuild_thong_ke_moi_han_theo_ngay_today_yesterday()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_yesterday date;
  v_days jsonb;
begin
  v_yesterday := v_today - 1;

  -- Prevent trigger writes to the summary table from interleaving with this
  -- replacement. New journal writes resume after this short transaction.
  lock table public.thong_ke_moi_han_theo_ngay in exclusive mode;

  delete from public.thong_ke_moi_han_theo_ngay
  where ngay_thuc_hien in (v_yesterday, v_today);

  insert into public.thong_ke_moi_han_theo_ngay
    (ngay_thuc_hien, du_an_id, cong_nghe_han, loai_moi_han,
     so_moi, so_dat, so_khong_dat, so_cho_tn, so_khong_tn, so_han_lai)
  select
    ngay_thuc_hien,
    du_an_id,
    cong_nghe_han,
    loai_moi_han,
    count(*),
    count(*) filter (where tinh_trang_thi_nghiem = 'Đạt'),
    count(*) filter (where tinh_trang_thi_nghiem = 'Không đạt'),
    count(*) filter (where tinh_trang_thi_nghiem = 'Chờ thí nghiệm'),
    count(*) filter (where tinh_trang_thi_nghiem = 'Không thí nghiệm'),
    count(*) filter (where nullif(btrim(moi_han_lien_ket), '') is not null)
  from public.lich_su_moi_han
  where ngay_thuc_hien in (v_yesterday, v_today)
  group by ngay_thuc_hien, du_an_id, cong_nghe_han, loai_moi_han;

  select jsonb_agg(
    jsonb_build_object(
      'date', d.day,
      'groups', coalesce(s.groups, 0),
      'welds', coalesce(s.welds, 0)
    ) order by d.day
  )
  into v_days
  from (values (v_yesterday), (v_today)) as d(day)
  left join lateral (
    select count(*)::bigint as groups, coalesce(sum(t.so_moi), 0)::bigint as welds
    from public.thong_ke_moi_han_theo_ngay t
    where t.ngay_thuc_hien = d.day
  ) s on true;

  return jsonb_build_object('days', coalesce(v_days, '[]'::jsonb), 'timezone', 'Asia/Ho_Chi_Minh');
end;
$$;

comment on function public.rebuild_thong_ke_moi_han_theo_ngay_today_yesterday() is
  'Rebuilds only yesterday and today in the existing daily weld rollup for the dashboard.';

revoke all on function public.rebuild_thong_ke_moi_han_theo_ngay_today_yesterday() from public, anon, authenticated;
grant execute on function public.rebuild_thong_ke_moi_han_theo_ngay_today_yesterday() to service_role;
