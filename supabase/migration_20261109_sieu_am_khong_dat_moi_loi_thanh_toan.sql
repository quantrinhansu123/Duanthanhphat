-- 1) Siêu âm không đạt là Không đạt luôn và báo thẳng là mối lỗi (so_luong_loi, tinh_trang_thi_nghiem = 'Không đạt').
-- 2) Thanh toán theo mối hàn: bảng thanh_toan_moi_han.
-- Chạy lại nhiều lần cũng không sao.
begin;

create or replace view public.chat_luong_moi_han with (security_invoker = true) as
select ls.id as moi_han_id, ls.du_an_id, ls.loai_moi_han, ls.cong_nghe_han, ls.ngay_thuc_hien,
  kt.phien_ban, kt.tieu_chuan_id, hh.ket_qua as ket_qua_hinh_hoc,
  coalesce(
    ls.so_luong_thuc_hien = 1
      and (flags.noi_bo_dat or (kt.ngay_mai is not null and kt.truc_quan is null))
      and not flags.ndt_loi
      and not flags.ep_khong_dat
      and not flags.sua_chua
      and not exists (select 1 from public.phieu_nt_tach_moi m where m.moi_han_id = ls.id and m.loai = 'hinh-hoc' and m.ket_qua = 'Không đạt' and kt.phien_ban is not null and nullif(m.du_lieu_chot->>'phien_ban', '')::int = kt.phien_ban),
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
    -- Nghiệm thu KHÔNG ĐẠT ở phiếu tách (hình học / siêu âm) → Sửa chữa/khắc phục,
    -- cho tới khi kiểm tra lại (đổi phiên bản kiểm tra) thì quay về luồng bình thường.
    when exists (select 1 from public.phieu_nt_tach_moi m where m.moi_han_id = ls.id and m.loai = 'hinh-hoc' and m.ket_qua = 'Không đạt' and kt.phien_ban is not null and nullif(m.du_lieu_chot->>'phien_ban', '')::int = kt.phien_ban) then 'Sửa chữa/khắc phục'
    when kt.ngay_mai is null and kt.truc_quan is null and kt.ket_qua_ndt is null then 'Chờ mài'
    -- Đã bấm «Mài xong» (có ngày mài, chưa kết luận trực quan / siêu âm): hiện «Mài xong» kể cả tiêu chí không yêu cầu siêu âm (vd. dự án đào tạo nội bộ).
    when kt.ngay_mai is not null and kt.truc_quan is null and kt.ket_qua_ndt is null then 'Mài xong'
    when tc.yeu_cau_ndt = false then 'Không thí nghiệm'
    when exists (
      select 1 from public.dot_nghiem_thu_moi dm
      join public.dot_nghiem_thu d on d.id = dm.dot_id
      where dm.moi_han_id = ls.id and dm.ket_qua = 'Đạt'
        and coalesce(d.thong_tin->>'draft', 'false') <> 'true'
    ) then 'Chờ ký biên bản'
    when exists (select 1 from public.phieu_nt_tach_moi m where m.moi_han_id = ls.id and m.loai = 'hinh-hoc' and m.ket_qua = 'Đạt') and exists (select 1 from public.phieu_nt_tach_moi m join public.phieu_nt_tach p on p.id = m.phieu_id where m.moi_han_id = ls.id and m.loai = 'sieu-am' and m.ket_qua = 'Đạt' and p.da_ky) then 'Đạt'
    when exists (select 1 from public.phieu_nt_tach_moi m where m.moi_han_id = ls.id and m.loai = 'hinh-hoc' and m.ket_qua = 'Đạt') and exists (select 1 from public.phieu_nt_tach_moi m where m.moi_han_id = ls.id and m.loai = 'sieu-am' and m.ket_qua = 'Đạt') then 'Chờ ký biên bản'
    when exists (select 1 from public.phieu_nt_tach_moi m where m.moi_han_id = ls.id and m.loai = 'hinh-hoc' and m.ket_qua = 'Đạt') then 'Chờ siêu âm'
    -- Duyệt hình học / trực quan đạt: chưa siêu âm → Chờ siêu âm; đã siêu âm đạt → Chờ nghiệm thu (phát RFI).
    when flags.noi_bo_dat and kt.ket_qua_ndt = 'Đạt' then 'Chờ nghiệm thu'
    when flags.noi_bo_dat then 'Chờ siêu âm'
    -- Đã bấm «Mài xong» (có ngày mài, chưa kết luận trực quan) → hiện «Mài xong», được phát RFI.
    when kt.ngay_mai is not null and kt.truc_quan is null then 'Mài xong'
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
    -- Siêu âm KHÔNG ĐẠT (kết quả NDT hoặc nghiệm thu phiếu siêu âm) là Không đạt luôn — không có đường sửa chữa.
    coalesce(kt.ket_qua_ndt = 'Không đạt' or exists (select 1 from public.phieu_nt_tach_moi m where m.moi_han_id = ls.id and m.loai = 'sieu-am' and m.ket_qua = 'Không đạt'), false) as ndt_loi,
    -- «Không đạt» cuối cùng chỉ khi chủ sở hữu chọn loại bỏ mối (xu_ly_truc_quan = 'khong_dat').
    coalesce(kt.xu_ly_truc_quan = 'khong_dat', false) as ep_khong_dat,
    -- Trực quan / hình học không đạt, HOẶC bị Không đạt ở nghiệm thu RFI chính (ly_do_loai_nghiem_thu) → Sửa chữa/khắc phục.
    -- Khắc phục xong: tick «Đã khắc phục và kiểm tra lại» trong hộp Kiểm tra để xoá cờ lỗi → mối quay về luồng.
    coalesce(
      (kt.truc_quan = 'Không đạt' or hh.ket_qua = 'Không đạt' or kt.ly_do_loai_nghiem_thu is not null)
      and coalesce(kt.ket_qua_ndt, '') is distinct from 'Không đạt'
      and coalesce(kt.xu_ly_truc_quan, 'sua_chua') = 'sua_chua',
      false
    ) as sua_chua
) flags;


