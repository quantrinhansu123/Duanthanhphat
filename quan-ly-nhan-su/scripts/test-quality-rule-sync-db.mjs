import assert from "node:assert/strict";
import fs from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const uuid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const project = uuid(1), other = uuid(2);
const sql = async (s, p = []) => (await db.query(s, p)).rows;
const one = async (s, p = []) => Object.values((await sql(s, p))[0])[0];
const migrate = async (n) => db.exec(fs.readFileSync(new URL(`../../supabase/${n}.sql`, import.meta.url), "utf8"));
const bounds = { min: -1, max: 1, minInclusive: true, maxInclusive: true };
const limits = Object.fromEntries(["doc_mat_lan", "ngang_nam_ray", "ngang_chan_ray", "phang_mat_lan", "chieu_dai_mai"].map((k) => [k, k === "chieu_dai_mai" ? { ...bounds, min: 0, max: 800 } : bounds]));
const measured = { doc_mat_lan: 0.1, ngang_nam_ray: 0.2, ngang_chan_ray: 0.3, phang_mat_lan: 0.1, chieu_dai_mai: 700 };
const migrations = ["migration_20261028_nghiem_thu_moi_han", "migration_20261028_nhat_ky_kiem_tra_chat_luong", "migration_20261029_chat_luong_trinh_tu_moi", "migration_20261031_rfi_quy_trinh", "migration_20261101_chieu_dai_mai", "migration_20261101_chieu_dai_mai_khong_ha_rfi", "migration_20261101_rfi_doi_soat_trang_thai", "migration_20261028_ho_so_sua_doi"];
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to service_role;
    create table du_an(id uuid primary key);
    create table lich_su_moi_han(id uuid primary key,ma_lich_su text,du_an_id uuid references du_an(id),cong_nghe_han text,
      loai_moi_han text,ngay_thuc_hien date,tinh_trang_thi_nghiem text,so_luong_loi integer default 0,so_luong_thuc_hien integer default 1);
    create view bao_cao_moi_han_theo_du_an as select * from lich_su_moi_han;
    create table toa_do(id uuid default gen_random_uuid(),lich_su_moi_han_id uuid,ma_diem text,ly_trinh text);
    grant select,insert,update,delete on du_an,lich_su_moi_han,toa_do to service_role;
    grant select on bao_cao_moi_han_theo_du_an to service_role;`);
  for (const n of migrations) await migrate(n);
  await sql("insert into du_an values ($1),($2)", [project, other]);
  const old = uuid(3);
  await sql("insert into tieu_chuan_nghiem_thu_moi_han(id,du_an_id,cong_nghe_han,loai_moi_han,phien_ban,ten,dung_sai,yeu_cau_ndt,ndt_truoc_rfi,nguoi_xac_nhan,dang_ap_dung) values ($1,$2,'FBW','Sản xuất',1,'R1',$3,true,false,'qc',true)", [old, project, limits]);
  const [open, frozen, training, crossProject, missing, aggregate] = [10,11,12,13,14,15].map(uuid);
  for (const id of [open, frozen, training, crossProject, missing, aggregate]) {
    await sql("insert into lich_su_moi_han(id,ma_lich_su,du_an_id,cong_nghe_han,loai_moi_han,ngay_thuc_hien,so_luong_thuc_hien) values ($1::uuid,$1::text,$2,'FBW',$3,'2026-11-01',$4)", [id, id === crossProject ? other : project, id === training ? "Đào tạo" : "Sản xuất", id === aggregate ? 10 : 1]);
  }
  for (const id of [open, frozen]) await sql("select luu_kiem_tra_moi_han($1,1,$2,'2026-11-01','Đạt',$3,'Siêu âm','Đạt','2026-11-01','qc')", [id, old, measured]);
  await sql("insert into phieu_yeu_cau_nghiem_thu(id,du_an_id,so_phieu,ngay_moi,nguoi_lap) values ($1,$2,'Frozen','2026-11-01','qc')", [uuid(20), project]);
  await sql("insert into dot_nghiem_thu(id,phieu_id,ngay_nghiem_thu,nguoi_lap,yeu_cau,thong_tin) values ($1,$2,'2026-11-01','qc','[]','{\"draft\":false}')", [uuid(21), uuid(20)]);
  await sql("insert into dot_nghiem_thu_moi(dot_id,moi_han_id,ket_qua,du_lieu_chot) values ($1,$2,'Đạt','{\"frozen\":true}')", [uuid(21), frozen]);
  const beforeFrozen = await one("select to_jsonb(k) from kiem_tra_moi_han k where moi_han_id=$1", [frozen]);
  await migrate("migration_20261101_tieu_chi_dong_bo_moi_mo");
  await db.exec("set role service_role");
  const created = await one("select tao_va_ap_dung_tieu_chuan_moi_han($1,'FBW','Sản xuất','R2',$2,true,true,null,'qc')", [project, limits]);
  const current = created.rule.id;
  assert.equal(created.sync.cap_nhat, 2, "Update existing open weld and unassigned weld");
  assert.equal(created.sync.giu_nguyen_ho_so, 1);
  const updated = await one("select to_jsonb(k) from kiem_tra_moi_han k where moi_han_id=$1", [open]);
  assert.equal(updated.tieu_chuan_id, current);
  assert.equal(updated.phien_ban, 3);
  assert.deepEqual(updated.gia_tri_do, measured);
  assert.equal(updated.ket_qua_ndt, "Đạt");
  assert.deepEqual(await one("select to_jsonb(k) from kiem_tra_moi_han k where moi_han_id=$1", [frozen]), beforeFrozen, "Completed inspection stays byte-for-byte unchanged");
  for (const id of [training, crossProject, aggregate]) assert.equal(await one("select tieu_chuan_id from kiem_tra_moi_han where moi_han_id=$1", [id]), null);
  assert.equal(await one("select du_lieu_chot from dot_nghiem_thu_moi where moi_han_id=$1", [frozen]).then(x => x.frozen), true);
  assert.equal((await one("select ap_dung_tieu_chuan_moi_han($1,'qc')", [current])).cap_nhat, 0, "Resync does not increment versions or duplicate audit");
  assert.equal(await one("select count(*)::int from lich_su_tieu_chuan_moi_han"), 2);
  await sql("insert into lich_su_moi_han(id,ma_lich_su,du_an_id,cong_nghe_han,loai_moi_han) values ($1,'new',$2,'FBW','Sản xuất')", [uuid(30), project]);
  assert.equal(await one("select tieu_chuan_id from kiem_tra_moi_han where moi_han_id=$1", [uuid(30)]), current, "New weld inherits current criteria");
  await assert.rejects(() => one("select ap_dung_tieu_chuan_moi_han($1,'qc')", [old]), /không còn/);
  await assert.rejects(() => one("select tao_va_ap_dung_tieu_chuan_moi_han($1,'FBW','Sản xuất','Invalid','{}',true,true,null,'qc')", [project]), /check constraint/);
  assert.equal(await one("select dang_ap_dung from tieu_chuan_nghiem_thu_moi_han where id=$1", [current]), true, "Invalid creation rolls back deactivation");
  await db.exec("reset role; create function fail_rule_update() returns trigger language plpgsql as $$ begin raise exception 'Injected sync failure'; end $$; create trigger fail_rule_update before insert on lich_su_tieu_chuan_moi_han for each row execute function fail_rule_update(); set role service_role");
  await assert.rejects(() => one("select tao_va_ap_dung_tieu_chuan_moi_han($1,'FBW','Sản xuất','R3',$2,true,true,null,'qc')", [project, limits]), /Injected sync failure/);
  assert.equal(await one("select count(*)::int from tieu_chuan_nghiem_thu_moi_han"), 2, "Rule creation and all weld updates roll back together");
  assert.equal(await one("select tieu_chuan_id from kiem_tra_moi_han where moi_han_id=$1", [open]), current);
  await db.exec("reset role; drop trigger fail_rule_update on lich_su_tieu_chuan_moi_han");
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    await assert.rejects(() => one("select ap_dung_tieu_chuan_moi_han($1,'qc')", [current]), /permission denied/);
    await assert.rejects(() => sql("select * from lich_su_tieu_chuan_moi_han"), /permission denied/);
    await db.exec("reset role");
  }
  const pq = "2370b59d-acd5-40a9-9f3f-94445a648a1a";
  await sql("insert into du_an values ($1)", [pq]);
  await sql("insert into tieu_chuan_nghiem_thu_moi_han(id,du_an_id,cong_nghe_han,loai_moi_han,phien_ban,ten,dung_sai,yeu_cau_ndt,ndt_truoc_rfi,nguoi_xac_nhan,dang_ap_dung) values ($1,$2,'FBW','Sản xuất',1,'PQ-R1',$3,true,false,'qc',true)", [uuid(60), pq, limits]);
  await sql("insert into lich_su_moi_han(id,ma_lich_su,du_an_id,cong_nghe_han,loai_moi_han) values ($1,'PQ-legacy',$2,'FBW','Sản xuất')", [uuid(61), pq]);
  await sql("update tieu_chuan_nghiem_thu_moi_han set dang_ap_dung=false where id=$1", [uuid(60)]);
  await sql("insert into tieu_chuan_nghiem_thu_moi_han(id,du_an_id,cong_nghe_han,loai_moi_han,phien_ban,ten,dung_sai,yeu_cau_ndt,ndt_truoc_rfi,nguoi_xac_nhan,dang_ap_dung) values ($1,$2,'FBW','Sản xuất',2,'PQ-R2',$3,true,true,'qc',true)", [uuid(62), pq, limits]);
  await migrate("migration_20261101_tieu_chi_dong_bo_moi_mo");
  assert.equal(await one("select tieu_chuan_id from kiem_tra_moi_han where moi_han_id=$1", [uuid(61)]), uuid(62), "Migration backfills existing PQ open inspections to the approved current rule");
  const version = await one("select phien_ban from kiem_tra_moi_han where moi_han_id=$1", [uuid(61)]);
  await migrate("migration_20261101_tieu_chi_dong_bo_moi_mo");
  assert.equal(await one("select phien_ban from kiem_tra_moi_han where moi_han_id=$1", [uuid(61)]), version, "Backfill is repeatable without changing versions");
  console.log("PASS criteria sync SQL: atomic create/apply, open welds, auto-inheritance, unchanged measurements/NDT/frozen dossier, group/project isolation, repeat sync, rollback and privileges");
} catch (e) { console.error(e.message, e.where ?? ""); process.exitCode = 1; }
finally { await db.close(); }
