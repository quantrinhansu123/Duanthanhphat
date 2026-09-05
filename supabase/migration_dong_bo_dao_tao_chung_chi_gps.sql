-- ============================================================
-- MIGRATION: ĐỒNG BỘ ĐÀO TẠO, CHỨNG CHỈ, NHÂN SỰ & GPS MỐI HÀN
-- An toàn chạy lại nhiều lần (idempotent), không xóa hay drop bảng dữ liệu hiện có.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. BẢNG CHỨNG CHỈ NHÓM (Dùng chung cho nhiều nhân sự / 1 đợt cấp)
-- ------------------------------------------------------------
create table if not exists public.chung_chi_nhom (
  id                    uuid primary key default gen_random_uuid(),
  ten_nhom              text not null,
  ma_nhom               text,
  loai_chung_chi        text,
  don_vi_cap            text,
  may_ap_dung           text,
  ngay_cap              date,
  ngay_het_han          date,
  file_chung_chi        text,
  cloudinary_public_id  text,
  secure_url            text,
  ghi_chu               text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.chung_chi_nhom is 'Nhóm/loại chứng chỉ chung cho nhiều nhân sự hoặc theo đợt cấp';

-- Bổ sung các cột mở rộng cho bảng chung_chi
alter table public.chung_chi
  add column if not exists nhom_id uuid references public.chung_chi_nhom (id) on delete set null,
  add column if not exists don_vi_cap text,
  add column if not exists so_chung_chi text,
  add column if not exists may_ap_dung text,
  add column if not exists ghi_chu text,
  add column if not exists khoa_dao_tao_nguon uuid,
  add column if not exists cloudinary_public_id text,
  add column if not exists secure_url text;

create index if not exists idx_chung_chi_nhom_id on public.chung_chi (nhom_id);
create index if not exists idx_chung_chi_employee_id on public.chung_chi (employee_id);
create index if not exists idx_chung_chi_ngay_het_han on public.chung_chi (ngay_het_han);

-- Bảng chung_chi là nguồn thật; nhan_su.chung_chi chỉ là cache để tương thích
-- với các màn hình cũ. Trigger giữ cache đồng bộ trong cùng transaction.
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
    select array_agg(distinct cc.ten_chung_chi order by cc.ten_chung_chi)
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

-- ------------------------------------------------------------
-- 2. BỔ SUNG CỘT CHO BẢNG ĐÀO TẠO & TẠO BẢNG HỌC VIÊN ĐÀO TẠO
-- ------------------------------------------------------------
alter table public.dao_tao
  add column if not exists thoi_luong text,
  add column if not exists dia_diem text,
  add column if not exists mo_ta text,
  add column if not exists cloudinary_public_id text,
  add column if not exists secure_url text,
  add column if not exists hinh_anh text,
  add column if not exists nhom_chung_chi_id uuid references public.chung_chi_nhom (id) on delete set null,
  add column if not exists topics text[] default '{}'::text[];

update public.dao_tao
set mo_ta = noi_dung
where nullif(btrim(mo_ta), '') is null and nullif(btrim(noi_dung), '') is not null;

-- Khóa ngoại từ chung_chi đến dao_tao
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_chung_chi_khoa_dao_tao'
  ) then
    alter table public.chung_chi
      add constraint fk_chung_chi_khoa_dao_tao
      foreign key (khoa_dao_tao_nguon) references public.dao_tao (id) on delete set null;
  end if;
end $$;

