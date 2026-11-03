-- Đánh số lại MÃ HỆ THỐNG nhật ký hàn cho liên tục 0001..n.
-- Mã dạng:  {mã dự án}-{FBW|ATW}-{dd}-{mm}-{yy}-{số thứ tự}   VD: PQ-FBW-03-11-26-0016
-- Mỗi nhóm = cùng phần đầu (dự án + công nghệ + ngày). Trong nhóm xếp theo số cũ rồi đến thời điểm tạo,
-- gán lại 0001, 0002, … không còn chỗ trống. Mã không đúng dạng trên được giữ nguyên.
--
-- CÁCH DÙNG (Supabase SQL Editor):
--   1) Xem trước, KHÔNG sửa gì:   select public.danh_so_lai_ma_he_thong(true);
--   2) Chạy thật:                 select public.danh_so_lai_ma_he_thong(false);
--   3) Muốn hoàn tác:             select public.hoan_tac_danh_so_lai_ma_he_thong('<id lần chạy trả về>');
-- Mọi mã đổi đều được ghi vào bảng public.nhat_ky_doi_ma_moi_han (mã cũ → mã mới).
-- NÊN sao lưu database trước khi chạy thật.

create table if not exists public.nhat_ky_doi_ma_moi_han (
  id bigserial primary key,
  lan_chay uuid not null,
  moi_han_id uuid not null,
  ma_cu text not null,
  ma_moi text not null,
  created_at timestamptz not null default now()
);
create index if not exists nhat_ky_doi_ma_moi_han_lan_chay_idx on public.nhat_ky_doi_ma_moi_han (lan_chay);
alter table public.nhat_ky_doi_ma_moi_han enable row level security;

create or replace function public.danh_so_lai_ma_he_thong(p_dry_run boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run uuid := gen_random_uuid();
  v_total integer;
  v_changed integer;
begin
  create temporary table tmp_doi_ma (
    id uuid primary key,
    old_code text not null,
    new_code text not null
  ) on commit drop;

  insert into tmp_doi_ma (id, old_code, new_code)
  select r.id, r.ma_lich_su, r.prefix || '-' || lpad(r.seq::text, 4, '0')
  from (
    select
      ls.id,
      ls.ma_lich_su,
      m[1] as prefix,
      row_number() over (partition by m[1] order by m[2]::integer, ls.created_at, ls.id) as seq
    from public.lich_su_moi_han ls
    cross join lateral regexp_match(ls.ma_lich_su, '^([A-Za-z0-9]+-(?:FBW|ATW)-\d{2}-\d{2}-\d{2})-(\d{1,6})$') as m
    where m is not null
  ) r;

  select count(*) into v_total from tmp_doi_ma;
  select count(*) into v_changed from tmp_doi_ma where old_code is distinct from new_code;

  if p_dry_run or v_changed = 0 then
    return jsonb_build_object(
      'dry_run', p_dry_run, 'tong_so_ma_dung_dang', v_total, 'se_doi', v_changed,
      'mau', (select coalesce(jsonb_agg(jsonb_build_object('cu', old_code, 'moi', new_code)), '[]'::jsonb)
              from (select old_code, new_code from tmp_doi_ma where old_code is distinct from new_code order by new_code limit 15) s)
    );
  end if;

  insert into public.nhat_ky_doi_ma_moi_han (lan_chay, moi_han_id, ma_cu, ma_moi)
  select v_run, id, old_code, new_code from tmp_doi_ma where old_code is distinct from new_code;

  -- Bước 1: mã tạm để không vướng ràng buộc duy nhất khi hoán đổi số
  update public.lich_su_moi_han ls set ma_lich_su = '__RENUM_' || replace(ls.id::text, '-', '')
  from tmp_doi_ma m where ls.id = m.id and m.old_code is distinct from m.new_code;

  -- Bước 2: mã chuẩn 1..n
  update public.lich_su_moi_han ls set ma_lich_su = m.new_code
  from tmp_doi_ma m where ls.id = m.id and m.old_code is distinct from m.new_code;

  -- Mối hàn liên kết (hàn lại) đang trỏ tới mã cũ
  update public.lich_su_moi_han ls set moi_han_lien_ket = m.new_code
  from tmp_doi_ma m where ls.moi_han_lien_ket = m.old_code and m.old_code is distinct from m.new_code;

  return jsonb_build_object('dry_run', false, 'lan_chay', v_run, 'da_doi', v_changed, 'tong_so_ma_dung_dang', v_total);
end;
$$;

create or replace function public.hoan_tac_danh_so_lai_ma_he_thong(p_lan_chay uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  update public.lich_su_moi_han ls set ma_lich_su = '__UNDO_' || replace(ls.id::text, '-', '')
  from public.nhat_ky_doi_ma_moi_han l where l.lan_chay = p_lan_chay and l.moi_han_id = ls.id;

  update public.lich_su_moi_han ls set ma_lich_su = l.ma_cu
  from public.nhat_ky_doi_ma_moi_han l where l.lan_chay = p_lan_chay and l.moi_han_id = ls.id;

  update public.lich_su_moi_han ls set moi_han_lien_ket = l.ma_cu
  from public.nhat_ky_doi_ma_moi_han l where l.lan_chay = p_lan_chay and ls.moi_han_lien_ket = l.ma_moi;

  select count(*) into v_n from public.nhat_ky_doi_ma_moi_han where lan_chay = p_lan_chay;
  delete from public.nhat_ky_doi_ma_moi_han where lan_chay = p_lan_chay;
  return jsonb_build_object('da_hoan_tac', v_n);
end;
$$;

-- Chỉ quản trị chạy trong SQL Editor; không mở cho người dùng app.
revoke all on function public.danh_so_lai_ma_he_thong(boolean) from public, anon, authenticated;
revoke all on function public.hoan_tac_danh_so_lai_ma_he_thong(uuid) from public, anon, authenticated;
