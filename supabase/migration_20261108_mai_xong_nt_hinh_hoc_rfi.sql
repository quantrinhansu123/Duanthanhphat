-- Trình tự mới:
--   Hàn → Chờ mài → bấm «Mài xong» (ghi ngày mài) → Chờ nghiệm thu → phát RFI.
--   Nghiệm thu: bấm Trực quan đạt (tự điền sai số max)
--     + chỉ hình học → in biên bản hình học riêng, mối → Chờ siêu âm (RFI sau nghiệm thu siêu âm → ký → Đạt);
--     + có cả siêu âm đạt → in toàn bộ → Chờ ký biên bản → ký đủ → Đạt.
begin;

create or replace view public.chat_luong_moi_han with (security_invoker = true) as
select ls.id as moi_han_id, ls.du_an_id, ls.loai_moi_han, ls.cong_nghe_han, ls.ngay_thuc_hien,
  kt.phien_ban, kt.tieu_chuan_id, hh.ket_qua as ket_qua_hinh_hoc,
  coalesce(
    ls.so_luong_thuc_hien = 1
      and (flags.noi_bo_dat or (kt.ngay_mai is not null and kt.truc_quan is null))
      and not flags.ndt_loi
      and not flags.ep_khong_dat
      and not flags.sua_chua,
    false
  ) as du_dieu_kien_rfi,
  coalesce(
    ls.so_luong_thuc_hien = 1
      and flags.noi_bo_dat
      and flags.ndt_dat
      and not flags.ndt_loi
      and not flags.ep_khong_dat
      and not flags.sua_chua
      and (
        tc.dung_sai is null
        or not (tc.dung_sai ? 'chieu_dai_mai')
        or nullif(kt.gia_tri_do->>'chieu_dai_mai', '') is not null
      ),
    false
  ) as du_dieu_kien_nghiem_thu,
  case
    when exists (
      select 1 from public.dot_nghiem_thu_moi dm
      where dm.moi_han_id = ls.id and dm.ket_qua = 'Đạt' and (select count(*) from public.ho_so_nghiem_thu h where h.dot_id=dm.dot_id and h.tinh_trang_ky='Đã ký') = 3
    ) then 'Đạt'
    when kt.moi_han_id is null then 'Chờ mài'
    when flags.ndt_loi or flags.ep_khong_dat then 'Không đạt'
    when flags.sua_chua then 'Sửa chữa/khắc phục'
    when kt.ngay_mai is null and kt.truc_quan is null and kt.ket_qua_ndt is null then 'Chờ mài'
    when tc.yeu_cau_ndt = false then 'Không thí nghiệm'
    when exists (
      select 1 from public.dot_nghiem_thu_moi dm
      join public.dot_nghiem_thu d on d.id = dm.dot_id
      where dm.moi_han_id = ls.id and dm.ket_qua = 'Đạt'
        and coalesce(d.thong_tin->>'draft', 'false') <> 'true'
    ) then 'Chờ ký biên bản'
    when exists (select 1 from public.phieu_nt_tach_moi m where m.moi_han_id = ls.id and m.loai = 'hinh-hoc' and m.ket_qua = 'Đạt') and exists (select 1 from public.phieu_nt_tach_moi m where m.moi_han_id = ls.id and m.loai = 'sieu-am' and m.ket_qua = 'Đạt') then 'Chờ ký biên bản'
    when exists (select 1 from public.phieu_nt_tach_moi m where m.moi_han_id = ls.id and m.loai = 'hinh-hoc' and m.ket_qua = 'Đạt') then 'Chờ siêu âm'
    when flags.noi_bo_dat then 'Chờ nghiệm thu'
    -- Đã bấm «Mài xong» (có ngày mài, chưa kết luận trực quan) → chờ nghiệm thu.
    when kt.ngay_mai is not null and kt.truc_quan is null then 'Chờ nghiệm thu'
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
    coalesce(not coalesce(tc.yeu_cau_ndt, true) or kt.ket_qua_ndt = 'Đạt', false) as ndt_dat,
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

-- Phiếu hình học tách riêng: liệt kê mối đã «Mài xong» (có ngày mài, chưa kết luận trực quan) + mối đã trực quan đạt.
-- Đạt chỉ chọn được khi đã bấm Trực quan đạt và đủ số đo (co_the_dat giữ nguyên).
create or replace view public.ung_vien_nt_tach with (security_invoker=true) as
select q.*, t.loai,
  case when t.loai='hinh-hoc' then q.noi_bo_hinh_hoc
      and (not (q.dung_sai ? 'chieu_dai_mai') or q.gia_tri_do->>'chieu_dai_mai' is not null)
    else q.phuong_phap_ndt='Siêu âm' and q.ket_qua_ndt='Đạt' and q.ngay_ndt is not null
  end as co_the_dat
from public.dieu_kien_nt_tach q cross join (values ('hinh-hoc'),('sieu-am')) t(loai)
where (t.loai='hinh-hoc' and (q.noi_bo_hinh_hoc or (q.ngay_mai is not null and q.truc_quan is null)))
   or (t.loai='sieu-am' and (q.noi_bo_truc_quan or q.da_nt_truc_quan));