-- Bảng quan hệ học viên tham gia khóa đào tạo
create table if not exists public.dao_tao_hoc_vien (
  id            uuid primary key default gen_random_uuid(),
  dao_tao_id    uuid not null references public.dao_tao (id) on delete cascade,
  employee_id   uuid not null references public.nhan_su (employee_id) on delete cascade,
  ket_qua       text not null default 'Đang học' check (ket_qua in ('Đạt', 'Không đạt', 'Đang học')),
  trang_thai    text not null default 'Đang học' check (trang_thai in ('Hoàn thành', 'Đang học', 'Không hoàn thành')),
  chung_chi_id  uuid references public.chung_chi (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint dao_tao_hoc_vien_unique unique (dao_tao_id, employee_id)
);

create index if not exists idx_dao_tao_hoc_vien_dao_tao on public.dao_tao_hoc_vien (dao_tao_id);
create index if not exists idx_dao_tao_hoc_vien_employee on public.dao_tao_hoc_vien (employee_id);

-- Giữ lại danh sách học viên đang nằm trong cột uuid[] của cấu trúc cũ.
insert into public.dao_tao_hoc_vien (dao_tao_id, employee_id, ket_qua, trang_thai)
select
  dt.id,
  participant.employee_id,
  case when dt.ket_qua in ('Đạt', 'Không đạt', 'Đang học') then dt.ket_qua else 'Đang học' end,
  case
    when dt.ket_qua = 'Đạt' then 'Hoàn thành'
    when dt.ket_qua = 'Không đạt' then 'Không hoàn thành'
    else 'Đang học'
  end
from public.dao_tao dt
cross join lateral unnest(coalesce(dt.nguoi_tham_gia, '{}'::uuid[])) as participant(employee_id)
where exists (
  select 1 from public.nhan_su ns where ns.employee_id = participant.employee_id
)
on conflict (dao_tao_id, employee_id) do nothing;

-- ------------------------------------------------------------
-- 3. DI CHUYỂN DỮ LIỆU TỪ CHUNG_CHI_HO_SO SANG CHUNG_CHI (NẾU CÓ)
-- ------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'chung_chi_ho_so'
  ) then
    insert into public.chung_chi (
      employee_id,
      ten_chung_chi,
      don_vi_cap,
      so_chung_chi,
      may_ap_dung,
      ngay_cap,
      ngay_het_han,
      trang_thai,
      ghi_chu
    )
    select
      cchs.nhan_su_id,
      btrim(cchs.ten_chung_chi),
      cchs.don_vi_cap,
      cchs.so_chung_chi,
      cchs.may,
      cchs.ngay_cap,
      cchs.ngay_het_han,
      case
        when cchs.trang_thai in ('Còn hiệu lực', 'Hết hạn', 'Thu hồi') then cchs.trang_thai
        when cchs.ngay_het_han is not null and cchs.ngay_het_han < current_date then 'Hết hạn'
        else 'Còn hiệu lực'
      end,
      cchs.ghi_chu
    from public.chung_chi_ho_so cchs
    where cchs.nhan_su_id is not null and nullif(btrim(cchs.ten_chung_chi), '') is not null
      and not exists (
        select 1 from public.chung_chi cc
        where cc.employee_id = cchs.nhan_su_id
          and lower(btrim(cc.ten_chung_chi)) = lower(btrim(cchs.ten_chung_chi))
      );
  end if;
end $$;

-- Gom các hồ sơ chứng chỉ hiện có thành nhóm theo cùng nội dung/đợt cấp.
insert into public.chung_chi_nhom (
  ten_nhom,
  don_vi_cap,
  may_ap_dung,
  ngay_cap,
  ngay_het_han,
  file_chung_chi,
  cloudinary_public_id,
  secure_url,
  ghi_chu
)
select
  btrim(cc.ten_chung_chi),
  cc.don_vi_cap,
  cc.may_ap_dung,
  cc.ngay_cap,
  cc.ngay_het_han,
  cc.file_chung_chi,
  max(cc.cloudinary_public_id),
  max(cc.secure_url),
  max(cc.ghi_chu)
from public.chung_chi cc
where cc.nhom_id is null
  and not exists (
    select 1
    from public.chung_chi_nhom nhom
    where lower(btrim(nhom.ten_nhom)) = lower(btrim(cc.ten_chung_chi))
      and nhom.don_vi_cap is not distinct from cc.don_vi_cap
      and nhom.may_ap_dung is not distinct from cc.may_ap_dung
      and nhom.ngay_cap is not distinct from cc.ngay_cap
      and nhom.ngay_het_han is not distinct from cc.ngay_het_han
      and nhom.file_chung_chi is not distinct from cc.file_chung_chi
  )
group by
  btrim(cc.ten_chung_chi), cc.don_vi_cap, cc.may_ap_dung,
  cc.ngay_cap, cc.ngay_het_han, cc.file_chung_chi;

update public.chung_chi cc
set nhom_id = (
  select nhom.id
  from public.chung_chi_nhom nhom
  where lower(btrim(nhom.ten_nhom)) = lower(btrim(cc.ten_chung_chi))
    and nhom.don_vi_cap is not distinct from cc.don_vi_cap
    and nhom.may_ap_dung is not distinct from cc.may_ap_dung
    and nhom.ngay_cap is not distinct from cc.ngay_cap
    and nhom.ngay_het_han is not distinct from cc.ngay_het_han
    and nhom.file_chung_chi is not distinct from cc.file_chung_chi
  order by nhom.created_at, nhom.id
  limit 1
)
where cc.nhom_id is null;

-- ------------------------------------------------------------
-- 4. BỔ SUNG KHÓA LIÊN KẾT GPS - NHẬT KÝ HÀN
-- ------------------------------------------------------------
alter table public.toa_do
  add column if not exists lich_su_moi_han_id uuid references public.lich_su_moi_han (id) on delete set null;

create index if not exists idx_toa_do_lich_su_moi_han
  on public.toa_do (lich_su_moi_han_id);

-- Mỗi mối hàn chỉ có tối đa 1 điểm toạ độ chính
create unique index if not exists uq_toa_do_lich_su_moi_han
  on public.toa_do (lich_su_moi_han_id)
  where lich_su_moi_han_id is not null;

