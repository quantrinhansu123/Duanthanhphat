-- Giữ đúng 6 nhóm trong ảnh ngày 31/10/2026 và người đang được gán.
-- Chạy bằng SQL Editor / kết nối chủ sở hữu database, sau khi sao lưu.
-- Xóa hồ sơ chứng chỉ ngoài danh mục; nhật ký giữ tên chứng chỉ đã dùng,
-- chỉ bỏ khóa ngoại đến hồ sơ bị xóa. Liên kết khóa học cũ được SET NULL.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';

lock table public.chung_chi_nhom, public.chung_chi, public.chung_chi_ho_so,
  public.nhan_su, public.lich_su_moi_han, public.dao_tao, public.dao_tao_hoc_vien
  in share row exclusive mode;

create temporary table giu_nhom_chung_chi (id uuid primary key, ten_nhom text) on commit drop;
insert into giu_nhom_chung_chi values
  ('2b7007a0-ad30-42b5-9aee-833b4d1a58c7', 'CHỨNG CHỈ HÀN RAY GAS KHÍ ÉP  - TGP-5'),
  ('8306e186-d31c-469d-ad60-92fbf8c3554e', 'CHỨNG CHỈ HÀN RAY NHIỆT NHÔM - SHANGDONG'),
  ('75cae38b-d15e-492b-92d0-4fc814c2aeec', 'CHỨNG CHỈ HÀN RAY NHIỆT NHÔM - RAILTECH'),
  ('92db678c-f63d-4dd5-84c4-91356432b364', 'CHỨNG CHỈ HÀN RAY NHIỆT NHÔM - GOLDSCHMIDT'),
  ('c0dd1208-b05e-4f9e-8621-93baa02b1a13', 'CHỨNG CHỈ HÀN RAY CHẢY GIÁP MÉP - UN5'),
  ('94e780d6-8094-49fb-a7b2-286921126a5e', 'CHỨNG CHỈ HÀN RAY CHẢY GIÁP MÉP - K922-1');

do $$ begin
  if (select count(*) from public.chung_chi_nhom g
      join giu_nhom_chung_chi k on k.id = g.id and k.ten_nhom = g.ten_nhom) <> 6 then
    raise exception 'Danh mục đã thay đổi; dừng để đối chiếu lại 6 chứng chỉ';
  end if;
end $$;

create temporary table bo_ho_so_chung_chi on commit drop as
select id from public.chung_chi c
where not exists (select 1 from giu_nhom_chung_chi k where k.id = c.nhom_id);

create temporary table giu_ho_so_chung_chi on commit drop as
select c.* from public.chung_chi c
where not exists (select 1 from bo_ho_so_chung_chi b where b.id = c.id);

create temporary table doi_chieu_lich_su on commit drop as
select l.id, to_jsonb(l) - 'chung_chi_id' - 'updated_at' as noi_dung
from public.lich_su_moi_han l;

-- Chỉ ngừng kiểm tra cấp chứng chỉ cho thao tác tháo FK lịch sử này.
-- Khóa bảng ngăn ghi đồng thời; mọi lỗi sẽ rollback cả trạng thái trigger.
alter table public.lich_su_moi_han disable trigger trg_kiem_tra_chung_chi_moi_han;
update public.lich_su_moi_han l set chung_chi_id = null
where exists (select 1 from bo_ho_so_chung_chi b where b.id = l.chung_chi_id);
alter table public.lich_su_moi_han enable trigger trg_kiem_tra_chung_chi_moi_han;

delete from public.chung_chi_ho_so h
where not exists (select 1 from giu_nhom_chung_chi k where k.ten_nhom = h.ten_chung_chi);
delete from public.chung_chi c
where exists (select 1 from bo_ho_so_chung_chi b where b.id = c.id);
delete from public.chung_chi_nhom g
where not exists (select 1 from giu_nhom_chung_chi k where k.id = g.id);

-- Xóa tên cũ trong cache để giao diện không tự dựng lại loại đã bỏ.
select public.dong_bo_mang_chung_chi_nhan_su(employee_id) from public.nhan_su;

do $$ begin
  if (select count(*) from public.chung_chi_nhom) <> 6 then
    raise exception 'Danh mục sau khi dọn không đủ đúng 6 loại';
  end if;
  if exists (
    (select * from giu_ho_so_chung_chi except select * from public.chung_chi)
    union all
    (select * from public.chung_chi except select * from giu_ho_so_chung_chi)
  ) then
    raise exception 'Hồ sơ/người sở hữu của 6 loại giữ lại đã bị thay đổi';
  end if;
  if exists (
    (select id, noi_dung from doi_chieu_lich_su
     except select l.id, to_jsonb(l) - 'chung_chi_id' - 'updated_at' from public.lich_su_moi_han l)
    union all
    (select l.id, to_jsonb(l) - 'chung_chi_id' - 'updated_at' from public.lich_su_moi_han l
     except select id, noi_dung from doi_chieu_lich_su)
  ) then
    raise exception 'Nội dung lịch sử hàn đã bị thay đổi';
  end if;
end $$;

commit;
