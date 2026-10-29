"use client";

import { useEffect, useState } from "react";
import { loadProjects } from "@/lib/projectsDb";
import { compressImage, emptyPhotoReport, loadPhotoReport, newPhotoItem, savePhotoReport, type PhotoReport } from "@/lib/photoReportDb";

const inp = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/25";
const lbl = "flex flex-col text-xs font-semibold text-slate-600";
const today = () => new Date().toLocaleDateString("sv-SE");
const css = `@media screen { #photo-print { display: none; } }
@media print {
  body * { visibility: hidden !important; }
  #photo-print, #photo-print * { visibility: visible !important; }
  #photo-print { position: absolute; left: 0; top: 0; width: 100%; }
  #photo-print tr { break-inside: avoid; }
  @page { size: A4; margin: 12mm; }
}`;

// Mặc định theo mẫu của dự án Phú Quốc; dự án khác tự nhập vì tiêu đề báo cáo khác nhau theo dự án.
const PQ = { goiThau: "Gói thầu XL-03: Cung cấp và thi công lắp đặt hệ thống ray", hangMuc: "Thi công hàn ray" };

export default function PhotoReportForm() {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState(today());
  const [r, setR] = useState<PhotoReport>(emptyPhotoReport);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadProjects({ includeProgress: false }).then((res) => {
      setProjects(res.projects.map((p) => ({ id: p.id, name: p.name })));
      setProjectId((cur) => cur || res.projects[0]?.id || "");
    }).catch(() => setProjects([]));
  }, []);

  const projectName = projects.find((p) => p.id === projectId)?.name ?? "";
  const isPq = /phú quốc/i.test(projectName);

  useEffect(() => {
    if (!projectId || !date) return;
    let live = true;
    setStatus("Đang tải…");
    loadPhotoReport(projectId, date).then((res) => {
      if (!live) return;
      setR(res.report ?? { ...emptyPhotoReport(), ...(isPq ? PQ : {}) });
      setStatus(res.source === "local" ? `Đang dùng bản lưu trên máy này${res.error ? ` (${res.error})` : ""}.` : "");
    });
    return () => { live = false; };
  }, [projectId, date, isPq]);

  const patch = (id: string, p: Partial<PhotoReport["items"][number]>) => setR((c) => ({ ...c, items: c.items.map((i) => (i.id === id ? { ...i, ...p } : i)) }));

  async function pick(id: string, file?: File) {
    if (!file) return;
    try { patch(id, { anh: await compressImage(file) }); } catch (e) { setStatus(e instanceof Error ? e.message : "Không đọc được ảnh"); }
  }

  async function save() {
    setBusy(true);
    const res = await savePhotoReport(projectId, date, r);
    setStatus(res.source === "supabase" ? "Đã lưu." : `Đã lưu trên máy này — chưa lên Supabase${res.error ? `: ${res.error}` : ""}.`);
    setBusy(false);
  }

  const printItems = r.items.length % 2 ? [...r.items, { id: "pad", noiDung: "", anh: "" }] : r.items;
  const rows = Array.from({ length: printItems.length / 2 }, (_, i) => printItems.slice(i * 2, i * 2 + 2));
  const [y, m, d] = date.split("-");

  return (
    <div className="px-4 sm:px-6 pb-8">
      <style>{css}</style>
      <div className="no-print divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-800 shadow-sm">
        <div className="flex flex-wrap items-end gap-3 pb-5">
          <label className={`${lbl} min-w-[16rem] flex-1`}>Dự án
            <select className={inp} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className={lbl}>Ngày
            <input className={inp} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={busy || !projectId} onClick={save} className="h-10 min-w-20 cursor-pointer rounded-lg bg-[#0047AB] px-5 font-semibold text-white transition-colors hover:bg-[#00388A] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Đang lưu…" : "Lưu"}</button>
            <button type="button" disabled={!projectId} onClick={() => window.print()} className="h-10 cursor-pointer rounded-lg border border-slate-300 bg-white px-4 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">In / Lưu PDF</button>
          </div>
          {status && <p role="status" className={`basis-full text-xs ${status.startsWith("Đã lưu.") ? "text-emerald-700" : "text-slate-600"}`}>{status}</p>}
        </div>

        <div className="grid gap-4 py-5 sm:grid-cols-2">
          <label className={lbl}>Gói thầu (in trên tiêu đề)<input className={inp} value={r.goiThau} onChange={(e) => setR({ ...r, goiThau: e.target.value })} placeholder="Gói thầu …" /></label>
          <label className={lbl}>Hạng mục<input className={inp} value={r.hangMuc} onChange={(e) => setR({ ...r, hangMuc: e.target.value })} placeholder="Thi công …" /></label>
        </div>

        <div className="space-y-4 pt-5">
          <div className="grid gap-4 md:grid-cols-2">
            {r.items.map((it, idx) => (
              <section key={it.id} className="space-y-2 rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Ảnh {idx + 1}</h3>
                  <button type="button" onClick={() => setR((c) => ({ ...c, items: c.items.filter((x) => x.id !== it.id) }))} className="cursor-pointer text-xs font-semibold text-red-600 hover:underline">Xoá ô này</button>
                </div>
                <label className={lbl}>Nội dung<textarea className={inp} rows={2} value={it.noiDung} onChange={(e) => patch(it.id, { noiDung: e.target.value })} placeholder="Ghi nội dung công việc hàng ngày" /></label>
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
                  {it.anh ? <img src={it.anh} alt={`Ảnh ${idx + 1}`} className="h-full w-full object-contain" /> : <span className="text-xs text-slate-500">Chưa có ảnh</span>}
                </div>
                <div className="flex gap-3 text-xs font-semibold">
                  <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50">
                    {it.anh ? "Đổi ảnh" : "Chọn ảnh"}
                    <input className="sr-only" type="file" accept="image/*" onChange={(e) => { void pick(it.id, e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                  {it.anh && <button type="button" onClick={() => patch(it.id, { anh: "" })} className="cursor-pointer text-slate-600 hover:underline">Bỏ ảnh</button>}
                </div>
              </section>
            ))}
          </div>
          <button type="button" onClick={() => setR((c) => ({ ...c, items: [...c.items, newPhotoItem()] }))} className="h-9 cursor-pointer rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">+ Thêm ô ảnh</button>
        </div>
      </div>

      <article id="photo-print" className="text-[13px] leading-6 text-black" style={{ fontFamily: "'Times New Roman', serif" }}>
        <div className="text-center font-bold uppercase">
          <div>Dự án: {projectName}</div>
          <div>{r.goiThau}</div>
          <div>Hạng mục: {r.hangMuc}</div>
          <h2 className="mt-2 text-lg">Báo cáo ảnh</h2>
          <div className="text-xs font-normal normal-case">Ngày {d} tháng {m} năm {y}</div>
        </div>
        <table className="mt-3 w-full table-fixed border-collapse">
          <tbody>
            {rows.flatMap((pair, i) => [
              <tr key={`n${i}`}>{pair.map((it, j) => <td key={j} className="border border-black p-1.5 align-top"><b>Nội dung: </b>{it.noiDung}</td>)}</tr>,
              <tr key={`a${i}`}>{pair.map((it, j) => (
                <td key={j} className="h-[62mm] border border-black p-1.5 text-center align-middle">
                  {it.anh ? <img src={it.anh} alt="" className="mx-auto max-h-[58mm] max-w-full object-contain" /> : null}
                </td>))}</tr>,
            ])}
          </tbody>
        </table>
      </article>
    </div>
  );
}
