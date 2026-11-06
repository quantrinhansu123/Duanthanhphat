begin;

create or replace view public.chat_luong_moi_han with (security_invoker = true) as
select ls.id as moi_han_id, ls.du_an_id, ls.loai_moi_han, ls.cong_nghe_han, ls.ngay_thuc_hien,
  kt.phien_ban, kt.tieu_chuan_id, hh.ket_qua as ket_qua_hinh_hoc,
  coalesce(
    ls.so_luong_thuc_hien = 1
      and flags.noi_bo_dat
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



-- Hồ sơ độc lập để các liên kết, trạng thái và bộ biên bản của PA tổng hợp tiếp tục hoạt động.
create table if not exists public.phieu_nt_tach (
  id uuid primary key,
  du_an_id uuid not null references public.du_an(id),
  loai text not null check (loai in ('hinh-hoc','sieu-am')),
  so_phieu text not null check (length(trim(so_phieu)) between 1 and 80),
  ngay_moi date not null,
  nguoi_lap text not null,
  ngay_nghiem_thu date check (ngay_nghiem_thu >= ngay_moi),
  nguoi_nghiem_thu text,
  unique (id,loai), unique (du_an_id,loai,so_phieu)
);

create table if not exists public.phieu_nt_tach_moi (
  phieu_id uuid not null,
  loai text not null,
  moi_han_id uuid not null references public.lich_su_moi_han(id),
  ma_lich_su text not null,
  ket_qua text check (ket_qua in ('Đạt','Không đạt')),
  ly_do text,
  du_lieu_chot jsonb not null,
  foreign key (phieu_id,loai) references public.phieu_nt_tach(id,loai),
  primary key (phieu_id,moi_han_id));
create unique index if not exists nt_tach_moi_dang_xu_ly on public.phieu_nt_tach_moi(moi_han_id,loai)
  where ket_qua is distinct from 'Không đạt';

create or replace view public.dieu_kien_nt_tach with (security_invoker=true) as
select ls.id as moi_han_id, ls.du_an_id, ls.ma_lich_su, kt.phien_ban, kt.ngay_mai, kt.ngay_ndt,
  kt.gia_tri_do, kt.truc_quan, kt.phuong_phap_ndt, kt.ket_qua_ndt, kt.tieu_chuan_id,
  tc.ten as ten_tieu_chuan, tc.dung_sai,
  (kt.ngay_mai is not null and kt.truc_quan='Đạt' and q.ket_qua_hinh_hoc='Đạt') as noi_bo_hinh_hoc,
  (kt.ngay_mai is not null and kt.truc_quan='Đạt') as noi_bo_truc_quan,
  (exists(select 1 from public.phieu_nt_tach_moi m where m.moi_han_id=ls.id and m.loai='hinh-hoc' and m.ket_qua='Đạt')
    or exists(select 1 from public.dot_nghiem_thu_moi m join public.dot_nghiem_thu d on d.id=m.dot_id
      where m.moi_han_id=ls.id and m.ket_qua='Đạt' and coalesce(d.thong_tin->>'draft','false') <> 'true')) as da_nt_truc_quan
from public.lich_su_moi_han ls
join public.chat_luong_moi_han q on q.moi_han_id=ls.id
join public.kiem_tra_moi_han kt on kt.moi_han_id=ls.id
left join public.tieu_chuan_nghiem_thu_moi_han tc on tc.id=kt.tieu_chuan_id
where ls.so_luong_thuc_hien=1 and kt.ly_do_loai_nghiem_thu is null
  and kt.xu_ly_truc_quan is distinct from 'khong_dat' and kt.truc_quan is distinct from 'Không đạt';

create or replace view public.ung_vien_nt_tach with (security_invoker=true) as
select q.*, t.loai,
  case when t.loai='hinh-hoc' then q.noi_bo_hinh_hoc
      and (not (q.dung_sai ? 'chieu_dai_mai') or q.gia_tri_do->>'chieu_dai_mai' is not null)
    else q.phuong_phap_ndt='Siêu âm' and q.ket_qua_ndt='Đạt' and q.ngay_ndt is not null
  end as co_the_dat
from public.dieu_kien_nt_tach q cross join (values ('hinh-hoc'),('sieu-am')) t(loai)
where (t.loai='hinh-hoc' and q.noi_bo_hinh_hoc)
   or (t.loai='sieu-am' and (q.noi_bo_truc_quan or q.da_nt_truc_quan));

create or replace view public.moi_cho_phieu_nt_tach with (security_invoker=true) as
select q.* from public.ung_vien_nt_tach q where not exists (
  select 1 from public.phieu_nt_tach_moi m where m.moi_han_id=q.moi_han_id and m.loai=q.loai
    and (m.ket_qua is distinct from 'Không đạt' or (m.du_lieu_chot->>'phien_ban')::int=q.phien_ban)
);

create or replace function public.phat_phieu_nt_tach(p_id uuid,p_du_an uuid,p_loai text,p_so text,p_ngay date,p_moi uuid[],p_actor text)
returns uuid language plpgsql set search_path=public,pg_temp as $$
declare n int;
begin
  n := cardinality(p_moi);
  if n is null or n not between 1 and 200 or n<>(select count(distinct id) from unnest(p_moi) id) then
    raise exception 'Danh sách mối không hợp lệ (1–200 mối khác nhau).';
  end if;
  perform 1 from lich_su_moi_han where id=any(p_moi) order by id for update;
  if exists(select 1 from phieu_nt_tach where id=p_id and du_an_id=p_du_an and loai=p_loai and so_phieu=trim(p_so)
    and ngay_moi=p_ngay and nguoi_lap=p_actor and (select array_agg(moi_han_id order by moi_han_id) from phieu_nt_tach_moi where phieu_id=p_id)
      =(select array_agg(id order by id) from unnest(p_moi) id)) then return p_id; end if;
  insert into phieu_nt_tach(id,du_an_id,loai,so_phieu,ngay_moi,nguoi_lap) values(p_id,p_du_an,p_loai,trim(p_so),p_ngay,p_actor);
  insert into phieu_nt_tach_moi(phieu_id,loai,moi_han_id,ma_lich_su,du_lieu_chot)
    select p_id,p_loai,q.moi_han_id,q.ma_lich_su,to_jsonb(q) from moi_cho_phieu_nt_tach q
    where q.du_an_id=p_du_an and q.loai=p_loai and q.moi_han_id=any(p_moi);
  if not found or (select count(*) from phieu_nt_tach_moi where phieu_id=p_id)<>n then
    raise exception 'Danh sách mối đã thay đổi hoặc chưa đủ điều kiện phát phiếu.';
  end if;
  return p_id;
end $$;

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
  update phieu_nt_tach set ngay_nghiem_thu=p_ngay,nguoi_nghiem_thu=p_actor where id=p_id;
  return p_id;
end $$;

alter table public.phieu_nt_tach enable row level security;
alter table public.phieu_nt_tach_moi enable row level security;
revoke all on public.phieu_nt_tach,public.phieu_nt_tach_moi,public.dieu_kien_nt_tach,public.ung_vien_nt_tach,public.moi_cho_phieu_nt_tach from public,anon,authenticated;
grant select,insert,update on public.phieu_nt_tach,public.phieu_nt_tach_moi to service_role;
grant select on public.dieu_kien_nt_tach,public.ung_vien_nt_tach,public.moi_cho_phieu_nt_tach to service_role;
revoke all on function public.phat_phieu_nt_tach(uuid,uuid,text,text,date,uuid[],text),public.chot_phieu_nt_tach(uuid,date,jsonb,text) from public,anon,authenticated;
grant execute on function public.phat_phieu_nt_tach(uuid,uuid,text,text,date,uuid[],text),public.chot_phieu_nt_tach(uuid,date,jsonb,text) to service_role;
notify pgrst,'reload schema';
commit;
