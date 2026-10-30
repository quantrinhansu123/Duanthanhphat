"use client";

import { useEffect, useState } from "react";
import { loadProjects } from "@/lib/projectsDb";
import { EMPTY_DIARY, loadDiary, saveDiary, type ConstructionDiary } from "@/lib/constructionDiaryDb";
import { qualityRequest } from "@/lib/weldQualityClient";

type DiaryDefaults = Pick<ConstructionDiary, "noiDungCongViec" | "nghiemThuHangNgay">;
const loadDefaults = (projectId: string, date: string) => qualityRequest<DiaryDefaults>({ action: "diary-defaults", du_an_id: projectId, date });

const inp = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/25";
const lbl = "flex flex-col text-xs font-semibold text-slate-600";
const today = () => new Date().toLocaleDateString("sv-SE");
const css = `@media screen { #diary-print { display: none; } }
@media print {
  body * { visibility: hidden !important; }
  #diary-print, #diary-print * { visibility: visible !important; }
  #diary-print { position: absolute; left: 0; top: 0; width: 100%; }
  #diary-print .pb { break-before: page; }
  @page { size: A4; margin: 15mm; }
}`;

const SECTIONS = [
  ["noiDungCongViec", "3. Nội dung công việc thực hiện", 8],
  ["nghiemThuHangNgay", "3.2. Nghiệm thu công việc xây dựng hàng ngày", 5],
  ["suCo", "4. Mô tả chi tiết các sự cố, hư hỏng, tai nạn lao động và các vấn đề phát sinh khác trong quá trình thi công xây dựng công trình", 4],
  ["kienNghi", "5. Các kiến nghị và những ý kiến chỉ đạo giải quyết các vấn đề phát sinh của các bên có liên quan (Chủ đầu tư, Người giám sát thi công, Người giám sát tác giả, ghi rõ họ và tên, chức vụ và chữ ký)", 4],
  ["nhanXetGiamSat", "6. Nhận xét của kỹ sư giám sát thi công xây dựng về tình hình và chất lượng công việc xây dựng (ghi rõ họ và tên, chức vụ và chữ ký)", 3],
  ["chtTiepThu", "7. Chỉ huy trưởng công trường tiếp thu các kiến nghị và nhận xét (họ tên, chữ ký)", 3],
] as const satisfies readonly (readonly [keyof ConstructionDiary, string, number])[];

