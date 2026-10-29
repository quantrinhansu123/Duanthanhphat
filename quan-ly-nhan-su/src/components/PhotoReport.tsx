"use client";

import { useEffect, useRef, useState } from "react";
import DailyWorkReportPrint, { type DailyPrintDay } from "@/components/DailyWorkReportPrint";
import PhotoReportPrintSheet from "@/components/PhotoReportPrintSheet";
import { loadDailyReport, type DailyWorkType } from "@/lib/dailyReportDb";
import { loadProjects } from "@/lib/projectsDb";
import { compressImage, emptyPhotoReport, loadPhotoReport, newPhotoItem, savePhotoReport, type PhotoReport } from "@/lib/photoReportDb";
import { loadAcceptedOnDate } from "@/lib/weldQualityClient";

const inp = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/25";
const lbl = "flex flex-col text-xs font-semibold text-slate-600";
const today = () => new Date().toLocaleDateString("sv-SE");

// Mặc định theo mẫu của dự án Phú Quốc; dự án khác tự nhập vì tiêu đề báo cáo khác nhau theo dự án.
const PQ = { goiThau: "Gói thầu XL-03: Cung cấp và thi công lắp đặt hệ thống ray", hangMuc: "Thi công hàn ray" };

type PhotoReportFormProps = {
  /** Nhúng trong Báo cáo ngày — dùng chung ngày/dự án với phiếu ngày. */
  embedded?: boolean;
  /** Tab đang mở — chỉ tải dữ liệu ảnh khi active (tránh tải base64 khi còn ở tab ngày). */
  active?: boolean;
  date?: string;
  onDateChange?: (date: string) => void;
  projectId?: string;
  onProjectIdChange?: (projectId: string) => void;
  /** Danh sách dự án từ cha — bỏ tải trùng khi nhúng. */
  projects?: { id: string; name: string }[];
};

