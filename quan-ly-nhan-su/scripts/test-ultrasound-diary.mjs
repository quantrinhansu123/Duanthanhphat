import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";

function load(name, imports = {}) {
  const exports = {};
  const source = readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, require: (key) => imports[key] ?? {} });
  return exports;
}

const uuid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const [project, otherProject, openTicket, closedTicket, otherTicket, geometryTicket, legacyTicket] = [1, 2, 3, 4, 5, 6, 7].map(uuid);
const [earlierDate, actualDate, closureDate] = ["2026-10-19", "2026-10-20", "2026-10-21"];
const welds = Array.from({ length: 54 }, (_, i) => ({
  id: uuid(i + 100), ma_lich_su: `W-${i + 1}`, ma_hien_truong: `TT${String(i + 1).padStart(4, "0")}`,
  so_luong_thuc_hien: 1, ly_trinh: `Km1+${String(i).padStart(3, "0")}`, du_an_id: i === 52 ? otherProject : project,
}));
const db = new PGlite();
const query = async (sql, params = []) => (await db.query(sql, params)).rows;
const save = (id, projectId, weldIds, date) => query("select ghi_ngay_sieu_am_thuc_te($1,$2,$3,$4) as saved", [id, projectId, weldIds, date]);

try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table phieu_nt_tach (id uuid primary key, du_an_id uuid, so_phieu text, loai text, ngay_moi date, ngay_nghiem_thu date);
    create table phieu_nt_tach_moi (phieu_id uuid references phieu_nt_tach(id), moi_han_id uuid, loai text, ket_qua text, primary key (phieu_id,moi_han_id));
    grant select, update on phieu_nt_tach_moi to service_role;
    grant select, update on phieu_nt_tach to service_role;`);
  const migration = readFileSync(new URL("../../supabase/migration_20261120_ngay_sieu_am_thuc_te.sql", import.meta.url), "utf8");
  await db.exec(migration);
  await db.exec(migration);

  for (const [id, projectId, kind, done] of [
    [openTicket, project, "sieu-am", null], [closedTicket, project, "sieu-am", closureDate],
    [otherTicket, otherProject, "sieu-am", null], [geometryTicket, project, "hinh-hoc", closureDate],
    [legacyTicket, project, "sieu-am", closureDate],
  ]) {
    await query("insert into phieu_nt_tach values ($1,$2,$3,$4,'2026-10-01',$5)", [id, projectId, `RFI-${id}`, kind, done]);
  }
  for (const [i, weld] of welds.entries()) {
    const [id, kind, result] = i === 53 ? [legacyTicket, "sieu-am", "Đạt"]
      : i === 52 ? [otherTicket, "sieu-am", null]
      : i === 51 ? [geometryTicket, "hinh-hoc", "Đạt"]
      : i >= 49 ? [closedTicket, "sieu-am", "Đạt"] : [openTicket, "sieu-am", null];
    await query("insert into phieu_nt_tach_moi (phieu_id,moi_han_id,loai,ket_qua) values ($1,$2,$3,$4)", [id, weld.id, kind, result]);
  }

  await db.exec("set role authenticated");
  await assert.rejects(() => save(openTicket, project, [welds[0].id], actualDate), /permission denied/);
  await db.exec("reset role; set role service_role");
  await assert.deepEqual(await save(openTicket, project, welds.slice(0, 49).map((w) => w.id), actualDate), [{ saved: 49 }]);
  await assert.deepEqual(await save(closedTicket, project, [welds[49].id], actualDate), [{ saved: 1 }]);
  await save(otherTicket, otherProject, [welds[52].id], actualDate);
  await assert.rejects(() => save(closedTicket, project, [welds[49].id, welds[0].id], earlierDate), /Danh sách mối không khớp/);
  await assert.rejects(() => save(geometryTicket, project, [welds[51].id], actualDate), /Danh sách mối không khớp/);
  await assert.rejects(() => save(otherTicket, project, [welds[52].id], actualDate), /Danh sách mối không khớp/);
  await assert.rejects(() => save(openTicket, project, [welds[0].id], "9999-01-01"), /Ngày siêu âm thực tế không hợp lệ/);

  const weldCode = load("weldCode");
  const diaryAuto = load("constructionDiaryAuto", { "./weldCode": weldCode, "./weldAcceptance": load("weldAcceptance", { "@/lib/weldCode": weldCode }) });
  const tables = {
    lich_su_moi_han: welds, kiem_tra_moi_han: [], dot_nghiem_thu_moi: [], phieu_yeu_cau_nghiem_thu: [],
    phieu_nt_tach: [], phieu_nt_tach_moi: [], gtus_thanh_rfi: [], bao_cao_ngay_cong_viec: [],
    du_an: [{ id: project }], lwr_track_layouts: [],
    toa_do: welds.map((w) => ({ lich_su_moi_han_id: w.id, ma_diem: w.ma_hien_truong, ly_trinh: w.ly_trinh })),
  };
  let legacySchema = false;
  const adminClient = { from(name) {
    assert.ok(name in tables, name);
    let rows = tables[name];
    let error = null;
    const response = (data) => ({ data: error ? null : data, error });
    const q = {
      select(columns) {
        if (legacySchema && name === "phieu_nt_tach_moi") {
          if (columns.includes("nhat_ky_theo_ngay_sieu_am")) error = { code: "42703", message: "column nhat_ky_theo_ngay_sieu_am does not exist" };
          rows = rows.map((row) => ({ ...row, phieu_nt_tach: {} }));
        }
        return q;
      },
      order: () => q,
      eq(key, value) {
        if (legacySchema && key === "ngay_sieu_am_thuc_te") error = { code: "42703", message: "column ngay_sieu_am_thuc_te does not exist" };
        rows = rows.filter((r) => r[key] === value);
        return q;
      },
      in(key, values) { rows = rows.filter((r) => values.includes(r[key])); return q; },
      neq(key, value) { rows = rows.filter((r) => r[key] !== value); return q; },
      not(key, op, value) { assert.equal(op, "is"); assert.equal(value, null); rows = rows.filter((r) => r[key] != null); return q; },
      range(from, to) { rows = rows.slice(from, to + 1); return q; },
      single: async () => response(rows[0]), maybeSingle: async () => response(rows[0] ?? null),
      then: (resolve) => Promise.resolve(response(rows)).then(resolve),
    };
    return q;
  } };
  const { loadDiaryDefaults } = load("server/weldAcceptanceServer", {
    "@/lib/supabase/admin": { createAdminClient: () => adminClient },
    "@/lib/server/weldQualityJournal": { qualityUuid: (v) => v, qualityDate: (v) => v },
    "@/lib/constructionDiaryAuto": diaryAuto,
    "@/lib/server/projectEquipment": { loadProjectEquipment: async () => [] },
    "@/lib/projectEquipment": { projectEquipmentText: () => "" },
    "@/lib/server/privateJsonStorage": { readPrivateJson: async () => null },
  });
  async function diary(date) {
    tables.phieu_nt_tach = await query("select *, ngay_moi::text as ngay_moi from phieu_nt_tach");
    const rows = await query(`select m.*, m.ngay_sieu_am_thuc_te::text,
      json_build_object('nhat_ky_theo_ngay_sieu_am', p.nhat_ky_theo_ngay_sieu_am) as phieu_nt_tach,
      p.du_an_id as "phieu_nt_tach.du_an_id", p.ngay_nghiem_thu::text as "phieu_nt_tach.ngay_nghiem_thu"
      from phieu_nt_tach_moi m join phieu_nt_tach p on m.phieu_id = p.id order by m.moi_han_id`);
    tables.phieu_nt_tach_moi = rows.map((row) => row.phieu_id === closedTicket ? { ...row, phieu_nt_tach: [row.phieu_nt_tach] } : row);
    return loadDiaryDefaults({ du_an_id: project, date });
  }
  const actual = await diary(actualDate);
  assert.match(actual.nghiemThuHangNgay, /Siêu âm mối hàn.*Khối lượng: 50 mối/);
  assert.match(actual.nghiemThuHangNgay, /TT0050/);
  assert.doesNotMatch(actual.nghiemThuHangNgay, /TT005[1-4]|Kết quả:/);
  assert.equal((await diary(earlierDate)).nghiemThuHangNgay, "");
  const closed = await diary(closureDate);
  assert.match(closed.nghiemThuHangNgayTheoNgayChot, /TT0050/);
  assert.doesNotMatch(closed.nghiemThuHangNgay, /TT005[01]/);
  assert.match(closed.nghiemThuHangNgay, /TT0052.*Kết quả: Đạt/);
  assert.match(closed.nghiemThuHangNgay, /TT0054.*Kết quả: Đạt/);
  await save(openTicket, project, [welds[0].id], earlierDate);
  assert.match((await diary(actualDate)).nghiemThuHangNgay, /Khối lượng: 49 mối/);
  assert.match((await diary(earlierDate)).nghiemThuHangNgay, /TT0001/);
  await save(openTicket, project, [welds[0].id], null);
  assert.equal((await diary(earlierDate)).nghiemThuHangNgay, "");
  await save(closedTicket, project, [welds[49].id], null);
  assert.doesNotMatch((await diary(closureDate)).nghiemThuHangNgay, /TT005[01]/);
  assert.deepEqual(await query("select ngay_nghiem_thu::text as date from phieu_nt_tach where id in ($1,$2) order by id", [openTicket, closedTicket]), [{ date: null }, { date: closureDate }]);
  assert.equal((await query("select ket_qua from phieu_nt_tach_moi where phieu_id=$1 and moi_han_id=$2", [closedTicket, welds[49].id]))[0].ket_qua, "Đạt");
  legacySchema = true;
  const beforeMigration = await diary(closureDate);
  assert.equal(beforeMigration.nghiemThuHangNgay, beforeMigration.nghiemThuHangNgayTheoNgayChot);
  assert.match(beforeMigration.nghiemThuHangNgay, /TT0050/);
  assert.match(beforeMigration.nghiemThuHangNgay, /TT0051/);
  console.log("PASS: 50 ultrasound welds by actual date, pre-migration compatibility, date corrections, permissions, rollback and unchanged acceptance");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.close();
}
