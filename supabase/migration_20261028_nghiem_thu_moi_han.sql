-- Giai đoạn 1: nền dữ liệu chất lượng. Chạy bằng SQL Editor sau các migration nhật ký hiện có.
-- Không backfill kết quả cũ, không đổi nghĩa tinh_trang_thi_nghiem, không tự áp dụng dung sai PQ.
begin;

create or replace function public.qlcl_so_do_hop_le(p_value jsonb)
returns boolean language plpgsql immutable set search_path = public, pg_temp as $$
declare item record;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'object' then return false; end if;
  for item in select * from jsonb_each(p_value) loop
    if not (item.key = any(array['doc_mat_lan','ngang_nam_ray','ngang_chan_ray','phang_mat_lan']))
      or jsonb_typeof(item.value) not in ('number','null') then return false; end if;
  end loop;
  return true;
end $$;

create or replace function public.qlcl_dung_sai_hop_le(p_value jsonb)
returns boolean language plpgsql immutable set search_path = public, pg_temp as $$
declare k text; b jsonb; lo numeric; hi numeric;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(p_value)) <> 4 then return false; end if;
  foreach k in array array['doc_mat_lan','ngang_nam_ray','ngang_chan_ray','phang_mat_lan'] loop
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
  foreach k in array array['doc_mat_lan','ngang_nam_ray','ngang_chan_ray','phang_mat_lan'] loop
    v := (p_do->>k)::numeric;
    if v is null then missing := true; continue; end if;
    b := p_dung_sai->k; lo := (b->>'min')::numeric; hi := (b->>'max')::numeric;
    if v < lo or v > hi or (v = lo and not (b->>'minInclusive')::boolean)
      or (v = hi and not (b->>'maxInclusive')::boolean) then return 'Không đạt'; end if;
  end loop;
  return case when missing then null else 'Đạt' end;
end $$;

create table if not exists public.tieu_chuan_nghiem_thu_moi_han (
  id uuid primary key default gen_random_uuid(),
  du_an_id uuid not null references public.du_an(id) on delete restrict,
  cong_nghe_han text not null check (cong_nghe_han in ('FBW','ATW')),
  loai_moi_han text not null check (loai_moi_han in ('Đào tạo','Thử nghiệm','Chấp thuận','Sản xuất','Tần suất')),
  phien_ban integer not null check (phien_ban > 0),
  ten text not null check (btrim(ten) <> ''),
  dung_sai jsonb not null check (public.qlcl_dung_sai_hop_le(dung_sai)),
  yeu_cau_ndt boolean not null,
  ndt_truoc_rfi boolean not null,
  can_cu_mien_ndt text,
  nguoi_xac_nhan text not null check (btrim(nguoi_xac_nhan) <> ''),
  dang_ap_dung boolean not null default false,
  created_at timestamptz not null default now(),
  check (yeu_cau_ndt or nullif(btrim(can_cu_mien_ndt),'') is not null),
  unique (du_an_id, cong_nghe_han, loai_moi_han, phien_ban)
);
create unique index if not exists uq_tieu_chuan_nghiem_thu_ap_dung
  on public.tieu_chuan_nghiem_thu_moi_han(du_an_id,cong_nghe_han,loai_moi_han) where dang_ap_dung;

create table if not exists public.kiem_tra_moi_han (
  moi_han_id uuid primary key references public.lich_su_moi_han(id) on delete restrict,
  tieu_chuan_id uuid references public.tieu_chuan_nghiem_thu_moi_han(id) on delete restrict,
  ngay_mai date,
  truc_quan text check (truc_quan in ('Đạt','Không đạt')),
  gia_tri_do jsonb not null default '{}'::jsonb check (public.qlcl_so_do_hop_le(gia_tri_do)),
  phuong_phap_ndt text not null default 'Siêu âm' check (phuong_phap_ndt in ('Siêu âm','Từ tính','Thẩm thấu')),
  ket_qua_ndt text check (ket_qua_ndt in ('Đạt','Không đạt')),
  ngay_ndt date,
  ly_do_loai_nghiem_thu text check (ly_do_loai_nghiem_thu is null or btrim(ly_do_loai_nghiem_thu) <> ''),
  nguoi_ghi_nhan text,
  ghi_chu text,
  phien_ban integer not null default 1 check (phien_ban > 0),
  updated_at timestamptz not null default now(),
  check (ket_qua_ndt is null or ngay_ndt is not null),
  check (truc_quan is null or ngay_mai is not null)
);
create index if not exists idx_kiem_tra_moi_han_tieu_chuan on public.kiem_tra_moi_han(tieu_chuan_id);

