-- Thao tác dọn dữ liệu được yêu cầu riêng, chạy bằng SQL Editor (postgres).
-- Chỉ Phú Quốc; giữ đúng 11 mối Chấp thuận 06/10/2026 và nguyên bộ hồ sơ liên quan.
-- Có sao lưu riêng trong DB; lỗi bất kỳ bước nào sẽ rollback cả lần dọn.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

lock table public.lich_su_moi_han, public.kiem_tra_moi_han,
  public.phieu_yeu_cau_nghiem_thu, public.phieu_yeu_cau_nghiem_thu_moi,
  public.dot_nghiem_thu, public.dot_nghiem_thu_moi, public.ho_so_nghiem_thu,
  public.ho_so_nghiem_thu_sua_doi, public.toa_do in share row exclusive mode;

create temp table pq_keep on commit drop as
select id from public.lich_su_moi_han
where du_an_id = '2370b59d-acd5-40a9-9f3f-94445a648a1a'
  and loai_moi_han = 'Chấp thuận' and ngay_thuc_hien = date '2026-10-06';

do $$ begin
  if (select count(*) from pq_keep) <> 11 then
    raise exception 'Dừng: phải xác nhận đúng 11 mối Chấp thuận ngày 06/10/2026 trước khi xóa';
  end if;
end $$;

create temp table pq_delete on commit drop as
select id from public.lich_su_moi_han
where du_an_id = '2370b59d-acd5-40a9-9f3f-94445a648a1a' and id not in (select id from pq_keep);
create temp table pq_rfi_delete on commit drop as
select id from public.phieu_yeu_cau_nghiem_thu p
where p.du_an_id = '2370b59d-acd5-40a9-9f3f-94445a648a1a'
  and not exists (select 1 from public.phieu_yeu_cau_nghiem_thu_moi pm where pm.phieu_id = p.id and pm.moi_han_id in (select id from pq_keep))
  and not exists (select 1 from public.dot_nghiem_thu d join public.dot_nghiem_thu_moi dm on dm.dot_id = d.id
    where d.phieu_id = p.id and dm.moi_han_id in (select id from pq_keep));
create temp table pq_dot_delete on commit drop as
select id from public.dot_nghiem_thu where phieu_id in (select id from pq_rfi_delete);
create temp table pq_docs_delete on commit drop as
select id from public.ho_so_nghiem_thu where dot_id in (select id from pq_dot_delete);

-- Không tự sửa nội dung một RFI/hồ sơ chứa cả mối cần giữ và mối cần xóa.
do $$ begin
  if exists (select 1 from public.phieu_yeu_cau_nghiem_thu_moi pm
    where pm.moi_han_id in (select id from pq_delete) and pm.phieu_id not in (select id from pq_rfi_delete))
    or exists (select 1 from public.dot_nghiem_thu_moi dm
      where dm.moi_han_id in (select id from pq_delete) and dm.dot_id not in (select id from pq_dot_delete)) then
    raise exception 'Dừng: có RFI/hồ sơ chứa lẫn mối giữ lại và mối cần xóa; cần tách phạm vi trước';
  end if;
  if exists (select 1 from public.phieu_yeu_cau_nghiem_thu_moi pm where pm.phieu_id in (select id from pq_rfi_delete)
    and pm.moi_han_id not in (select id from pq_delete))
    or exists (select 1 from public.dot_nghiem_thu_moi dm where dm.dot_id in (select id from pq_dot_delete)
      and dm.moi_han_id not in (select id from pq_delete)) then
    raise exception 'Dừng: RFI Phú Quốc chứa mối ngoài phạm vi xóa';
  end if;
end $$;

