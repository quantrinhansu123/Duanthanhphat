import assert from "node:assert/strict";
import fs from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Cài PGlite ngoài repo, truyền đường dẫn dist/index.js. Kiểm tra hai migration bổ sung (danh sách email, bản sửa đổi hồ sơ).
if (!process.argv[2]) throw new Error("Usage: node scripts/test-weld-quality-extras-db.mjs <path-to-pglite/dist/index.js>");
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const read = (n) => fs.readFileSync(new URL(`../../supabase/${n}`, import.meta.url), "utf8");
const doc = "00000000-0000-0000-0000-000000000001";
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  create table public.ho_so_nghiem_thu(id uuid primary key); insert into public.ho_so_nghiem_thu values ('${doc}');`);
await db.exec(read("migration_20261028_ho_so_sua_doi.sql"));
await db.exec(read("migration_20261028_nguoi_dung_nghiem_thu.sql"));
await db.exec(read("migration_20261028_ho_so_sua_doi.sql")); // chạy lại không lỗi
await db.exec(read("migration_20261028_nguoi_dung_nghiem_thu.sql"));
const rev = (v, reason = "Sửa địa điểm", info = "{}") => db.query(
  "insert into public.ho_so_nghiem_thu_sua_doi(ho_so_id,phien_ban,thong_tin,ly_do,nguoi_sua) values ($1,$2,$3,$4,'qc')", [doc, v, info, reason]);
await rev(1); await rev(2);
await assert.rejects(() => rev(2), /unique/, "trùng phiên bản bị chặn");
await assert.rejects(() => rev(3, "  "), /check/, "thiếu lý do bị chặn");
await assert.rejects(() => rev(3, "x", "[]"), /check/, "thong_tin phải là object");
await assert.rejects(() => db.query("update public.ho_so_nghiem_thu_sua_doi set ly_do='x'"), /chỉ được thêm mới/);
await assert.rejects(() => db.query("delete from public.ho_so_nghiem_thu_sua_doi"), /chỉ được thêm mới/);
assert.equal((await db.query("select count(*)::int n from public.ho_so_nghiem_thu_sua_doi")).rows[0].n, 2);

assert.deepEqual((await db.query("select email from public.nguoi_dung_nghiem_thu")).rows.map((r) => r.email), ["admin@gmail.com"]);
await assert.rejects(() => db.query("insert into public.nguoi_dung_nghiem_thu(email) values ('Admin@Gmail.com')"), /check/, "email phải chữ thường");
for (const role of ["anon", "authenticated"]) {
  await db.exec(`set role ${role}`);
  await assert.rejects(() => db.query("select * from public.nguoi_dung_nghiem_thu"), /permission denied/);
  await assert.rejects(() => db.query("select * from public.ho_so_nghiem_thu_sua_doi"), /permission denied/);
  await db.exec("reset role");
}
await db.exec("set role service_role");
assert.equal((await db.query("select count(*)::int n from public.nguoi_dung_nghiem_thu")).rows[0].n, 1);
console.log("PASS: revision history is append-only with reasons/versions, allowlist and revisions are service_role only, migrations rerunnable");