create table if not exists public.phieu_yeu_cau_nghiem_thu (
  id uuid primary key,
  du_an_id uuid not null references public.du_an(id) on delete restrict,
  so_phieu text not null check (btrim(so_phieu) <> ''),
  ngay_moi date not null,
  nguoi_lap text not null check (btrim(nguoi_lap) <> ''),
  thong_tin jsonb not null default '{}'::jsonb check (jsonb_typeof(thong_tin) = 'object'),
  trang_thai text not null default 'Đã phát hành' check (trang_thai in ('Đã phát hành','Đã hoàn thành','Đã huỷ')),
  created_at timestamptz not null default now(),
  unique (du_an_id,so_phieu)
);
create table if not exists public.phieu_yeu_cau_nghiem_thu_moi (
  phieu_id uuid not null references public.phieu_yeu_cau_nghiem_thu(id) on delete restrict,
  moi_han_id uuid not null references public.lich_su_moi_han(id) on delete restrict,
  du_lieu_chot jsonb not null,
  con_hieu_luc boolean not null default true,
  primary key (phieu_id,moi_han_id)
);
create unique index if not exists uq_rfi_moi_han_hieu_luc
  on public.phieu_yeu_cau_nghiem_thu_moi(moi_han_id) where con_hieu_luc;

create table if not exists public.dot_nghiem_thu (
  id uuid primary key,
  phieu_id uuid not null references public.phieu_yeu_cau_nghiem_thu(id) on delete restrict,
  ngay_nghiem_thu date not null,
  nguoi_lap text not null check (btrim(nguoi_lap) <> ''),
  thong_tin jsonb not null check (jsonb_typeof(thong_tin) = 'object'),
  yeu_cau jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_dot_nghiem_thu_phieu on public.dot_nghiem_thu(phieu_id,ngay_nghiem_thu);
create table if not exists public.dot_nghiem_thu_moi (
  dot_id uuid not null references public.dot_nghiem_thu(id) on delete restrict,
  moi_han_id uuid not null references public.lich_su_moi_han(id) on delete restrict,
  ket_qua text not null check (ket_qua in ('Đạt','Không đạt','Chưa nghiệm thu')),
  ly_do text,
  du_lieu_chot jsonb not null,
  primary key (dot_id,moi_han_id),
  check (ket_qua = 'Đạt' or nullif(btrim(ly_do),'') is not null)
);
create unique index if not exists uq_moi_han_nghiem_thu_dat
  on public.dot_nghiem_thu_moi(moi_han_id) where ket_qua = 'Đạt';
create table if not exists public.ho_so_nghiem_thu (
  id uuid primary key default gen_random_uuid(),
  dot_id uuid not null references public.dot_nghiem_thu(id) on delete restrict,
  loai text not null check (loai in ('Hoàn thành công việc','Phụ lục công việc','Giai đoạn xây dựng')),
  du_lieu_chot jsonb not null,
  phien_ban_mau text,
  tinh_trang_ky text not null default 'Chờ ký' check (tinh_trang_ky in ('Chờ ký','Đã ký')),
  created_at timestamptz not null default now(),
  unique (dot_id,loai)
);

-- Quy tắc chỉ đọc, dùng chung cho view và các RPC có ghi dữ liệu.
create or replace view public.chat_luong_moi_han with (security_invoker = true) as
select ls.id as moi_han_id, ls.du_an_id, ls.loai_moi_han, ls.cong_nghe_han, ls.ngay_thuc_hien,
  kt.phien_ban, kt.tieu_chuan_id, hh.ket_qua as ket_qua_hinh_hoc,
  coalesce(ls.so_luong_thuc_hien = 1 and flags.noi_bo_dat and not flags.loi and (not tc.ndt_truoc_rfi or flags.ndt_dat),false) as du_dieu_kien_rfi,
  coalesce(ls.so_luong_thuc_hien = 1 and flags.noi_bo_dat and flags.ndt_dat and not flags.loi,false) as du_dieu_kien_nghiem_thu,
  case
    when exists (select 1 from public.dot_nghiem_thu_moi dm where dm.moi_han_id = ls.id and dm.ket_qua = 'Đạt') then 'Nghiệm thu đạt'
    when kt.moi_han_id is null then 'Chưa có dữ liệu chất lượng'
    when flags.loi then 'Không đạt'
    when tc.yeu_cau_ndt = false then 'Không thí nghiệm'
    when flags.noi_bo_dat and flags.ndt_dat then 'Chờ nghiệm thu'
    when flags.noi_bo_dat or ls.loai_moi_han in ('Thử nghiệm','Chấp thuận') then 'Chờ thí nghiệm'
    else 'Chờ mài'
  end as tinh_trang
from public.lich_su_moi_han ls
left join public.kiem_tra_moi_han kt on kt.moi_han_id = ls.id
left join public.tieu_chuan_nghiem_thu_moi_han tc on tc.id = kt.tieu_chuan_id
cross join lateral (select public.qlcl_xet_hinh_hoc(coalesce(kt.gia_tri_do,'{}'::jsonb),tc.dung_sai) as ket_qua) hh
cross join lateral (select
  coalesce(kt.ngay_mai is not null and kt.truc_quan = 'Đạt' and hh.ket_qua = 'Đạt',false) as noi_bo_dat,
  coalesce(not tc.yeu_cau_ndt or (kt.ket_qua_ndt = 'Đạt' and kt.ngay_ndt is not null),false) as ndt_dat,
  kt.ly_do_loai_nghiem_thu is not null or coalesce(kt.truc_quan = 'Không đạt',false)
    or coalesce(hh.ket_qua = 'Không đạt',false) or coalesce(kt.ket_qua_ndt = 'Không đạt',false) as loi
) flags;

create or replace view public.moi_han_can_bo_sung_chat_luong with (security_invoker = true) as
select ls.id,ls.ma_lich_su,ls.du_an_id,ls.ngay_thuc_hien,ls.tinh_trang_thi_nghiem,
  case when kt.moi_han_id is null then 'Chưa ghi nhận chất lượng; kết quả cũ chưa chứng minh nghiệm thu'
    when kt.tieu_chuan_id is null then 'Chưa xác nhận tiêu chí áp dụng'
    else 'Chưa đủ dữ liệu kiểm tra' end as ly_do
from public.lich_su_moi_han ls
left join public.kiem_tra_moi_han kt on kt.moi_han_id = ls.id
join public.chat_luong_moi_han cl on cl.moi_han_id = ls.id
where kt.moi_han_id is null or kt.tieu_chuan_id is null or
  (cl.ket_qua_hinh_hoc is null or kt.truc_quan is null);

create or replace function public.khoi_tao_chat_luong_moi_han()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Trigger tại bảng gốc bao phủ mọi RPC cũ, Excel, Autolisp và insert trực tiếp.
  insert into public.kiem_tra_moi_han(moi_han_id) values (new.id);
  return new;
end $$;
drop trigger if exists trg_khoi_tao_chat_luong_moi_han on public.lich_su_moi_han;
create trigger trg_khoi_tao_chat_luong_moi_han after insert on public.lich_su_moi_han
  for each row execute function public.khoi_tao_chat_luong_moi_han();

create or replace function public.bao_ve_kiem_tra_moi_han()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare ls public.lich_su_moi_han; tc public.tieu_chuan_nghiem_thu_moi_han;
begin
  select * into strict ls from public.lich_su_moi_han where id = new.moi_han_id for update;
  if ls.so_luong_thuc_hien <> 1 and
    (new.tieu_chuan_id is not null or new.ngay_mai is not null or new.truc_quan is not null
      or new.gia_tri_do <> '{}'::jsonb or new.ket_qua_ndt is not null) then
    raise exception 'Chỉ kiểm tra từng mối; bản ghi khối lượng tổng hợp cần được tách và xác minh';
  end if;
  if exists (select 1 from public.dot_nghiem_thu_moi where moi_han_id = new.moi_han_id and ket_qua = 'Đạt') then
    raise exception 'Mối đã nghiệm thu; cần lập bản sửa đổi trước khi sửa kiểm tra';
  end if;
  if tg_op = 'UPDATE' and new.moi_han_id <> old.moi_han_id then raise exception 'Không được đổi ID mối kiểm tra'; end if;
  if new.tieu_chuan_id is not null then
    select * into strict tc from public.tieu_chuan_nghiem_thu_moi_han where id = new.tieu_chuan_id for share;
    if tc.du_an_id <> ls.du_an_id or tc.cong_nghe_han <> ls.cong_nghe_han or tc.loai_moi_han <> ls.loai_moi_han then
      raise exception 'Tiêu chí không thuộc dự án/công nghệ/loại mối';
    end if;
    if not tc.dang_ap_dung and (tg_op = 'INSERT' or new.tieu_chuan_id is distinct from old.tieu_chuan_id) then
      raise exception 'Tiêu chí chưa được xác nhận áp dụng';
    end if;
  end if;
  if tg_op = 'UPDATE' then new.phien_ban := old.phien_ban + 1; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_bao_ve_kiem_tra_moi_han on public.kiem_tra_moi_han;
create trigger trg_bao_ve_kiem_tra_moi_han before insert or update on public.kiem_tra_moi_han
  for each row execute function public.bao_ve_kiem_tra_moi_han();

create or replace function public.bao_ve_tieu_chuan_nghiem_thu()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if (to_jsonb(new) - 'dang_ap_dung') is distinct from (to_jsonb(old) - 'dang_ap_dung')
    and exists (select 1 from public.kiem_tra_moi_han where tieu_chuan_id = old.id) then
    raise exception 'Tiêu chí đã dùng; hãy tạo phiên bản mới';
  end if;
  return new;
end $$;
drop trigger if exists trg_bao_ve_tieu_chuan_nghiem_thu on public.tieu_chuan_nghiem_thu_moi_han;
create trigger trg_bao_ve_tieu_chuan_nghiem_thu before update on public.tieu_chuan_nghiem_thu_moi_han
  for each row execute function public.bao_ve_tieu_chuan_nghiem_thu();

-- Chặn đổi nền kiểm tra qua các màn hình cũ; không thay đổi cách đánh mã hoặc dữ liệu GPS.
create or replace function public.bao_ve_nguon_chat_luong_moi_han()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.kiem_tra_moi_han where moi_han_id = old.id and
      (tieu_chuan_id is not null or ngay_mai is not null or truc_quan is not null or gia_tri_do <> '{}'::jsonb
        or ket_qua_ndt is not null or ngay_ndt is not null or nguoi_ghi_nhan is not null)) then
      raise exception 'Mối đã ghi nhận kiểm tra; không được xoá dữ liệu chất lượng';
    end if;
    delete from public.kiem_tra_moi_han where moi_han_id = old.id;
    return old;
  end if;
  if (new.du_an_id,new.cong_nghe_han,new.loai_moi_han,new.so_luong_thuc_hien)
    is distinct from (old.du_an_id,old.cong_nghe_han,old.loai_moi_han,old.so_luong_thuc_hien)
    and exists (select 1 from public.kiem_tra_moi_han where moi_han_id = old.id and tieu_chuan_id is not null) then
    raise exception 'Mối đã có tiêu chí kiểm tra; cần xử lý hồ sơ chất lượng trước khi đổi dự án/công nghệ/loại/khối lượng';
  end if;
  return new;
