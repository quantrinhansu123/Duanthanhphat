import assert from "node:assert/strict";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const uuid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const [project, weld, late, profile, rfi, request] = [1, 2, 3, 4, 5, 6].map(uuid);
const sql = async (s, args = []) => (await db.query(s, args)).rows;
const value = async (s, args = []) => Object.values((await sql(s, args))[0])[0];
const migrate = (name) => db.exec(fs.readFileSync(new URL(`../../supabase/${name}.sql`, import.meta.url), "utf8"));
const limits = Object.fromEntries(["doc_mat_lan", "ngang_nam_ray", "ngang_chan_ray", "phang_mat_lan"].map((k) => [k, { min: -1, max: 1, minInclusive: true, maxInclusive: true }]));
const measurements = Object.fromEntries(Object.keys(limits).map((k) => [k, 0]));
const status = () => value("select tinh_trang from chat_luong_moi_han where moi_han_id=$1", [weld]);
const publish = (id = rfi, ids = [weld]) => value("select phat_hanh_rfi_moi_han($1,$2,$3,'2026-10-31',$4,'tester','{\"dia_diem\":\"Site\"}')", [id, project, `RFI-${id}`, ids]);
const decisions = [{ moi_han_id: weld, phien_ban: 3, ket_qua: "Đạt" }];
const complete = (results = decisions) => value("select hoan_thanh_nghiem_thu_moi_han($1,$2,'2026-10-31','tester',$3,'{}')", [request, rfi, results]);
const sign = (id, state = "Đã ký") => sql("select ky_bo_ho_so_moi_han($1,$2)", [id, state]);
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to service_role;
    create table du_an(id uuid primary key);
    create table lich_su_moi_han(id uuid primary key,ma_lich_su text,du_an_id uuid references du_an(id),cong_nghe_han text,
      loai_moi_han text,ngay_thuc_hien date,tinh_trang_thi_nghiem text,so_luong_loi integer default 0,so_luong_thuc_hien integer default 1);
    create view bao_cao_moi_han_theo_du_an as select * from lich_su_moi_han;
    create table toa_do(lich_su_moi_han_id uuid,ma_diem text,ly_trinh text);
    grant select,insert,update,delete on du_an,lich_su_moi_han,toa_do to service_role;
    grant select on bao_cao_moi_han_theo_du_an to service_role;`);
  for (const name of ["migration_20261028_nghiem_thu_moi_han", "migration_20261028_nhat_ky_kiem_tra_chat_luong", "migration_20261029_chat_luong_trinh_tu_moi", "migration_20261031_rfi_ho_so_draft", "migration_20261031_rfi_quy_trinh"]) await migrate(name);
  await sql("insert into du_an values ($1)", [project]);
  await sql("insert into tieu_chuan_nghiem_thu_moi_han(id,du_an_id,cong_nghe_han,loai_moi_han,phien_ban,ten,dung_sai,yeu_cau_ndt,ndt_truoc_rfi,nguoi_xac_nhan,dang_ap_dung) values ($1,$2,'FBW','Sản xuất',1,'Fixture',$3,true,false,'tester',true)", [profile, project, limits]);
  for (const id of [weld, late]) {
    await sql("insert into lich_su_moi_han(id,ma_lich_su,du_an_id,cong_nghe_han,loai_moi_han,ngay_thuc_hien) values ($1,$2,$3,'FBW','Sản xuất','2026-10-30')", [id, `W-${id}`, project]);
    await sql("select luu_kiem_tra_moi_han($1,1,$2,'2026-10-30','Đạt',$3,'Siêu âm',null,null,'tester')", [id, profile, measurements]);
  }
  await sql("insert into toa_do values ($1,'TT0001','Km1+000')", [weld]);
  await sql("select luu_kiem_tra_moi_han($1,2,$2,'2026-10-30','Đạt',$3,'Siêu âm','Đạt','2026-10-31','tester')", [late, profile, measurements]);
  await assert.rejects(() => publish(uuid(7), [late]), /Chờ siêu âm/, "Waiting-for-signature welds cannot enter a new RFI");
  await db.exec(`create function fail_document() returns trigger language plpgsql as $$ begin raise exception 'Injected failure'; end $$;
    create trigger fail_document before insert on ho_so_nghiem_thu for each row execute function fail_document();`);
  await assert.rejects(() => publish(), /Injected failure/);
  assert.equal(await value("select count(*)::int from phieu_yeu_cau_nghiem_thu"), 0, "Publishing must roll back if any document fails");
  await db.exec("drop trigger fail_document on ho_so_nghiem_thu; set role service_role");
  assert.equal(await publish(), rfi);
  assert.equal(await publish(), rfi);
  const draft = await value("select id from dot_nghiem_thu where phieu_id=$1", [rfi]);
  assert.equal(await value("select count(*)::int from ho_so_nghiem_thu where dot_id=$1", [draft]), 3);
  assert.equal(await value("select du_lieu_chot->'moi_han'->>'ly_trinh' from dot_nghiem_thu_moi where dot_id=$1", [draft]), "Km1+000");
  assert.equal(await status(), "Chờ siêu âm và nghiệm thu");
  await assert.rejects(() => sign(draft), /Cần hoàn thành/);
  await assert.rejects(() => complete(), /Dữ liệu đã thay đổi/);
  await sql("select luu_kiem_tra_moi_han($1,2,$2,'2026-10-30','Đạt',$3,'Siêu âm','Đạt','2026-10-31','tester')", [weld, profile, measurements]);
  assert.equal(await complete(), draft, "Finalize the existing draft without creating a fourth document");
  assert.equal(await complete(), draft, "Retry with the original request ID returns the same draft");
  assert.equal(await value("select count(*)::int from dot_nghiem_thu"), 1);
  assert.equal(await value("select count(*)::int from ho_so_nghiem_thu"), 3);
  assert.equal(await status(), "Chờ ký biên bản", "Acceptance alone does not mean a signed dossier");
  assert.equal(await value("select dem_moi_nghiem_thu_da_ky('2026-10-31',$1)", [project]), 0, "Daily reports exclude unsigned records");
  const deleted = (await sql("delete from ho_so_nghiem_thu where dot_id=$1 and loai='Phụ lục công việc' returning *", [draft]))[0];
  await assert.rejects(() => sign(draft), /Thiếu một/);
  await sql("insert into ho_so_nghiem_thu(id,dot_id,loai,du_lieu_chot) values ($1,$2,$3,$4)", [deleted.id, draft, deleted.loai, deleted.du_lieu_chot]);
  await sign(draft);
  assert.equal(await status(), "Đạt");
  assert.equal(await value("select dem_moi_nghiem_thu_da_ky('2026-10-31',$1)", [project]), 1);
  assert.equal(await value("select count(*)::int from ho_so_nghiem_thu where tinh_trang_ky='Đã ký'"), 3);
  await sign(draft, "Chờ ký");
  assert.equal(await status(), "Chờ ký biên bản");
  await db.exec("reset role");
  await migrate("migration_20261031_rfi_quy_trinh");
  assert.equal(await value("select count(*)::int from ho_so_nghiem_thu"), 3, "Migration is rerunnable");
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    await assert.rejects(() => sign(draft), /permission denied/);
    await db.exec("reset role");
  }
  console.log("PASS RFI lifecycle: status filtering, atomic publishing, three draft documents, coordinates, completion retry, no duplicate dossier, missing-document guard, joint signing, unsigned status and privileges");
} catch (error) {
  console.error(error.message, error.where ?? "");
  process.exitCode = 1;
} finally { await db.close(); }
