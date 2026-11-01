-- Đồng bộ phiên bản tiêu chí cho mối chưa chốt; không sửa số đo/NDT/hồ sơ đã nghiệm thu.
begin;

create table if not exists public.lich_su_tieu_chuan_moi_han (
  id uuid primary key default gen_random_uuid(),
  moi_han_id uuid not null references public.lich_su_moi_han(id) on delete restrict,
  tieu_chuan_cu uuid references public.tieu_chuan_nghiem_thu_moi_han(id),
  tieu_chuan_moi uuid not null references public.tieu_chuan_nghiem_thu_moi_han(id),
  phien_ban_kiem_tra integer not null,
  nguoi_thay_doi text not null check (btrim(nguoi_thay_doi) <> ''),
  created_at timestamptz not null default now()
);
alter table public.lich_su_tieu_chuan_moi_han enable row level security;
revoke all on public.lich_su_tieu_chuan_moi_han from public, anon, authenticated;
grant select, insert on public.lich_su_tieu_chuan_moi_han to service_role;

create or replace function public.ap_dung_tieu_chuan_moi_han(p_tieu_chuan_id uuid, p_nguoi_thay_doi text)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare tc public.tieu_chuan_nghiem_thu_moi_han; changed integer; frozen integer; same_rule integer;
begin
  if nullif(btrim(p_nguoi_thay_doi),'') is null then raise exception 'Thiếu người xác nhận tiêu chí'; end if;
  select * into strict tc from public.tieu_chuan_nghiem_thu_moi_han where id = p_tieu_chuan_id;
  -- Cùng thứ tự khóa với tạo tiêu chí: dự án -> mối -> tiêu chí.
  perform 1 from public.du_an where id = tc.du_an_id for update;
  select * into strict tc from public.tieu_chuan_nghiem_thu_moi_han where id = p_tieu_chuan_id;
  if not tc.dang_ap_dung then raise exception 'Tiêu chí không còn đang áp dụng; hãy tải lại'; end if;
  perform 1 from public.lich_su_moi_han ls
    where ls.du_an_id = tc.du_an_id and ls.cong_nghe_han = tc.cong_nghe_han and ls.loai_moi_han = tc.loai_moi_han
    order by ls.id for update;

  -- Bổ sung bản kiểm tra rỗng cho dữ liệu lịch sử thiếu bản kiểm tra. Không tự điền số đo.
  insert into public.kiem_tra_moi_han(moi_han_id)
    select ls.id from public.lich_su_moi_han ls
    where ls.du_an_id = tc.du_an_id and ls.cong_nghe_han = tc.cong_nghe_han and ls.loai_moi_han = tc.loai_moi_han
      and ls.so_luong_thuc_hien = 1
      and not exists (select 1 from public.dot_nghiem_thu_moi dm join public.dot_nghiem_thu d on d.id = dm.dot_id
        where dm.moi_han_id = ls.id and dm.ket_qua <> 'Chưa nghiệm thu'
          and coalesce(d.thong_tin->>'draft','false') <> 'true')
    on conflict (moi_han_id) do nothing;

  with candidates as materialized (
    select kt.moi_han_id, kt.tieu_chuan_id from public.kiem_tra_moi_han kt
    join public.lich_su_moi_han ls on ls.id = kt.moi_han_id
    where ls.du_an_id = tc.du_an_id and ls.cong_nghe_han = tc.cong_nghe_han and ls.loai_moi_han = tc.loai_moi_han
      and ls.so_luong_thuc_hien = 1 and kt.tieu_chuan_id is distinct from tc.id
      and not exists (select 1 from public.dot_nghiem_thu_moi dm join public.dot_nghiem_thu d on d.id = dm.dot_id
        where dm.moi_han_id = ls.id and (dm.ket_qua = 'Đạt' or
          (dm.ket_qua <> 'Chưa nghiệm thu' and coalesce(d.thong_tin->>'draft','false') <> 'true')))
  ), updated as (
    update public.kiem_tra_moi_han kt set tieu_chuan_id = tc.id
    from candidates c where kt.moi_han_id = c.moi_han_id
    returning kt.moi_han_id, c.tieu_chuan_id as old_id, kt.phien_ban
  )
  insert into public.lich_su_tieu_chuan_moi_han(moi_han_id,tieu_chuan_cu,tieu_chuan_moi,phien_ban_kiem_tra,nguoi_thay_doi)
    select moi_han_id, old_id, tc.id, phien_ban, btrim(p_nguoi_thay_doi) from updated;
  get diagnostics changed = row_count;
  select count(*) into frozen from public.lich_su_moi_han ls
    where ls.du_an_id = tc.du_an_id and ls.cong_nghe_han = tc.cong_nghe_han and ls.loai_moi_han = tc.loai_moi_han
      and exists (select 1 from public.dot_nghiem_thu_moi dm join public.dot_nghiem_thu d on d.id = dm.dot_id
        where dm.moi_han_id = ls.id and (dm.ket_qua = 'Đạt' or
          (dm.ket_qua <> 'Chưa nghiệm thu' and coalesce(d.thong_tin->>'draft','false') <> 'true')));
  select count(*) into same_rule from public.kiem_tra_moi_han kt
    join public.lich_su_moi_han ls on ls.id = kt.moi_han_id
    where ls.du_an_id = tc.du_an_id and ls.cong_nghe_han = tc.cong_nghe_han and ls.loai_moi_han = tc.loai_moi_han
      and kt.tieu_chuan_id = tc.id;
  return jsonb_build_object('cap_nhat',changed,'giu_nguyen_ho_so',frozen,'dang_dung_tieu_chi',same_rule);
