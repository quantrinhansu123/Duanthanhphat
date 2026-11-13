"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { loadProjects } from "@/lib/projectsDb";
import { EMPTY_DIARY, averageDayTemperature, deleteDiary, listDiaries, loadDiary, saveDiary, type ConstructionDiary, type DiarySummary } from "@/lib/constructionDiaryDb";
import { loadReportWeather, qualityRequest } from "@/lib/weldQualityClient";

type DiaryDefaults = Pick<ConstructionDiary, "noiDungCongViec" | "nghiemThuHangNgay" | "thietBi" | "banChiHuy" | "canBoKyThuat" | "congNhan" | "nhanLucNguon">;
async function loadDefaults(projectId: string, date: string) {
  const [work, weather] = await Promise.allSettled([
    qualityRequest<DiaryDefaults>({ action: "diary-defaults", du_an_id: projectId, date }),
    loadReportWeather(projectId, date),
  ]);
  const values: Partial<ConstructionDiary> = { ...(work.status === "fulfilled" ? work.value : {}), ...(weather.status === "fulfilled" ? weather.value : {}) };
  const avg = averageDayTemperature(values.sang ?? "", values.chieu ?? "", values.toi ?? "");
  if (avg) values.nhietDo = avg;
  return {
    values,
    warning: [work, weather].flatMap((r) => r.status === "rejected" ? [r.reason instanceof Error ? r.reason.message : "Chưa tải được dữ liệu tự điền; có thể nhập tay."] : []).join(" "),
  };
}

/** Ba ô chọn thời tiết theo biểu mẫu dự án (NKTC phần B). */
const WEATHER_OPTIONS = ["Bình thường", "Mưa", "Nắng"] as const;
type WeatherOption = (typeof WEATHER_OPTIONS)[number];

function weatherMark(thoiTiet: string): WeatherOption | "" {
  const t = thoiTiet.trim().toLowerCase();
  if (!t) return "";
  if (/(mưa|dông|mưa rào)/i.test(t)) return "Mưa";
  if (/(nắng|trời quang|quang mây)/i.test(t)) return "Nắng";
  if (/(bình thường|nhiều mây|sương|mát|âm u|tuyết)/i.test(t)) return "Bình thường";
  // Giá trị đã chọn đúng một trong ba ô
  const exact = WEATHER_OPTIONS.find((o) => o.toLowerCase() === t);
  return exact ?? "Bình thường";
}

const inp = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/25";
const lbl = "flex flex-col text-xs font-semibold text-slate-600";
const today = () => new Date().toLocaleDateString("sv-SE");
const LINE = 27; // px, khoảng cách dòng chấm theo bản mẫu
const DOT = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='3' height='27'%3E%3Crect y='26' width='1' height='1'/%3E%3C/svg%3E\")";
const css = `@media screen { #diary-print { position: absolute; left: -10000px; top: 0; visibility: hidden; pointer-events: none; } }
@media screen { #diary-print.diary-preview { position: fixed; left: 0; top: 0; right: 0; bottom: 0; width: auto; visibility: visible; pointer-events: auto; overflow: auto; background: #cbd5e1; z-index: 1400; padding: 72px 12px 28px; }
  #diary-print.diary-preview .diary-sheet { margin: 0 auto 16px; background: #fff; box-shadow: 0 2px 14px rgba(15, 23, 42, 0.28); } }
#diary-print { width: 210mm; font-family: 'Times New Roman', Times, serif; font-size: 13pt; line-height: 15pt; color: black; }
#diary-print p { margin: 0; }
#diary-print h2 { margin: 0 0 6pt; font-size: 13.5pt; line-height: 18pt; text-align: center; font-weight: bold; }
#diary-print .diary-sheet { width: 210mm; height: 296mm; box-sizing: border-box; padding: 15mm 10mm 20mm 20mm; display: flex; flex-direction: column; position: relative; overflow: hidden; break-after: page; page-break-after: always; }
#diary-print .diary-sheet:last-child { break-after: auto; page-break-after: auto; }
#diary-print .diary-foot { position: absolute; right: 15mm; bottom: 8mm; font-size: 11pt; }
#diary-print .diary-date { text-align: right; margin: 0 0 6pt; }
#diary-print .diary-heading { margin-top: 6pt; font-weight: bold; }
#diary-print .diary-heading .diary-hint { font-weight: normal; font-style: italic; }
#diary-print .diary-indent { padding-left: 10mm; }
#diary-print .diary-check { font-family: 'Times New Roman', Times, serif; }
#diary-print .diary-ruled { line-height: ${LINE}px; background-image: ${DOT}; background-size: 3px ${LINE}px; white-space: pre-wrap; overflow-wrap: anywhere; overflow: hidden; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
#diary-print .diary-fill { flex: 1 1 0; min-height: 0; overflow: hidden; }
#diary-print .diary-sig-row { display: grid; grid-template-columns: 1fr 1fr 1fr; text-align: center; font-weight: bold; margin-top: 8pt; break-inside: avoid; }
#diary-print .diary-sig-name { font-weight: normal; font-style: italic; min-height: 14pt; margin-top: 2pt; }
#diary-print .diary-sig-input { width: 90%; border: 0; background: transparent; font: inherit; font-weight: normal; font-style: italic; text-align: center; color: inherit; outline: none; padding: 0; }
@media print { #diary-print .diary-sig-input::placeholder { color: transparent; } }
@media screen { #diary-print .diary-sig-input { border-bottom: 1px dashed #64748b; background: #fffbea; } }
#diary-print .diary-sig-box { height: 16mm; display: flex; align-items: center; justify-content: center; overflow: hidden; }
#diary-print .diary-sig-box img { max-height: 15mm; max-width: 90%; width: auto; height: auto; object-fit: contain; }
@media print {
  body * { visibility: hidden !important; }
  #diary-print, #diary-print * { visibility: visible !important; }
  html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
  body *:has(#diary-print) { position: static !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
  aside, header, .no-print { display: none !important; }
  #diary-print { position: absolute; left: 0; top: 0; }
  @page { size: A4 portrait; margin: 0; }
}`;

