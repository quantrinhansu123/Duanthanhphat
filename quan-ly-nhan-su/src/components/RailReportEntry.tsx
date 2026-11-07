"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SelectMenu from "@/components/SelectMenu";
import LongRailMonitoringPrint from "@/components/LongRailMonitoringPrint";
import { loadProjects } from "@/lib/projectsDb";
import type { Project } from "@/data/projects";
import { reportEndMovement } from "@lwr/lib/stress-release";
import {
  getPlacementSpan,
  parseChainage,
  patchTrackCell,
  railCellLockTemp,
  railRowKey,
  TRACK_LAYOUT_STORAGE_KEY,
  type TrackLayout,
} from "@lwr/lib/track-editor";
import { loadTrackLayout, serializeTrackLayout, upsertTrackLayout } from "@lwr/lib/track-layout-storage";
import type { RailCell, RailReportRow } from "@lwr/types/track";

const REPORT_DESIGN_MM = 5; // Giới hạn cho phép tại điểm M theo quy trình.
const EMPTY_ROW: RailReportRow = { temp: "", mActual: "", eActual: "", note: "", measuredAt: "", airTemp: "" };
function measurementNow() {
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  return parts.replace(" ", "T");
}
const inputCls =
  "mt-1 w-full min-w-0 rounded-md border border-amber-400 bg-white px-2 py-2 text-sm font-semibold focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";

type CellOption = { cell: RailCell; line: string; rail: string };

function cellOptions(layout: TrackLayout | null): CellOption[] {
  if (!layout) return [];
  const all = layout.rows.flatMap((row) => row.cells.map((cell) => ({ cell, line: row.line, rail: row.rail })));
  const placed = all.filter((item) => item.cell.placed || item.cell.released);
  return placed.length ? placed : all;
}

