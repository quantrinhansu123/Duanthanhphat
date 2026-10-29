"use client";

import { useState } from "react";
import { loadRecordSet, reviseRecord, type RecordSet, type RfiSummary, type RfiWeld } from "@/lib/weldQualityClient";

export type DocKind = "rfi" | "hoan-thanh" | "phu-luc" | "giai-doan";

type View = { kind: DocKind; rfi?: { rfi: RfiSummary; welds: RfiWeld[]; projectName: string }; record?: RecordSet };

const TITLES: Record<DocKind, string> = {
  rfi: "PHIẾU YÊU CẦU NGHIỆM THU (RFI)",
  "hoan-thanh": "PHIẾU NGHIỆM THU HOÀN THÀNH CÔNG VIỆC XÂY DỰNG",
  "phu-luc": "PHỤ LỤC NGHIỆM THU CÔNG VIỆC XÂY DỰNG",
  "giai-doan": "PHIẾU NGHIỆM THU GIAI ĐOẠN XÂY DỰNG",
};
const METHOD_TEXT = { FBW: "Hàn ray chảy giáp mép trên tuyến (FBW)", ATW: "Hàn nhiệt nhôm trên tuyến (ATW)" } as const;
// Chưa nhận mẫu chính thức: bản in dùng bố cục tạm và nói rõ trên giấy.
const TEMPLATE_VERSION = "Mẫu tạm v0 — chờ mẫu chính thức";

const css = `@media print {
  body * { visibility: hidden !important; }
  #weld-doc-print, #weld-doc-print * { visibility: visible !important; }
  #weld-doc-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0; background: #fff; }
  .weld-doc-actions { display: none !important; }
  #weld-doc-print table { page-break-inside: auto; } #weld-doc-print tr { page-break-inside: avoid; }
  #weld-doc-print thead { display: table-header-group; }
  @page { size: A4; margin: 15mm; }
}`;

type Row = { code: string; date: string; method: "FBW" | "ATW" | ""; result: string; note: string; km?: string; mapUrl?: string; coords?: string };

/** Link Google Maps dẫn thẳng tới vị trí mối ngoài hiện trường. */
const mapLink = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;

function recordRows(record: RecordSet): Row[] {
  return record.moi.map((m) => {
    const w = m.du_lieu_chot.moi_han ?? {};
    return { code: String(w.ma_lich_su ?? ""), date: String(w.ngay_thuc_hien ?? ""), method: (w.cong_nghe_han as "FBW" | "ATW") ?? "",
      result: m.ket_qua, note: m.ly_do ?? "" };
  }).sort((a, b) => a.code.localeCompare(b.code, "vi", { numeric: true }));
}

const LOAI: Record<DocKind, string> = { rfi: "", "hoan-thanh": "Hoàn thành công việc", "phu-luc": "Phụ lục công việc", "giai-doan": "Giai đoạn xây dựng" };