create sequence if not exists public.toa_do_ma_diem_seq;

do $$
declare
  max_point_number bigint;
  current_sequence bigint;
begin
  select coalesce(max(substring(ma_diem from '^TT([0-9]+)$')::bigint), 0)
  into max_point_number
  from public.toa_do
  where ma_diem ~ '^TT[0-9]+$';

  select last_value into current_sequence from public.toa_do_ma_diem_seq;
  if max_point_number > 0 then
    perform setval(
      'public.toa_do_ma_diem_seq',
      greatest(max_point_number, current_sequence),
      true
    );
  end if;
end $$;

-- View tổng hợp mối hàn và GPS
create or replace view public.bao_cao_moi_han_gps with (security_invoker = true) as
select
  td.id as toa_do_id,
  td.ma_diem,
  td.kinh_do,
  td.vi_do,
  td.ly_trinh as ly_trinh_toa_do,
  td.thu_tu,
  td.ghi_chu as ghi_chu_toa_do,
  td.lich_su_moi_han_id,
  ls.id as moi_han_id,
  ls.ma_lich_su,
  ls.ngay_thuc_hien,
  ls.nam_thuc_hien,
  ls.loai_ray,
  ls.loai_moi_han,
  ls.cong_nghe_han,
  ls.so_luong_loi,
  case when coalesce(ls.so_luong_loi, 0) = 0 then 'Đạt' else 'Lỗi' end as ket_qua_moi_han,
  ls.nguyen_nhan_loi,
  ls.hach_toan,
  ls.chung_chi_su_dung,
  ns.employee_id as tho_han_id,
  ns.ho_ten as ten_tho_han,
  ns.ma_nhan_su,
  tb.id as may_id,
  tb.ma_may,
  tb.ten_may,
  da.id as du_an_id,
  da.du_an as ten_du_an
from public.toa_do td
left join public.lich_su_moi_han ls on ls.id = td.lich_su_moi_han_id
left join public.nhan_su ns on ns.employee_id = ls.tho_han_id
left join public.thiet_bi tb on tb.id = ls.may_id
left join public.du_an da on da.id = coalesce(ls.du_an_id, td.du_an_id);

-- ------------------------------------------------------------
-- 5. RPC LƯU NHẬT KÝ HÀN VÀ TOẠ ĐỘ GPS TRONG CÙNG TRANSACTION
-- ------------------------------------------------------------
create or replace function public.them_nhat_ky_han_co_toa_do(
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
  p_chung_chi_su_dung text,
  p_hach_toan text,
  -- Tọa độ GPS đi kèm (nếu có)
  p_toa_do_id uuid default null,           -- nếu liên kết với điểm đã có
  p_kinh_do double precision default null, -- nếu tạo mới tọa độ
  p_vi_do double precision default null,
  p_ly_trinh text default null
)
returns uuid
language plpgsql
as $$
declare
  weld_id uuid;
  cert_id uuid;
  new_point_code text;
  existing_weld_id uuid;
begin
  -- Tìm chứng chỉ nếu có truyền tên
  if nullif(btrim(p_chung_chi_su_dung), '') is not null then
    select cc.id into cert_id
    from public.chung_chi cc
    where cc.employee_id = p_tho_han_id
      and cc.trang_thai = 'Còn hiệu lực'
      and (cc.ngay_het_han is null or cc.ngay_het_han >= current_date)
      and lower(btrim(cc.ten_chung_chi)) = lower(btrim(p_chung_chi_su_dung))
    order by cc.created_at
    limit 1;
  end if;

  -- 1. Insert nhật ký mối hàn
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
    hach_toan,
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
    coalesce(p_so_luong_loi, 0),
    nullif(btrim(p_nguyen_nhan_loi), ''),
    nullif(btrim(p_ghi_chu), ''),
    nullif(btrim(p_moi_han_lien_ket), ''),
    p_may_id,
    cert_id,
    nullif(btrim(p_chung_chi_su_dung), ''),
    coalesce(nullif(btrim(p_hach_toan), ''), 'HT-SX01'),
    'nhat-ky-han'
  ) returning id into weld_id;

  -- 2. Gán tọa độ GPS
  if p_toa_do_id is not null then
    -- Liên kết điểm tọa độ có sẵn
    select lich_su_moi_han_id
    into existing_weld_id
    from public.toa_do
    where id = p_toa_do_id
    for update;

    if not found then
      raise exception 'Không tìm thấy điểm GPS %', p_toa_do_id;
    end if;
    if existing_weld_id is not null then
      raise exception 'Điểm GPS % đã liên kết với mối hàn %', p_toa_do_id, existing_weld_id;
    end if;

    update public.toa_do
    set lich_su_moi_han_id = weld_id
    where id = p_toa_do_id;
  elsif p_kinh_do is not null and p_vi_do is not null then
    -- Sinh mã điểm mới và lưu tọa độ
    new_point_code := 'TT' || lpad(nextval('public.toa_do_ma_diem_seq')::text, 4, '0');
    insert into public.toa_do (
      ma_diem,
      kinh_do,
      vi_do,
      ly_trinh,
      du_an_id,
      lich_su_moi_han_id
    ) values (
      new_point_code,
      p_kinh_do,
      p_vi_do,
      nullif(btrim(p_ly_trinh), ''),
      p_du_an_id,
      weld_id
    );
  end if;

  return weld_id;