create or replace function public.chot_phieu_nt_tach(p_id uuid,p_ngay date,p_ket_qua jsonb,p_actor text)
returns uuid language plpgsql set search_path=public,pg_temp as $$
declare p phieu_nt_tach; n int; updated_count int;
begin
  select * into strict p from phieu_nt_tach where id=p_id for update;
  if p.ngay_nghiem_thu is not null then raise exception 'Dữ liệu đã thay đổi: phiếu đã chốt.'; end if;
  if p_ngay is null or p_ngay<p.ngay_moi then raise exception 'Ngày nghiệm thu không hợp lệ.'; end if;
  select count(*) into n from phieu_nt_tach_moi where phieu_id=p_id;
  if jsonb_typeof(p_ket_qua) is distinct from 'array' or jsonb_array_length(p_ket_qua)<>n then raise exception 'Danh sách kết quả thiếu mối.'; end if;
  perform 1 from lich_su_moi_han where id in (select moi_han_id from phieu_nt_tach_moi where phieu_id=p_id) order by id for update;
  update phieu_nt_tach_moi m set ket_qua=r.ket_qua,ly_do=nullif(trim(r.ly_do),''),
    du_lieu_chot=m.du_lieu_chot || coalesce(to_jsonb(q),'{}'::jsonb) || to_jsonb(kt)
  from jsonb_to_recordset(p_ket_qua) as r(id uuid,ket_qua text,ly_do text,phien_ban int)
  join kiem_tra_moi_han kt on kt.moi_han_id=r.id and kt.phien_ban=r.phien_ban
  left join ung_vien_nt_tach q on q.moi_han_id=r.id and q.du_an_id=p.du_an_id and q.loai=p.loai
  where m.phieu_id=p_id and m.moi_han_id=r.id
    and ((r.ket_qua='Không đạt' and nullif(trim(r.ly_do),'') is not null)
      or (r.ket_qua='Đạt' and q.co_the_dat and
        case when p.loai='sieu-am' then q.ngay_ndt<=p_ngay else q.ngay_mai<=p_ngay end));
  get diagnostics updated_count=row_count;
  if updated_count<>n then raise exception 'Danh sách kết quả chưa đủ điều kiện, thiếu lý do hoặc phiên bản đã thay đổi.'; end if;
  -- Siêu âm không đạt → báo thẳng là mối lỗi (vào thống kê lỗi), không qua sửa chữa.
  if p.loai='sieu-am' then
    update lich_su_moi_han ls set so_luong_loi=ls.so_luong_thuc_hien, tinh_trang_thi_nghiem='Không đạt',
      nguyen_nhan_loi=coalesce(nullif(trim(ls.nguyen_nhan_loi),''),'Siêu âm không đạt: '||coalesce(m.ly_do,''))
    from phieu_nt_tach_moi m where m.phieu_id=p_id and m.moi_han_id=ls.id and m.ket_qua='Không đạt';
  end if;
  update phieu_nt_tach set ngay_nghiem_thu=p_ngay,nguoi_nghiem_thu=p_actor where id=p_id;
  return p_id;
end $$;


-- Bù cho các mối đã bị siêu âm không đạt trước đây.
update public.lich_su_moi_han ls set so_luong_loi=ls.so_luong_thuc_hien, tinh_trang_thi_nghiem='Không đạt',
  nguyen_nhan_loi=coalesce(nullif(trim(ls.nguyen_nhan_loi),''),'Siêu âm không đạt: '||coalesce(m.ly_do,''))
from public.phieu_nt_tach_moi m where m.moi_han_id=ls.id and m.loai='sieu-am' and m.ket_qua='Không đạt' and ls.so_luong_loi=0;

create table if not exists public.thanh_toan_moi_han (
  moi_han_id uuid primary key references public.lich_su_moi_han(id) on delete cascade,
  du_an_id uuid not null references public.du_an(id),
  ngay_thanh_toan date not null,
  dot_thanh_toan text check (dot_thanh_toan is null or length(dot_thanh_toan) <= 80),
  ghi_chu text check (ghi_chu is null or length(ghi_chu) <= 500),
  nguoi_cap_nhat text,
  created_at timestamptz not null default now()
);
create index if not exists idx_thanh_toan_moi_han_du_an on public.thanh_toan_moi_han(du_an_id);
alter table public.thanh_toan_moi_han enable row level security;
revoke all on public.thanh_toan_moi_han from public,anon,authenticated;
grant select,insert,update,delete on public.thanh_toan_moi_han to service_role;
revoke all on function public.chot_phieu_nt_tach(uuid,date,jsonb,text) from public,anon,authenticated;
grant execute on function public.chot_phieu_nt_tach(uuid,date,jsonb,text) to service_role;

notify pgrst,'reload schema';
commit;