-- Phiếu hình học tạo từ RFI chính (nghiệm thu chỉ hình học) → nhớ RFI gốc để in lại biên bản.
alter table public.phieu_nt_tach add column if not exists phieu_rfi_id uuid references public.phieu_yeu_cau_nghiem_thu(id) on delete set null;

-- Nghiệm thu CHỈ hình học / trực quan cho các mối của một RFI chính:
-- tạo phiếu hình học đã chốt (Đạt), gỡ mối khỏi RFI (để RFI sau nghiệm thu siêu âm).
create or replace function public.nt_hinh_hoc_tu_rfi(p_id uuid,p_phieu_id uuid,p_ngay date,p_ket_qua jsonb,p_actor text)
returns uuid language plpgsql set search_path=public,pg_temp as $$
declare r phieu_yeu_cau_nghiem_thu; n int; inserted int; v_so text; i int := 1;
begin
  select * into strict r from phieu_yeu_cau_nghiem_thu where id=p_phieu_id for update;
  if exists(select 1 from phieu_nt_tach where id=p_id and phieu_rfi_id=p_phieu_id) then return p_id; end if;
  if r.trang_thai <> 'Đã phát hành' then raise exception 'RFI không còn hiệu lực.'; end if;
  if p_ngay is null or p_ngay < r.ngay_moi then raise exception 'Ngày nghiệm thu không được trước ngày mời.'; end if;
  if jsonb_typeof(p_ket_qua) is distinct from 'array' then raise exception 'Danh sách mối không hợp lệ.'; end if;
  n := jsonb_array_length(p_ket_qua);
  if n not between 1 and 2000 or n <> (select count(distinct e->>'moi_han_id') from jsonb_array_elements(p_ket_qua) e) then
    raise exception 'Danh sách mối không hợp lệ (trùng hoặc rỗng).';
  end if;
  perform 1 from lich_su_moi_han where id in (select (e->>'moi_han_id')::uuid from jsonb_array_elements(p_ket_qua) e) order by id for update;
  v_so := r.so_phieu;
  while exists(select 1 from phieu_nt_tach where du_an_id=r.du_an_id and loai='hinh-hoc' and so_phieu=v_so) loop
    i := i + 1; v_so := r.so_phieu || '-' || i;
  end loop;
  insert into phieu_nt_tach(id,du_an_id,loai,so_phieu,ngay_moi,nguoi_lap,ngay_nghiem_thu,nguoi_nghiem_thu,phieu_rfi_id)
    values(p_id,r.du_an_id,'hinh-hoc',v_so,r.ngay_moi,r.nguoi_lap,p_ngay,p_actor,p_phieu_id);
  insert into phieu_nt_tach_moi(phieu_id,loai,moi_han_id,ma_lich_su,ket_qua,du_lieu_chot)
    select p_id,'hinh-hoc',q.moi_han_id,q.ma_lich_su,'Đạt',
      to_jsonb(q) || jsonb_build_object('moi_han',to_jsonb(ls),'kiem_tra',to_jsonb(kt),'tieu_chuan',to_jsonb(tc))
    from jsonb_to_recordset(p_ket_qua) e(moi_han_id uuid, phien_ban int)
    join phieu_yeu_cau_nghiem_thu_moi pm on pm.phieu_id=p_phieu_id and pm.moi_han_id=e.moi_han_id and pm.con_hieu_luc
    join ung_vien_nt_tach q on q.moi_han_id=e.moi_han_id and q.du_an_id=r.du_an_id and q.loai='hinh-hoc' and q.co_the_dat and q.ngay_mai<=p_ngay
    join lich_su_moi_han ls on ls.id=e.moi_han_id
    join kiem_tra_moi_han kt on kt.moi_han_id=e.moi_han_id and kt.phien_ban=e.phien_ban
    left join tieu_chuan_nghiem_thu_moi_han tc on tc.id=kt.tieu_chuan_id;
  get diagnostics inserted=row_count;
  if inserted<>n then
    raise exception 'Có mối chưa đủ điều kiện hình học (trực quan + số đo), ngày mài sau ngày nghiệm thu, không thuộc RFI hoặc dữ liệu đã thay đổi. Bấm Tải lại điều kiện.';
  end if;
  update phieu_yeu_cau_nghiem_thu_moi set con_hieu_luc=false
    where phieu_id=p_phieu_id and moi_han_id in (select (e->>'moi_han_id')::uuid from jsonb_array_elements(p_ket_qua) e);
  if not exists(select 1 from phieu_yeu_cau_nghiem_thu_moi where phieu_id=p_phieu_id and con_hieu_luc) then
    update phieu_yeu_cau_nghiem_thu set trang_thai='Đã hoàn thành' where id=p_phieu_id;
  end if;
  return p_id;
end $$;
revoke all on function public.nt_hinh_hoc_tu_rfi(uuid,uuid,date,jsonb,text) from public,anon,authenticated;
grant execute on function public.nt_hinh_hoc_tu_rfi(uuid,uuid,date,jsonb,text) to service_role;

notify pgrst,'reload schema';
commit;