end;
$$;

-- ------------------------------------------------------------
-- 6. RPC TẠO MỘT NHÓM CHỨNG CHỈ CHO NHIỀU NHÂN SỰ
-- ------------------------------------------------------------
create or replace function public.them_nhom_chung_chi_cho_nhan_su(
  p_employee_ids uuid[],
  p_ten_chung_chi text,
  p_ngay_cap date default null,
  p_ngay_het_han date default null,
  p_file_chung_chi text default null,
  p_trang_thai text default 'Còn hiệu lực',
  p_cloudinary_public_id text default null,
  p_secure_url text default null,
  p_don_vi_cap text default null,
  p_so_chung_chi text default null,
  p_may_ap_dung text default null,
  p_ghi_chu text default null
)
returns uuid
language plpgsql
as $$
declare
  v_group_id uuid;
  v_employee_id uuid;
  v_certificate_id uuid;
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

  select id into v_group_id
  from public.chung_chi_nhom
  where lower(btrim(ten_nhom)) = lower(btrim(p_ten_chung_chi))
    and don_vi_cap is not distinct from nullif(btrim(p_don_vi_cap), '')
    and may_ap_dung is not distinct from nullif(btrim(p_may_ap_dung), '')
    and ngay_cap is not distinct from p_ngay_cap
    and ngay_het_han is not distinct from p_ngay_het_han
    and file_chung_chi is not distinct from nullif(btrim(p_file_chung_chi), '')
  order by created_at, id
  limit 1;

  if v_group_id is null then
    insert into public.chung_chi_nhom (
      ten_nhom, don_vi_cap, may_ap_dung, ngay_cap, ngay_het_han,
      file_chung_chi, cloudinary_public_id, secure_url, ghi_chu
    ) values (
      btrim(p_ten_chung_chi), nullif(btrim(p_don_vi_cap), ''), nullif(btrim(p_may_ap_dung), ''),
      p_ngay_cap, p_ngay_het_han, nullif(btrim(p_file_chung_chi), ''),
      nullif(btrim(p_cloudinary_public_id), ''), nullif(btrim(p_secure_url), ''),
      nullif(btrim(p_ghi_chu), '')
    ) returning id into v_group_id;
  end if;

  foreach v_employee_id in array p_employee_ids loop
    if not exists (select 1 from public.nhan_su where employee_id = v_employee_id) then
      raise exception 'Không tìm thấy nhân sự %', v_employee_id;
    end if;

    select id into v_certificate_id
    from public.chung_chi
    where employee_id = v_employee_id and nhom_id = v_group_id
    order by created_at, id
    limit 1;

    if v_certificate_id is null then
      insert into public.chung_chi (
        employee_id, ten_chung_chi, nhom_id, don_vi_cap, so_chung_chi,
        may_ap_dung, ngay_cap, ngay_het_han, file_chung_chi, trang_thai,
        cloudinary_public_id, secure_url, ghi_chu
      ) values (
        v_employee_id, btrim(p_ten_chung_chi), v_group_id, nullif(btrim(p_don_vi_cap), ''),
        nullif(btrim(p_so_chung_chi), ''), nullif(btrim(p_may_ap_dung), ''),
        p_ngay_cap, p_ngay_het_han, nullif(btrim(p_file_chung_chi), ''), p_trang_thai,
        nullif(btrim(p_cloudinary_public_id), ''), nullif(btrim(p_secure_url), ''),
        nullif(btrim(p_ghi_chu), '')
      );
    else
      update public.chung_chi
      set ten_chung_chi = btrim(p_ten_chung_chi),
          don_vi_cap = nullif(btrim(p_don_vi_cap), ''),
          so_chung_chi = nullif(btrim(p_so_chung_chi), ''),
          may_ap_dung = nullif(btrim(p_may_ap_dung), ''),
          ngay_cap = p_ngay_cap,
          ngay_het_han = p_ngay_het_han,
          file_chung_chi = nullif(btrim(p_file_chung_chi), ''),
          trang_thai = p_trang_thai,
          cloudinary_public_id = nullif(btrim(p_cloudinary_public_id), ''),
          secure_url = nullif(btrim(p_secure_url), ''),
          ghi_chu = nullif(btrim(p_ghi_chu), ''),
          updated_at = now()
      where id = v_certificate_id;
    end if;
  end loop;

  return v_group_id;