-- Dấu kiểm tra dữ liệu giữ lại, bao gồm bản sửa đổi và snapshot đã ký.
create temp table pq_protected on commit drop as
select 'lich_su_moi_han'::text as name, coalesce(jsonb_agg(to_jsonb(w) order by w.id),'[]'::jsonb) as rows
from public.lich_su_moi_han w where w.id in (select id from pq_keep)
union all select 'kiem_tra_moi_han',coalesce(jsonb_agg(to_jsonb(w) order by w.moi_han_id),'[]'::jsonb)
from public.kiem_tra_moi_han w where w.moi_han_id in (select id from pq_keep)
union all select 'toa_do',coalesce(jsonb_agg(to_jsonb(w) order by w.id),'[]'::jsonb)
from public.toa_do w where w.lich_su_moi_han_id in (select id from pq_keep)
union all select 'phieu_yeu_cau_nghiem_thu',coalesce(jsonb_agg(to_jsonb(w) order by w.id),'[]'::jsonb)
from public.phieu_yeu_cau_nghiem_thu w where w.du_an_id = '2370b59d-acd5-40a9-9f3f-94445a648a1a' and w.id not in (select id from pq_rfi_delete)
union all select 'phieu_yeu_cau_nghiem_thu_moi',coalesce(jsonb_agg(to_jsonb(w) order by w.phieu_id,w.moi_han_id),'[]'::jsonb)
from public.phieu_yeu_cau_nghiem_thu_moi w where w.moi_han_id in (select id from pq_keep)
union all select 'dot_nghiem_thu',coalesce(jsonb_agg(to_jsonb(w) order by w.id),'[]'::jsonb)
from public.dot_nghiem_thu w join public.phieu_yeu_cau_nghiem_thu p on p.id = w.phieu_id
where p.du_an_id = '2370b59d-acd5-40a9-9f3f-94445a648a1a' and w.id not in (select id from pq_dot_delete)
union all select 'dot_nghiem_thu_moi',coalesce(jsonb_agg(to_jsonb(w) order by w.dot_id,w.moi_han_id),'[]'::jsonb)
from public.dot_nghiem_thu_moi w where w.moi_han_id in (select id from pq_keep)
union all select 'ho_so_nghiem_thu',coalesce(jsonb_agg(to_jsonb(w) order by w.id),'[]'::jsonb)
from public.ho_so_nghiem_thu w join public.dot_nghiem_thu d on d.id = w.dot_id join public.phieu_yeu_cau_nghiem_thu p on p.id = d.phieu_id
where p.du_an_id = '2370b59d-acd5-40a9-9f3f-94445a648a1a' and w.id not in (select id from pq_docs_delete)
union all select 'ho_so_nghiem_thu_sua_doi',coalesce(jsonb_agg(to_jsonb(w) order by w.id),'[]'::jsonb)
from public.ho_so_nghiem_thu_sua_doi w join public.ho_so_nghiem_thu h on h.id = w.ho_so_id
join public.dot_nghiem_thu d on d.id = h.dot_id join public.phieu_yeu_cau_nghiem_thu p on p.id = d.phieu_id
where p.du_an_id = '2370b59d-acd5-40a9-9f3f-94445a648a1a' and w.ho_so_id not in (select id from pq_docs_delete);

create schema if not exists maintenance_backup;
revoke all on schema maintenance_backup from public, anon, authenticated;
create table if not exists maintenance_backup.pq_weld_reset_20261101 (
  table_name text primary key, rows jsonb not null, captured_at timestamptz not null default now()
);
revoke all on maintenance_backup.pq_weld_reset_20261101 from public,anon,authenticated;
do $$ begin
  if exists (select 1 from maintenance_backup.pq_weld_reset_20261101 where table_name = 'lich_su_moi_han')
    and exists (select 1 from pq_delete) then
    raise exception 'Đợt dọn này đã chạy; có dữ liệu mới ngoài 11 mối giữ lại. Cần lập đợt dọn mới để không ghi đè bản sao lưu';
  end if;
end $$;
insert into maintenance_backup.pq_weld_reset_20261101(table_name,rows)
select 'lich_su_moi_han',coalesce(jsonb_agg(to_jsonb(w)),'[]'::jsonb) from public.lich_su_moi_han w where id in (select id from pq_delete)
union all select 'kiem_tra_moi_han',coalesce(jsonb_agg(to_jsonb(w)),'[]'::jsonb) from public.kiem_tra_moi_han w where moi_han_id in (select id from pq_delete)
union all select 'phieu_yeu_cau_nghiem_thu',coalesce(jsonb_agg(to_jsonb(w)),'[]'::jsonb) from public.phieu_yeu_cau_nghiem_thu w where id in (select id from pq_rfi_delete)
union all select 'phieu_yeu_cau_nghiem_thu_moi',coalesce(jsonb_agg(to_jsonb(w)),'[]'::jsonb) from public.phieu_yeu_cau_nghiem_thu_moi w where phieu_id in (select id from pq_rfi_delete)
union all select 'dot_nghiem_thu',coalesce(jsonb_agg(to_jsonb(w)),'[]'::jsonb) from public.dot_nghiem_thu w where id in (select id from pq_dot_delete)
union all select 'dot_nghiem_thu_moi',coalesce(jsonb_agg(to_jsonb(w)),'[]'::jsonb) from public.dot_nghiem_thu_moi w where dot_id in (select id from pq_dot_delete)
union all select 'ho_so_nghiem_thu',coalesce(jsonb_agg(to_jsonb(w)),'[]'::jsonb) from public.ho_so_nghiem_thu w where id in (select id from pq_docs_delete)
union all select 'ho_so_nghiem_thu_sua_doi',coalesce(jsonb_agg(to_jsonb(w)),'[]'::jsonb) from public.ho_so_nghiem_thu_sua_doi w where ho_so_id in (select id from pq_docs_delete)
union all select 'toa_do',coalesce(jsonb_agg(to_jsonb(w)),'[]'::jsonb) from public.toa_do w where lich_su_moi_han_id in (select id from pq_delete)
union all select 'protected',jsonb_object_agg(name,rows) from pq_protected
on conflict (table_name) do nothing;