end $$;
drop trigger if exists trg_bao_ve_nguon_chat_luong_moi_han on public.lich_su_moi_han;
create trigger trg_bao_ve_nguon_chat_luong_moi_han before update or delete on public.lich_su_moi_han
  for each row execute function public.bao_ve_nguon_chat_luong_moi_han();

create or replace function public.luu_kiem_tra_moi_han(
  p_moi_han_id uuid, p_phien_ban integer, p_tieu_chuan_id uuid, p_ngay_mai date, p_truc_quan text,
  p_gia_tri_do jsonb, p_phuong_phap_ndt text, p_ket_qua_ndt text, p_ngay_ndt date,
  p_nguoi_ghi_nhan text, p_ghi_chu text default null, p_ly_do_loai_nghiem_thu text default null
)
returns public.kiem_tra_moi_han language plpgsql set search_path = public, pg_temp as $$
declare result public.kiem_tra_moi_han;
begin
  if nullif(btrim(p_nguoi_ghi_nhan),'') is null then raise exception 'Thiếu người ghi nhận'; end if;
  perform 1 from public.lich_su_moi_han where id = p_moi_han_id for update;
  if not found then raise exception 'Không tìm thấy mối hàn'; end if;
  if p_phien_ban = 0 then
    insert into public.kiem_tra_moi_han(moi_han_id) values (p_moi_han_id) on conflict do nothing;
    if not found then raise exception 'Dữ liệu đã thay đổi; hãy tải lại'; end if;
    p_phien_ban := 1;
  end if;
  update public.kiem_tra_moi_han set tieu_chuan_id = p_tieu_chuan_id, ngay_mai = p_ngay_mai,
    truc_quan = p_truc_quan, gia_tri_do = p_gia_tri_do, phuong_phap_ndt = p_phuong_phap_ndt,
    ket_qua_ndt = p_ket_qua_ndt, ngay_ndt = p_ngay_ndt, nguoi_ghi_nhan = btrim(p_nguoi_ghi_nhan), ghi_chu = p_ghi_chu,
    ly_do_loai_nghiem_thu = nullif(btrim(p_ly_do_loai_nghiem_thu),'')
  where moi_han_id = p_moi_han_id and phien_ban = p_phien_ban returning * into result;
  if not found then raise exception 'Dữ liệu đã thay đổi; hãy tải lại'; end if;
  return result;