end;
$$;

create or replace function public.cap_nhat_han_nhom_chung_chi(
  p_nhom_id uuid,
  p_ten_chung_chi text,
  p_ngay_het_han date
)
returns integer
language plpgsql
as $$
declare
  v_updated integer;
begin
  if p_ngay_het_han is null then
    raise exception 'Ngày hết hạn mới không được để trống';
  end if;

  if p_nhom_id is not null then
    update public.chung_chi_nhom
    set ngay_het_han = p_ngay_het_han, updated_at = now()
    where id = p_nhom_id;
    if not found then
      raise exception 'Không tìm thấy nhóm chứng chỉ %', p_nhom_id;
    end if;

    update public.chung_chi
    set ngay_het_han = p_ngay_het_han,
        trang_thai = case when p_ngay_het_han < current_date then 'Hết hạn' else 'Còn hiệu lực' end,
        updated_at = now()
    where nhom_id = p_nhom_id and trang_thai <> 'Thu hồi';
  else
    update public.chung_chi
    set ngay_het_han = p_ngay_het_han,
        trang_thai = case when p_ngay_het_han < current_date then 'Hết hạn' else 'Còn hiệu lực' end,
        updated_at = now()
    where lower(btrim(ten_chung_chi)) = lower(btrim(p_ten_chung_chi))
      and trang_thai <> 'Thu hồi';
  end if;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

-- ------------------------------------------------------------
-- 7. RPC LƯU KHÓA ĐÀO TẠO, HỌC VIÊN VÀ CẤP CHỨNG CHỈ TỰ ĐỘNG
-- ------------------------------------------------------------
create or replace function public.luu_khoa_dao_tao_va_cap_chung_chi(
  p_dao_tao_id uuid, -- nếu null là tạo mới
  p_ten_khoa_hoc text,
  p_ngay date,
  p_thoi_luong text,
  p_dia_diem text,
  p_mo_ta text,
  p_nguoi_dao_tao uuid,
  p_ket_qua_khoa text,
  p_hinh_anh text,
  p_cloudinary_public_id text,
  p_secure_url text,
  p_nhom_chung_chi_id uuid,
  p_topics text[],
  p_hoc_vien jsonb -- mảng object: [{ "employee_id": uuid, "ket_qua": "Đạt", "trang_thai": "Hoàn thành" }]
)
returns uuid
language plpgsql
as $$
declare
  v_dao_tao_id uuid := p_dao_tao_id;
  v_hv record;
  v_nhom record;
  v_chung_chi_id uuid;
  v_old_chung_chi_id uuid;