do $$ begin
  if to_regclass('public.lwr_track_layouts') is not null then
    lock table public.lwr_track_layouts in share row exclusive mode;
    insert into maintenance_backup.pq_weld_reset_20261101(table_name,rows)
      select 'lwr_track_layouts',coalesce(jsonb_agg(to_jsonb(w)),'[]'::jsonb) from public.lwr_track_layouts w
      where project_id = '2370b59d-acd5-40a9-9f3f-94445a648a1a' on conflict (table_name) do nothing;
    update public.lwr_track_layouts t set layout = jsonb_set(t.layout,'{jointWeldLinks}',
      coalesce((select jsonb_object_agg(j.key,coalesce((select jsonb_agg(v.value order by v.ordinality)
        from jsonb_array_elements(j.value) with ordinality v(value,ordinality)
        where v.value #>> '{}' not in (select id::text from pq_delete)),'[]'::jsonb))
        from jsonb_each(t.layout->'jointWeldLinks') j),'{}'::jsonb))
      where project_id = '2370b59d-acd5-40a9-9f3f-94445a648a1a' and jsonb_typeof(layout->'jointWeldLinks') = 'object'
        and exists (select 1 from jsonb_each(t.layout->'jointWeldLinks') j cross join lateral jsonb_array_elements(j.value) v
          where v #>> '{}' in (select id::text from pq_delete));
  end if;
  if to_regclass('public.lich_su_tieu_chuan_moi_han') is not null then
    insert into maintenance_backup.pq_weld_reset_20261101(table_name,rows)
      select 'lich_su_tieu_chuan_moi_han',coalesce(jsonb_agg(to_jsonb(w)),'[]'::jsonb)
      from public.lich_su_tieu_chuan_moi_han w where moi_han_id in (select id from pq_delete) on conflict (table_name) do nothing;
    delete from public.lich_su_tieu_chuan_moi_han where moi_han_id in (select id from pq_delete);
  end if;
end $$;

-- Chỉ tạm mở trigger bất biến của bản sửa đổi, trong transaction đã khóa và chốt phạm vi.
alter table public.ho_so_nghiem_thu_sua_doi disable trigger trg_bao_ve_ho_so_sua_doi;
delete from public.ho_so_nghiem_thu_sua_doi where ho_so_id in (select id from pq_docs_delete);
alter table public.ho_so_nghiem_thu_sua_doi enable trigger trg_bao_ve_ho_so_sua_doi;
delete from public.ho_so_nghiem_thu where id in (select id from pq_docs_delete);
delete from public.dot_nghiem_thu_moi where dot_id in (select id from pq_dot_delete);
delete from public.dot_nghiem_thu where id in (select id from pq_dot_delete);
delete from public.phieu_yeu_cau_nghiem_thu_moi where phieu_id in (select id from pq_rfi_delete);
delete from public.phieu_yeu_cau_nghiem_thu where id in (select id from pq_rfi_delete);
delete from public.kiem_tra_moi_han where moi_han_id in (select id from pq_delete);
-- Giữ dữ liệu tọa độ tuyến gốc; tháo liên kết các mối đã xóa.
update public.toa_do set lich_su_moi_han_id = null where lich_su_moi_han_id in (select id from pq_delete);
delete from public.lich_su_moi_han where id in (select id from pq_delete);

-- Các trigger thống kê nguồn vẫn hoạt động. Xác minh dữ liệu giữ lại nguyên vẹn từng cột.
do $$ declare item record; actual jsonb; key text;
begin
  if (select count(*) from public.lich_su_moi_han where du_an_id = '2370b59d-acd5-40a9-9f3f-94445a648a1a') <> 11 then
    raise exception 'Dọn không đúng phạm vi: dự án phải còn đúng 11 mối';
  end if;
  for item in select * from pq_protected loop
    if item.name in ('lich_su_moi_han','phieu_yeu_cau_nghiem_thu','dot_nghiem_thu','ho_so_nghiem_thu','ho_so_nghiem_thu_sua_doi','toa_do') then key := 'id';
    else key := 'moi_han_id'; end if;
    execute format('select coalesce(jsonb_agg(to_jsonb(w) order by to_jsonb(w)::text),''[]''::jsonb) from public.%I w where w.%I::text in (select v->>%L from jsonb_array_elements($1) v)',item.name,key,key)
      into actual using item.rows;
    if actual is distinct from (select coalesce(jsonb_agg(v order by v::text),'[]'::jsonb) from jsonb_array_elements(item.rows) v) then
      raise exception 'Dừng: dữ liệu cần giữ ở bảng % đã thay đổi',item.name;
    end if;
  end loop;
  if exists (select 1 from public.phieu_yeu_cau_nghiem_thu p
    where p.du_an_id = '2370b59d-acd5-40a9-9f3f-94445a648a1a'
      and not exists (select 1 from public.phieu_yeu_cau_nghiem_thu_moi pm where pm.phieu_id = p.id)
      and not exists (select 1 from public.dot_nghiem_thu d where d.phieu_id = p.id)) then
    raise exception 'Dừng: còn RFI rỗng sau khi dọn';
  end if;
end $$;

select (select count(*) from pq_keep) as moi_giu_lai,
       (select count(*) from pq_delete) as moi_da_xoa,
       (select count(*) from pq_rfi_delete) as rfi_da_xoa,
       (select count(*) from public.phieu_yeu_cau_nghiem_thu where du_an_id = '2370b59d-acd5-40a9-9f3f-94445a648a1a') as rfi_con_lai;
commit;