end $$;

create or replace function public.phat_hanh_rfi_moi_han(
  p_id uuid, p_du_an_id uuid, p_so_phieu text, p_ngay_moi date, p_moi_han_ids uuid[],
  p_nguoi_lap text, p_thong_tin jsonb default '{}'::jsonb
)
returns uuid language plpgsql set search_path = public, pg_temp as $$
declare existing public.phieu_yeu_cau_nghiem_thu; weld_id uuid; selected_ids uuid[];
begin
  if coalesce(cardinality(p_moi_han_ids),0) = 0 or array_position(p_moi_han_ids,null) is not null or
    cardinality(p_moi_han_ids) <> (select count(distinct id) from unnest(p_moi_han_ids) id) then
    raise exception 'Danh sách mối phải khác rỗng và không trùng';
  end if;
  select array_agg(id order by id) into selected_ids from unnest(p_moi_han_ids) id;
  select * into existing from public.phieu_yeu_cau_nghiem_thu where id = p_id;
  if found then
    if (existing.du_an_id,existing.so_phieu,existing.ngay_moi,existing.nguoi_lap,existing.thong_tin)
      is distinct from (p_du_an_id,btrim(p_so_phieu),p_ngay_moi,btrim(p_nguoi_lap),p_thong_tin)
      or selected_ids is distinct from (select array_agg(moi_han_id order by moi_han_id) from public.phieu_yeu_cau_nghiem_thu_moi where phieu_id = p_id) then
      raise exception 'Mã yêu cầu đã được dùng với nội dung khác';
    end if;
    return p_id;
  end if;
  -- Cùng thứ tự khoá cho các phiếu khác nhau có chung mối, tránh deadlock.
  perform 1 from public.lich_su_moi_han where id = any(selected_ids) order by id for update;
  -- Kiểm tra lại sau khi chờ khoá: yêu cầu giống nhau có thể vừa được lưu ở phiên khác.
  if exists (select 1 from public.phieu_yeu_cau_nghiem_thu where id = p_id) then
    return public.phat_hanh_rfi_moi_han(p_id,p_du_an_id,p_so_phieu,p_ngay_moi,p_moi_han_ids,p_nguoi_lap,p_thong_tin);
  end if;
  foreach weld_id in array selected_ids loop
    if not exists (select 1 from public.chat_luong_moi_han where moi_han_id = weld_id and du_an_id = p_du_an_id
      and du_dieu_kien_rfi and tinh_trang <> 'Nghiệm thu đạt') then
      raise exception 'Mối % chưa đủ điều kiện RFI hoặc sai dự án',weld_id;
    end if;
  end loop;
  insert into public.phieu_yeu_cau_nghiem_thu(id,du_an_id,so_phieu,ngay_moi,nguoi_lap,thong_tin)
    values (p_id,p_du_an_id,btrim(p_so_phieu),p_ngay_moi,btrim(p_nguoi_lap),p_thong_tin);
  insert into public.phieu_yeu_cau_nghiem_thu_moi(phieu_id,moi_han_id,du_lieu_chot)
    select p_id,ls.id,jsonb_build_object('moi_han',to_jsonb(ls),'kiem_tra',to_jsonb(kt),'tieu_chuan',to_jsonb(tc))
    from public.lich_su_moi_han ls join public.kiem_tra_moi_han kt on kt.moi_han_id = ls.id
    join public.tieu_chuan_nghiem_thu_moi_han tc on tc.id = kt.tieu_chuan_id where ls.id = any(selected_ids);
  return p_id;