begin
  if nullif(btrim(p_ten_khoa_hoc), '') is null then
    raise exception 'Tên khóa đào tạo không được để trống';
  end if;

  -- 1. Lưu thông tin khóa học
  if v_dao_tao_id is null then
    insert into public.dao_tao (
      ten_khoa_hoc,
      ngay,
      thoi_luong,
      dia_diem,
      mo_ta,
      nguoi_dao_tao,
      ket_qua,
      hinh_anh,
      cloudinary_public_id,
      secure_url,
      nhom_chung_chi_id,
      topics
    ) values (
      btrim(p_ten_khoa_hoc),
      p_ngay,
      nullif(btrim(p_thoi_luong), ''),
      nullif(btrim(p_dia_diem), ''),
      nullif(btrim(p_mo_ta), ''),
      p_nguoi_dao_tao,
      p_ket_qua_khoa,
      nullif(btrim(p_hinh_anh), ''),
      nullif(btrim(p_cloudinary_public_id), ''),
      nullif(btrim(p_secure_url), ''),
      p_nhom_chung_chi_id,
      coalesce(p_topics, '{}'::text[])
    ) returning id into v_dao_tao_id;
  else
    update public.dao_tao
    set ten_khoa_hoc = btrim(p_ten_khoa_hoc),
        ngay = p_ngay,
        thoi_luong = nullif(btrim(p_thoi_luong), ''),
        dia_diem = nullif(btrim(p_dia_diem), ''),
        mo_ta = nullif(btrim(p_mo_ta), ''),
        nguoi_dao_tao = p_nguoi_dao_tao,
        ket_qua = p_ket_qua_khoa,
        hinh_anh = nullif(btrim(p_hinh_anh), ''),
        cloudinary_public_id = nullif(btrim(p_cloudinary_public_id), ''),
        secure_url = nullif(btrim(p_secure_url), ''),
        nhom_chung_chi_id = p_nhom_chung_chi_id,
        topics = coalesce(p_topics, topics),
        updated_at = now()
    where id = v_dao_tao_id;
    if not found then
      raise exception 'Không tìm thấy khóa đào tạo %', v_dao_tao_id;
    end if;
  end if;

  -- Lấy thông tin nhóm chứng chỉ nếu có gắn với khóa học
  if p_nhom_chung_chi_id is not null then
    select * into v_nhom from public.chung_chi_nhom where id = p_nhom_chung_chi_id;
    if not found then
      raise exception 'Không tìm thấy nhóm chứng chỉ %', p_nhom_chung_chi_id;
    end if;
  end if;

  -- Thu hồi chứng chỉ do chính khóa này cấp cho học viên đã bị bỏ khỏi danh sách.
  update public.chung_chi cc
  set trang_thai = 'Thu hồi', updated_at = now()
  where cc.khoa_dao_tao_nguon = v_dao_tao_id
    and exists (
      select 1
      from public.dao_tao_hoc_vien old_hv
      where old_hv.dao_tao_id = v_dao_tao_id
        and old_hv.employee_id = cc.employee_id
        and not exists (
          select 1
          from jsonb_to_recordset(coalesce(p_hoc_vien, '[]'::jsonb)) as incoming(employee_id uuid)
          where incoming.employee_id = old_hv.employee_id
        )
    );

  delete from public.dao_tao_hoc_vien old_hv
  where old_hv.dao_tao_id = v_dao_tao_id
    and not exists (
      select 1
      from jsonb_to_recordset(coalesce(p_hoc_vien, '[]'::jsonb)) as incoming(employee_id uuid)
      where incoming.employee_id = old_hv.employee_id
    );

  -- 2. Xử lý danh sách học viên hiện tại.
  if p_hoc_vien is not null and jsonb_array_length(p_hoc_vien) > 0 then
    for v_hv in select * from jsonb_to_recordset(p_hoc_vien) as x(
      employee_id uuid,
      ket_qua text,
      trang_thai text
    ) loop
      v_chung_chi_id := null;
      v_old_chung_chi_id := null;

      select chung_chi_id into v_old_chung_chi_id
      from public.dao_tao_hoc_vien
      where dao_tao_id = v_dao_tao_id and employee_id = v_hv.employee_id;

      -- Nếu không còn đạt hoặc đổi nhóm, thu hồi chứng chỉ do chính khóa này đã cấp.
      if v_old_chung_chi_id is not null then
        update public.chung_chi
        set trang_thai = 'Thu hồi', updated_at = now()
        where id = v_old_chung_chi_id
          and khoa_dao_tao_nguon = v_dao_tao_id
          and (
            v_hv.ket_qua is distinct from 'Đạt'
            or nhom_id is distinct from p_nhom_chung_chi_id
          );
      end if;

      -- Nếu kết quả = "Đạt" và khóa học có gắn nhóm chứng chỉ -> Tự động cấp chứng chỉ
      if v_hv.ket_qua = 'Đạt' and p_nhom_chung_chi_id is not null and v_nhom.id is not null then
        -- Tìm xem học viên đã có chứng chỉ của nhóm này chưa
        select id into v_chung_chi_id
        from public.chung_chi
        where employee_id = v_hv.employee_id
          and nhom_id = p_nhom_chung_chi_id
          and (
            (trang_thai = 'Còn hiệu lực' and (ngay_het_han is null or ngay_het_han >= current_date))
            or khoa_dao_tao_nguon = v_dao_tao_id
          )
        order by (khoa_dao_tao_nguon = v_dao_tao_id) desc, created_at desc
        limit 1;

        if v_chung_chi_id is null then
          insert into public.chung_chi (
            employee_id,
            ten_chung_chi,
            nhom_id,
            don_vi_cap,
            may_ap_dung,
            ngay_cap,
            ngay_het_han,
            trang_thai,
            khoa_dao_tao_nguon,
            file_chung_chi,
            cloudinary_public_id,
            secure_url,
            ghi_chu
          ) values (
            v_hv.employee_id,
            v_nhom.ten_nhom,
            p_nhom_chung_chi_id,
            v_nhom.don_vi_cap,
            v_nhom.may_ap_dung,
            coalesce(v_nhom.ngay_cap, p_ngay),
            v_nhom.ngay_het_han,
            'Còn hiệu lực',
            v_dao_tao_id,
            v_nhom.file_chung_chi,
            v_nhom.cloudinary_public_id,
            v_nhom.secure_url,
            'Cấp từ khóa đào tạo: ' || p_ten_khoa_hoc
          ) returning id into v_chung_chi_id;
        else
          update public.chung_chi
          set ten_chung_chi = v_nhom.ten_nhom,
              don_vi_cap = v_nhom.don_vi_cap,
              may_ap_dung = v_nhom.may_ap_dung,
              ngay_cap = coalesce(v_nhom.ngay_cap, p_ngay),
              ngay_het_han = v_nhom.ngay_het_han,
              trang_thai = 'Còn hiệu lực',
              file_chung_chi = v_nhom.file_chung_chi,
              cloudinary_public_id = v_nhom.cloudinary_public_id,
              secure_url = v_nhom.secure_url,
              updated_at = now()
          where id = v_chung_chi_id and khoa_dao_tao_nguon = v_dao_tao_id;
        end if;
      end if;

      -- Upsert vào dao_tao_hoc_vien
      insert into public.dao_tao_hoc_vien (
        dao_tao_id,
        employee_id,
        ket_qua,
        trang_thai,
        chung_chi_id,
        updated_at
      ) values (
        v_dao_tao_id,
        v_hv.employee_id,
        coalesce(v_hv.ket_qua, 'Đang học'),
        coalesce(v_hv.trang_thai, 'Đang học'),
        v_chung_chi_id,
        now()
      )
      on conflict (dao_tao_id, employee_id) do update set
        ket_qua = excluded.ket_qua,
        trang_thai = excluded.trang_thai,
        chung_chi_id = excluded.chung_chi_id,
        updated_at = now();
    end loop;
  end if;

  -- Đồng bộ cột uuid[] cũ để các màn hình/chức năng cũ vẫn đọc đúng học viên.
  update public.dao_tao
  set nguoi_tham_gia = coalesce((
        select array_agg(hv.employee_id order by hv.created_at, hv.employee_id)
        from public.dao_tao_hoc_vien hv
        where hv.dao_tao_id = v_dao_tao_id
      ), '{}'::uuid[]),
      updated_at = now()
  where id = v_dao_tao_id;

  return v_dao_tao_id;
