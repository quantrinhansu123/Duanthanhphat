-- Thêm chỉ tiêu «Chiều dài mài hoàn thiện» (≤ 800 mm theo phụ lục BBNT).
-- Cập nhật hàm kiểm tra + backfill dung_sai tiêu chí hiện có.

create or replace function public.qlcl_so_do_hop_le(p_value jsonb)
returns boolean language plpgsql immutable set search_path = public, pg_temp as $$
declare item record;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'object' then return false; end if;
  for item in select * from jsonb_each(p_value) loop
    if not (item.key = any(array['doc_mat_lan','ngang_nam_ray','ngang_chan_ray','phang_mat_lan','chieu_dai_mai']))
      or jsonb_typeof(item.value) not in ('number','null') then return false; end if;
  end loop;
  return true;
end $$;

create or replace function public.qlcl_dung_sai_hop_le(p_value jsonb)
returns boolean language plpgsql immutable set search_path = public, pg_temp as $$
declare k text; b jsonb; lo numeric; hi numeric;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(p_value)) <> 5 then return false; end if;
  foreach k in array array['doc_mat_lan','ngang_nam_ray','ngang_chan_ray','phang_mat_lan','chieu_dai_mai'] loop
    b := p_value -> k;
    if b is null or jsonb_typeof(b) <> 'object' then return false; end if;
    if (select count(*) from jsonb_object_keys(b)) <> 4
      or not (b ?& array['min','max','minInclusive','maxInclusive']) then return false; end if;
    if jsonb_typeof(b->'min') not in ('number','null') or jsonb_typeof(b->'max') not in ('number','null')
      or jsonb_typeof(b->'minInclusive') <> 'boolean' or jsonb_typeof(b->'maxInclusive') <> 'boolean' then return false; end if;
    lo := (b->>'min')::numeric; hi := (b->>'max')::numeric;
    if (lo is null and hi is null) or lo > hi or
      (lo = hi and (not (b->>'minInclusive')::boolean or not (b->>'maxInclusive')::boolean)) then return false; end if;
  end loop;
  return true;
end $$;

create or replace function public.qlcl_xet_hinh_hoc(p_do jsonb, p_dung_sai jsonb)
returns text language plpgsql immutable set search_path = public, pg_temp as $$
declare k text; b jsonb; v numeric; lo numeric; hi numeric; missing boolean := false;
begin
  if not public.qlcl_so_do_hop_le(p_do) then raise exception 'Số đo không hợp lệ'; end if;
  if p_dung_sai is null then return null; end if;
  if not public.qlcl_dung_sai_hop_le(p_dung_sai) then raise exception 'Dung sai không hợp lệ'; end if;
  foreach k in array array['doc_mat_lan','ngang_nam_ray','ngang_chan_ray','phang_mat_lan','chieu_dai_mai'] loop
    v := (p_do->>k)::numeric;
    if v is null then missing := true; continue; end if;
    b := p_dung_sai->k; lo := (b->>'min')::numeric; hi := (b->>'max')::numeric;
    if v < lo or v > hi or (v = lo and not (b->>'minInclusive')::boolean)
      or (v = hi and not (b->>'maxInclusive')::boolean) then return 'Không đạt'; end if;
  end loop;
  return case when missing then null else 'Đạt' end;
end $$;

-- Backfill: tiêu chí cũ thiếu chiều dài mài → mặc định ≤ 800 mm (theo phụ lục).
-- Tắt tạm trigger bảo vệ (chỉ cho phép đổi dang_ap_dung khi đã gắn mối) vì đây là
-- bổ sung khóa schema, không phải đổi dung sai nghiệp vụ tay.
alter table public.tieu_chuan_nghiem_thu_moi_han
  disable trigger trg_bao_ve_tieu_chuan_nghiem_thu;

update public.tieu_chuan_nghiem_thu_moi_han
set dung_sai = dung_sai || jsonb_build_object(
  'chieu_dai_mai',
  jsonb_build_object('min', null, 'max', 800, 'minInclusive', true, 'maxInclusive', true)
)
where not (dung_sai ? 'chieu_dai_mai');

alter table public.tieu_chuan_nghiem_thu_moi_han
  enable trigger trg_bao_ve_tieu_chuan_nghiem_thu;

notify pgrst, 'reload schema';