end $$;

create or replace function public.tao_va_ap_dung_tieu_chuan_moi_han(
  p_du_an_id uuid, p_cong_nghe_han text, p_loai_moi_han text, p_ten text, p_dung_sai jsonb,
  p_yeu_cau_ndt boolean, p_ndt_truoc_rfi boolean, p_can_cu_mien_ndt text, p_nguoi_xac_nhan text
)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare tc public.tieu_chuan_nghiem_thu_moi_han; next_version integer; synced jsonb;
begin
  if nullif(btrim(p_nguoi_xac_nhan),'') is null then raise exception 'Thiếu người xác nhận tiêu chí'; end if;
  perform 1 from public.du_an where id = p_du_an_id for update;
  if not found then raise exception 'Dự án không hợp lệ'; end if;
  perform 1 from public.lich_su_moi_han
    where du_an_id = p_du_an_id and cong_nghe_han = p_cong_nghe_han and loai_moi_han = p_loai_moi_han order by id for update;
  select coalesce(max(phien_ban),0) + 1 into next_version from public.tieu_chuan_nghiem_thu_moi_han
    where du_an_id = p_du_an_id and cong_nghe_han = p_cong_nghe_han and loai_moi_han = p_loai_moi_han;
  update public.tieu_chuan_nghiem_thu_moi_han set dang_ap_dung = false
    where du_an_id = p_du_an_id and cong_nghe_han = p_cong_nghe_han and loai_moi_han = p_loai_moi_han and dang_ap_dung;
  insert into public.tieu_chuan_nghiem_thu_moi_han(
    du_an_id,cong_nghe_han,loai_moi_han,phien_ban,ten,dung_sai,yeu_cau_ndt,ndt_truoc_rfi,can_cu_mien_ndt,nguoi_xac_nhan,dang_ap_dung
  ) values (p_du_an_id,p_cong_nghe_han,p_loai_moi_han,next_version,btrim(p_ten),p_dung_sai,
    p_yeu_cau_ndt,p_ndt_truoc_rfi,nullif(btrim(p_can_cu_mien_ndt),''),btrim(p_nguoi_xac_nhan),true) returning * into tc;
  synced := public.ap_dung_tieu_chuan_moi_han(tc.id,p_nguoi_xac_nhan);
  return jsonb_build_object('rule',to_jsonb(tc),'sync',synced);
end $$;

-- Nhật ký mới tự nhận tiêu chí đang áp dụng trong đúng dự án/công nghệ/loại mối.
create or replace function public.khoi_tao_chat_luong_moi_han()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.kiem_tra_moi_han(moi_han_id,tieu_chuan_id) values (new.id,
    case when new.so_luong_thuc_hien = 1 then (
      select id from public.tieu_chuan_nghiem_thu_moi_han
      where du_an_id = new.du_an_id and cong_nghe_han = new.cong_nghe_han and loai_moi_han = new.loai_moi_han and dang_ap_dung
    ) else null end);
  return new;
end $$;

revoke all on function public.ap_dung_tieu_chuan_moi_han(uuid,text) from public,anon,authenticated;
revoke all on function public.tao_va_ap_dung_tieu_chuan_moi_han(uuid,text,text,text,jsonb,boolean,boolean,text,text) from public,anon,authenticated;
grant execute on function public.ap_dung_tieu_chuan_moi_han(uuid,text) to service_role;
grant execute on function public.tao_va_ap_dung_tieu_chuan_moi_han(uuid,text,text,text,jsonb,boolean,boolean,text,text) to service_role;

-- Chuyển dữ liệu mở của Phú Quốc về các tiêu chí đã được xác nhận, giữ mọi hồ sơ chốt.
do $$ declare rule_id uuid; begin
  for rule_id in select id from public.tieu_chuan_nghiem_thu_moi_han
    where du_an_id = '2370b59d-acd5-40a9-9f3f-94445a648a1a' and dang_ap_dung order by id
  loop perform public.ap_dung_tieu_chuan_moi_han(rule_id,'migration:20261101'); end loop;
end $$;

notify pgrst, 'reload schema';
commit;
