"use client";

import { useEffect, useState } from "react";
import { loadProjects } from "@/lib/projectsDb";
import { EMPTY_DIARY, loadDiary, saveDiary, type ConstructionDiary } from "@/lib/constructionDiaryDb";
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
const css = `@media screen { #diary-print { display: none; } }
@media print {
  body * { visibility: hidden !important; }
  #diary-print, #diary-print * { visibility: visible !important; }
  html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
  body *:has(#diary-print) { position: static !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
  aside, header, .no-print { display: none !important; }
  #diary-print {
    position: absolute; left: 0; top: 0; width: 100%;
    font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 18pt; color: black;
  }
  #diary-print h2 { margin: 0 0 4pt; font-size: 13pt; line-height: 20pt; text-align: center; font-weight: bold; }
  #diary-print .diary-date { text-align: center; margin: 0 0 8pt; }
  #diary-print p { margin: 0; }
  #diary-print .whitespace-pre-wrap { white-space: pre-wrap; overflow-wrap: anywhere; }
  #diary-print .diary-heading { margin-top: 8pt; font-weight: bold; }
  #diary-print .diary-heading .diary-hint { font-weight: normal; font-style: italic; }
  #diary-print .diary-section { break-inside: avoid; }
  #diary-print .diary-dots { height: 18pt; border-bottom: 1px dotted black; }
  #diary-print .diary-check { font-family: 'Times New Roman', Times, serif; }
  #diary-print .diary-sig-row { display: grid; grid-template-columns: 1fr 1fr; text-align: center; font-weight: bold; margin-top: 28pt; break-inside: avoid; }
  #diary-print .diary-sig-sub { text-align: center; font-weight: bold; margin-top: 28pt; break-inside: avoid; }
  #diary-print .diary-sig-hint { font-weight: normal; font-style: italic; margin-top: 2pt; }
  #diary-print .diary-page { text-align: right; margin-top: 18pt; font-size: 10pt; }
  @page { size: A4 portrait; margin: 15mm 18mm 18mm 18mm; }
}`;

const TEXT_SECTIONS = [
  ["suCo", "4. Mô tả chi tiết các sự cố, hư hỏng, tai nạn lao động và các vấn đề phát sinh khác trong quá trình thi công xây dựng công trình", "", 3],
  ["kienNghi", "5. Các kiến nghị và những ý kiến chỉ đạo giải quyết các vấn đề phát sinh của các bên có liên quan", "(Chủ đầu tư, Người giám sát thi công, Người giám sát tác giả, ghi rõ họ và tên, chức vụ và chữ ký)", 2],
  ["nhanXetGiamSat", "6. Nhận xét của kỹ sư giám sát thi công xây dựng về tình hình và chất lượng công việc xây dựng", "(ghi rõ họ và tên, chức vụ và chữ ký)", 2],
  ["chtTiepThu", "7. Chỉ huy trưởng công trường tiếp thu các kiến nghị và nhận xét", "(họ tên, chữ ký)", 2],
] as const satisfies readonly (readonly [keyof ConstructionDiary, string, string, number])[];

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
  const [y, m, day] = date.split("-");
  const mark = weatherMark(d.thoiTiet);

  /** Nội dung mục 3 khi in: gộp công việc + nghiệm thu hàng ngày (biểu mẫu không có mục 3.2 riêng). */
  const section3Print = [d.noiDungCongViec.trim(), d.nghiemThuHangNgay.trim() ? `Nghiệm thu công việc xây dựng hàng ngày:\n${d.nghiemThuHangNgay.trim()}` : ""]
    .filter(Boolean).join("\n\n");

  async function autofill() {
    setBusy(true);
    try {
      const defaults = await loadDefaults(projectId, date);
      setD((cur) => ({ ...cur, ...defaults.values }));
      setStatus(defaults.warning || "Đã tự điền thời tiết, nhân lực, thiết bị và mục 3. Có thể sửa nội dung rồi bấm Lưu.");
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

  function printDiary() {
    const previous = document.title;
    // Tránh header trình duyệt in tên hệ thống / thời gian nổi bật trên biểu mẫu.
    document.title = " ";
    const restore = () => { document.title = previous; };
    window.addEventListener("afterprint", restore, { once: true });
    window.print();
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
            <button type="button" disabled={busy || loading || !projectId || !date} onClick={autofill} title="Điền lại thời tiết, nhân lực, thiết bị dự án và công việc theo ngày đang chọn" className="h-10 rounded-lg border border-slate-300 px-4 font-semibold disabled:opacity-50">Tự điền lại</button>
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
      </div>

      <article id="diary-print">
        <h2>B. TÌNH HÌNH THI CÔNG HÀNG NGÀY</h2>
        <p className="diary-date">Ngày {day || "……"} tháng {m || "……"} năm {y || "……"}</p>

        <p className="diary-heading">1. Thời tiết:</p>
        <p className="diary-check">
          <Check checked={mark === "Bình thường"} /> Bình thường&nbsp;&nbsp;&nbsp;
          <Check checked={mark === "Mưa"} /> Mưa&nbsp;&nbsp;&nbsp;
          <Check checked={mark === "Nắng"} /> Nắng
          &nbsp;&nbsp;&nbsp;&nbsp;Nhiệt độ: {d.nhietDo || "……"} °C
        </p>
        <p>Sáng: {d.sang || "………………"}&nbsp;&nbsp;&nbsp;Chiều: {d.chieu || "………………"}&nbsp;&nbsp;&nbsp;Tối: {d.toi || "………………"}</p>

        <p className="diary-heading">2. Tình hình nhân lực, thiết bị thi công:</p>
        <p>2.1 Nhân lực: Ban chỉ huy: {d.banChiHuy || "……"} (người); Cán bộ kỹ thuật: {d.canBoKyThuat || "……"} (người); Công nhân: {d.congNhan || "……"} (người)</p>
        <p>2.2 Thiết bị:</p>
        <Block text={d.thietBi} min={3} />

        <div className="diary-section">
          <p className="diary-heading">3. Nội dung công việc thực hiện:</p>
          <Block text={section3Print} min={6} />
        </div>

        {TEXT_SECTIONS.map(([k, title, hint, rows]) => (
          <div key={k} className="diary-section">
            <p className="diary-heading">{title}{hint ? <> <span className="diary-hint">{hint}</span></> : null}:</p>
            <Block text={d[k]} min={rows} />
          </div>
        ))}

        <div className="diary-sig-row">
          <div>TƯ VẤN GIÁM SÁT<div className="diary-sig-hint">(Ký, ghi rõ họ tên)</div></div>
          <div>NHÀ THẦU CHÍNH<div className="diary-sig-hint">(Ký, ghi rõ họ tên)</div></div>
        </div>
        <div className="diary-sig-sub">
          NHÀ THẦU PHỤ
          <div className="diary-sig-hint">(Ký, ghi rõ họ tên)</div>
        </div>
        <p className="diary-page">Trang ……</p>
      </article>
    </div>
  );
}

function Check({ checked }: { checked: boolean }) {
  return <span aria-hidden="true">{checked ? "☑" : "☐"}</span>;
}

/** Văn bản đã nhập, hoặc các dòng chấm để điền tay khi để trống. */
function Block({ text, min }: { text: string; min: number }) {
  if (text.trim()) return <p className="whitespace-pre-wrap">{text}</p>;
  return <>{Array.from({ length: min }, (_, i) => <p key={i} className="diary-dots" aria-hidden="true">&nbsp;</p>)}</>;
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
