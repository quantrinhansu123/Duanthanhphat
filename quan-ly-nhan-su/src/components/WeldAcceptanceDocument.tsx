"use client";

import { useEffect, useState } from "react";
import { loadRecordSet, reviseRecord, type RecordSet, type RfiSummary, type RfiWeld } from "@/lib/weldQualityClient";
import WeldAcceptanceRecordPages, { acceptancePrintCss, type RecordKind } from "@/components/WeldAcceptanceRecordPages";
import { parseCoordinateCode } from "@/lib/weldCode";

export type DocKind = "rfi" | "hoan-thanh" | "phu-luc" | "giai-doan";

type View = { kind: DocKind; rfi?: { rfi: RfiSummary; welds: RfiWeld[]; projectName: string }; record?: RecordSet };

const TITLES: Record<DocKind, string> = {
  rfi: "PHIẾU YÊU CẦU NGHIỆM THU (RFI)",
  "phu-luc": "PHỤ LỤC BIÊN BẢN NGHIỆM THU MỐI HÀN",
  "giai-doan": "BIÊN BẢN NGHIỆM THU CÔNG VIỆC",
  "hoan-thanh": "BIÊN BẢN HOÀN THÀNH CÔNG VIỆC",
};
const css = `@media print {
  body * { visibility: hidden !important; }
  #weld-doc-print, #weld-doc-print * { visibility: visible !important; }
  #weld-doc-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0; background: #fff; }
  .weld-doc-actions { display: none !important; }
  #weld-doc-print table { page-break-inside: auto; } #weld-doc-print tr { page-break-inside: avoid; }
  #weld-doc-print thead { display: table-header-group; }
  @page { size: A4; margin: 15mm; }
}`;

const LOAI: Record<DocKind, string> = { rfi: "", "hoan-thanh": "Hoàn thành công việc", "phu-luc": "Phụ lục công việc", "giai-doan": "Giai đoạn xây dựng" };

const flagOn = (v: unknown) => v === true || v === "1" || v === "true";