end;
$$;

-- ------------------------------------------------------------
-- 8. CẤP QUYỀN RLS CHO CÁC BẢNG MỚI
-- ------------------------------------------------------------
alter table public.chung_chi_nhom enable row level security;
alter table public.dao_tao_hoc_vien enable row level security;

drop policy if exists "allow_all_chung_chi_nhom" on public.chung_chi_nhom;
create policy "allow_all_chung_chi_nhom" on public.chung_chi_nhom
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "allow_all_dao_tao_hoc_vien" on public.dao_tao_hoc_vien;
create policy "allow_all_dao_tao_hoc_vien" on public.dao_tao_hoc_vien
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon_all_dao_tao" on public.dao_tao;
create policy "anon_all_dao_tao" on public.dao_tao
  for all to anon using (true) with check (true);

grant select, insert, update, delete on public.chung_chi_nhom to anon, authenticated;
grant select, insert, update, delete on public.dao_tao_hoc_vien to anon, authenticated;
grant select, insert, update, delete on public.dao_tao to anon, authenticated;
grant usage, select on sequence public.toa_do_ma_diem_seq to anon, authenticated;

-- ------------------------------------------------------------
-- 9. VIEW BÁO CÁO LỊCH SỬ MỐI HÀN CHI TIẾT
-- ------------------------------------------------------------
create or replace view public.v_lich_su_moi_han_chi_tiet with (security_invoker = true) as
select
  ls.id,
  ls.ma_lich_su,
  ls.ngay_thuc_hien,
  ls.nam_thuc_hien,
  ls.loai_ray,
  ls.loai_moi_han,
  ls.cong_nghe_han,
  ls.so_luong_thuc_hien,
  ls.so_luong_loi,
  ls.hach_toan,
  ls.moi_han_lien_ket,
  ls.ghi_chu,
  ls.tho_han_id,
  ns.ho_ten as ten_tho_han,
  ns.ma_nhan_su,
  ls.du_an_id,
  da.du_an as ten_du_an,
  da.ma_du_an,
  ls.may_id,
  tb.ma_may as ten_may,
  case
    when ls.ghi_chu ilike '%Kết quả: Sửa chữa%' or (coalesce(ls.so_luong_loi, 0) > 0 and (ls.ghi_chu ilike '%sửa chữa%' or ls.moi_han_lien_ket ilike 'SC-%')) then 'Sửa chữa'
    when ls.ghi_chu ilike '%Kết quả: Không đạt%' or (coalesce(ls.so_luong_loi, 0) > 0) then 'Không đạt'
    else 'Đạt'
  end as ket_qua,
  case
    when ls.ghi_chu ilike '%Ca 2%' then 'Ca 2'
    when ls.ghi_chu ilike '%Ca 3%' then 'Ca 3'
    else 'Ca 1'
  end as ca_han
from public.lich_su_moi_han ls
left join public.nhan_su ns on ns.employee_id = ls.tho_han_id
left join public.du_an da on da.id = ls.du_an_id
left join public.thiet_bi tb on tb.id = ls.may_id;

