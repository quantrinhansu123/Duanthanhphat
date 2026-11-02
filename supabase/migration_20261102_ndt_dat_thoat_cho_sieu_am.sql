-- NDT/siêu âm Đạt → «Chờ nghiệm thu» (không còn «Chờ siêu âm…»).
-- «Chờ ký biên bản» chỉ khi đã có kết quả nghiệm thu Đạt ở đợt không nháp (giữ logic đối soát RFI).
-- Chiều dài mài: vẫn bắt buộc trước du_dieu_kien_nghiem_thu.

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
    when tc.yeu_cau_ndt = false then 'Không thí nghiệm'
    when exists (
      select 1 from public.dot_nghiem_thu_moi dm
      join public.dot_nghiem_thu d on d.id = dm.dot_id
      where dm.moi_han_id = ls.id and dm.ket_qua = 'Đạt'
        and coalesce(d.thong_tin->>'draft', 'false') <> 'true'
    ) then 'Chờ ký biên bản'
    when flags.noi_bo_dat and flags.ndt_dat then 'Chờ nghiệm thu'
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

-- Cho phép phát RFI cả mối đã NDT Đạt («Chờ nghiệm thu») nếu chưa thuộc phiếu.
create or replace function public.phat_hanh_rfi_moi_han(
  p_id uuid, p_du_an_id uuid, p_so_phieu text, p_ngay_moi date, p_moi_han_ids uuid[],
  p_nguoi_lap text, p_thong_tin jsonb default '{}'::jsonb
)
returns uuid language plpgsql set search_path = public, pg_temp as $$
declare
  existing public.phieu_yeu_cau_nghiem_thu;
  weld_id uuid;
  selected_ids uuid[];
  draft_id uuid;
  snapshot jsonb;
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
    if not exists (
      select 1 from public.chat_luong_moi_han
      where moi_han_id = weld_id and du_an_id = p_du_an_id
        and du_dieu_kien_rfi
        and tinh_trang in ('Chờ siêu âm và nghiệm thu', 'Chờ nghiệm thu', 'Chờ thí nghiệm')
    ) then
      raise exception 'Mối % chưa đủ điều kiện phát RFI (cần Chờ siêu âm/Chờ nghiệm thu, đúng dự án, chưa chờ ký)', weld_id;
    end if;
  end loop;
  insert into public.phieu_yeu_cau_nghiem_thu(id,du_an_id,so_phieu,ngay_moi,nguoi_lap,thong_tin)
    values (p_id,p_du_an_id,btrim(p_so_phieu),p_ngay_moi,btrim(p_nguoi_lap),p_thong_tin);
  insert into public.phieu_yeu_cau_nghiem_thu_moi(phieu_id,moi_han_id,du_lieu_chot)
    select p_id,ls.id,jsonb_build_object('moi_han',to_jsonb(ls) || coalesce((select to_jsonb(b) from public.bao_cao_moi_han_theo_du_an b where b.id=ls.id),'{}'::jsonb) || coalesce((select jsonb_build_object('ly_trinh',p.ly_trinh,'ma_diem',p.ma_diem) from public.toa_do p where p.lich_su_moi_han_id=ls.id order by p.ma_diem limit 1),'{}'::jsonb),'kiem_tra',to_jsonb(kt),'tieu_chuan',to_jsonb(tc))
    from public.lich_su_moi_han ls join public.kiem_tra_moi_han kt on kt.moi_han_id = ls.id
    join public.tieu_chuan_nghiem_thu_moi_han tc on tc.id = kt.tieu_chuan_id where ls.id = any(selected_ids);

  draft_id := gen_random_uuid();
  insert into public.dot_nghiem_thu(id,phieu_id,ngay_nghiem_thu,nguoi_lap,yeu_cau,thong_tin)
    values (
      draft_id, p_id, p_ngay_moi, btrim(p_nguoi_lap),
      (select coalesce(jsonb_agg(jsonb_build_object(
        'moi_han_id', pm.moi_han_id,
        'phien_ban', coalesce((pm.du_lieu_chot->'kiem_tra'->>'phien_ban')::int, 1),
        'ket_qua', 'Chưa nghiệm thu',
        'ly_do', 'Chờ siêu âm / nghiệm thu tại hiện trường'
      ) order by pm.moi_han_id), '[]'::jsonb)
       from public.phieu_yeu_cau_nghiem_thu_moi pm where pm.phieu_id = p_id),
      jsonb_build_object('draft', true, 'nguon', 'phat_rfi')
    );
  insert into public.dot_nghiem_thu_moi(dot_id,moi_han_id,ket_qua,ly_do,du_lieu_chot)
    select draft_id, pm.moi_han_id, 'Chưa nghiệm thu', 'Chờ siêu âm / nghiệm thu tại hiện trường', pm.du_lieu_chot
    from public.phieu_yeu_cau_nghiem_thu_moi pm where pm.phieu_id = p_id;
  select jsonb_build_object(
    'rfi', to_jsonb(p),
    'dot', to_jsonb(d),
    'cac_moi', (select jsonb_agg(to_jsonb(dm) order by dm.moi_han_id) from public.dot_nghiem_thu_moi dm where dm.dot_id = draft_id)
  ) into snapshot
  from public.phieu_yeu_cau_nghiem_thu p, public.dot_nghiem_thu d
  where p.id = p_id and d.id = draft_id;
  insert into public.ho_so_nghiem_thu(dot_id,loai,du_lieu_chot,tinh_trang_ky)
    select draft_id, loai, snapshot, 'Chờ ký'
    from unnest(array['Phụ lục công việc','Giai đoạn xây dựng','Hoàn thành công việc']) loai;
  return p_id;
end $$;

notify pgrst, 'reload schema';