end $$;

create or replace function public.hoan_thanh_nghiem_thu_moi_han(
  p_id uuid, p_phieu_id uuid, p_ngay_nghiem_thu date, p_nguoi_lap text, p_ket_qua jsonb,
  p_thong_tin jsonb default '{}'::jsonb
)
returns uuid language plpgsql set search_path = public, pg_temp as $$
declare phieu public.phieu_yeu_cau_nghiem_thu; existing public.dot_nghiem_thu;
  item jsonb; weld_id uuid; n integer; snapshot jsonb;
begin
  select * into strict phieu from public.phieu_yeu_cau_nghiem_thu where id = p_phieu_id for update;
  select * into existing from public.dot_nghiem_thu where id = p_id;
  if found then
    if (existing.phieu_id,existing.ngay_nghiem_thu,existing.nguoi_lap,existing.yeu_cau,existing.thong_tin)
      is distinct from (p_phieu_id,p_ngay_nghiem_thu,btrim(p_nguoi_lap),p_ket_qua,p_thong_tin) then
      raise exception 'Mã yêu cầu đã được dùng với nội dung khác';
    end if;
    return p_id;
  end if;
  if phieu.trang_thai <> 'Đã phát hành' then raise exception 'RFI không còn hiệu lực'; end if;
  if p_ket_qua is null or jsonb_typeof(p_ket_qua) <> 'array' then raise exception 'Danh sách kết quả không hợp lệ'; end if;
  n := jsonb_array_length(p_ket_qua);
  if n = 0 or not exists (select 1 from jsonb_array_elements(p_ket_qua) r where r->>'ket_qua' = 'Đạt') then
    raise exception 'Cần ít nhất một mối được chấp nhận';
  end if;
  if n <> (select count(distinct (r->>'moi_han_id')::uuid) from jsonb_array_elements(p_ket_qua) r) then
    raise exception 'Mối kết quả bị thiếu ID hoặc trùng';
  end if;
  perform 1 from public.lich_su_moi_han ls join public.phieu_yeu_cau_nghiem_thu_moi pm on pm.moi_han_id = ls.id
    where pm.phieu_id = p_phieu_id and pm.con_hieu_luc order by ls.id for update of ls;
  if n <> (select count(*) from public.phieu_yeu_cau_nghiem_thu_moi where phieu_id = p_phieu_id and con_hieu_luc) then
    raise exception 'Cần kết quả cho đủ các mối còn lại trong RFI';
  end if;
  for item in select * from jsonb_array_elements(p_ket_qua) loop
    weld_id := (item->>'moi_han_id')::uuid;
    if jsonb_typeof(item) <> 'object' or item->>'ket_qua' is null or item->>'ket_qua' not in ('Đạt','Không đạt','Chưa nghiệm thu')
      or not exists (select 1 from public.phieu_yeu_cau_nghiem_thu_moi where phieu_id = p_phieu_id and moi_han_id = weld_id and con_hieu_luc) then
      raise exception 'Kết quả hoặc mối không thuộc RFI hiệu lực';
    end if;
    if not exists (select 1 from public.chat_luong_moi_han where moi_han_id = weld_id and du_an_id = phieu.du_an_id
      and phien_ban = (item->>'phien_ban')::integer) then raise exception 'Dữ liệu đã thay đổi; hãy tải lại'; end if;
    if item->>'ket_qua' = 'Đạt' and not exists (select 1 from public.chat_luong_moi_han
      where moi_han_id = weld_id and du_dieu_kien_nghiem_thu and tinh_trang <> 'Nghiệm thu đạt') then
      raise exception 'Mối % chưa đủ điều kiện hoàn thành',weld_id;
    end if;
    if item->>'ket_qua' <> 'Đạt' and nullif(btrim(item->>'ly_do'),'') is null then raise exception 'Thiếu lý do loại trừ'; end if;
  end loop;
  insert into public.dot_nghiem_thu(id,phieu_id,ngay_nghiem_thu,nguoi_lap,yeu_cau,thong_tin)
    values (p_id,p_phieu_id,p_ngay_nghiem_thu,btrim(p_nguoi_lap),p_ket_qua,p_thong_tin);
  update public.kiem_tra_moi_han kt set ly_do_loai_nghiem_thu = btrim(r->>'ly_do')
    from jsonb_array_elements(p_ket_qua) r where kt.moi_han_id = (r->>'moi_han_id')::uuid and r->>'ket_qua' = 'Không đạt';
  insert into public.dot_nghiem_thu_moi(dot_id,moi_han_id,ket_qua,ly_do,du_lieu_chot)
    select p_id,ls.id,r->>'ket_qua',nullif(btrim(r->>'ly_do'),''),
      jsonb_build_object('moi_han',to_jsonb(ls),'kiem_tra',to_jsonb(kt),'tieu_chuan',to_jsonb(tc))
    from jsonb_array_elements(p_ket_qua) r join public.lich_su_moi_han ls on ls.id = (r->>'moi_han_id')::uuid
    join public.kiem_tra_moi_han kt on kt.moi_han_id = ls.id
    left join public.tieu_chuan_nghiem_thu_moi_han tc on tc.id = kt.tieu_chuan_id;
  update public.phieu_yeu_cau_nghiem_thu_moi pm set con_hieu_luc = false
    from jsonb_array_elements(p_ket_qua) r where pm.phieu_id = p_phieu_id and pm.moi_han_id = (r->>'moi_han_id')::uuid
    and r->>'ket_qua' <> 'Chưa nghiệm thu';
  if not exists (select 1 from public.phieu_yeu_cau_nghiem_thu_moi where phieu_id = p_phieu_id and con_hieu_luc) then
    update public.phieu_yeu_cau_nghiem_thu set trang_thai = 'Đã hoàn thành' where id = p_phieu_id;
  end if;
  select jsonb_build_object('rfi',to_jsonb(phieu),'dot',to_jsonb(d),
    'cac_moi', (select jsonb_agg(to_jsonb(dm) order by dm.moi_han_id) from public.dot_nghiem_thu_moi dm where dm.dot_id = p_id))
    into snapshot from public.dot_nghiem_thu d where d.id = p_id;
  -- Chỉ lưu dữ liệu hồ sơ; chưa nhận mẫu chính thức nên phien_ban_mau để trống, chưa có PDF/đã ký.
  insert into public.ho_so_nghiem_thu(dot_id,loai,du_lieu_chot)
    select p_id,loai,snapshot from unnest(array['Hoàn thành công việc','Phụ lục công việc','Giai đoạn xây dựng']) loai;
  return p_id;
