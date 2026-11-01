import assert from "node:assert/strict";
import fs from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const project = "2370b59d-acd5-40a9-9f3f-94445a648a1a";
const uuid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const operation = fs.readFileSync(new URL("../../supabase/operations/reset_pq_giu_11_moi_chap_thuan_20261101.sql", import.meta.url), "utf8");
async function fixture() {
  const db = new PGlite();
  const sql = async (s, p = []) => (await db.query(s, p)).rows;
  const one = async (s, p = []) => Object.values((await sql(s, p))[0])[0];
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table du_an(id uuid primary key);
    create table lich_su_moi_han(id uuid primary key,ma_lich_su text,du_an_id uuid references du_an(id),cong_nghe_han text,
      loai_moi_han text,ngay_thuc_hien date,tinh_trang_thi_nghiem text,so_luong_loi integer default 0,so_luong_thuc_hien integer default 1);
    create view bao_cao_moi_han_theo_du_an as select * from lich_su_moi_han;
    create table toa_do(id uuid primary key,lich_su_moi_han_id uuid references lich_su_moi_han(id) on delete set null,ma_diem text,ly_trinh text);
    create table lwr_track_layouts(project_id uuid primary key,layout jsonb);
    create table lich_su_tieu_chuan_moi_han(id uuid primary key, moi_han_id uuid references lich_su_moi_han(id) on delete restrict);
    create table test_rollup(deleted integer); insert into test_rollup values (0);
    create function count_deletion() returns trigger language plpgsql as $$ begin update test_rollup set deleted=deleted+1; return old; end $$;
    create trigger test_rollup_trigger after delete on lich_su_moi_han for each row execute function count_deletion();`);
  for (const name of ["migration_20261028_nghiem_thu_moi_han", "migration_20261028_ho_so_sua_doi", "migration_20261029_chat_luong_trinh_tu_moi", "migration_20261101_chieu_dai_mai"]) {
    await db.exec(fs.readFileSync(new URL(`../../supabase/${name}.sql`, import.meta.url), "utf8"));
  }
  await sql("insert into du_an values ($1),($2)", [project, uuid(999)]);
  for (let i = 1; i <= 83; i++) {
    await sql("insert into lich_su_moi_han(id,ma_lich_su,du_an_id,cong_nghe_han,loai_moi_han,ngay_thuc_hien) values ($1,$2,$3,'FBW',$4,$5)", [uuid(i), `W${i}`, i === 83 ? uuid(999) : project, i <= 11 ? "Chấp thuận" : "Sản xuất", i <= 11 ? "2026-10-06" : "2026-11-01"]);
    await sql("insert into toa_do values ($1,$2,$3,$4)", [uuid(i + 1000), uuid(i), `TT${i}`, `Km1+${i}`]);
  }
  for (const [n, ids] of [[100, Array.from({length: 11}, (_, i) => i + 1)], [101, [12,13]], [102, []], [103,[83]]]) {
    await sql("insert into phieu_yeu_cau_nghiem_thu(id,du_an_id,so_phieu,ngay_moi,nguoi_lap) values ($1,$2,$3,'2026-11-01','qc')", [uuid(n), n === 103 ? uuid(999) : project, n === 100 ? "001-RFI" : `RFI-${n}`]);
    await sql("insert into dot_nghiem_thu(id,phieu_id,ngay_nghiem_thu,nguoi_lap,yeu_cau,thong_tin) values ($1,$2,'2026-11-01','qc','[]','{}')", [uuid(n + 100), uuid(n)]);
    for (const i of ids) {
      await sql("insert into phieu_yeu_cau_nghiem_thu_moi(phieu_id,moi_han_id,du_lieu_chot,con_hieu_luc) values ($1,$2,'{\"original\":true}',false)", [uuid(n),uuid(i)]);
      await sql("insert into dot_nghiem_thu_moi(dot_id,moi_han_id,ket_qua,du_lieu_chot) values ($1,$2,'Đạt','{\"original\":true}')", [uuid(n+100),uuid(i)]);
    }
    await sql("insert into ho_so_nghiem_thu(id,dot_id,loai,du_lieu_chot,tinh_trang_ky) values ($1,$2,'Phụ lục công việc','{\"signed\":true}','Đã ký')", [uuid(n+200),uuid(n+100)]);
    await sql("insert into ho_so_nghiem_thu_sua_doi(id,ho_so_id,phien_ban,thong_tin,ly_do,nguoi_sua) values ($1,$2,1,'{}','original','qc')", [uuid(n+300),uuid(n+200)]);
  }
  await sql("insert into lwr_track_layouts values ($1,$2),($3,$4)", [project, {version:2,rows:[{id:"keep-geometry"}],jointWeldLinks:{one:[uuid(12),uuid(1)],two:[uuid(13)]}}, uuid(999), {version:2,jointWeldLinks:{one:[uuid(83)]}}]);
  for (const i of [1,12,83]) await sql("insert into lich_su_tieu_chuan_moi_han values ($1,$2)", [uuid(i+2000),uuid(i)]);
  return { db, sql, one };
}
let f;
try {
  f = await fixture();
  const original = await f.one("select to_jsonb(w) from lich_su_moi_han w where id=$1", [uuid(83)]);
  await f.db.exec(`create function injected_delete_failure() returns trigger language plpgsql as $$ begin raise exception 'Injected deletion failure'; end $$; create trigger injected_delete_failure before delete on lich_su_moi_han for each row execute function injected_delete_failure();`);
  await assert.rejects(() => f.db.exec(operation), /Injected deletion failure/);
  await f.db.exec("rollback");
  assert.equal(await f.one("select count(*)::int from lich_su_moi_han"), 83, "Failed cleanup rolls back weld/dossier/backup mutations");
  assert.equal(await f.one("select count(*)::int from ho_so_nghiem_thu_sua_doi"), 4);
  assert.equal(await f.one("select tgenabled from pg_trigger where tgname='trg_bao_ve_ho_so_sua_doi'"), "O");
  await f.db.exec("drop trigger injected_delete_failure on lich_su_moi_han");
  const result = await f.db.exec(operation);
  assert.equal(await f.one("select count(*)::int from lich_su_moi_han where du_an_id=$1", [project]), 11);
  assert.equal(await f.one("select count(*)::int from phieu_yeu_cau_nghiem_thu where du_an_id=$1", [project]), 1);
  assert.equal(await f.one("select so_phieu from phieu_yeu_cau_nghiem_thu where du_an_id=$1", [project]), "001-RFI");
  assert.equal(await f.one("select count(*)::int from ho_so_nghiem_thu_sua_doi"), 2, "Keep original and other-project revisions");
  assert.equal(await f.one("select count(*)::int from lich_su_tieu_chuan_moi_han"), 2, "Remove deleted-weld rule history and preserve retained/other-project history");
  assert.deepEqual(await f.one("select to_jsonb(w) from lich_su_moi_han w where id=$1", [uuid(83)]), original);
  assert.equal(await f.one("select count(*)::int from toa_do where lich_su_moi_han_id is null"), 71);
  assert.deepEqual(await f.one("select layout->'jointWeldLinks' from lwr_track_layouts where project_id=$1", [project]), {one:[uuid(1)],two:[]});
  assert.equal(await f.one("select deleted from test_rollup"), 71, "Source rollup triggers remain enabled");
  assert.equal(await f.one("select jsonb_array_length(rows) from maintenance_backup.pq_weld_reset_20261101 where table_name='lich_su_moi_han'"), 71);
  await f.db.exec("set role anon");
  await assert.rejects(() => f.sql("select * from maintenance_backup.pq_weld_reset_20261101"), /permission denied/);
  await f.db.exec("reset role");
  await f.db.exec(operation);
  assert.equal(await f.one("select jsonb_array_length(rows) from maintenance_backup.pq_weld_reset_20261101 where table_name='lich_su_moi_han'"), 71, "Repeat does not overwrite original backup");
  console.log("Cleanup result:", JSON.stringify(result.find(r => r.rows?.[0]?.moi_giu_lai)?.rows));
  await f.db.close(); f = await fixture();
  await f.sql("update lich_su_moi_han set ngay_thuc_hien='2026-10-07' where id=$1", [uuid(1)]);
  await assert.rejects(() => f.db.exec(operation), /đúng 11/); await f.db.exec("rollback");
  assert.equal(await f.one("select count(*)::int from lich_su_moi_han"), 83);
  await f.db.close(); f = await fixture();
  await f.sql("insert into phieu_yeu_cau_nghiem_thu_moi(phieu_id,moi_han_id,du_lieu_chot) values ($1,$2,'{}')", [uuid(100),uuid(14)]);
  await assert.rejects(() => f.db.exec(operation), /chứa lẫn/); await f.db.exec("rollback");
  assert.equal(await f.one("select count(*)::int from lich_su_moi_han"), 83);
  console.log("PASS PQ cleanup SQL: delete 71, preserve 11 approval welds and original dossier, remove empty RFI/revisions, retain other project/GPS geometry, unlink LWR, backups, enabled rollups, rollback, repeat and mixed-scope/count guards");
} catch (e) { console.error(e.message, e.where ?? ""); process.exitCode=1; }
finally { if (f) await f.db.close(); }