-- Thống kê trên toàn bộ tập đã lọc, không phụ thuộc giới hạn max-rows của REST.
create or replace function public.thong_ke_lich_su_moi_han(
  p_date_from date default null,
  p_date_to date default null,
  p_welder text default null,
  p_result text default null,
  p_machines text[] default null,
  p_rails text[] default null,
  p_projects text[] default null,
  p_shifts text[] default null,
  p_accounting_codes text[] default null,
  p_query text default null
)
returns table (
  tong bigint,
  dat bigint,
  khong_dat bigint,
  sua_chua bigint,
  thong_ke_hach_toan jsonb
)
language sql
stable
as $$
  with filtered as (
    select *
    from public.v_lich_su_moi_han_chi_tiet row_data
    where (p_date_from is null or row_data.ngay_thuc_hien >= p_date_from)
      and (p_date_to is null or row_data.ngay_thuc_hien <= p_date_to)
      and (nullif(btrim(p_welder), '') is null or row_data.ten_tho_han = p_welder)
      and (nullif(btrim(p_result), '') is null or row_data.ket_qua = p_result)
      and (coalesce(cardinality(p_machines), 0) = 0 or row_data.ten_may = any(p_machines))
      and (coalesce(cardinality(p_rails), 0) = 0 or row_data.loai_ray = any(p_rails))
      and (coalesce(cardinality(p_projects), 0) = 0 or row_data.ten_du_an = any(p_projects))
      and (coalesce(cardinality(p_shifts), 0) = 0 or row_data.ca_han = any(p_shifts))
      and (coalesce(cardinality(p_accounting_codes), 0) = 0 or row_data.hach_toan = any(p_accounting_codes))
      and (
        nullif(btrim(p_query), '') is null
        or row_data.ma_lich_su ilike '%' || p_query || '%'
        or row_data.moi_han_lien_ket ilike '%' || p_query || '%'
        or row_data.ghi_chu ilike '%' || p_query || '%'
        or row_data.ten_tho_han ilike '%' || p_query || '%'
        or row_data.ten_du_an ilike '%' || p_query || '%'
        or row_data.ten_may ilike '%' || p_query || '%'
        or row_data.hach_toan ilike '%' || p_query || '%'
      )
  ),
  totals as (
    select
      count(*) as tong,
      count(*) filter (where ket_qua = 'Đạt') as dat,
      count(*) filter (where ket_qua = 'Không đạt') as khong_dat,
      count(*) filter (where ket_qua = 'Sửa chữa') as sua_chua
    from filtered
  ),
  accounting as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object('code', hach_toan, 'count', so_luong)
        order by so_luong desc, hach_toan
      ),
      '[]'::jsonb
    ) as payload
    from (
      select hach_toan, count(*) as so_luong
      from filtered
      where nullif(btrim(hach_toan), '') is not null
      group by hach_toan
    ) grouped
  )
  select totals.tong, totals.dat, totals.khong_dat, totals.sua_chua, accounting.payload
  from totals cross join accounting;
$$;

revoke execute on function public.them_nhat_ky_han_co_toa_do(
  text, uuid, uuid, smallint, date, text, text, text, integer, text, text, text,
  uuid, text, text, uuid, double precision, double precision, text
) from public;
revoke execute on function public.them_nhom_chung_chi_cho_nhan_su(
  uuid[], text, date, date, text, text, text, text, text, text, text, text
) from public;
revoke execute on function public.cap_nhat_han_nhom_chung_chi(uuid, text, date) from public;
revoke execute on function public.luu_khoa_dao_tao_va_cap_chung_chi(
  uuid, text, date, text, text, text, uuid, text, text, text, text, uuid, text[], jsonb
) from public;
revoke execute on function public.thong_ke_lich_su_moi_han(
  date, date, text, text, text[], text[], text[], text[], text[], text
) from public;

grant execute on function public.them_nhat_ky_han_co_toa_do(
  text, uuid, uuid, smallint, date, text, text, text, integer, text, text, text,
  uuid, text, text, uuid, double precision, double precision, text
) to anon, authenticated;
grant execute on function public.them_nhom_chung_chi_cho_nhan_su(
  uuid[], text, date, date, text, text, text, text, text, text, text, text
) to anon, authenticated;
grant execute on function public.cap_nhat_han_nhom_chung_chi(uuid, text, date) to anon, authenticated;
grant execute on function public.luu_khoa_dao_tao_va_cap_chung_chi(
  uuid, text, date, text, text, text, uuid, text, text, text, text, uuid, text[], jsonb
) to anon, authenticated;
grant execute on function public.thong_ke_lich_su_moi_han(
  date, date, text, text, text[], text[], text[], text[], text[], text
) to anon, authenticated;
grant select on public.bao_cao_moi_han_gps to anon, authenticated;
grant select on public.v_lich_su_moi_han_chi_tiet to anon, authenticated;

commit;

notify pgrst, 'reload schema';