export default function WeldAcceptanceDocument({ view, onClose, onEditRfi }: {
  view: View;
  onClose: () => void;
  /** Mở form sửa phiếu YCNT (chỉ khi xem RFI). */
  onEditRfi?: (rfi: RfiSummary) => void;
}) {
  const { kind } = view;
  const [record, setRecord] = useState(view.record);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ dia_diem: "", thanh_phan: "", ly_do: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hoSo = record?.ho_so.find((h) => h.loai === LOAI[kind]);
  const revisions = (record?.sua_doi ?? []).filter((r) => r.ho_so_id === hoSo?.id);
  const latest = revisions[revisions.length - 1];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function saveRevision() {
    if (!hoSo || !record) return;
    setBusy(true); setError("");
    try {
      await reviseRecord(hoSo.id, { dia_diem: form.dia_diem, thanh_phan: form.thanh_phan }, form.ly_do);
      setRecord(await loadRecordSet(String(record.dot.id)));
      setEditing(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Không lưu được bản sửa đổi."); } finally { setBusy(false); }
  }

  return (
    <div className={`${kind === "rfi" ? "" : "acceptance-print-root"} fixed inset-0 z-[100] overflow-auto bg-slate-900/70 p-3 sm:p-4`} role="dialog" aria-modal="true" aria-label={TITLES[kind]}>
      <style>{kind === "rfi" ? css : acceptancePrintCss}</style>
      <div className="weld-doc-actions sticky top-0 z-[110] mx-auto mb-3 flex max-w-3xl flex-wrap items-center justify-end gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
        {kind === "rfi" && view.rfi && onEditRfi ? (
          <button type="button" onClick={() => onEditRfi(view.rfi!.rfi)} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 cursor-pointer hover:bg-slate-50">
            Sửa phiếu
          </button>
        ) : null}
        {hoSo && (
          <button type="button" onClick={() => { setForm({ dia_diem: String(latest?.thong_tin.dia_diem ?? ((record?.dot.thong_tin as Record<string, string> | undefined)?.dia_diem ?? "")), thanh_phan: String(latest?.thong_tin.thanh_phan ?? ((record?.dot.thong_tin as Record<string, string> | undefined)?.thanh_phan ?? "")), ly_do: "" }); setEditing((v) => !v); }}
            className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 cursor-pointer hover:bg-slate-50">Sửa thông tin in</button>
        )}
        <button type="button" onClick={() => window.print()} className="h-10 rounded-lg bg-[#0047AB] px-5 text-sm font-semibold text-white cursor-pointer hover:bg-[#00388A]">In / Lưu PDF</button>
        <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-300 bg-slate-100 px-5 text-sm font-semibold text-slate-900 cursor-pointer hover:bg-slate-200">Thoát</button>
      </div>
      {editing && (
        <div className="weld-doc-actions mx-auto mb-3 max-w-3xl space-y-2 rounded-xl bg-white p-4 text-sm">
          <p className="text-xs text-slate-600">Chỉ sửa địa điểm và thành phần tham dự. Số đo và danh sách mối đã chốt không thay đổi; bản sửa đổi được lưu kèm lý do và người sửa.</p>
          <input className="h-9 w-full rounded-lg border border-slate-300 px-2" placeholder="Địa điểm" value={form.dia_diem} onChange={(e) => setForm({ ...form, dia_diem: e.target.value })} />
          <input className="h-9 w-full rounded-lg border border-slate-300 px-2" placeholder="Thành phần tham dự" value={form.thanh_phan} onChange={(e) => setForm({ ...form, thanh_phan: e.target.value })} />
          <input className="h-9 w-full rounded-lg border border-slate-300 px-2" placeholder="Lý do sửa đổi (bắt buộc)" value={form.ly_do} onChange={(e) => setForm({ ...form, ly_do: e.target.value })} />
          {error && <p role="alert" className="text-red-600">{error}</p>}
          <button type="button" disabled={busy || !form.ly_do.trim()} onClick={() => void saveRevision()} className="h-9 rounded-lg bg-[#0047AB] px-4 font-semibold text-white disabled:opacity-50 cursor-pointer">Lưu bản sửa đổi</button>
        </div>
      )}
      {kind === "rfi" && view.rfi ? <RfiForm {...view.rfi} /> : (
      record ? <WeldAcceptanceRecordPages record={record} kind={kind as RecordKind} /> : null)}
    </div>
  );
}

const PQ = {
  goiThau: "Gói thầu XL03: Cung cấp và thi công lắp đặt hệ thống ray", diaDiem: "Đặc khu Phú Quốc, Tỉnh An Giang", noiLap: "Phú Quốc",
  kinhGui: ["Ban Quản lý dự án - Công ty TNHH MTV BOT tàu điện Phú Quốc;", "Tư vấn giám sát – Công ty CP TVTK XDCT GT Miền Bắc (Tedi North)."],
};
const DOTS = "……………";

function RfiForm({ rfi, welds, projectName }: { rfi: RfiSummary; welds: RfiWeld[]; projectName: string }) {
  const t = rfi.thong_tin ?? {}, pq = /phú quốc/i.test(projectName) ? PQ : null;
  const monitoring = t.loai_rfi === "theo-doi";
  const [y, m, d] = rfi.ngay_moi.split("-");
  const km = welds.map((w) => w.ly_trinh).filter((v): v is string => !!v)
    .flatMap((v) => { const p = /(\d+)\+(\d+(?:\.\d+)?)/.exec(v); return p ? [{ v, n: Number(p[1]) * 1000 + Number(p[2]) }] : []; })
    .sort((a, b) => a.n - b.n);
  const kinhGui = t.ben_nhan ? [t.ben_nhan] : pq?.kinhGui ?? [DOTS];
  const routes = welds.map((w) => parseCoordinateCode(w.ma_diem ?? "")?.prefix);
  const autoUpper = routes.some((r) => r === "TT" || r === "TP");
  const autoLower = routes.some((r) => r === "HT" || r === "HP");
  const hasRouteOverride = "tuyen_thuong" in t || "tuyen_ha" in t;
  const upper = hasRouteOverride ? flagOn(t.tuyen_thuong) : autoUpper;
  const lower = hasRouteOverride ? flagOn(t.tuyen_ha) : autoLower;
  const missingRoutes = welds.filter((_, i) => !routes[i]);
  const chainage = (value?: string) => value ? `Km${value.replace(/^\s*km\s*/i, "")}` : `Km ${DOTS}`;
  const gio = (t.gio_bat_dau || "").trim();
  const [hh, mm] = gio.includes(":") ? gio.split(":") : ["", ""];
  return (
    <article id="weld-doc-print" className="mx-auto max-w-3xl bg-white p-10 text-[13px] leading-6 text-slate-900" style={{ fontFamily: "'Times New Roman', serif" }}>
      <div className="text-center font-bold">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM<br />Độc lập - Tự do - Hạnh phúc</div>
      <p className="mt-2 text-right italic">{pq?.noiLap ?? DOTS}, ngày {d ?? DOTS} tháng {m ?? DOTS} năm {y ?? DOTS}</p>
      <h2 className="mt-3 text-center text-lg font-bold">{monitoring ? "PHIẾU YÊU CẦU THEO DÕI CÔNG VIỆC HÀN (RFI)" : "PHIẾU YÊU CẦU NGHIỆM THU"}</h2>
      <p className="text-center">Số: {rfi.so_phieu}/{monitoring ? "RFI" : "YCNT"}</p>
      <dl className="mt-3 grid grid-cols-[6rem_1fr]">
        <dt>Dự án</dt><dd>: {projectName || DOTS}</dd>
        <dt>Gói thầu</dt><dd>: {pq?.goiThau ?? DOTS}</dd>
        <dt>Hạng mục</dt><dd>: Thi công hàn ray</dd>
        <dt>Địa điểm</dt><dd>: {t.dia_diem || pq?.diaDiem || DOTS}</dd>
      </dl>
      <div className="mt-2 flex gap-2"><b>Kính gửi:</b><div>{kinhGui.map((k) => <p key={k}>- {k}</p>)}</div></div>
      <p className="mt-3 font-bold">1. {monitoring ? "Công việc đề nghị theo dõi" : "Đối tượng nghiệm thu"}:</p>
      <p className="pl-4">- {monitoring ? "Theo dõi công việc thi công hàn ray" : "Nghiệm thu mối hàn chảy giáp mép - Hàn trên tuyến"}{t.pham_vi ? ` (${t.pham_vi})` : ""}</p>
      <p className="mt-2 font-bold">2. {monitoring ? "Phạm vi theo dõi" : "Vị trí nghiệm thu"}:</p>
      <p className="pl-4">- Tuyến: {upper ? "☑" : "☐"} Tuyến thượng &nbsp; {lower ? "☑" : "☐"} Tuyến hạ</p>
      {missingRoutes.length > 0 && !hasRouteOverride && <p className="pl-4">- Chưa xác định tuyến: {missingRoutes.map((w) => w.ma_lich_su).join(", ")}</p>}
      <p className="pl-4">- Lý trình: Từ {chainage(monitoring ? t.kmFrom : km[0]?.v)} đến {chainage(monitoring ? t.kmTo : km[km.length - 1]?.v)}</p>
      <p className="pl-4">- Tên mối hàn: {monitoring ? [t.nameFrom, t.nameTo].filter(Boolean).join(" – ") || DOTS : welds.map((w) => w.ma_lich_su).join(", ") || DOTS}</p>
      <p className="mt-2 font-bold">3. Thời gian {monitoring ? "theo dõi" : "nghiệm thu"}:</p>
      <p className="pl-4">Bắt đầu: {hh || "…. "}h{mm || "…"} ngày {d || "……"} tháng {m || "……"} năm {y || "……"}</p>
      {monitoring ? <>
        <p className="mt-2 font-bold">4. Nội dung đề nghị:</p>
        <p>Đề nghị Tư vấn giám sát đến công trường theo dõi công việc hàn trong phạm vi nêu trên vào ngày {d}/{m}/{y}.</p>
        <p>Phiếu theo dõi công việc hàn; kết quả kiểm tra và nghiệm thu được ghi nhận theo hồ sơ riêng.</p>
      </> : <>
      <p className="mt-2 font-bold">4. Đánh giá công việc:</p>
      <p>- Nhà thầu cam kết hạng mục trên đã đáp ứng yêu cầu chất lượng theo hồ sơ thiết kế, chỉ dẫn kỹ thuật, Hợp đồng thi công xây dựng và các tài liệu có liên quan khác.</p>
      <p>- Công việc chuẩn bị hồ sơ, thủ tục đã đầy đủ sẵn sàng để kiểm tra, nghiệm thu.</p>
      <p>- Đề nghị Tư vấn giám sát đến công trường kiểm tra, nghiệm thu để Nhà thầu triển khai các công việc tiếp theo.</p>
      </>}
      <div className="mt-4 grid grid-cols-2 gap-4 text-center">
        <div><b>NHÀ THẦU CHÍNH</b><div className="mt-12">Tên: {pq ? "Nguyễn Tất Đạt" : DOTS}<br />Chức vụ: Chỉ huy trưởng</div></div>
        <div><b>NHÀ THẦU PHỤ</b><div className="mt-12">Tên: {pq ? "Trần Công Tiến" : DOTS}<br />Chức vụ: Chỉ huy trưởng</div></div>
      </div>
      <div className="mt-6"><b>TƯ VẤN GIÁM SÁT</b>
        <p>Người nhận: {pq ? "Trần Văn Thanh" : DOTS} &nbsp; Chức vụ: Tư vấn giám sát trưởng</p>
        <p>Ngày nhận: ……/……../{y ?? "2026"} &nbsp; Chữ ký: ……………………………</p></div>
    </article>
  );
}