const TEXT_SECTIONS = [
  ["suCo", "4. Mô tả chi tiết các sự cố, hư hỏng, tai nạn lao động và các vấn đề phát sinh khác trong quá trình thi công xây dựng công trình", "", 3],
  ["kienNghi", "5. Các kiến nghị và những ý kiến chỉ đạo giải quyết các vấn đề phát sinh của các bên có liên quan", "(Chủ đầu tư, Người giám sát thi công, Người giám sát tác giả, ghi rõ họ và tên, chức vụ và chữ ký)", 2],
  ["nhanXetGiamSat", "6. Nhận xét của kỹ sư giám sát thi công xây dựng về tình hình và chất lượng công việc xây dựng", "(ghi rõ họ và tên, chức vụ và chữ ký)", 2],
  ["chtTiepThu", "7. Chỉ huy trưởng công trường tiếp thu các kiến nghị và nhận xét", "(họ tên, chữ ký)", 2],
] as const satisfies readonly (readonly [keyof ConstructionDiary, string, string, number])[];

export default function ConstructionDiaryForm() {
  const [projects, setProjects] = useState<{ id: string; name: string; startDate: string }[]>([]);
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState(today());
  const [d, setD] = useState<ConstructionDiary>(EMPTY_DIARY);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  /** Nhật ký đang xem nhanh trong hộp thoại (nút Xem ở danh sách). */
  const [viewRow, setViewRow] = useState<DiarySummary | null>(null);
  /** Xem trước mẫu in nhật ký (nút In / Lưu PDF) — bấm In trong khung xem trước mới mở hộp thoại in. */
  const [previewOpen, setPreviewOpen] = useState(false);
  /** In ghép nhiều ngày: khoảng ngày chọn + danh sách nhật ký đã lưu trong khoảng (null = đang in một ngày). */
  const [range, setRange] = useState({ from: "", to: "" });
  const [rangeRows, setRangeRows] = useState<DiarySummary[] | null>(null);
  const closePreview = () => { setPreviewOpen(false); setRangeRows(null); };
  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closePreview(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewOpen]);
  useEffect(() => {
    if (!viewRow) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setViewRow(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewRow]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<DiarySummary[]>([]);
  const reloadSaved = () => { void listDiaries().then((r) => setSaved(r.rows)); };
  useEffect(reloadSaved, []);
  useEffect(() => {
    loadProjects({ includeProgress: false }).then((r) => {
      setProjects(r.projects.map((p) => ({ id: p.id, name: p.name, startDate: p.startDate })));
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
        const defaults = await loadDefaults(projectId, date);
        diary = { ...diary, ...defaults.values };
        warning = defaults.warning;
      } else {
        // Nhật ký đã lưu: (1) bản cũ bị cắt «… (+N)» → điền lại mục 3; (2) danh sách thiết bị đã lưu thiếu máy / vật tư đang gán cho dự án → cập nhật mục 2.2 cho đủ.
        // Bấm Lưu để lưu bản mới; sửa tay vẫn giữ nếu danh sách đã đủ.
        try {
          const defaults = await loadDefaults(projectId, date);
          const notes: string[] = [];
          // Dòng «Báo RFI số …» (bản cũ ghi vào mục 3) không thuộc nhật ký thi công: nội dung RFI chỉ nằm ở mục 3.2.
          const withoutRfi = diary.noiDungCongViec.split("\n").filter((line) => !/^\s*-?\s*Báo RFI số/i.test(line)).join("\n");
          if (withoutRfi !== diary.noiDungCongViec) {
            diary = { ...diary, noiDungCongViec: withoutRfi };
            notes.push("Đã bỏ dòng «Báo RFI số …» khỏi mục 3.");
          }
          if (/\(\+\d+\)/.test(diary.noiDungCongViec) && defaults.values.noiDungCongViec) {
            diary = { ...diary, noiDungCongViec: defaults.values.noiDungCongViec };
            notes.push("Mục 3 đã được điền lại đủ nội dung (bỏ «+N»).");
          }
          const wanted = (defaults.values.thietBi ?? "").split(/[\n;]/).map((x) => x.trim()).filter((x) => / bộ\s*$/.test(x))
            .map((x) => x.replace(/^-\s*/, "").replace(/^\d\.\s*[^:]+:\s*/, "").split(":")[0].trim()).filter(Boolean);
          if (wanted.some((name) => !diary.thietBi.includes(name))) {
            diary = { ...diary, thietBi: defaults.values.thietBi ?? diary.thietBi };
            notes.push("Danh sách thiết bị (2.2) đã được cập nhật đủ máy / vật tư gán cho dự án.");
          }
          // Giải toả ứng suất chỉ ghi vào ngày nghiệm thu (phát phiếu không vào nhật ký): đồng bộ dòng GTUS của mục 3.1 theo dữ liệu hiện tại.
          const isGtusLine = (line: string) => /Giải toả ứng suất/i.test(line);
          const savedGtus = diary.noiDungCongViec.split("\n").filter(isGtusLine);
          const wantedGtus = (defaults.values.noiDungCongViec ?? "").split("\n").filter(isGtusLine);
          if (savedGtus.join("\n") !== wantedGtus.join("\n")) {
            diary = { ...diary, noiDungCongViec: [...diary.noiDungCongViec.split("\n").filter((line) => !isGtusLine(line)), ...wantedGtus].filter((line) => line.trim()).join("\n") };
            notes.push("Dòng giải toả ứng suất ở mục 3.1 đã được đồng bộ theo ngày nghiệm thu.");
          }
          // Mục 3.2 theo nghiệm thu đã chốt / RFI phát trong ngày: thiếu dòng nào so với dữ liệu hiện tại thì cập nhật.
          const wantedAccept = (defaults.values.nghiemThuHangNgay ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
          if (wantedAccept.some((line) => !diary.nghiemThuHangNgay.includes(line.slice(0, 60)))) {
            diary = { ...diary, nghiemThuHangNgay: defaults.values.nghiemThuHangNgay ?? diary.nghiemThuHangNgay };
            notes.push("Mục 3.2 đã được cập nhật theo các nghiệm thu trong ngày.");
          }
          if (notes.length) warning = notes.join(" ") + " Bấm Lưu để lưu bản mới.";
        } catch { /* giữ nội dung đã lưu */ }
      }
      if (!live) return;
      setD(diary);
      setStatus([r.source === "local" ? `Đang dùng bản lưu trên máy này${r.error ? ` (${r.error})` : ""}.` : "", warning].filter(Boolean).join(" "));
      setLoading(false);
    }).catch(() => {
      if (live) {
        setD(EMPTY_DIARY);
        setStatus("Không tải được nhật ký. Vui lòng chọn lại ngày để thử lại.");
      }
    });
    return () => { live = false; };
  }, [projectId, date]);

  const mark = weatherMark(d.thoiTiet);
  const set = (k: keyof ConstructionDiary) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD((cur) => ({ ...cur, [k]: e.target.value }));

  async function autofill() {
    setBusy(true);
    try {
      const defaults = await loadDefaults(projectId, date);
      const { thietBi, noiDungCongViec, nghiemThuHangNgay } = defaults.values;
      setD((cur) => ({ ...cur, thietBi: thietBi ?? cur.thietBi, noiDungCongViec: noiDungCongViec ?? cur.noiDungCongViec, nghiemThuHangNgay: nghiemThuHangNgay ?? cur.nghiemThuHangNgay })); // giữ nguyên thời tiết, nhân lực đã nhập
      setStatus(defaults.warning || "Đã tự điền lại thiết bị (2.2) và mục 3; thời tiết, nhân lực giữ nguyên. Có thể sửa nội dung rồi bấm Lưu.");
    } catch { setStatus("Không tải được dữ liệu tự điền. Nội dung hiện tại được giữ nguyên."); }
    finally { setBusy(false); }
  }

  async function save() {
    setBusy(true);
    try {
      const r = await saveDiary(projectId, date, { ...d, kyTvgs: signers.tvgs, kyNtc: signers.ntc, kyNtp: signers.ntp });
      reloadSaved();
      setStatus(r.source === "supabase" ? "Đã lưu." : `Đã lưu trên máy này — chưa lên Supabase${r.error ? `: ${r.error}` : ""}.`);
    } catch { setStatus("Không lưu được nhật ký. Nội dung đang nhập được giữ nguyên; vui lòng thử lại."); }
    finally { setBusy(false); }
  }

  function printDiary() {
    const previous = document.title;
    // Tránh header trình duyệt in tên hệ thống / thời gian nổi bật trên biểu mẫu.
    document.title = " ";
    const restore = () => { document.title = previous; };
    window.addEventListener("afterprint", restore, { once: true });
    window.print();
  }

  const formTop = useRef<HTMLDivElement>(null);
  // Tên người ký cuối nhật ký: lưu cùng nhật ký trên Supabase (máy nào cũng thấy); ngày chưa có thì lấy của nhật ký mới nhất cùng dự án, rồi tới bản nhớ trên máy này.
  const [localSigners, setLocalSigners] = useState({ tvgs: "", ntc: "", ntp: "" });
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("nhat-ky-thi-cong-nguoi-ky");
      if (raw) setLocalSigners((cur) => ({ ...cur, ...(JSON.parse(raw) as Partial<typeof cur>) }));
    } catch { /* bỏ qua */ }
  }, []);
  const lastRow = saved.find((r) => r.projectId === projectId && r.date !== date && (r.diary.kyTvgs || r.diary.kyNtc || r.diary.kyNtp));
  const fallback = lastRow ? { tvgs: lastRow.diary.kyTvgs ?? "", ntc: lastRow.diary.kyNtc ?? "", ntp: lastRow.diary.kyNtp ?? "" } : localSigners;
  const signers = { tvgs: d.kyTvgs ?? fallback.tvgs, ntc: d.kyNtc ?? fallback.ntc, ntp: d.kyNtp ?? fallback.ntp };
  function setSigner(key: "tvgs" | "ntc" | "ntp", value: string) {
    const next = { ...signers, [key]: value };
    try { window.localStorage.setItem("nhat-ky-thi-cong-nguoi-ky", JSON.stringify(next)); } catch { /* bỏ qua */ }
    setLocalSigners(next);
    setD((cur) => ({ ...cur, kyTvgs: next.tvgs, kyNtc: next.ntc, kyNtp: next.ntp }));
  }
  /** Gõ tên ở khung xem trước: nhật ký ngày này đã lưu thì lưu luôn tên người ký lên Supabase. */
  function persistSigners() {
    if (!saved.some((r) => r.projectId === projectId && r.date === date)) return;
    void saveDiary(projectId, date, { ...d, kyTvgs: signers.tvgs, kyNtc: signers.ntc, kyNtp: signers.ntp }).then(reloadSaved);
  }
  /** Cuộn tới đầu form: trang nằm trong khung cuộn riêng của ứng dụng nên window.scrollTo không đủ. */
  function scrollToForm() {
    window.setTimeout(() => {
      formTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 50);
  }

  /** Mở một nhật ký đã lưu vào form (dùng cho nút Xem / Sửa). */
  function openSaved(row: DiarySummary) {
    setProjectId(row.projectId);
    setDate(row.date);
    setD(row.diary);
    setStatus(`Đang mở nhật ký ngày ${row.date.split("-").reverse().join("/")}.`);
    scrollToForm();
  }

  /** Ghép các nhật ký đã lưu của dự án trong khoảng ngày thành một bản in (số trang đánh liên tục từ 1). */
  function printRange() {
    const rows = saved.filter((r) => r.projectId === projectId && r.date >= range.from && r.date <= range.to).sort((a, b) => a.date.localeCompare(b.date));
    if (!rows.length) { setStatus("Không có nhật ký đã lưu nào của dự án này trong khoảng ngày đã chọn."); return; }
    setStatus(`Ghép ${rows.length} nhật ký đã lưu (các ngày chưa lập nhật ký được bỏ qua).`);
    setRangeRows(rows);
    setPreviewOpen(true);
  }

  /** In riêng một nhật ký đã lưu: nạp vào form rồi mở hộp thoại in. */
  function printSaved(row: DiarySummary) {
    setProjectId(row.projectId);
    setDate(row.date);
    setD(row.diary);
    setPreviewOpen(true);
  }

  async function removeSaved(row: DiarySummary) {
    const label = `${row.date.split("-").reverse().join("/")} · ${projects.find((p) => p.id === row.projectId)?.name ?? "dự án"}`;
    if (!window.confirm(`Xoá nhật ký ngày ${label}? Thao tác này không hoàn tác được.`)) return;
    setBusy(true);
    try {
      const r = await deleteDiary(row.projectId, row.date);
      reloadSaved();
      setStatus(r.source === "supabase" ? "Đã xoá nhật ký." : `Đã xoá bản trên máy này — chưa xoá được trên Supabase${r.error ? `: ${r.error}` : ""}.`);
      if (row.projectId === projectId && row.date === date) setD(EMPTY_DIARY);
    } catch { setStatus("Không xoá được nhật ký. Vui lòng thử lại."); }
    finally { setBusy(false); }
  }

  return (
    <div className="px-4 sm:px-6 pb-8">
      <style>{css}</style>
      <div ref={formTop} aria-hidden />
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
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || loading || !projectId || !date} onClick={autofill} title="Điền lại thiết bị (2.2) và công việc (mục 3) theo ngày đang chọn; không đổi thời tiết, nhân lực" className="h-10 rounded-lg border border-slate-300 px-4 font-semibold disabled:opacity-50">Tự điền lại</button>
            <button type="button" disabled={busy || loading || !projectId || !date} onClick={save} className="h-10 min-w-20 cursor-pointer rounded-lg bg-[#0047AB] px-5 font-semibold text-white transition-colors hover:bg-[#00388A] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Đang xử lý…" : "Lưu"}</button>
            <button type="button" disabled={busy || loading || !projectId || !date} onClick={() => setPreviewOpen(true)} className="h-10 cursor-pointer rounded-lg border border-slate-300 bg-white px-4 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">In / Lưu PDF</button>
          </div>
          <div className="flex basis-full flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
            <label className={lbl}>In từ ngày<input className={inp} type="date" value={range.from} max={range.to || undefined} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} /></label>
            <label className={lbl}>đến ngày<input className={inp} type="date" value={range.to} min={range.from || undefined} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} /></label>
            <button type="button" disabled={busy || !projectId || !range.from || !range.to} onClick={printRange} title="Ghép các nhật ký đã lưu trong khoảng ngày thành một bản in / một file PDF" className="h-10 cursor-pointer rounded-lg border border-[#0047AB]/40 bg-[#0047AB]/5 px-4 font-semibold text-[#0047AB] transition-colors hover:bg-[#0047AB]/10 disabled:cursor-not-allowed disabled:opacity-50">In nhiều ngày (ghép PDF)</button>
          </div>
          {status && <p role="status" className={`basis-full text-xs ${status.startsWith("Đã lưu.") ? "text-emerald-700" : "text-slate-600"}`}>{status}</p>}
          <p className="basis-full text-xs text-slate-500">Bản in theo biểu mẫu dự án phần B (NKTC). Khi in PDF, tắt “Headers and footers” / “Đầu trang và chân trang” trong hộp thoại in nếu trình duyệt vẫn hiện ngày giờ hoặc tên hệ thống.</p>
        </div>

        <fieldset disabled={loading || busy} className="grid gap-x-8 gap-y-5 py-5 lg:grid-cols-2">
          <Card title="1. Thời tiết">
            <div className="flex flex-wrap items-center gap-4 pt-1">
              {WEATHER_OPTIONS.map((opt) => (
                <label key={opt} className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                  <input
                    type="radio"
                    name="diary-weather"
                    checked={mark === opt}
                    onChange={() => setD((cur) => ({ ...cur, thoiTiet: opt }))}
                    className="size-4 accent-[#0047AB]"
                  />
                  {opt}
                </label>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <label className={lbl}>Nhiệt độ (°C) — trung bình sáng / chiều / tối<input className={inp} inputMode="decimal" value={averageDayTemperature(d.sang, d.chieu, d.toi) ?? d.nhietDo} onChange={set("nhietDo")} /></label>
              {(["sang", "chieu", "toi"] as const).map((k) => (
                <label key={k} className={lbl}>{{ sang: "Sáng", chieu: "Chiều", toi: "Tối" }[k]}<input className={inp} value={d[k]} onChange={set(k)} placeholder="Ví dụ: Nắng, 27°C" /></label>
              ))}
            </div>
            <p className="text-xs text-slate-500">Theo biểu mẫu: Bình thường / Mưa / Nắng + nhiệt độ; Sáng, Chiều, Tối ghi chi tiết. Tự điền từ Open-Meteo theo tọa độ dự án.</p>
          </Card>

          <Card title="2. Nhân lực, thiết bị thi công">
            <div className="grid items-end gap-3 sm:grid-cols-3">
              <label className={lbl}>Ban chỉ huy (người)<input className={inp} inputMode="numeric" value={d.banChiHuy} onChange={set("banChiHuy")} /></label>
              <label className={lbl}>Cán bộ kỹ thuật (người)<input className={inp} inputMode="numeric" value={d.canBoKyThuat} onChange={set("canBoKyThuat")} /></label>
              <label className={lbl}>Công nhân (người)<input className={inp} inputMode="numeric" value={d.congNhan} onChange={set("congNhan")} /></label>
            </div>
            <p className="text-xs text-slate-500">Ban chỉ huy = CHT. Cán bộ kỹ thuật = Kỹ sư. Công nhân = Lái máy + Thợ vận hành + Công nhân + Khác (bao gồm VNR).</p>
            {d.nhanLucNguon && <p className="text-xs text-slate-500">{d.nhanLucNguon}</p>}
            <label className={lbl}>2.2 Thiết bị<textarea className={inp} rows={3} value={d.thietBi} onChange={set("thietBi")} /></label>
          </Card>
        </fieldset>

        <fieldset disabled={loading || busy} className="grid gap-x-8 gap-y-5 py-5 lg:grid-cols-2">
          <Card title="3. Nội dung công việc thực hiện" wide>
            <textarea aria-label="Nội dung công việc thực hiện" className={inp} rows={6} value={d.noiDungCongViec} onChange={set("noiDungCongViec")} />
            <label className={lbl}>Nghiệm thu công việc xây dựng hàng ngày
              <span className="font-normal text-slate-500"> (in thành mục 3.2, dưới mục 3.1; lấy theo nghiệm thu đã chốt trong ngày, không có thì để trống)</span>
              <textarea aria-label="Nghiệm thu công việc xây dựng hàng ngày" className={inp} rows={4} value={d.nghiemThuHangNgay} onChange={set("nghiemThuHangNgay")} />
            </label>
          </Card>
          {TEXT_SECTIONS.map(([k, title, hint, rows]) => (
            <Card key={k} title={title} hint={hint || undefined} wide>
              <textarea aria-label={title} className={inp} rows={Math.max(rows, 3)} value={d[k]} onChange={set(k)} />
            </Card>
          ))}
          <Card title="Người ký cuối nhật ký" hint="Nhập một lần, phần mềm nhớ cho các lần sau; để trống thì bản in để trống." wide>
            <div className="grid gap-3 sm:grid-cols-3">
              {([["tvgs", "Tư vấn giám sát"], ["ntc", "Nhà thầu chính"], ["ntp", "Nhà thầu phụ"]] as const).map(([key, label]) => (
                <label key={key} className={lbl}>{label}<input className={inp} value={signers[key]} onBlur={persistSigners} onChange={(e) => setSigner(key, e.target.value)} placeholder="Họ và tên" /></label>
              ))}
            </div>
          </Card>
        </fieldset>

        <section className="pt-5">
          <h2 className="mb-2 text-sm font-bold text-slate-800">Nhật ký đã lưu <span className="font-mono text-xs font-semibold text-slate-500">{saved.length}</span></h2>
          {saved.length === 0 ? (
            <p className="rounded-lg border border-slate-200 px-4 py-6 text-center text-xs text-slate-500">Chưa có nhật ký nào được lưu.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[40rem] text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr><th className="px-3 py-2">Ngày</th><th className="px-3 py-2">Dự án</th><th className="px-3 py-2 text-right">BCH</th><th className="px-3 py-2 text-right">KT</th><th className="px-3 py-2 text-right">CN</th><th className="px-3 py-2">Công việc</th><th className="px-3 py-2 text-right">Thao tác</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {saved.map((row) => {
                    const active = row.projectId === projectId && row.date === date;
                    return (
                      <tr key={`${row.projectId}:${row.date}`} className={active ? "bg-blue-50/60" : "hover:bg-slate-50"}>
                        <td className="whitespace-nowrap px-3 py-2 font-mono font-semibold text-[#0047AB]">{row.date.split("-").reverse().join("/")}</td>
                        <td className="max-w-[16rem] truncate px-3 py-2">{projects.find((p) => p.id === row.projectId)?.name ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{row.diary.banChiHuy || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{row.diary.canBoKyThuat || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{row.diary.congNhan || "—"}</td>
                        <td className="max-w-[22rem] truncate px-3 py-2 text-slate-600">{row.diary.noiDungCongViec.split("\n")[0] || "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setViewRow(row)}
                              title="Xem nhanh nội dung nhật ký này"
                              className="h-8 rounded-md border border-slate-300 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              Xem
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => openSaved(row)}
                              title="Mở nhật ký này để sửa nội dung"
                              className="h-8 rounded-md border border-[#0047AB]/40 bg-[#0047AB]/5 px-2.5 font-semibold text-[#0047AB] hover:bg-[#0047AB]/10 disabled:opacity-50"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => printSaved(row)}
                              title="In nhật ký này"
                              className="h-8 rounded-md border border-slate-300 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              In
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void removeSaved(row)}
                              title="Xoá nhật ký này"
                              className="h-8 rounded-md border border-rose-200 bg-rose-50 px-2.5 font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                            >
                              Xoá
                            </button>
                            {active ? (
                              <span className="ml-0.5 rounded-md bg-[#0047AB] px-1.5 py-0.5 text-[10px] font-bold text-white">
                                Đang mở
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Đưa ra body để khung xem trước nằm trên header của ứng dụng (không bị che nút In). */}
      {createPortal(<>
      {previewOpen && (
        <div className="no-print fixed left-0 right-0 top-0 z-[1500] flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 bg-white px-4 py-3 shadow">
          <div>
            <p className="text-sm font-bold text-slate-900">{rangeRows
              ? `Xem trước bản in — ${rangeRows.length} nhật ký, từ ${rangeRows[0].date.split("-").reverse().join("/")} đến ${rangeRows[rangeRows.length - 1].date.split("-").reverse().join("/")}`
              : `Xem trước bản in — Nhật ký thi công ngày ${date.split("-").reverse().join("/")}`}</p>
            <p className="text-xs text-slate-500">Gõ tên người ký ngay dưới tên các bên ở cuối nhật ký (được nhớ cho lần sau), kiểm tra nội dung rồi bấm In / Lưu PDF. Khi in PDF, tắt “Headers and footers” (Đầu trang và chân trang) trong hộp thoại in.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={printDiary} className="h-10 rounded-lg bg-[#0047AB] px-5 text-sm font-semibold text-white">In / Lưu PDF</button>
            <button type="button" onClick={closePreview} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">Đóng</button>
          </div>
        </div>
      )}
      <article id="diary-print" className={previewOpen ? "diary-preview" : undefined}>
        {rangeRows
          ? rangeRows.map((row, i) => <DiaryPages key={`${row.projectId}:${row.date}`} d={row.diary} date={row.date} pageStart={i * 2 + 1} signers={{ tvgs: row.diary.kyTvgs ?? fallback.tvgs, ntc: row.diary.kyNtc ?? fallback.ntc, ntp: row.diary.kyNtp ?? fallback.ntp }} />)
          : <DiaryPages d={d} date={date} pageStart={1} signers={signers} editable={previewOpen} onSigner={setSigner} onSignerBlur={persistSigners} />}
      </article>
      </>, document.body)}
      {viewRow && (
        <DiaryViewModal
          row={viewRow}
          projectName={projects.find((p) => p.id === viewRow.projectId)?.name ?? "—"}
          signers={{ tvgs: viewRow.diary.kyTvgs ?? fallback.tvgs, ntc: viewRow.diary.kyNtc ?? fallback.ntc, ntp: viewRow.diary.kyNtp ?? fallback.ntp }}
          onClose={() => setViewRow(null)}
          onEdit={() => { const row = viewRow; setViewRow(null); openSaved(row); }}
          onPrint={() => { const row = viewRow; setViewRow(null); printSaved(row); }}
        />
      )}
    </div>
  );
}

/** Hai trang in của một nhật ký (dùng cho bản in một ngày và bản ghép nhiều ngày). */
function DiaryPages({ d, date, pageStart, signers, editable = false, onSigner, onSignerBlur }: {
  d: ConstructionDiary; date: string; pageStart: number; signers: { tvgs: string; ntc: string; ntp: string };
  editable?: boolean; onSigner?: (key: "tvgs" | "ntc" | "ntp", value: string) => void; onSignerBlur?: () => void;
}) {
  const fill1 = useRef<HTMLDivElement>(null), fill2 = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<[number, number]>([20, 14]); // số dòng chấm mục 3 ở trang 1 / trang 2, đo theo chỗ còn trống
  useLayoutEffect(() => {
    const measure = () => {
      const a = fill1.current?.clientHeight, b = fill2.current?.clientHeight;
      if (a == null || b == null) return;
      const next: [number, number] = [Math.max(0, Math.floor(a / LINE)), Math.max(0, Math.floor(b / LINE))];
      setLines((cur) => (cur[0] === next[0] && cur[1] === next[1] ? cur : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    for (const el of [fill1.current, fill2.current]) if (el) ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [y, m, day] = date.split("-");
  const mark = weatherMark(d.thoiTiet);
  const noAcceptance = (v: string) => !v.trim() || v.trim() === "Không có công tác nghiệm thu"; // không in dòng "không có" vô nghĩa
  // Dòng «Báo RFI số …» của bản cũ không thuộc nhật ký thi công.
  const workToday = d.noiDungCongViec.split("\n").filter((line) => !/^\s*-?\s*Báo RFI số/i.test(line)).join("\n").trim();
  const section3Print = [
    "3.1 Công việc thực hiện trong ngày",
    workToday,
    "3.2 Nghiệm thu công việc xây dựng hàng ngày",
    noAcceptance(d.nghiemThuHangNgay) ? "" : d.nghiemThuHangNgay.trim(),
  ].join("\n");
  return <>
        <section className="diary-sheet">
          <h2>B. TÌNH HÌNH THI CÔNG HÀNG NGÀY</h2>
          <p className="diary-date">Ngày {day || "……"} tháng {m || "……"} năm {y || "202…."}</p>

          <p className="diary-heading" style={{ marginTop: 0 }}>1. Thời tiết</p>
          <p className="diary-indent diary-check">
            Bình thường: <Check checked={mark === "Bình thường"} />&nbsp;&nbsp;&nbsp;&nbsp;
            Mưa <Check checked={mark === "Mưa"} />&nbsp;&nbsp;&nbsp;&nbsp;
            Nắng <Check checked={mark === "Nắng"} />&nbsp;&nbsp;&nbsp;&nbsp;
            Nhiệt độ : {(averageDayTemperature(d.sang, d.chieu, d.toi) ?? d.nhietDo) ? `${averageDayTemperature(d.sang, d.chieu, d.toi) ?? d.nhietDo} °C` : ".........."}
          </p>
          <p className="diary-indent">Sáng {d.sang || "…………."}&nbsp;&nbsp;&nbsp;&nbsp;Chiều {d.chieu || "……...."}&nbsp;&nbsp;&nbsp;&nbsp;Tối {d.toi || "………….."}</p>

          <p className="diary-heading">2. Tình hình nhân lực, thiết bị thi công:</p>
          <p className="diary-heading" style={{ marginTop: 0 }}>2.1 Nhân lực:</p>
          <p className="diary-indent">Ban chỉ huy: {d.banChiHuy || "………"}(người); Cán bộ kỹ thuật: {d.canBoKyThuat || ".........."}(người); Công nhân {d.congNhan || "..........."}(người)</p>
          <p className="diary-heading" style={{ marginTop: 0 }}>2.2 Thiết bị:</p>
          <Ruled text={d.thietBi} min={5} />

          <p className="diary-heading">3. Nội dung công việc thực hiện:</p>
          <div className="diary-fill" ref={fill1}>
            <div className="diary-ruled" style={{ height: lines[0] * LINE }}><div>{section3Print}</div></div>
          </div>
          <p className="diary-foot">Trang {pageStart}</p>
        </section>

        <section className="diary-sheet">
          <div className="diary-fill" ref={fill2}>
            <div className="diary-ruled" style={{ height: lines[1] * LINE }}><div style={{ marginTop: -lines[0] * LINE }}>{section3Print}</div></div>
          </div>

          {TEXT_SECTIONS.map(([k, title, hint, rows]) => (
            <div key={k}>
              <p className="diary-heading">{title}{hint ? <> <span className="diary-hint">{hint}</span></> : null}:</p>
              <Ruled text={d[k]} min={rows} />
            </div>
          ))}

          <div className="diary-sig-row">
            <div>TƯ VẤN GIÁM SÁT<div className="diary-sig-box" /><div className="diary-sig-name">{editable ? <input className="diary-sig-input" aria-label="Tên người ký tư vấn giám sát" placeholder="Gõ tên người ký" value={signers.tvgs} onBlur={onSignerBlur} onChange={(e) => onSigner?.("tvgs", e.target.value)} /> : signers.tvgs}</div></div>
            <div>NHÀ THẦU CHÍNH<div className="diary-sig-box" /><div className="diary-sig-name">{editable ? <input className="diary-sig-input" aria-label="Tên người ký nhà thầu chính" placeholder="Gõ tên người ký" value={signers.ntc} onBlur={onSignerBlur} onChange={(e) => onSigner?.("ntc", e.target.value)} /> : signers.ntc}</div></div>
            <div>NHÀ THẦU PHỤ<div className="diary-sig-box" /><div className="diary-sig-name">{editable ? <input className="diary-sig-input" aria-label="Tên người ký nhà thầu phụ" placeholder="Gõ tên người ký" value={signers.ntp} onBlur={onSignerBlur} onChange={(e) => onSigner?.("ntp", e.target.value)} /> : signers.ntp}</div></div>
          </div>
          <p className="diary-foot">Trang {pageStart + 1}</p>
        </section>
  </>;
}

function ViewBlock({ title, text }: { title: string; text: string }) {
  return (
    <section className="space-y-1">
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      <p className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">{text.trim() || "—"}</p>
    </section>
  );
}

/** Xem nhanh một nhật ký đã lưu: nội dung theo từng mục, đọc được ngay mà không phải nạp lên form. */
function DiaryViewModal({ row, projectName, signers, onClose, onEdit, onPrint }: {
  row: DiarySummary; projectName: string; signers: { tvgs: string; ntc: string; ntp: string };
  onClose: () => void; onEdit: () => void; onPrint: () => void;
}) {
  const dd = row.diary;
  const label = row.date.split("-").reverse().join("/");
  const temp = averageDayTemperature(dd.sang, dd.chieu, dd.toi) ?? dd.nhietDo;
  const work = dd.noiDungCongViec.split("\n").filter((line) => !/^\s*-?\s*Báo RFI số/i.test(line)).join("\n").trim();
  const accept = !dd.nghiemThuHangNgay.trim() || dd.nghiemThuHangNgay.trim() === "Không có công tác nghiệm thu" ? "" : dd.nghiemThuHangNgay.trim();
  return (
    <div role="dialog" aria-modal="true" aria-label={`Nhật ký thi công ngày ${label}`} className="no-print fixed inset-0 z-[1500] flex items-start justify-center overflow-auto bg-slate-900/60 p-3 sm:p-6" onClick={onClose}>
      <div className="w-full max-w-3xl space-y-4 rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">Nhật ký thi công ngày {label}</h2>
            <p className="text-xs text-slate-500">{projectName}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onEdit} className="h-9 rounded-lg border border-[#0047AB]/40 bg-[#0047AB]/5 px-3 text-sm font-semibold text-[#0047AB]">Sửa</button>
            <button type="button" onClick={onPrint} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">In</button>
            <button type="button" onClick={onClose} className="h-9 rounded-lg bg-[#0047AB] px-4 text-sm font-semibold text-white">Đóng</button>
          </div>
        </div>
        <ViewBlock title="1. Thời tiết" text={`${dd.thoiTiet || "—"} · Nhiệt độ ${temp ? `${temp} °C` : "—"}\nSáng: ${dd.sang || "—"} · Chiều: ${dd.chieu || "—"} · Tối: ${dd.toi || "—"}`} />
        <ViewBlock title="2.1 Nhân lực" text={`Ban chỉ huy: ${dd.banChiHuy || "—"} người · Cán bộ kỹ thuật: ${dd.canBoKyThuat || "—"} người · Công nhân: ${dd.congNhan || "—"} người`} />
        <ViewBlock title="2.2 Thiết bị" text={dd.thietBi} />
        <ViewBlock title="3.1 Công việc thực hiện trong ngày" text={work} />
        <ViewBlock title="3.2 Nghiệm thu công việc xây dựng hàng ngày" text={accept} />
        <ViewBlock title="4. Sự cố, hư hỏng, tai nạn lao động và vấn đề phát sinh" text={dd.suCo} />
        <ViewBlock title="5. Kiến nghị và ý kiến chỉ đạo" text={dd.kienNghi} />
        <ViewBlock title="6. Nhận xét của kỹ sư giám sát" text={dd.nhanXetGiamSat} />
        <ViewBlock title="7. Chỉ huy trưởng tiếp thu" text={dd.chtTiepThu} />
        <ViewBlock title="Người ký" text={`Tư vấn giám sát: ${signers.tvgs || "—"} · Nhà thầu chính: ${signers.ntc || "—"} · Nhà thầu phụ: ${signers.ntp || "—"}`} />
      </div>
    </div>
  );
}

function Check({ checked }: { checked: boolean }) {
  return <span aria-hidden="true">{checked ? "☑" : "☐"}</span>;
}

/** Văn bản đã nhập, hoặc các dòng chấm để điền tay khi để trống. */
function Ruled({ text, min }: { text: string; min: number }) {
  return <div className="diary-ruled" style={{ minHeight: min * LINE }}>{text.trim()}</div>;
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
