// Tạo tài khoản theo "Danh sách nhân sư". Chạy: node --env-file=.env scripts/seed-accounts-nhan-su.mjs
// Đăng nhập bằng SĐT + mật khẩu; email nội bộ = <sđt>@thanhphat.vn. Mật khẩu in ra 1 lần, không lưu ở đâu.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

// Thứ tự = ưu tiên vai trò khi một người xuất hiện ở nhiều cột (cao nhất thắng).
const people = [
  ["Nguyễn Minh Phúc", "0904426889", "Quản trị"],
  ["Nguyễn Huy Thanh", "0906419889", "Quản trị"],
  ["Trần Công Tiên", "0392828637", "Quản trị"],
  ["Lê Ngọc Hà", "0983229264", "Quản trị"],
  ["Đỗ Lê Khang", "0913592495", "Lãnh đạo"],
  ["Hồ Thái Dương", "0983533677", "Lãnh đạo"],
  ["Hoàng Ngọc Quảng", "0983510765", "Lãnh đạo"],
  ["Trần Công Tiên", "0392828637", "Chỉ huy trưởng dự án"],
  ["Nguyễn Văn Trinh", "0902210735", "Chỉ huy trưởng dự án"],
  ["Vũ Văn Khanh", "0972128783", "Thợ hàn / thợ vận hành"],
  ["Trịnh Thông Phúc", "0327140095", "Thợ hàn / thợ vận hành"],
  ["Cao Mạnh Huy", "0971087169", "Thợ hàn / thợ vận hành"],
  ["Nguyễn Công Đức", "0932216821", "Thợ hàn / thợ vận hành"],
  ["Hoàng Đăng Tịnh", "0948780236", "Thợ hàn / thợ vận hành"],
  ["Nguyễn Văn Tuấn", "0971899007", "Thợ hàn / thợ vận hành"],
  ["Đỗ Lê Khoa", "0945377979", "Quản lý máy"],
  ["Vũ Minh Tiên", "0989933586", "Quản lý máy"],
  ["Nguyễn Văn Tuấn", "0971899007", "Quản lý máy"],
  ["Đỗ Hoàng Linh", "0915942838", "Bộ phận khác"],
  ["Trần Ngọc Anh", "0983016827", "Bộ phận khác"],
  ["Hoàng Quốc Hoàn", "0966743423", "Bộ phận khác"],
  ["Nguyễn Đức An", "0983238455", "Bộ phận khác"],
];
const rank = ["Quản trị", "Lãnh đạo", "Chỉ huy trưởng dự án", "Kỹ sư hiện trường", "Quản lý máy", "Thợ hàn / thợ vận hành", "Bộ phận khác"];
const byPhone = new Map();
for (const [fullName, phone, role] of people) {
  const cur = byPhone.get(phone);
  if (!cur || rank.indexOf(role) < rank.indexOf(cur.role)) byPhone.set(phone, { fullName, phone, role });
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BUCKET = "system-configuration", FILE = "system-configuration.json";

const { data: blob } = await db.storage.from(BUCKET).download(FILE);
const config = blob ? JSON.parse(await blob.text()) : null;
if (!config) throw new Error("Chưa có system-configuration.json — mở /cau-hinh lưu một lần trước.");

const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
const today = new Date().toISOString().slice(0, 10);
const out = [];
for (const p of byPhone.values()) {
  const email = `${p.phone}@thanhphat.vn`;
  const password = randomBytes(6).toString("base64url"); // 8 ký tự
  const user = list.users.find((u) => u.email === email);
  const r = user ? { error: null } : await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (r.error) { console.error("LỖI", p.fullName, r.error.message); continue; }
  const acc = config.accounts.find((a) => a.phone === p.phone || a.email === email);
  const next = { id: acc?.id ?? `nhan-su-${p.phone}`, fullName: p.fullName, email, phone: p.phone, birthDate: acc?.birthDate ?? "", role: p.role, status: "Hoạt động", createdAt: acc?.createdAt ?? today, note: acc?.note ?? "" };
  if (acc) Object.assign(acc, next); else config.accounts.push(next);
  out.push({ ...p, email, password: user ? "(đã có, giữ nguyên)" : password });
}
config.updatedAt = new Date().toISOString();
const up = await db.storage.from(BUCKET).upload(FILE, new TextEncoder().encode(JSON.stringify(config)), { contentType: "application/json", cacheControl: "0", upsert: true });
if (up.error) throw up.error;
const sync = await db.from("tai_khoan_phan_quyen").upsert(out.map((o) => ({ email: o.email, role: o.role, status: "Hoạt động" })), { onConflict: "email" });
if (sync.error) console.warn("Chưa đồng bộ DB (mở /cau-hinh bấm Lưu để đồng bộ):", sync.error.message);
console.table(out.map(({ fullName, phone, role, password }) => ({ fullName, phone, role, password })));
