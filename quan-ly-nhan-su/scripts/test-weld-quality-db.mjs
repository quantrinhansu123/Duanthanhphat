import assert from "node:assert/strict";
import fs from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import ts from "typescript";

// Cài PGlite ngoài repo, truyền đường dẫn dist/index.js; không kết nối DB thật hoặc thêm dependency ứng dụng.
if (!process.argv[2]) throw new Error("Usage: node scripts/test-weld-quality-db.mjs <path-to-pglite/dist/index.js>");
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const migration = fs.readFileSync(new URL("../../supabase/migration_20261028_nghiem_thu_moi_han.sql", import.meta.url), "utf8");
const journalMigration = fs.readFileSync(new URL("../../supabase/migration_20261028_nhat_ky_kiem_tra_chat_luong.sql", import.meta.url), "utf8");
const flowMigration = fs.readFileSync(new URL("../../supabase/migration_20261029_chat_luong_trinh_tu_moi.sql", import.meta.url), "utf8");
const uuid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const project = uuid(1);
const oldWeld = uuid(100);
const a = uuid(101), b = uuid(102), c = uuid(103), d = uuid(104);
const profile = uuid(200), otherProfile = uuid(201);
const rfi = uuid(300), batch = uuid(400);
const bounds = (min, max) => ({ min, max, minInclusive: true, maxInclusive: true });
const limits = { doc_mat_lan: bounds(-0.1, 0.4), ngang_nam_ray: bounds(-0.4, 0.4), ngang_chan_ray: bounds(-2, 2), phang_mat_lan: bounds(0, 0.2) };
const measurements = { doc_mat_lan: 0, ngang_nam_ray: 0, ngang_chan_ray: 0, phang_mat_lan: 0 };
const rules = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("../src/lib/weldQuality.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: rules });
const query = async (sql, params = []) => (await db.query(sql, params)).rows;
const scalar = async (sql, params = []) => Object.values((await query(sql, params))[0])[0];
const expectError = async (sql, params, message) => assert.rejects(() => query(sql, params), message);
const getStatus = async (id) => scalar("select tinh_trang from chat_luong_moi_han where moi_han_id=$1", [id]);
const save = (id, version, ndt = null, values = measurements, criterion = profile) => query(
  "select * from luu_kiem_tra_moi_han($1,$2,$3,'2026-10-28','Đạt',$4,'Siêu âm',$5,$6,'Fixture',null)",
  [id, version, criterion, values, ndt, ndt ? "2026-10-28" : null],
);
const publish = (id, ids = [a, b, c]) => scalar("select phat_hanh_rfi_moi_han($1,$2,$3,'2026-10-28',$4,'Fixture','{}')", [id, project, `RFI-${id}`, ids]);
const results = [
  { moi_han_id: a, phien_ban: 3, ket_qua: "Đạt" },
  { moi_han_id: b, phien_ban: 3, ket_qua: "Không đạt", ly_do: "Loại khi nghiệm thu" },
  { moi_han_id: c, phien_ban: 2, ket_qua: "Chưa nghiệm thu", ly_do: "Để đợt sau" },
];
const complete = (id = batch, items = results) => scalar("select hoan_thanh_nghiem_thu_moi_han($1,$2,'2026-10-28','Fixture',$3,'{}')", [id, rfi, items]);

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon,authenticated,service_role;
    create table public.du_an(id uuid primary key);
    create table public.lich_su_moi_han(id uuid primary key,ma_lich_su text,du_an_id uuid references du_an(id),
      cong_nghe_han text,loai_moi_han text,ngay_thuc_hien date,tinh_trang_thi_nghiem text,so_luong_loi integer default 0,
      so_luong_thuc_hien integer not null default 1);
    grant select,insert,update,delete on public.lich_su_moi_han to anon,authenticated,service_role;
    grant select on public.du_an to anon,authenticated,service_role;
    create view public.bao_cao_moi_han_theo_du_an with (security_invoker=true) as select * from public.lich_su_moi_han;
    grant select on public.bao_cao_moi_han_theo_du_an to service_role;
  `);
  await query("insert into du_an values ($1),($2)", [project, uuid(2)]);
  await query("insert into lich_su_moi_han values ($1,'OLD',$2,'FBW','Sản xuất','2026-10-01','Đạt',0)", [oldWeld, project]);
  await query("update lich_su_moi_han set so_luong_thuc_hien=100 where id=$1", [oldWeld]);
  await db.exec(migration);
  await db.exec(migration);
  await db.exec(journalMigration);
  await db.exec(journalMigration);
  await db.exec(flowMigration);
  assert.equal(await scalar("select count(*)::integer from kiem_tra_moi_han"), 0, "No backfill of historic passes");
  assert.equal(await getStatus(oldWeld), "Hàn");
  assert.equal(await scalar("select tinh_trang_thi_nghiem from lich_su_moi_han where id=$1", [oldWeld]), "Đạt");
  assert.equal(await scalar("select count(*)::integer from tieu_chuan_nghiem_thu_moi_han"), 0, "No unapproved PQ seed");
  await query("insert into lich_su_moi_han values ($1,'TRIAL',$2,'FBW','Chấp thuận','2026-10-28','Đạt',0)", [uuid(105), project]);
  assert.equal(await getStatus(uuid(105)), "Chờ mài", "Chấp thuận cùng trình tự mọi loại mối hàn");
  await query("delete from lich_su_moi_han where id=$1", [uuid(105)]);

  // Lối insert cũ chỉ có quyền anon vẫn khởi tạo chất lượng và báo lỗi nếu trigger thất bại.
  await db.exec("set role anon");
  for (const id of [a, b, c, d]) {
    await query("insert into lich_su_moi_han values ($1::uuid,$1::text,$2,'FBW','Sản xuất','2026-10-28','Đạt',0)", [id, project]);
  }
  await expectError("select * from kiem_tra_moi_han", [], /permission denied/);
  await expectError("select * from nhat_ky_han_chat_luong", [], /permission denied/);
  await expectError("select phat_hanh_rfi_moi_han($1,$2,'X',current_date,$3,'X','{}')", [rfi, project, [a]], /permission denied/);
  await expectError("select hoan_thanh_nghiem_thu_moi_han($1,$2,current_date,'X','[]','{}')", [batch, rfi], /permission denied/);
  await query("delete from lich_su_moi_han where id=$1", [d]);
  await db.exec("reset role");
  assert.equal(await scalar("select count(*)::integer from kiem_tra_moi_han"), 3, "Blank initial rows remain deletable via existing UI");
  assert.equal(await getStatus(a), "Chờ mài");
  assert.equal(await scalar("select phuong_phap_ndt from kiem_tra_moi_han where moi_han_id=$1", [a]), "Siêu âm");

  await db.exec("set role service_role");
  await query(`insert into tieu_chuan_nghiem_thu_moi_han
    (id,du_an_id,cong_nghe_han,loai_moi_han,phien_ban,ten,dung_sai,yeu_cau_ndt,ndt_truoc_rfi,nguoi_xac_nhan,dang_ap_dung)
    values ($1,$2,'FBW','Sản xuất',1,'Fixture',$3,true,false,'Fixture',true)`, [profile, project, limits]);
  await query(`insert into tieu_chuan_nghiem_thu_moi_han
    (id,du_an_id,cong_nghe_han,loai_moi_han,phien_ban,ten,dung_sai,yeu_cau_ndt,ndt_truoc_rfi,nguoi_xac_nhan,dang_ap_dung)
    values ($1,$2,'ATW','Sản xuất',1,'Other',$3,true,false,'Fixture',true)`, [otherProfile, project, limits]);
  await assert.rejects(() => save(a, 1, null, measurements, otherProfile), /Tiêu chí không thuộc/);
  await assert.rejects(() => save(oldWeld, 0, "Đạt"), /bản ghi khối lượng tổng hợp/);
  await assert.rejects(() => publish(rfi), /chưa đủ điều kiện RFI/);
  await expectError("update tieu_chuan_nghiem_thu_moi_han set yeu_cau_ndt=false where id=$1", [profile], /check constraint/);

  for (const id of [a, b, c]) await save(id, 1);
  assert.equal(await scalar("select tinh_trang_thi_nghiem from lich_su_moi_han where id=$1", [a]), "Chờ thí nghiệm", "Explicit quality inspection applies the confirmed NDT rule");
  assert.equal(await getStatus(a), "Chờ siêu âm và nghiệm thu");
  const baseInspection = { ngay_mai: "2026-10-28", truc_quan: "Đạt", gia_tri_do: measurements, phuong_phap_ndt: "Siêu âm", ket_qua_ndt: null, ngay_ndt: null };
  const baseRule = { dung_sai: limits, yeu_cau_ndt: true, ndt_truoc_rfi: false, can_cu_mien_ndt: null };
  for (const policy of [
    baseRule,
    { ...baseRule, ndt_truoc_rfi: true },
    { ...baseRule, yeu_cau_ndt: false, can_cu_mien_ndt: "Fixture exemption" },
  ]) {
    // Fixture độc lập để không sửa tiêu chí đã được gắn với các mối a/b/c.
    await query("insert into lich_su_moi_han values ($1,'POLICY',$2,'ATW','Đào tạo','2026-10-28','Không thí nghiệm',0)", [d, project]);
    await query(`insert into tieu_chuan_nghiem_thu_moi_han
      (id,du_an_id,cong_nghe_han,loai_moi_han,phien_ban,ten,dung_sai,yeu_cau_ndt,ndt_truoc_rfi,can_cu_mien_ndt,nguoi_xac_nhan,dang_ap_dung)
      values ($1,$2,'ATW','Đào tạo',1,'Policy',$3,$4,$5,$6,'Fixture',true)`,
    [uuid(202), project, limits, policy.yeu_cau_ndt, policy.ndt_truoc_rfi, policy.can_cu_mien_ndt]);
    await save(d, 1, null, measurements, uuid(202));
    const sql = (await query("select * from chat_luong_moi_han where moi_han_id=$1", [d]))[0];
    const js = rules.evaluateWeldQuality(baseInspection, policy, "Đào tạo");
    assert.equal(sql.tinh_trang, js.status);
    assert.equal(sql.du_dieu_kien_rfi, js.rfiEligible);
    assert.equal(sql.du_dieu_kien_nghiem_thu, js.acceptanceEligible);
    await query("delete from kiem_tra_moi_han where moi_han_id=$1", [d]);
    await query("delete from lich_su_moi_han where id=$1", [d]);
    await query("delete from tieu_chuan_nghiem_thu_moi_han where id=$1", [uuid(202)]);
  }
  await assert.rejects(() => save(a, 1), /Dữ liệu đã thay đổi/);
  await expectError("update tieu_chuan_nghiem_thu_moi_han set ten='Changed' where id=$1", [profile], /phiên bản mới/);
  await expectError("update kiem_tra_moi_han set gia_tri_do='{" + '"doc_mat_lan":"NaN"' + "}' where moi_han_id=$1", [a], /check constraint/);
  await expectError("update kiem_tra_moi_han set gia_tri_do='{" + '"wrong":0' + "}' where moi_han_id=$1", [a], /check constraint/);
  await expectError("update kiem_tra_moi_han set ket_qua_ndt='Đạt' where moi_han_id=$1", [a], /check constraint/);
  await expectError("update lich_su_moi_han set cong_nghe_han='ATW' where id=$1", [a], /cần xử lý hồ sơ/);
  await expectError("update lich_su_moi_han set so_luong_thuc_hien=2 where id=$1", [a], /cần xử lý hồ sơ/);
  await expectError("delete from lich_su_moi_han where id=$1", [a], /không được xoá/);

  for (const key of rules.GEOMETRY_CRITERIA) {
    for (const value of [limits[key].min - 0.001, limits[key].min, 0, limits[key].max, limits[key].max + 0.001]) {
      const measured = { ...measurements, [key]: value };
      assert.equal(await scalar("select qlcl_xet_hinh_hoc($1,$2)", [measured, limits]), rules.evaluateGeometry(measured, limits));
    }
  }
  for (const measured of [{}, { doc_mat_lan: -0.11 }, { doc_mat_lan: null }]) {
    assert.equal(await scalar("select qlcl_xet_hinh_hoc($1,$2)", [measured, limits]), rules.evaluateGeometry(measured, limits));
  }
  const open = structuredClone(limits); open.doc_mat_lan.maxInclusive = false;
  assert.equal(await scalar("select qlcl_xet_hinh_hoc($1,$2)", [{ ...measurements, doc_mat_lan: 0.4 }, open]), "Không đạt");
  assert.equal(await scalar("select qlcl_dung_sai_hop_le($1)", [{ ...limits, doc_mat_lan: bounds(1, 0) }]), false);
  assert.equal(await publish(rfi), rfi);
  assert.equal(await publish(rfi), rfi, "Retry returns existing RFI");
  await assert.rejects(() => publish(uuid(301)), /unique constraint/, "A weld cannot enter overlapping active RFIs");
  await assert.rejects(() => complete(), /Dữ liệu đã thay đổi|chưa đủ điều kiện/);
  await save(a, 2, "Đạt");
  assert.equal(await scalar("select tinh_trang_thi_nghiem from lich_su_moi_han where id=$1", [a]), "Đạt");
  await expectError("update lich_su_moi_han set tinh_trang_thi_nghiem='Không đạt',so_luong_loi=1 where id=$1", [a], /hãy cập nhật tại đó/);
  await save(b, 2, "Đạt");
  assert.equal(await getStatus(a), "Chờ ký biên bản");
  assert.equal(await getStatus(b), "Chờ ký biên bản");
  await assert.rejects(() => complete(batch, results.map((r) => ({ ...r, ket_qua: "Đạt" }))), /chưa đủ điều kiện/);

  // Lỗi ở cuối RPC phải hoàn tác đợt, trạng thái và toàn bộ hồ sơ.
  await db.exec(`reset role;
    create function public.fail_quality_document() returns trigger language plpgsql as $$ begin raise exception 'Injected document failure'; end $$;
    create trigger test_document_failure before insert on ho_so_nghiem_thu for each row execute function fail_quality_document();
    set role service_role;`);
  await assert.rejects(() => complete(), /Injected document failure/);
  assert.equal(await scalar("select count(*)::integer from dot_nghiem_thu"), 0);
  assert.equal(await scalar("select count(*)::integer from ho_so_nghiem_thu"), 0);
  assert.equal(await scalar("select count(*)::integer from phieu_yeu_cau_nghiem_thu_moi where con_hieu_luc"), 3);
  assert.equal(await getStatus(a), "Chờ ký biên bản");
  await db.exec("reset role; drop trigger test_document_failure on ho_so_nghiem_thu; set role service_role");
  assert.equal(await complete(), batch);
  assert.equal(await complete(), batch, "Retry does not complete twice");
  assert.equal(await scalar("select count(*)::integer from ho_so_nghiem_thu"), 3);
  assert.equal(await scalar("select count(*)::integer from dot_nghiem_thu_moi where ket_qua='Đạt'"), 1);
  assert.equal(await getStatus(a), "Đạt");
  assert.equal(await getStatus(b), "Không đạt", "Field rejection remains a failure even when NDT passed");
  assert.equal(await getStatus(c), "Chờ siêu âm và nghiệm thu");
  await assert.rejects(() => save(a, 3, "Đạt"), /Mối đã nghiệm thu/);
  const before = await scalar("select du_lieu_chot from ho_so_nghiem_thu order by loai limit 1");
  await query("update lich_su_moi_han set ma_lich_su='NEW-CODE' where id=$1", [a]);
  assert.deepEqual(await scalar("select du_lieu_chot from ho_so_nghiem_thu order by loai limit 1"), before);
  await assert.rejects(() => complete(uuid(401), results), /đủ các mối còn lại/);
  await save(c, 2, "Đạt");
  await complete(uuid(402), [{ moi_han_id: c, phien_ban: 3, ket_qua: "Đạt" }]);
  assert.equal(await scalar("select trang_thai from phieu_yeu_cau_nghiem_thu where id=$1", [rfi]), "Đã hoàn thành");
  await assert.rejects(() => publish(uuid(302), [a]), /chưa đủ điều kiện/);
  await assert.rejects(() => publish(uuid(303), [b]), /chưa đủ điều kiện/);
  await save(b, 4, "Đạt");
  assert.equal(await getStatus(b), "Chờ ký biên bản", "Explicit reinspection clears field rejection, history remains");
  await publish(uuid(303), [b]);

  // Khi đã có hồ sơ, chạy lại migration vẫn bảo toàn dữ liệu.
  await db.exec("reset role");
  await db.exec(migration);
  await db.exec(journalMigration);
  assert.equal(await scalar("select count(*)::integer from ho_so_nghiem_thu"), 6);
  assert.equal(await scalar("select count(*)::integer from moi_han_can_bo_sung_chat_luong where id=$1", [oldWeld]), 1);
  console.log("PASS: repeatable migration, legacy preservation, insert/delete compatibility, privileges, SQL/TS parity, optimistic versions, RFI exclusivity, partial acceptance, retry, rollback, frozen snapshots");
} catch (error) {
  console.error(error.message, error.query ?? "", error.where ?? "");
  process.exitCode = 1;
} finally {
  await db.close();
}