export default function WeldAcceptanceDocument({ view, onClose }: { view: View; onClose: () => void }) {
  const { kind } = view;
  const [record, setRecord] = useState(view.record);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ dia_diem: "", thanh_phan: "", ly_do: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hoSo = record?.ho_so.find((h) => h.loai === LOAI[kind]);
  const revisions = (record?.sua_doi ?? []).filter((r) => r.ho_so_id === hoSo?.id);
  const latest = revisions[revisions.length - 1];

  async function saveRevision() {
    if (!hoSo || !record) return;
    setBusy(true); setError("");
    try {
      await reviseRecord(hoSo.id, { dia_diem: form.dia_diem, thanh_phan: form.thanh_phan }, form.ly_do);
      setRecord(await loadRecordSet(String(record.dot.id)));
      setEditing(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Không lưu được bản sửa đổi."); } finally { setBusy(false); }
  }
  let projectName = "", headline: [string, string][] = [], rows: Row[] = [], counts: string | null = null;
  if (view.rfi) {
    const { rfi, welds } = view.rfi, t = rfi.thong_tin ?? {};
    projectName = view.rfi.projectName;
    headline = [["Số phiếu", rfi.so_phieu], ["Ngày mời nghiệm thu", rfi.ngay_moi], ["Địa điểm", t.dia_diem ?? ""], ["Bên mời", t.ben_moi ?? ""], ["Bên nhận", t.ben_nhan ?? ""], ["Phạm vi", t.pham_vi ?? ""], ["Người lập", rfi.nguoi_lap]];
    rows = welds.map((w) => ({ code: w.ma_lich_su, date: w.ngay_thuc_hien ?? "", method: "", result: "", note: "", km: w.ly_trinh ?? "",
      mapUrl: w.vi_do != null && w.kinh_do != null ? mapLink(w.vi_do, w.kinh_do) : "", coords: w.vi_do != null && w.kinh_do != null ? `${w.vi_do.toFixed(6)}, ${w.kinh_do.toFixed(6)}` : "" }));
  } else if (record) {
    const { dot } = record, rfi = dot.phieu_yeu_cau_nghiem_thu, t = { ...((dot.thong_tin ?? {}) as Record<string, string>), ...(latest?.thong_tin ?? {}) };
    projectName = String(rfi.du_an?.du_an ?? rfi.du_an?.ten_du_an ?? rfi.du_an?.name ?? "");
    const all = recordRows(record);
    rows = kind === "giai-doan" ? [] : all.filter((r) => r.result === "Đạt");
    counts = `Tổng ${all.length} mối trong RFI ${rfi.so_phieu}: chấp nhận ${all.filter((r) => r.result === "Đạt").length}, không đạt ${all.filter((r) => r.result === "Không đạt").length}, chưa nghiệm thu ${all.filter((r) => r.result === "Chưa nghiệm thu").length}.`;
    headline = [["Số RFI", String(rfi.so_phieu)], ["Ngày nghiệm thu", String(dot.ngay_nghiem_thu)], ["Địa điểm", t.dia_diem ?? ""], ["Thành phần tham dự", t.thanh_phan ?? ""], ["Người lập", String(dot.nguoi_lap)]];
  }
  const methods = [...new Set(rows.map((r) => r.method).filter(Boolean))] as ("FBW" | "ATW")[];
  const signed = hoSo?.tinh_trang_ky;

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-slate-900/60 p-4">
      <style>{css}</style>
      <div className="weld-doc-actions mx-auto mb-3 flex max-w-3xl justify-end gap-2">
        {hoSo && (
          <button type="button" onClick={() => { setForm({ dia_diem: String(latest?.thong_tin.dia_diem ?? ((record?.dot.thong_tin as Record<string, string> | undefined)?.dia_diem ?? "")), thanh_phan: String(latest?.thong_tin.thanh_phan ?? ((record?.dot.thong_tin as Record<string, string> | undefined)?.thanh_phan ?? "")), ly_do: "" }); setEditing((v) => !v); }}
            className="h-9 rounded-lg bg-white px-4 text-sm font-semibold cursor-pointer">Sửa thông tin in</button>
        )}
        <button type="button" onClick={() => window.print()} className="h-9 rounded-lg bg-[#0047AB] px-4 text-sm font-semibold text-white cursor-pointer">In / Lưu PDF</button>
        <button type="button" onClick={onClose} className="h-9 rounded-lg bg-white px-4 text-sm font-semibold cursor-pointer">Đóng</button>
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
      <article id="weld-doc-print" className="mx-auto max-w-3xl bg-white p-8 text-sm text-slate-900">
        <div className="text-center font-bold uppercase text-xs">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br /><span className="underline normal-case">Độc lập - Tự do - Hạnh phúc</span></div>
        <h2 className="mt-4 text-center text-base font-extrabold">{TITLES[kind]}</h2>
        <p className="mt-2 text-center">Dự án: <b>{projectName}</b></p>
        {methods.length > 0 && <p className="text-center">Công việc: {methods.map((m) => METHOD_TEXT[m]).join("; ")}</p>}
        <dl className="mt-4 grid grid-cols-[10rem_1fr] gap-y-1">
          {headline.map(([k, v]) => <div key={k} className="contents"><dt className="font-semibold">{k}:</dt><dd>{v || "………………"}</dd></div>)}
        </dl>
        {counts && <p className="mt-3">{counts}</p>}
        {rows.length > 0 && (
          <table className="mt-3 w-full border-collapse text-xs">
            <thead><tr>{["STT", "Mã mối hàn", ...(kind === "rfi" ? ["Ngày hàn", "Lý trình", "Vị trí hiện trường"] : ["Ngày hàn", "Kết quả"])].map((h) => <th key={h} className="border border-slate-700 p-1">{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={r.code + i}><td className="border border-slate-700 p-1 text-center">{i + 1}</td><td className="border border-slate-700 p-1">{r.code}</td>
                {kind === "rfi" ? (
                  <>
                    <td className="border border-slate-700 p-1 text-center">{r.date || "—"}</td>
                    <td className="border border-slate-700 p-1 text-center">{r.km || "—"}</td>
                    <td className="border border-slate-700 p-1">
                      {r.mapUrl ? <><a href={r.mapUrl} target="_blank" rel="noreferrer" className="text-[#0047AB] underline">Mở vị trí mối</a><div className="text-[9px] text-slate-500">{r.coords}</div></> : "Chưa có toạ độ"}
                    </td>
                  </>
                ) : <><td className="border border-slate-700 p-1 text-center">{r.date}</td><td className="border border-slate-700 p-1 text-center">{r.result}</td></>}</tr>))}
            </tbody>
          </table>)}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          {["Đại diện nhà thầu", "Tư vấn giám sát", "Chủ đầu tư"].map((s) => <div key={s}><b>{s}</b><div className="mt-14 text-slate-400">(ký, ghi rõ họ tên)</div></div>)}
        </div>
        <p className="mt-6 text-[10px] text-slate-500">{TEMPLATE_VERSION}. {latest ? `Bản sửa đổi lần ${latest.phien_ban} (${latest.created_at.slice(0, 10)}, ${latest.nguoi_sua}): ${latest.ly_do}. ` : ""}{signed ? `Tình trạng ký: ${signed}.` : ""} Nội dung lấy từ dữ liệu chốt tại thời điểm phát hành.</p>
      </article>)}
    </div>
  );
}

