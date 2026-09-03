import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(scriptDirectory, "..");

function loadEnv(filePath) {
  const values = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/);
    if (!match) continue;
    values[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

const env = loadEnv(path.join(appDirectory, ".env"));
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function fetchAllWeldRows() {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("lich_su_moi_han")
      .select("du_an_id,ngay_thuc_hien,so_luong_thuc_hien")
      .not("ngay_thuc_hien", "is", null)
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

const weldRows = await fetchAllWeldRows();
const actualByProjectAndDate = new Map();

for (const row of weldRows) {
  const key = `${row.du_an_id}|${row.ngay_thuc_hien}`;
  actualByProjectAndDate.set(
    key,
    (actualByProjectAndDate.get(key) ?? 0) + Number(row.so_luong_thuc_hien),
  );
}

const { data: projects, error: projectsError } = await supabase
  .from("du_an")
  .select("id,ma_du_an,du_an");
if (projectsError) throw projectsError;

const expectedByProject = new Map();
for (const project of projects) {
  const prefix = `${project.id}|`;
  const plan = [...actualByProjectAndDate.entries()]
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, actual]) => ({
      ngay: key.slice(prefix.length),
      so_moi_han: actual + 5,
    }))
    .sort((a, b) => a.ngay.localeCompare(b.ngay));

  expectedByProject.set(project.id, plan);
  const totalTarget = plan.reduce((sum, row) => sum + row.so_moi_han, 0);

  if (plan.length === 0) {
    const { error } = await supabase
      .from("du_an")
      .update({ tong_moi_han_du_kien: 0, tien_do_ly_thuyet: [] })
      .eq("id", project.id);
    if (error) throw error;
    continue;
  }

  // Cập nhật tổng và khoảng ngày trước; trigger hiện có có thể tạo kế hoạch tạm.
  const { error: rangeError } = await supabase
    .from("du_an")
    .update({
      ngay_bat_dau: plan[0].ngay,
      ngay_ket_thuc: plan.at(-1).ngay,
      tong_moi_han_du_kien: totalTarget,
    })
    .eq("id", project.id);
  if (rangeError) throw rangeError;

  // Ghi đè bằng định mức chính xác: thực tế từng dự án/ngày + 5.
  const { error: planError } = await supabase
    .from("du_an")
    .update({ tien_do_ly_thuyet: plan })
    .eq("id", project.id);
  if (planError) throw planError;
}

const { data: verifiedProjects, error: verifyError } = await supabase
  .from("du_an")
  .select("id,ma_du_an,du_an,tong_moi_han_du_kien,tien_do_ly_thuyet")
  .order("ma_du_an");
if (verifyError) throw verifyError;

const summary = verifiedProjects.map((project) => {
  const expected = expectedByProject.get(project.id) ?? [];
  const actualPlan = Array.isArray(project.tien_do_ly_thuyet) ? project.tien_do_ly_thuyet : [];
  if (JSON.stringify(actualPlan) !== JSON.stringify(expected)) {
    throw new Error(`Định mức dự án ${project.ma_du_an ?? project.id} chưa khớp`);
  }

  const totalTarget = actualPlan.reduce((sum, row) => sum + Number(row.so_moi_han), 0);
  if (Number(project.tong_moi_han_du_kien) !== totalTarget) {
    throw new Error(`Tổng định mức dự án ${project.ma_du_an ?? project.id} chưa khớp`);
  }

  return {
    project: project.ma_du_an,
    days: actualPlan.length,
    totalTarget,
  };
});

console.log(JSON.stringify({
  sourceRows: weldRows.length,
  projectDays: summary.reduce((sum, row) => sum + row.days, 0),
  totalTarget: summary.reduce((sum, row) => sum + row.totalTarget, 0),
  projects: summary,
}, null, 2));
