"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { loadProjects } from "@/lib/projectsDb";
import { EMPTY_DIARY, deleteDiary, listDiaries, loadDiary, saveDiary, type ConstructionDiary, type DiarySummary } from "@/lib/constructionDiaryDb";
import { loadReportWeather, qualityRequest } from "@/lib/weldQualityClient";

type DiaryDefaults = Pick<ConstructionDiary, "noiDungCongViec" | "nghiemThuHangNgay" | "thietBi" | "banChiHuy" | "canBoKyThuat" | "congNhan" | "nhanLucNguon">;
async function loadDefaults(projectId: string, date: string) {
  const [work, weather] = await Promise.allSettled([
    qualityRequest<DiaryDefaults>({ action: "diary-defaults", du_an_id: projectId, date }),
    loadReportWeather(projectId, date),
  ]);
  return {
    values: { ...(work.status === "fulfilled" ? work.value : {}), ...(weather.status === "fulfilled" ? weather.value : {}) },
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
#diary-print { width: 210mm; font-family: 'Times New Roman', Times, serif; font-size: 13pt; line-height: 15pt; color: black; }
#diary-print p { margin: 0; }
#diary-print h2 { margin: 0 0 6pt; font-size: 13.5pt; line-height: 18pt; text-align: center; font-weight: bold; }
#diary-print .diary-sheet { width: 210mm; height: 296mm; box-sizing: border-box; padding: 16mm 15mm 18mm 20mm; display: flex; flex-direction: column; position: relative; overflow: hidden; break-after: page; page-break-after: always; }
#diary-print .diary-sheet:last-child { break-after: auto; page-break-after: auto; }
#diary-print .diary-foot { position: absolute; right: 15mm; bottom: 9mm; font-size: 11pt; }
#diary-print .diary-date { text-align: right; margin: 0 0 6pt; }
#diary-print .diary-heading { margin-top: 6pt; font-weight: bold; }
#diary-print .diary-heading .diary-hint { font-weight: normal; font-style: italic; }
#diary-print .diary-indent { padding-left: 10mm; }
#diary-print .diary-check { font-family: 'Times New Roman', Times, serif; }
#diary-print .diary-ruled { line-height: ${LINE}px; background-image: ${DOT}; background-size: 3px ${LINE}px; white-space: pre-wrap; overflow-wrap: anywhere; overflow: hidden; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
#diary-print .diary-fill { flex: 1 1 0; min-height: 0; overflow: hidden; }
#diary-print .diary-sig-row { display: grid; grid-template-columns: 1fr 1fr 1fr; text-align: center; font-weight: bold; margin-top: 8pt; break-inside: avoid; }
#diary-print .diary-sig-hint { font-weight: normal; font-style: italic; margin-top: 2pt; }
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

  const set = (k: keyof ConstructionDiary) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD((cur) => ({ ...cur, [k]: e.target.value }));
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

  /**
   * Số trang nhật ký: bắt đầu 5–6 cho ngày đầu dự án, mỗi ngày thi công dùng 2 trang,
   * luỹ tiến 7–8, 9–10… Không có ngày bắt đầu dự án thì để trống (điền tay).
   */
  const [pageStart, pageEnd] = (() => {
    const project = projects.find((p) => p.id === projectId);
    const start = project?.startDate?.slice(0, 10);
    if (!start || !date) return ["……", "……"];
    const startMs = Date.parse(`${start}T00:00:00`);
    const curMs = Date.parse(`${date}T00:00:00`);
    if (!Number.isFinite(startMs) || !Number.isFinite(curMs)) return ["……", "……"];
    const days = Math.max(0, Math.round((curMs - startMs) / 86400000));
    const first = 5 + days * 2;
    return [String(first), String(first + 1)];
  })();

  /** Nội dung mục 3 khi in: gộp công việc + nghiệm thu hàng ngày (biểu mẫu không có mục 3.2 riêng). */
  const noAcceptance = (v: string) => !v.trim() || v.trim() === "Không có công tác nghiệm thu"; // không in dòng "không có" vô nghĩa
  const section3Print = [noAcceptance(d.noiDungCongViec) ? "" : d.noiDungCongViec.trim(), noAcceptance(d.nghiemThuHangNgay) ? "" : `Nghiệm thu công việc xây dựng hàng ngày:\n${d.nghiemThuHangNgay.trim()}`]
    .filter(Boolean).join("\n\n");

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
      const r = await saveDiary(projectId, date, d);
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

  /** Mở một nhật ký đã lưu vào form (dùng cho nút Xem / Sửa). */
  function openSaved(row: DiarySummary) {
    setProjectId(row.projectId);
    setDate(row.date);
    setD(row.diary);
    setStatus(`Đang mở nhật ký ngày ${row.date.split("-").reverse().join("/")}.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** In riêng một nhật ký đã lưu: nạp vào form rồi mở hộp thoại in. */
  function printSaved(row: DiarySummary) {
    setProjectId(row.projectId);
    setDate(row.date);
    setD(row.diary);
    // Chờ React render xong nội dung #diary-print rồi mới in.
    window.setTimeout(printDiary, 120);
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
            <button type="button" disabled={busy || loading || !projectId || !date} onClick={printDiary} className="h-10 cursor-pointer rounded-lg border border-slate-300 bg-white px-4 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">In / Lưu PDF</button>
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
              <label className={lbl}>Nhiệt độ (°C)<input className={inp} inputMode="decimal" value={d.nhietDo} onChange={set("nhietDo")} /></label>
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
              <span className="font-normal text-slate-500"> (gộp vào mục 3 khi in — biểu mẫu dự án không có mục 3.2 riêng)</span>
              <textarea aria-label="Nghiệm thu công việc xây dựng hàng ngày" className={inp} rows={4} value={d.nghiemThuHangNgay} onChange={set("nghiemThuHangNgay")} />
            </label>
          </Card>
          {TEXT_SECTIONS.map(([k, title, hint, rows]) => (
            <Card key={k} title={title} hint={hint || undefined} wide>
              <textarea aria-label={title} className={inp} rows={Math.max(rows, 3)} value={d[k]} onChange={set(k)} />
            </Card>
          ))}
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
                              onClick={() => openSaved(row)}
                              title="Mở nhật ký này để xem"
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

      <article id="diary-print">
        <section className="diary-sheet">
          <h2>B. TÌNH HÌNH THI CÔNG HÀNG NGÀY</h2>
          <p className="diary-date">Ngày {day || "……"} tháng {m || "……"} năm {y || "202…."}</p>

          <p className="diary-heading" style={{ marginTop: 0 }}>1. Thời tiết</p>
          <p className="diary-indent diary-check">
            Bình thường: <Check checked={mark === "Bình thường"} />&nbsp;&nbsp;&nbsp;&nbsp;
            Mưa <Check checked={mark === "Mưa"} />&nbsp;&nbsp;&nbsp;&nbsp;
            Nắng <Check checked={mark === "Nắng"} />&nbsp;&nbsp;&nbsp;&nbsp;
            Nhiệt độ : {d.nhietDo ? `${d.nhietDo} °C` : ".........."}
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
            <div>TƯ VẤN GIÁM SÁT<div className="diary-sig-hint">(Ký, ghi rõ họ tên)</div><div className="diary-sig-box" /></div>
            <div>NHÀ THẦU CHÍNH<div className="diary-sig-hint">(Ký, ghi rõ họ tên)</div><div className="diary-sig-box" /></div>
            <div>NHÀ THẦU PHỤ<div className="diary-sig-hint">(Ký, ghi rõ họ tên)</div><div className="diary-sig-box" /></div>
          </div>
          <p className="diary-foot">Trang {pageEnd}</p>
        </section>
      </article>
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