export default function ConstructionDiaryForm() {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState(today());
  const [d, setD] = useState<ConstructionDiary>(EMPTY_DIARY);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects({ includeProgress: false }).then((r) => {
      setProjects(r.projects.map((p) => ({ id: p.id, name: p.name })));
      setProjectId((cur) => cur || r.projects[0]?.id || "");
    }).catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (!projectId || !date) return;
    let live = true;
    setLoading(true);
    setStatus("Đang tải…");
    loadDiary(projectId, date).then(async (r) => {
      let diary = r.diary;
      let warning = "";
      if (!r.saved) {
        try { diary = { ...diary, ...await loadDefaults(projectId, date) }; }
        catch { warning = "Chưa tải được dữ liệu tự điền. Có thể nhập tay hoặc bấm Tự điền lại."; }
      }
      if (!live) return;
      setD(diary);
      setStatus([r.source === "local" ? `Đang dùng bản lưu trên máy này${r.error ? ` (${r.error})` : ""}.` : "", warning].filter(Boolean).join(" "));
      setLoading(false);
    }).catch(() => {
      if (live) setStatus("Không tải được nhật ký. Vui lòng chọn lại ngày để thử lại.");
    });
    return () => { live = false; };
  }, [projectId, date]);

  const set = (k: keyof ConstructionDiary) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD((cur) => ({ ...cur, [k]: e.target.value }));
  const projectName = projects.find((p) => p.id === projectId)?.name ?? "";
  const [y, m, day] = date.split("-");

  async function autofill() {
    setBusy(true);
    try {
      const defaults = await loadDefaults(projectId, date);
      setD((cur) => ({ ...cur, ...defaults }));
      setStatus("Đã tự điền mục 3 và 3.2. Có thể sửa nội dung rồi bấm Lưu.");
    } catch { setStatus("Không tải được dữ liệu tự điền. Nội dung hiện tại được giữ nguyên."); }
    finally { setBusy(false); }
  }

  async function save() {
    setBusy(true);
    try {
      const r = await saveDiary(projectId, date, d);
      setStatus(r.source === "supabase" ? "Đã lưu." : `Đã lưu trên máy này — chưa lên Supabase${r.error ? `: ${r.error}` : ""}.`);
    } catch { setStatus("Không lưu được nhật ký. Nội dung đang nhập được giữ nguyên; vui lòng thử lại."); }
    finally { setBusy(false); }
  }

  return (
    <div className="px-4 sm:px-6 pb-8">
      <style>{css}</style>
      <div className="no-print divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-800 shadow-sm">
        <div className="flex flex-wrap items-end gap-3 pb-5">
          <label className={`${lbl} min-w-[16rem] flex-1`}>Dự án
            <select disabled={busy} className={inp} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className={lbl}>Ngày
            <input disabled={busy} className={inp} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={busy || loading || !projectId} onClick={autofill} title="Thay nội dung mục 3 và 3.2 bằng dữ liệu hàn, mài và RFI" className="h-10 rounded-lg border border-slate-300 px-4 font-semibold disabled:opacity-50">Tự điền lại mục 3 / 3.2</button>
            <button type="button" disabled={busy || loading || !projectId} onClick={save} className="h-10 min-w-20 cursor-pointer rounded-lg bg-[#0047AB] px-5 font-semibold text-white transition-colors hover:bg-[#00388A] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Đang lưu…" : "Lưu"}</button>
            <button type="button" disabled={busy || loading || !projectId} onClick={() => window.print()} className="h-10 cursor-pointer rounded-lg border border-slate-300 bg-white px-4 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">In / Lưu PDF</button>
          </div>
          {status && <p role="status" className={`basis-full text-xs ${status.startsWith("Đã lưu.") ? "text-emerald-700" : "text-slate-600"}`}>{status}</p>}
        </div>

        <fieldset disabled={loading || busy} className="grid gap-x-8 gap-y-5 py-5 lg:grid-cols-2">
          <Card title="1. Thời tiết">
            <div role="radiogroup" aria-label="Thời tiết" className="flex flex-wrap gap-2">
              {(["Bình thường", "Mưa", "Nắng"] as const).map((w) => (
                <label key={w} className={`cursor-pointer rounded-full border px-4 py-1.5 font-medium transition-colors focus-within:ring-2 focus-within:ring-[#0047AB]/40 ${d.thoiTiet === w ? "border-[#0047AB] bg-[#0047AB] text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
                  <input className="sr-only" type="radio" name="thoi-tiet" checked={d.thoiTiet === w} onChange={() => setD((c) => ({ ...c, thoiTiet: w }))} />{w}
                </label>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <label className={lbl}>Nhiệt độ (°C)<input className={inp} inputMode="decimal" value={d.nhietDo} onChange={set("nhietDo")} /></label>
              {(["sang", "chieu", "toi"] as const).map((k) => (
                <label key={k} className={lbl}>{{ sang: "Sáng", chieu: "Chiều", toi: "Tối" }[k]}<input className={inp} value={d[k]} onChange={set(k)} /></label>
              ))}
            </div>
          </Card>

          <Card title="2. Nhân lực, thiết bị thi công">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className={lbl}>Ban chỉ huy (người)<input className={inp} inputMode="numeric" value={d.banChiHuy} onChange={set("banChiHuy")} /></label>
              <label className={lbl}>Cán bộ kỹ thuật (người)<input className={inp} inputMode="numeric" value={d.canBoKyThuat} onChange={set("canBoKyThuat")} /></label>
              <label className={lbl}>Công nhân (người)<input className={inp} inputMode="numeric" value={d.congNhan} onChange={set("congNhan")} /></label>
            </div>
            <label className={lbl}>2.2 Thiết bị<textarea className={inp} rows={3} value={d.thietBi} onChange={set("thietBi")} /></label>
          </Card>
        </fieldset>

        <fieldset disabled={loading || busy} className="grid gap-x-8 gap-y-5 py-5 lg:grid-cols-2">
          {SECTIONS.map(([k, label, rows]) => {
            const [title, hint] = label.split(/ \((?=[^()]*\)$)/);
            return (
              <Card key={k} title={title} hint={hint?.replace(/\)$/, "")} wide>
                <textarea aria-label={title} className={inp} rows={Math.max(rows, 4)} value={d[k]} onChange={set(k)} />
              </Card>
            );
          })}
        </fieldset>
      </div>

      <article id="diary-print" className="text-[13px] leading-6 text-black" style={{ fontFamily: "'Times New Roman', serif" }}>
        <h2 className="text-center text-base font-bold">B. TÌNH HÌNH THI CÔNG HÀNG NGÀY</h2>
        <p className="text-center">Dự án: {projectName}</p>
        <p className="text-center">Ngày {day} tháng {m} năm {y}</p>
        <p className="mt-2 font-bold">1. Thời tiết</p>
        <p>{(["Bình thường", "Mưa", "Nắng"] as const).map((w) => `${d.thoiTiet === w ? "☑" : "☐"} ${w}`).join("     ")}     Nhiệt độ: {d.nhietDo || "……"}°C</p>
        <p>Sáng: {d.sang || "……………"}     Chiều: {d.chieu || "……………"}     Tối: {d.toi || "……………"}</p>
        <p className="mt-2 font-bold">2. Tình hình nhân lực, thiết bị thi công:</p>
        <p>2.1 Nhân lực: Ban chỉ huy: {d.banChiHuy || "……"} (người); Cán bộ kỹ thuật: {d.canBoKyThuat || "……"} (người); Công nhân: {d.congNhan || "……"} (người)</p>
        <p>2.2 Thiết bị:</p>
        <Block text={d.thietBi} min={4} />
        {SECTIONS.map(([k, label, rows]) => (
          <div key={k} className={k === "nghiemThuHangNgay" ? "pb" : ""}>
            <p className="mt-2 font-bold">{label}{k === "noiDungCongViec" ? " (3.1)" : ""}:</p>
            <Block text={d[k]} min={rows} />
          </div>
        ))}
        <div className="mt-6 grid grid-cols-3 text-center font-bold">
          <div>TƯ VẤN GIÁM SÁT<div className="font-normal">(Ký, ghi rõ họ tên)</div></div>
          <div>NHÀ THẦU CHÍNH<div className="font-normal">(Ký, ghi rõ họ tên)</div></div>
          <div>NHÀ THẦU PHỤ<div className="font-normal">(Ký, ghi rõ họ tên)</div></div>
        </div>
      </article>
    </div>
  );
}

/** Văn bản đã nhập, hoặc các dòng chấm để điền tay khi để trống. */
function Block({ text, min }: { text: string; min: number }) {
  if (text.trim()) return <p className="whitespace-pre-wrap">{text}</p>;
  return <>{Array.from({ length: min }, (_, i) => <p key={i} className="overflow-hidden">{"…".repeat(120)}</p>)}</>;
}

function Card({ title, hint, wide, children }: { title: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <section className={`space-y-3 ${wide ? "lg:col-span-2" : ""}`}>
      <div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