export default function PhotoReportForm({
  embedded = false,
  active = true,
  date: dateProp,
  onDateChange,
  projectId: projectIdProp,
  onProjectIdChange,
  projects: projectsProp,
}: PhotoReportFormProps) {
  const [projectsLocal, setProjectsLocal] = useState<{ id: string; name: string }[]>([]);
  const [projectIdLocal, setProjectIdLocal] = useState("");
  const [dateLocal, setDateLocal] = useState(today());
  const [r, setR] = useState<PhotoReport>(emptyPhotoReport);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printDay, setPrintDay] = useState<DailyPrintDay | null>(null);
  const [workTypes, setWorkTypes] = useState<DailyWorkType[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const loadedKeyRef = useRef("");

  const projects = projectsProp ?? projectsLocal;
  const projectId = projectIdProp ?? projectIdLocal;
  const date = dateProp ?? dateLocal;

  function setProjectId(next: string) {
    if (onProjectIdChange) onProjectIdChange(next);
    else setProjectIdLocal(next);
  }

  function setDate(next: string) {
    if (onDateChange) onDateChange(next);
    else setDateLocal(next);
  }

  useEffect(() => {
    if (projectsProp) return;
    let live = true;
    loadProjects({ includeProgress: false })
      .then((res) => {
        if (!live) return;
        setProjectsLocal(res.projects.map((p) => ({ id: p.id, name: p.name })));
        if (projectIdProp === undefined && !embedded) {
          setProjectIdLocal((cur) => cur || res.projects[0]?.id || "");
        }
      })
      .catch(() => {
        if (live) setProjectsLocal([]);
      });
    return () => {
      live = false;
    };
  }, [projectsProp, projectIdProp, embedded]);

  useEffect(() => {
    if (projectIdProp !== undefined) setProjectIdLocal(projectIdProp);
  }, [projectIdProp]);

  useEffect(() => {
    if (dateProp !== undefined) setDateLocal(dateProp);
  }, [dateProp]);

  const projectName = projects.find((p) => p.id === projectId)?.name ?? "";
  const isPq = /phú quốc/i.test(projectName);

  useEffect(() => {
    if (!active || !projectId || !date) return;
    const key = `${projectId}|${date}`;
    if (loadedKeyRef.current === key) return;
    let live = true;
    setStatus("Đang tải…");
    loadPhotoReport(projectId, date).then((res) => {
      if (!live) return;
      loadedKeyRef.current = key;
      setR(res.report ?? { ...emptyPhotoReport(), ...(isPq ? PQ : {}) });
      setStatus(res.source === "local" ? `Đang dùng bản lưu trên máy này${res.error ? ` (${res.error})` : ""}.` : "");
    });
    return () => {
      live = false;
    };
  }, [active, projectId, date, isPq]);

  const patch = (id: string, p: Partial<PhotoReport["items"][number]>) => setR((c) => ({ ...c, items: c.items.map((i) => (i.id === id ? { ...i, ...p } : i)) }));

  async function pick(id: string, file?: File) {
    if (!file) return;
    try {
      patch(id, { anh: await compressImage(file) });
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Không đọc được ảnh");
    }
  }

  async function save() {
    if (!projectId) return;
    setBusy(true);
    const res = await savePhotoReport(projectId, date, r);
    loadedKeyRef.current = `${projectId}|${date}`;
    setStatus(res.source === "supabase" ? "Đã lưu." : `Đã lưu trên máy này — chưa lên Supabase${res.error ? `: ${res.error}` : ""}.`);
    setBusy(false);
    return res;
  }

  /** In cùng báo cáo ngày của cùng dự án / ngày. */
  async function printWithDaily() {
    if (!projectId) return;
    setBusy(true);
    try {
      await savePhotoReport(projectId, date, r);
      const bundle = await loadDailyReport(date);
      const accepted = await loadAcceptedOnDate(date, projectId).then((res) => res.count).catch(() => null);
      setWorkTypes(bundle.workTypes);
      setPrintDay({
        reportDate: date,
        weather: "",
        temperature: "",
        workToday: bundle.workToday,
        workNext: bundle.workNext,
        equipment: bundle.equipment,
        incidents: bundle.incidents,
        acceptedCount: accepted,
        duAnId: projectId,
        projectName,
        photo: r,
      });
      setPrintOpen(true);
      setStatus("Đã mở bản in: báo cáo ngày + báo cáo ảnh.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Không mở được bản in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={embedded ? "pb-2" : "px-4 sm:px-6 pb-8"}>
      <div className="no-print divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-800 shadow-sm">
        <div className="flex flex-wrap items-end gap-3 pb-5">
          {embedded ? (
            <p className="basis-full rounded-lg border border-[#0047AB]/20 bg-[#0047AB]/5 px-3 py-2 text-xs text-slate-700">
              Đang gắn với phiếu <span className="font-semibold">Báo cáo ngày</span>
              {date ? <> · ngày <span className="font-semibold tabular-nums">{date}</span></> : null}
              {projectName ? <> · dự án <span className="font-semibold">{projectName}</span></> : <> · <span className="font-semibold text-amber-700">chưa chọn dự án</span></>}
              . Đổi dự án / ngày ở đây cũng đổi phiếu ngày.
            </p>
          ) : null}
          <label className={`${lbl} min-w-[16rem] flex-1`}>Dự án
            <select className={inp} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {!projectId ? <option value="">Chọn dự án</option> : null}
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className={lbl}>Ngày
            <input className={inp} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={busy || !projectId} onClick={() => void save()} className="h-10 min-w-20 cursor-pointer rounded-lg bg-[#0047AB] px-5 font-semibold text-white transition-colors hover:bg-[#00388A] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Đang lưu…" : "Lưu"}</button>
            {!embedded ? (
              <button type="button" disabled={busy || !projectId} onClick={() => void printWithDaily()} className="h-10 cursor-pointer rounded-lg border border-slate-300 bg-white px-4 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">In cùng báo cáo ngày</button>
            ) : null}
          </div>
          {status && <p role="status" className={`basis-full text-xs ${status.startsWith("Đã lưu.") || status.startsWith("Đã mở") ? "text-emerald-700" : "text-slate-600"}`}>{status}</p>}
          <p className="basis-full text-xs text-slate-500">
            {embedded
              ? "Ảnh lưu theo cùng dự án và ngày với phiếu báo cáo ngày. Nút In báo cáo phía trên in cả hai mẫu."
              : "In từ tab này hoặc tab Báo cáo ngày đều kèm mẫu báo cáo ảnh cùng ngày / dự án."}
          </p>
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
                  {it.anh ? <img src={it.anh} alt={`Ảnh ${idx + 1}`} className="h-full w-full object-contain" loading="lazy" decoding="async" /> : <span className="text-xs text-slate-500">Chưa có ảnh</span>}
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

      <div className="no-print mt-4">
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="h-9 cursor-pointer rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {showPreview ? "Ẩn xem trước mẫu in" : "Xem trước mẫu in"}
        </button>
        {showPreview ? (
          <div className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mx-auto w-[210mm] origin-top scale-[0.72] sm:scale-90">
              <PhotoReportPrintSheet projectName={projectName} date={date} report={r} className="photo-preview-sheet" />
            </div>
          </div>
        ) : null}
      </div>

      <DailyWorkReportPrint
        open={printOpen}
        reportDate={date}
        weather=""
        temperature=""
        workTypes={workTypes}
        workToday={printDay?.workToday ?? []}
        workNext={printDay?.workNext ?? []}
        equipment={printDay?.equipment ?? []}
        incidents={printDay?.incidents ?? []}
        days={printDay ? [printDay] : undefined}
        acceptedCount={printDay?.acceptedCount ?? null}
        duAnId={projectId}
        projectName={projectName}
        photo={r}
        onClose={() => { setPrintOpen(false); setPrintDay(null); }}
        onPrint={() => window.print()}
      />
    </div>
  );
}
