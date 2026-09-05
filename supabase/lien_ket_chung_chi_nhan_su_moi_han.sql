-- ============================================================
-- Liên kết chuẩn: chứng chỉ -> nhân sự -> mối hàn / nhật ký hàn
-- Chạy sau: schema.sql, lich_su_moi_han.sql, lich_chay_may.sql
-- Có thể chạy lại an toàn. Không xóa dữ liệu hiện có.
-- ============================================================

begin;

-- 1. Chuẩn hóa các chứng chỉ đang nằm trong nhan_su.chung_chi sang bảng hồ sơ.
insert into public.chung_chi (
  ten_chung_chi,
  trang_thai,
  employee_id
)
select distinct
  btrim(chung_chi.ten_chung_chi),
  'Còn hiệu lực',
  ns.employee_id
from public.nhan_su ns
cross join lateral unnest(coalesce(ns.chung_chi, '{}'::text[])) as chung_chi(ten_chung_chi)
where nullif(btrim(chung_chi.ten_chung_chi), '') is not null
  and not exists (
    select 1
    from public.chung_chi cc
    where cc.employee_id = ns.employee_id
      and lower(btrim(cc.ten_chung_chi)) = lower(btrim(chung_chi.ten_chung_chi))
  );

-- Mỗi mối hàn mới có thể trỏ thẳng tới đúng hồ sơ chứng chỉ đã sử dụng.
alter table public.lich_su_moi_han
  add column if not exists chung_chi_id uuid
  references public.chung_chi (id) on delete restrict;

comment on column public.lich_su_moi_han.chung_chi_id is
  'Hồ sơ chứng chỉ cụ thể của nhân sự được sử dụng cho mối hàn';

create index if not exists idx_lich_su_moi_han_chung_chi
  on public.lich_su_moi_han (chung_chi_id);

-- Ghép FK cho dữ liệu đã có tên chứng chỉ chính xác; không suy đoán dữ liệu thiếu.
update public.lich_su_moi_han ls
set chung_chi_id = cc.id
from public.chung_chi cc
where ls.chung_chi_id is null
  and cc.employee_id = ls.tho_han_id
  and nullif(btrim(ls.chung_chi_su_dung), '') is not null
  and lower(btrim(cc.ten_chung_chi)) = lower(btrim(ls.chung_chi_su_dung));

-- 2. Bảng chung_chi là hồ sơ chi tiết; mảng nhan_su.chung_chi là cache dùng
-- cho bộ lọc nhanh. Trigger giữ hai nguồn đồng bộ trong cùng transaction.
create or replace function public.dong_bo_mang_chung_chi_nhan_su(p_employee_id uuid)
returns void
language plpgsql
as $$
begin
  if p_employee_id is null then
    return;
  end if;

  update public.nhan_su ns
  set chung_chi = coalesce((
    select array_agg(cc.ten_chung_chi order by cc.ten_chung_chi)
    from public.chung_chi cc
    where cc.employee_id = p_employee_id
      and cc.trang_thai = 'Còn hiệu lực'
      and (cc.ngay_het_han is null or cc.ngay_het_han >= current_date)
  ), '{}'::text[])
  where ns.employee_id = p_employee_id;
end;
$$;