end $$;

-- Chỉ server giữ service_role được ghi/đọc nền chất lượng. Không cấp quyền từ currentViewer giả lập trên UI.
do $$
declare t text; f record;
begin
  foreach t in array array['tieu_chuan_nghiem_thu_moi_han','kiem_tra_moi_han','phieu_yeu_cau_nghiem_thu',
    'phieu_yeu_cau_nghiem_thu_moi','dot_nghiem_thu','dot_nghiem_thu_moi','ho_so_nghiem_thu'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant select, insert, update, delete on public.%I to service_role',t);
  end loop;
  for f in select oid::regprocedure as signature from pg_proc where pronamespace = 'public'::regnamespace
    and proname in ('qlcl_so_do_hop_le','qlcl_dung_sai_hop_le','qlcl_xet_hinh_hoc','khoi_tao_chat_luong_moi_han',
      'bao_ve_kiem_tra_moi_han','bao_ve_tieu_chuan_nghiem_thu','bao_ve_nguon_chat_luong_moi_han',
      'luu_kiem_tra_moi_han','phat_hanh_rfi_moi_han','hoan_thanh_nghiem_thu_moi_han') loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
revoke all on public.chat_luong_moi_han, public.moi_han_can_bo_sung_chat_luong from public,anon,authenticated;
grant select on public.chat_luong_moi_han, public.moi_han_can_bo_sung_chat_luong to service_role;
notify pgrst, 'reload schema';
commit;