/** Trang «Theo dõi ray hàn dài»: chọn dự án + tên thanh ray rồi điền báo cáo chuyển vị điểm M / điểm E. */
export default function RailReportEntry() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [projectsReady, setProjectsReady] = useState(false);
  const [layout, setLayout] = useState<TrackLayout | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [cellId, setCellId] = useState("");
  const [report, setReport] = useState<RailReportRow>({ ...EMPTY_ROW });
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const editorRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (editorOpen) editorRef.current?.showModal();
    else editorRef.current?.close();
  }, [editorOpen]);
  const [checked, setChecked] = useState<string[]>([]);
  const [printCells, setPrintCells] = useState<RailCell[] | null>(null);

  useEffect(() => {
    let active = true;
    void loadProjects({ includeProgress: false })
      .then((result) => {
        if (!active) return;
        setProjects(result.projects);
        // Tự chọn dự án Phú Quốc như trang Track Map.
        const pq = result.projects.find((p) => /phú quốc/i.test(p.name) || p.maDuAn?.trim().toUpperCase() === "PQ");
        if (pq) setProjectId((cur) => cur || pq.id);
      })
      .catch((cause) => { if (active) setMessage(`Không tải được danh sách dự án: ${String(cause)}`); })
      .finally(() => { if (active) setProjectsReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!projectsReady) return;
    let active = true;
    setLoading(true);
    setMessage("");
    setLayout(null);
    setCellId("");
    setChecked([]);
    setPrintCells(null);
    void loadTrackLayout(projectId || undefined)
      .then((result) => {
        if (!active) return;
        setLayout(result.layout);
        if (!result.layout) setMessage(result.error ?? "Dự án này chưa có sơ đồ thanh ray. Mở Tổng quan (Track Map) để tạo sơ đồ trước.");
      })
      .catch((cause) => { if (active) setMessage(`Không tải được sơ đồ: ${String(cause)}`); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, projectsReady]);

  const options = useMemo(() => cellOptions(layout), [layout]);
  const selected = options.find((item) => item.cell.id === cellId) ?? null;
  const cell = selected?.cell ?? null;

  useEffect(() => {
    const stored = cell?.report?.rows[0];
    setReport({ ...EMPTY_ROW, ...stored, measuredAt: stored?.measuredAt || measurementNow() });
  }, [cell?.id, cell?.report]);

  const projectOptions = useMemo(
    () => [
      { value: "", label: "Sơ đồ hiện có (chưa gán dự án)" },
      ...projects.map((p) => ({ value: p.id, label: p.name, hint: p.maDuAn?.trim() || undefined })),
    ],
    [projects],
  );
  const railOptions = useMemo(
    () => options.map(({ cell: c, line, rail }) => ({
      value: c.id,
      label: `${c.id} · ${line} – ${rail}`,
      hint: `Km${c.from} → Km${c.to}${c.released ? " · đã giải tỏa" : ""}`,
    })),
    [options],
  );

  // Thông số tính toán lấy từ đoạn LWR (tab Giải tỏa) đang phủ thanh này.
  const params = useMemo(() => {
    if (!layout || !cell || !selected) return undefined;
    const row = layout.rows.find((item) => item.cells.some((c) => c.id === cell.id));
    const from = parseChainage(cell.from);
    const to = parseChainage(cell.to);
    if (!row || from === null || to === null) return undefined;
    const key = railRowKey(row);
    return layout.longRails
      .filter((rail) => {
        if (rail.rowKey !== key) return false;
        const span = getPlacementSpan(layout.rows, rail);
        return Boolean(span && span.startMetres < to && span.endMetres > from);
      })
      .sort((a, b) => ((a.endMetres ?? 0) - (a.startMetres ?? 0)) - ((b.endMetres ?? 0) - (b.startMetres ?? 0)))[0]?.params;
  }, [layout, cell, selected]);

  async function commit(next: RailReportRow) {
    if (!layout || !cell) return;
    const empty = !next.temp.trim() && !next.mActual.trim() && !next.eActual.trim() && !next.note.trim() && !next.measuredAt?.trim() && !next.airTemp?.trim();
    setSaving(true);
    setMessage("");
    try {
      const updated = patchTrackCell(layout, cell.id, { report: empty ? null : { rows: [next] } });
      const savedAt = new Date().toISOString();
      const result = await upsertTrackLayout(projectId || undefined, updated, savedAt);
      if (!result.ok) { setMessage(result.error ?? "Không lưu được báo cáo lên Supabase."); return; }
      try {
        const key = projectId ? `${TRACK_LAYOUT_STORAGE_KEY}:${projectId}` : TRACK_LAYOUT_STORAGE_KEY;
        localStorage.setItem(key, serializeTrackLayout(updated, savedAt));
      } catch { /* bản lưu trên trình duyệt chỉ là dự phòng */ }
      setLayout(updated);
      setEditorOpen(false);
      setMessage(result.skipped && result.error ? result.error : `Đã lưu báo cáo ${cell.id}.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Không lưu được báo cáo.");
    } finally {
      setSaving(false);
    }
  }

  const lock = cell ? railCellLockTemp(cell) : null;
  const measuredNumber = Number(report.temp.trim().replace(",", "."));
  const hasMeasured = Boolean(report.temp.trim()) && Number.isFinite(measuredNumber);
  const diff = lock !== null && hasMeasured ? Math.round((measuredNumber - lock) * 1000) / 1000 : null;
  const eDesign = params && diff !== null ? reportEndMovement(params, diff) : null;

  const autoBox = (label: string, value: string | number, unit: string) => (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 font-bold text-slate-800">{value} <span className="text-xs font-medium text-slate-500">{unit}</span></p>
    </div>
  );
  const set = (patch: Partial<RailReportRow>) => setReport((r) => ({ ...r, ...patch }));

  return (
    <div className="w-full min-w-0 space-y-3 px-4 pb-10 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-slate-900">Theo dõi ray hàn dài</h1>
        <button type="button" disabled={saving} onClick={() => {
          setCellId(""); setReport({ ...EMPTY_ROW, measuredAt: measurementNow() }); setMessage(""); setEditorOpen(true);
        }} className="min-h-11 rounded-lg bg-[#0047AB] px-4 py-2 font-semibold text-white disabled:opacity-50">+ Thêm mới</button>
      </div>
      {message && <p role="status" className="text-sm text-slate-600">{message}</p>}
      <dialog ref={editorRef} aria-labelledby="rail-editor-title" onClose={() => setEditorOpen(false)} onCancel={event => { if (saving) event.preventDefault(); }} className="m-auto max-h-[92dvh] w-[calc(100%_-_1.5rem)] max-w-3xl overflow-y-auto rounded-2xl border-0 bg-white p-4 text-slate-900 shadow-xl backdrop:bg-slate-900/50 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="rail-editor-title" className="text-lg font-bold">Theo dõi ray hàn dài — {cell ? cell.id : "Thêm mới"}</h2>
        <button type="button" disabled={saving} onClick={() => setEditorOpen(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 font-semibold disabled:opacity-50">Đóng</button>
      </div>
      {message && <p role="status" className="mb-3 text-sm text-slate-600">{message}</p>}
      <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mt-0.5 text-sm text-slate-600">Chọn dự án và tên thanh ray, sau đó điền báo cáo chuyển vị điểm M / điểm E.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <span className="text-sm font-semibold text-slate-700">Dự án</span>
            <div className="mt-1">
              <SelectMenu
                searchable
                value={projectId}
                onChange={setProjectId}
                options={projectOptions}
                placeholder="Gõ tên / mã dự án…"
                searchPlaceholder="Gõ để lọc dự án…"
                emptyLabel="Không có dự án khớp"
                buttonClassName="w-full min-w-0 rounded border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900"
              />
            </div>
          </div>
          <div className="min-w-0">
            <span className="text-sm font-semibold text-slate-700">Tên thanh ray</span>
            <div className="mt-1">
              <SelectMenu
                searchable
                value={cellId}
                onChange={setCellId}
                options={railOptions}
                disabled={loading || railOptions.length === 0}
                placeholder={loading ? "Đang tải sơ đồ…" : railOptions.length ? "Chọn thanh ray (vd DT-41)" : "Chưa có thanh ray"}
                searchPlaceholder="Gõ tên thanh ray / tuyến…"
                emptyLabel="Không có thanh ray khớp"
                buttonClassName="w-full min-w-0 rounded border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900"
              />
            </div>
          </div>
        </div>
      </div>

      {cell && lock !== null ? (
        <section className="space-y-3 rounded-xl border border-slate-300 bg-white p-4 text-sm">
          <div>
            <h2 className="font-bold text-slate-900">Báo cáo chuyển vị điểm M / điểm E — {cell.id}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {selected?.line} – {selected?.rail} · Km{cell.from} → Km{cell.to}. Thông số tính toán lấy từ tab Giải tỏa; nhập thông tin quan trắc và chuyển vị thực tế.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="flex items-center justify-between gap-2 font-semibold text-slate-700">Ngày giờ đo
                <button type="button" disabled={saving} onClick={() => set({ measuredAt: measurementNow() })} className="min-h-9 rounded-md border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 disabled:opacity-50">Now</button>
              </span>
              <input type="datetime-local" aria-label="Ngày giờ đo" className={inputCls} value={report.measuredAt ?? ""} onChange={(e) => set({ measuredAt: e.target.value })} />
            </label>
            <label className="block min-w-0">
              <span className="font-semibold text-slate-700">Nhiệt độ không khí (°C)</span>
              <input aria-label="Nhiệt độ không khí (°C)" inputMode="decimal" className={inputCls} value={report.airTemp ?? ""} onChange={(e) => set({ airTemp: e.target.value })} placeholder="Nhập nhiệt độ không khí" />
            </label>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Nhiệt độ</p>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {autoBox("Nhiệt độ khóa", lock, "°C")}
              <label className="block min-w-0 rounded-md border border-amber-300 bg-amber-50/60 px-3 py-2">
                <span className="text-xs font-semibold text-amber-900">Nhiệt độ đo (°C)</span>
                <input aria-label="Nhiệt độ đo (°C)" inputMode="decimal" className="mt-0.5 w-full min-w-0 bg-transparent font-bold text-slate-800 focus:outline-none" value={report.temp} onChange={(e) => set({ temp: e.target.value })} placeholder="Nhập" />
              </label>
              {autoBox("Chênh nhiệt độ", diff === null ? "—" : diff, "°C")}
            </div>
            <p className="mt-1 text-xs text-slate-500">Khóa = (T ray trái + T ray phải) / 2 từ tab Giải tỏa; đo = nhiệt độ ray lúc đo điểm M / E (bạn nhập); chênh = đo − khóa.</p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
            <p className="font-bold text-amber-900">Điểm M</p>
            <div className="mt-1 grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <span className="text-slate-600">Thiết kế (mm)</span>
                <div className="mt-1 rounded-md border border-slate-200 bg-white px-2 py-2 font-semibold text-slate-700">{REPORT_DESIGN_MM}</div>
              </div>
              <label className="block min-w-0">
                <span className="font-semibold text-amber-900">Thực tế (mm)</span>
                <input aria-label="Điểm M thực tế (mm)" inputMode="decimal" className={inputCls} value={report.mActual} onChange={(e) => set({ mActual: e.target.value })} placeholder="Nhập số" />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
            <p className="font-bold text-amber-900">Điểm E</p>
            <p className="mt-1 text-xs text-slate-600">Δ = (Pmax − Pj)² / (2EFr); Pmax = EFα × |T đo − T khóa|; Pj = 0. Thông số lấy từ Giải tỏa. Dấu âm thể hiện giảm nhiệt.</p>
            <div className="mt-1 grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <span className="text-slate-600">Thiết kế (mm)</span>
                <div className="mt-1 rounded-md border border-slate-200 bg-white px-2 py-2 font-semibold text-slate-700">
                  {eDesign === null ? (params ? "Chờ nhiệt độ đo" : "Chờ thông số Giải tỏa") : Math.round(eDesign * 1000) / 1000}
                </div>
              </div>
              <label className="block min-w-0">
                <span className="font-semibold text-amber-900">Thực tế (mm)</span>
                <input aria-label="Điểm E thực tế (mm)" inputMode="decimal" className={inputCls} value={report.eActual} onChange={(e) => set({ eActual: e.target.value })} placeholder="Nhập số" />
              </label>
            </div>
          </div>

          <label className="block">
            <span className="font-semibold text-slate-700">Ghi chú</span>
            <textarea aria-label="Ghi chú" rows={3} className="mt-1 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600" value={report.note} onChange={(e) => set({ note: e.target.value })} />
          </label>
          <button type="button" disabled={saving || loading} onClick={() => void commit(report)} className="min-h-11 w-full rounded-lg bg-[#0047AB] px-4 py-2 font-semibold text-white hover:bg-[#00388A] disabled:opacity-50">{saving ? "Đang lưu…" : "Lưu báo cáo"}</button>
        </section>
      ) : (
        !loading && <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">Chọn tên thanh ray để hiện form nhập báo cáo.</p>
      )}
      </div>
      </dialog>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold text-slate-900">Danh sách đã nhập ({options.filter(item => item.cell.report?.rows.length).length})</h2>
        <button type="button" disabled={!checked.length || loading || saving} onClick={() => setPrintCells(options.filter(item => checked.includes(item.cell.id) && item.cell.report?.rows.length).map(item => item.cell))} className="mt-3 min-h-11 rounded-lg bg-[#0047AB] px-4 py-2 font-semibold text-white disabled:opacity-50">In báo cáo ({checked.length})</button>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600"><tr>
              <th className="p-2"><input type="checkbox" aria-label="Chọn tất cả báo cáo đã nhập" checked={options.some(item => item.cell.report?.rows.length) && options.filter(item => item.cell.report?.rows.length).every(item => checked.includes(item.cell.id))} onChange={e => setChecked(e.target.checked ? options.filter(item => item.cell.report?.rows.length).map(item => item.cell.id) : [])} /></th>
              <th className="p-2">Thanh ray</th><th className="p-2">Ngày giờ đo</th><th className="p-2">Không khí (°C)</th><th className="p-2">Nhiệt độ đo (°C)</th><th className="p-2">M thực tế (mm)</th><th className="p-2">E thực tế (mm)</th><th className="p-2">Thao tác</th>
            </tr></thead>
            <tbody>{options.filter(item => item.cell.report?.rows.length).map(item => {
              const saved = item.cell.report!.rows[0];
              const date = saved.measuredAt?.split("T");
              const displayDate = date?.[0] ? `${date[0].split("-").reverse().join("/")} ${date[1] ?? ""}` : "—";
              return <tr key={item.cell.id} className="border-t border-slate-100">
                <td className="p-2"><input type="checkbox" aria-label={`Chọn báo cáo ${item.cell.id}`} checked={checked.includes(item.cell.id)} onChange={e => setChecked(previous => e.target.checked ? [...previous,item.cell.id] : previous.filter(id => id !== item.cell.id))} /></td>
                <td className="p-2 font-semibold">{item.cell.id}<span className="block text-xs font-normal text-slate-500">{item.line} · {item.rail}</span></td>
                <td className="p-2">{displayDate}</td><td className="p-2">{saved.airTemp || "—"}</td><td className="p-2">{saved.temp || "—"}</td><td className="p-2">{saved.mActual || "—"}</td><td className="p-2">{saved.eActual || "—"}</td>
                <td className="p-2"><button type="button" disabled={saving} onClick={() => { setCellId(item.cell.id); setEditorOpen(true); }} className="min-h-10 rounded-lg border border-blue-200 px-3 font-semibold text-blue-700 disabled:opacity-50">Xem / Sửa</button></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        {!options.some(item => item.cell.report?.rows.length) && <p className="mt-3 text-sm text-slate-500">Chưa có báo cáo đã lưu trong dự án này.</p>}
      </section>
      {printCells && layout && <LongRailMonitoringPrint layout={layout} cells={printCells} project={projects.find(p => p.id === projectId)?.name || "Sơ đồ hiện có"} onClose={() => setPrintCells(null)} />}
    </div>
  );
}
