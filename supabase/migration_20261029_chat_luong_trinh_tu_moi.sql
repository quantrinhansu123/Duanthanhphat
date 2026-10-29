-- Trình tự chất lượng thống nhất mọi loại mối hàn; bỏ nhánh riêng Chấp thuận/Thử nghiệm.
-- Tên trạng thái mới: Chờ mài (ngay khi tạo nhật ký hàn) → Chờ siêu âm và nghiệm thu → Sửa chữa/khắc phục
--   → Chờ ký biên bản → Đạt | Không đạt | Không thí nghiệm.
-- Cột Kết quả NDT trên UI không còn dùng để điều khiển tình trạng (vẫn lưu ket_qua_ndt trong kiểm tra).

alter table public.kiem_tra_moi_han
  add column if not exists xu_ly_truc_quan text
  check (xu_ly_truc_quan is null or xu_ly_truc_quan in ('sua_chua', 'khong_dat'));

create or replace view public.chat_luong_moi_han with (security_invoker = true) as
select ls.id as moi_han_id, ls.du_an_id, ls.loai_moi_han, ls.cong_nghe_han, ls.ngay_thuc_hien,
  kt.phien_ban, kt.tieu_chuan_id, hh.ket_qua as ket_qua_hinh_hoc,
  coalesce(
    ls.so_luong_thuc_hien = 1
      and flags.noi_bo_dat
      and not flags.ndt_loi
      and not flags.ep_khong_dat
      and not flags.sua_chua
      and (not tc.ndt_truoc_rfi or flags.ndt_dat),
    false
  ) as du_dieu_kien_rfi,
  coalesce(
    ls.so_luong_thuc_hien = 1
      and flags.noi_bo_dat
      and flags.ndt_dat
      and not flags.ndt_loi
      and not flags.ep_khong_dat
      and not flags.sua_chua,
    false
  ) as du_dieu_kien_nghiem_thu,
  case
    when exists (
      select 1 from public.dot_nghiem_thu_moi dm
      where dm.moi_han_id = ls.id and dm.ket_qua = 'Đạt'
    ) then 'Đạt'
    when kt.moi_han_id is null then 'Chờ mài'
    when flags.ndt_loi or flags.ep_khong_dat then 'Không đạt'
    when flags.sua_chua then 'Sửa chữa/khắc phục'
    when tc.yeu_cau_ndt = false then 'Không thí nghiệm'
    when flags.noi_bo_dat and flags.ndt_dat then 'Chờ ký biên bản'
    when flags.noi_bo_dat then 'Chờ siêu âm và nghiệm thu'
    else 'Chờ mài'
  end as tinh_trang
from public.lich_su_moi_han ls
left join public.kiem_tra_moi_han kt on kt.moi_han_id = ls.id
left join public.tieu_chuan_nghiem_thu_moi_han tc on tc.id = kt.tieu_chuan_id
cross join lateral (
  select public.qlcl_xet_hinh_hoc(coalesce(kt.gia_tri_do, '{}'::jsonb), tc.dung_sai) as ket_qua
) hh
cross join lateral (
  select
    coalesce(kt.ngay_mai is not null and kt.truc_quan = 'Đạt' and hh.ket_qua = 'Đạt', false) as noi_bo_dat,
    coalesce(not coalesce(tc.yeu_cau_ndt, true) or (kt.ket_qua_ndt = 'Đạt' and kt.ngay_ndt is not null), false) as ndt_dat,
    coalesce(kt.ket_qua_ndt = 'Không đạt', false) as ndt_loi,
    coalesce(
      kt.ly_do_loai_nghiem_thu is not null
      or kt.xu_ly_truc_quan = 'khong_dat',
      false
    ) as ep_khong_dat,
    coalesce(
      (kt.truc_quan = 'Không đạt' or hh.ket_qua = 'Không đạt')
      and coalesce(kt.ket_qua_ndt, '') is distinct from 'Không đạt'
      and kt.ly_do_loai_nghiem_thu is null
      and coalesce(kt.xu_ly_truc_quan, 'sua_chua') = 'sua_chua',
      false
    ) as sua_chua
) flags;

drop function if exists public.luu_kiem_tra_moi_han(
  uuid, integer, uuid, date, text, jsonb, text, text, date, text, text, text
);

create or replace function public.luu_kiem_tra_moi_han(
  p_moi_han_id uuid, p_phien_ban integer, p_tieu_chuan_id uuid, p_ngay_mai date, p_truc_quan text,
  p_gia_tri_do jsonb, p_phuong_phap_ndt text, p_ket_qua_ndt text, p_ngay_ndt date,
  p_nguoi_ghi_nhan text, p_ghi_chu text default null, p_ly_do_loai_nghiem_thu text default null,
  p_xu_ly_truc_quan text default null
)
returns public.kiem_tra_moi_han language plpgsql set search_path = public, pg_temp as $$
declare result public.kiem_tra_moi_han;
begin
  if nullif(btrim(p_nguoi_ghi_nhan),'') is null then raise exception 'Thiếu người ghi nhận'; end if;
  if p_xu_ly_truc_quan is not null and p_xu_ly_truc_quan not in ('sua_chua','khong_dat') then
    raise exception 'Cách xử lý trực quan/độ lệch không hợp lệ';
  end if;
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
    ly_do_loai_nghiem_thu = nullif(btrim(p_ly_do_loai_nghiem_thu),''),
    xu_ly_truc_quan = p_xu_ly_truc_quan
  where moi_han_id = p_moi_han_id and phien_ban = p_phien_ban returning * into result;
  if not found then raise exception 'Dữ liệu đã thay đổi; hãy tải lại'; end if;
  return result;
end $$;

-- RPC cũ so sánh 'Nghiệm thu đạt' → đổi sang 'Đạt' (tên tình trạng mới).
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
  perform 1 from public.lich_su_moi_han where id = any(selected_ids) order by id for update;
  if exists (select 1 from public.phieu_yeu_cau_nghiem_thu where id = p_id) then
    return public.phat_hanh_rfi_moi_han(p_id,p_du_an_id,p_so_phieu,p_ngay_moi,p_moi_han_ids,p_nguoi_lap,p_thong_tin);
  end if;
  foreach weld_id in array selected_ids loop
    if not exists (select 1 from public.chat_luong_moi_han where moi_han_id = weld_id and du_an_id = p_du_an_id
      and du_dieu_kien_rfi and tinh_trang <> 'Đạt') then
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

-- Giữ nguyên RPC nghiệm thu; chỉ đổi so sánh tình trạng 'Nghiệm thu đạt' → 'Đạt'.
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
      where moi_han_id = weld_id and du_dieu_kien_nghiem_thu and tinh_trang <> 'Đạt') then
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
  insert into public.ho_so_nghiem_thu(dot_id,loai,du_lieu_chot)
    select p_id,loai,snapshot from unnest(array['Hoàn thành công việc','Phụ lục công việc','Giai đoạn xây dựng']) loai;
  return p_id;
end $$;

notify pgrst, 'reload schema';