// Mặc định theo mẫu "Phiếu YCNT công việc" của dự án Phú Quốc; dự án khác để trống cho điền tay.
const PQ = {
  goiThau: "Gói thầu XL03: Cung cấp và thi công lắp đặt hệ thống ray", diaDiem: "Đặc khu Phú Quốc, Tỉnh An Giang", noiLap: "Phú Quốc",
  kinhGui: ["Ban Quản lý dự án - Công ty TNHH MTV BOT tàu điện Phú Quốc;", "Tư vấn giám sát – Công ty CP TVTK XDCT GT Miền Bắc (Tedi North)."],
};
const DOTS = "……………";

function RfiForm({ rfi, welds, projectName }: { rfi: RfiSummary; welds: RfiWeld[]; projectName: string }) {
  const t = rfi.thong_tin ?? {}, pq = /phú quốc/i.test(projectName) ? PQ : null;
  const [y, m, d] = rfi.ngay_moi.split("-");
  const km = welds.map((w) => w.ly_trinh).filter((v): v is string => !!v)
    .flatMap((v) => { const p = /(\d+)\+(\d+(?:\.\d+)?)/.exec(v); return p ? [{ v, n: Number(p[1]) * 1000 + Number(p[2]) }] : []; })
    .sort((a, b) => a.n - b.n);
  const kinhGui = t.ben_nhan ? [t.ben_nhan] : pq?.kinhGui ?? [DOTS];
  return (
    <article id="weld-doc-print" className="mx-auto max-w-3xl bg-white p-10 text-[13px] leading-6 text-slate-900" style={{ fontFamily: "'Times New Roman', serif" }}>
      <div className="text-center font-bold">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM<br />Độc lập - Tự do - Hạnh phúc</div>
      <p className="mt-2 text-right italic">{pq?.noiLap ?? DOTS}, ngày {d ?? DOTS} tháng {m ?? DOTS} năm {y ?? DOTS}</p>
      <h2 className="mt-3 text-center text-lg font-bold">PHIẾU YÊU CẦU NGHIỆM THU</h2>
      <p className="text-center">Số: {rfi.so_phieu}/YCNT</p>
      <dl className="mt-3 grid grid-cols-[6rem_1fr]">
        <dt>Dự án</dt><dd>: {projectName || DOTS}</dd>
        <dt>Gói thầu</dt><dd>: {pq?.goiThau ?? DOTS}</dd>
        <dt>Hạng mục</dt><dd>: Thi công hàn ray</dd>
        <dt>Địa điểm</dt><dd>: {t.dia_diem || pq?.diaDiem || DOTS}</dd>
      </dl>
      <div className="mt-2 flex gap-2"><b>Kính gửi:</b><div>{kinhGui.map((k) => <p key={k}>- {k}</p>)}</div></div>
      <p className="mt-3 font-bold">1. Đối tượng nghiệm thu:</p>
      <p className="pl-4">- Nghiệm thu mối hàn chảy giáp mép - Hàn trên tuyến{t.pham_vi ? ` (${t.pham_vi})` : ""}</p>
      <p className="mt-2 font-bold">2. Vị trí nghiệm thu:</p>
      <p className="pl-4">- Tuyến: ❐ Tuyến thượng &nbsp; ❐ Tuyến hạ</p>
      <p className="pl-4">- Lý trình: Từ Km {km[0]?.v ?? DOTS} đến Km {km.length ? km[km.length - 1].v : DOTS}</p>
      <p className="pl-4">- Tên mối hàn: {welds.map((w) => w.ma_lich_su).join(", ") || DOTS}</p>
      <p className="mt-2 font-bold">3. Thời gian nghiệm thu:</p>
      <p className="pl-4">Bắt đầu: ….h… ngày …… tháng …… năm ……</p>
      <p className="mt-2 font-bold">4. Đánh giá công việc:</p>
      <p>- Nhà thầu cam kết hạng mục trên đã đáp ứng yêu cầu chất lượng theo hồ sơ thiết kế, chỉ dẫn kỹ thuật, Hợp đồng thi công xây dựng và các tài liệu có liên quan khác.</p>
      <p>- Công việc chuẩn bị hồ sơ, thủ tục đã đầy đủ sẵn sàng để kiểm tra, nghiệm thu.</p>
      <p>- Đề nghị Tư vấn giám sát đến công trường kiểm tra, nghiệm thu để Nhà thầu triển khai các công việc tiếp theo.</p>
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