create or replace function public.trg_dong_bo_chung_chi_nhan_su()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.dong_bo_mang_chung_chi_nhan_su(old.employee_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.employee_id is distinct from new.employee_id then
    perform public.dong_bo_mang_chung_chi_nhan_su(old.employee_id);
  end if;
  perform public.dong_bo_mang_chung_chi_nhan_su(new.employee_id);
  return new;
end;
$$;

drop trigger if exists trg_dong_bo_chung_chi_nhan_su on public.chung_chi;
create trigger trg_dong_bo_chung_chi_nhan_su
  after insert or update or delete on public.chung_chi
  for each row execute function public.trg_dong_bo_chung_chi_nhan_su();

-- 3. Thêm một chứng chỉ cho nhiều nhân sự, ghi hồ sơ và mảng cache nguyên tử.
create or replace function public.them_chung_chi_cho_nhan_su(
  p_employee_ids uuid[],
  p_ten_chung_chi text,
  p_ngay_cap date default null,
  p_ngay_het_han date default null,
  p_file_chung_chi text default null,
  p_trang_thai text default 'Còn hiệu lực'
)
returns integer
language plpgsql
as $$
declare
  employee_id_item uuid;
  certificate_id uuid;
  affected integer := 0;
begin
  if coalesce(array_length(p_employee_ids, 1), 0) = 0 then
    raise exception 'Phải chọn ít nhất một nhân sự';
  end if;
  if nullif(btrim(p_ten_chung_chi), '') is null then
    raise exception 'Tên chứng chỉ không được để trống';
  end if;
  if p_ngay_cap is not null and p_ngay_het_han is not null and p_ngay_het_han < p_ngay_cap then
    raise exception 'Ngày hết hạn phải từ ngày cấp trở đi';
  end if;
  if p_trang_thai not in ('Còn hiệu lực', 'Hết hạn', 'Thu hồi') then
    raise exception 'Trạng thái chứng chỉ không hợp lệ: %', p_trang_thai;
  end if;

  foreach employee_id_item in array p_employee_ids loop
    if not exists (
      select 1 from public.nhan_su where employee_id = employee_id_item
    ) then
      raise exception 'Không tìm thấy nhân sự %', employee_id_item;
    end if;

    select cc.id
    into certificate_id
    from public.chung_chi cc
    where cc.employee_id = employee_id_item
      and lower(btrim(cc.ten_chung_chi)) = lower(btrim(p_ten_chung_chi))
    order by cc.created_at
    limit 1;

    if certificate_id is null then
      insert into public.chung_chi (
        ten_chung_chi,
        ngay_cap,
        ngay_het_han,
        file_chung_chi,
        trang_thai,
        employee_id
      ) values (
        btrim(p_ten_chung_chi),
        p_ngay_cap,
        p_ngay_het_han,
        nullif(btrim(p_file_chung_chi), ''),
        p_trang_thai,
        employee_id_item
      );
    else
      update public.chung_chi
      set ngay_cap = p_ngay_cap,
          ngay_het_han = p_ngay_het_han,
          file_chung_chi = nullif(btrim(p_file_chung_chi), ''),
          trang_thai = p_trang_thai
      where id = certificate_id;
    end if;
    affected := affected + 1;
  end loop;

  return affected;
end;
$$;

-- 4. Ghi nhật ký và khóa đúng hồ sơ chứng chỉ trong một transaction.
create or replace function public.them_nhat_ky_han_lien_ket(
  p_ma_lich_su text,
  p_du_an_id uuid,
  p_tho_han_id uuid,
  p_nam_thuc_hien smallint,
  p_ngay_thuc_hien date,
  p_loai_ray text,
  p_loai_moi_han text,
  p_cong_nghe_han text,
  p_so_luong_loi integer,
  p_nguyen_nhan_loi text,
  p_ghi_chu text,
  p_moi_han_lien_ket text,
  p_may_id uuid,
  p_chung_chi_su_dung text
)
returns uuid
language plpgsql
as $$
declare
  certificate_id uuid;
  weld_id uuid;
begin
  select cc.id
  into certificate_id
  from public.chung_chi cc
  where cc.employee_id = p_tho_han_id
    and cc.trang_thai = 'Còn hiệu lực'
    and (cc.ngay_het_han is null or cc.ngay_het_han >= current_date)
    and lower(btrim(cc.ten_chung_chi)) = lower(btrim(p_chung_chi_su_dung))
  order by cc.created_at
  limit 1;

  if certificate_id is null then
    raise exception 'Chứng chỉ được chọn không thuộc hồ sơ nhân sự hoặc đã bị thu hồi';
  end if;

  insert into public.lich_su_moi_han (
    ma_lich_su,
    du_an_id,
    tho_han_id,
    nam_thuc_hien,
    ngay_thuc_hien,
    loai_ray,
    loai_moi_han,
    cong_nghe_han,
    so_luong_thuc_hien,
    so_luong_loi,
    nguyen_nhan_loi,
    ghi_chu,
    moi_han_lien_ket,
    may_id,
    chung_chi_id,
    chung_chi_su_dung,
    nguon_du_lieu
  ) values (
    btrim(p_ma_lich_su),
    p_du_an_id,
    p_tho_han_id,
    p_nam_thuc_hien,
    p_ngay_thuc_hien,
    btrim(p_loai_ray),
    p_loai_moi_han,
    p_cong_nghe_han,
    1,
    p_so_luong_loi,
    nullif(btrim(p_nguyen_nhan_loi), ''),
    nullif(btrim(p_ghi_chu), ''),
    nullif(btrim(p_moi_han_lien_ket), ''),
    p_may_id,
    certificate_id,
    btrim(p_chung_chi_su_dung),
    'nhat-ky-han'
  ) returning id into weld_id;

  return weld_id;
end;
$$;

-- 5. Ràng buộc nghiệp vụ theo chứng chỉ thật đang có trong hồ sơ R4.
create or replace function public.kiem_tra_chung_chi_moi_han()
returns trigger
language plpgsql
as $$
declare
  machine_code text;
  certificate_name text := lower(coalesce(new.chung_chi_su_dung, ''));
begin
  if new.nguon_du_lieu <> 'nhat-ky-han' then
    return new;
  end if;

  if nullif(btrim(new.chung_chi_su_dung), '') is null or new.chung_chi_id is null then
    raise exception 'Nhật ký hàn phải liên kết một hồ sơ chứng chỉ';
  end if;

  if not exists (
    select 1
    from public.chung_chi cc
    where cc.id = new.chung_chi_id
      and cc.employee_id = new.tho_han_id
      and cc.trang_thai = 'Còn hiệu lực'
      and (cc.ngay_het_han is null or cc.ngay_het_han >= current_date)
      and lower(btrim(cc.ten_chung_chi)) = lower(btrim(new.chung_chi_su_dung))
  ) then
    raise exception 'Chứng chỉ không thuộc nhân sự được chọn hoặc đã bị thu hồi';
  end if;

  select lower(coalesce(tb.ma_may, ''))
  into machine_code
  from public.thiet_bi tb
  where tb.id = new.may_id;

  if new.cong_nghe_han = 'ATW' then
    if certificate_name not like '%thermit%'
       and certificate_name not like '%aluminothermic%'
       and certificate_name not like '%nhôm nhiệt%'
       and certificate_name not like '%hạng 1%'
       and certificate_name not like '%hạng 2%' then
      raise exception 'ATW yêu cầu chứng chỉ hàn nhôm nhiệt (Thermit/Railtech)';
    end if;
  elsif machine_code like '%un5%' then
    if certificate_name not like '%un5%' then
      raise exception 'Máy UN5 yêu cầu chứng chỉ vận hành máy hàn UN5';
    end if;
  elsif machine_code like '%kcm%' or machine_code like '%k922%' or machine_code like '%k920%' then
    if certificate_name not like '%k922%'
       and certificate_name not like '%k920%'
       and certificate_name not like '%kcm%' then
      raise exception 'Máy KCM yêu cầu chứng chỉ vận hành K922-1/KCM';
    end if;
  elsif certificate_name not like '%flash-butt%'
        and certificate_name not like '%vận hành máy hàn%'
        and certificate_name not like '%iso 9606%' then
    raise exception 'FBW yêu cầu chứng chỉ vận hành hàn đối đầu';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_kiem_tra_chung_chi_moi_han on public.lich_su_moi_han;
create trigger trg_kiem_tra_chung_chi_moi_han
  before insert or update of tho_han_id, may_id, loai_ray, cong_nghe_han,
    chung_chi_id, chung_chi_su_dung, nguon_du_lieu
  on public.lich_su_moi_han
  for each row execute function public.kiem_tra_chung_chi_moi_han();

-- Cột mới được thêm cuối view để không đổi thứ tự các cột đang được app dùng.
create or replace view public.bao_cao_moi_han_theo_du_an
with (security_invoker = true)
as
select
  ls.id,
  ls.ma_lich_su,
  da.id as du_an_id,
  da.ma_du_an,
  da.du_an,
  ls.nam_thuc_hien,
  ls.loai_ray,
  ls.loai_moi_han,
  ls.cong_nghe_han,
  ls.so_luong_thuc_hien,
  ls.so_luong_loi,
  ns.employee_id as tho_han_id,
  ns.ma_nhan_su,
  ns.ho_ten as ten_tho_han,
  ls.nguyen_nhan_loi,
  ls.nguon_du_lieu,
  ls.dong_nguon,
  ls.ghi_chu,
  ls.moi_han_lien_ket,
  tb.id as may_id,
  tb.ma_may,
  tb.ten_may,
  ns.to_han,
  ns.chung_chi as chung_chi_nhan_su,
  ls.chung_chi_su_dung,
  ls.ngay_thuc_hien,
  ls.chung_chi_id
from public.lich_su_moi_han ls
join public.du_an da on da.id = ls.du_an_id
join public.nhan_su ns on ns.employee_id = ls.tho_han_id
left join public.thiet_bi tb on tb.id = ls.may_id;

alter table public.chung_chi enable row level security;

-- Ứng dụng hiện chưa có màn đăng nhập và đang dùng anon cho các màn CRUD.
drop policy if exists "anon_all_chung_chi" on public.chung_chi;
create policy "anon_all_chung_chi"
  on public.chung_chi for all to anon
  using (true) with check (true);

drop policy if exists "anon_update_nhan_su_certificates" on public.nhan_su;
create policy "anon_update_nhan_su_certificates"
  on public.nhan_su for update to anon
  using (true) with check (true);

grant select, insert, update, delete on public.chung_chi to anon, authenticated;
grant update (chung_chi) on public.nhan_su to anon;
grant execute on function public.them_chung_chi_cho_nhan_su(uuid[], text, date, date, text, text) to anon, authenticated;
grant execute on function public.them_nhat_ky_han_lien_ket(text, uuid, uuid, smallint, date, text, text, text, integer, text, text, text, uuid, text) to anon, authenticated;
grant select on public.bao_cao_moi_han_theo_du_an to anon, authenticated;

notify pgrst, 'reload schema';

commit;
