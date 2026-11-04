"use client";

import { useEffect, useState } from "react";
import { loadRecordSet, reviseRecord, type RecordSet, type RfiSummary, type RfiWeld } from "@/lib/weldQualityClient";
import WeldAcceptanceRecordPages, { acceptancePrintCss, type RecordKind } from "@/components/WeldAcceptanceRecordPages";
import { parseCoordinateCode } from "@/lib/weldCode";
import { loadRfiSignatures, saveRfiSignature, uploadSignatureImage, type SignatureKey, type SignatureStore } from "@/lib/rfiSignatures";

export type DocKind = "rfi" | "hoan-thanh" | "phu-luc" | "giai-doan";

type View = { kind: DocKind; rfi?: { rfi: RfiSummary; welds: RfiWeld[]; projectName: string }; record?: RecordSet };

const TITLES: Record<DocKind, string> = {
  rfi: "PHIẾU YÊU CẦU NGHIỆM THU (RFI)",
  "phu-luc": "BIÊN BẢN NGHIỆM THU MỐI HÀN CHẢY GIÁP MÉP",
  "giai-doan": "BIÊN BẢN NGHIỆM THU CÔNG VIỆC XÂY DỰNG",
  "hoan-thanh": "BIÊN BẢN NGHIỆM THU HOÀN THÀNH GIAI ĐOẠN THI CÔNG",
};
const css = `@media print {
  body * { visibility: hidden !important; }
  #weld-doc-print, #weld-doc-print * { visibility: visible !important; }
  #weld-doc-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0; background: #fff; }
  .weld-doc-actions { display: none !important; }
  #weld-doc-print table { page-break-inside: auto; } #weld-doc-print tr { page-break-inside: avoid; }
  #weld-doc-print thead { display: table-header-group; }
  /* Phiếu YCNT 1 trang: lề trang = 0 để trình duyệt tự bỏ đầu trang / cuối trang (ngày giờ, tiêu đề); lề thật đặt bằng padding. */
  @page { size: A4; margin: 0; }
  #weld-doc-print { box-sizing: border-box; padding: 15mm 15mm 15mm 20mm !important; max-width: none !important; }
}`;

const LOAI: Record<DocKind, string> = { rfi: "", "hoan-thanh": "Hoàn thành công việc", "phu-luc": "Phụ lục công việc", "giai-doan": "Giai đoạn xây dựng" };

/** Mục 5 (a–g) của BB nghiệm thu hoàn thành: nhập tay, lưu qua bản sửa đổi thông tin in. */
const FREE_TEXT_FIELDS: [string, string][] = [
  ["tai_lieu_can_cu", "a) Các tài liệu căn cứ nghiệm thu"],
  ["danh_gia_chat_luong", "b) Đánh giá chất lượng công trình so với thiết kế được phê duyệt"],
  ["dieu_chinh", "c) Những điều chỉnh, thay đổi bổ sung trong quá trình thi công"],
  ["so_voi_thiet_ke", "d) Chất lượng hạng mục — so với thiết kế, chỉ dẫn kỹ thuật"],
  ["so_voi_hop_dong", "d) Chất lượng hạng mục — so với hợp đồng"],
  ["ket_qua_thi_nghiem", "e) Kết quả thí nghiệm, kiểm tra, kiểm định, chạy thử"],
  ["tuan_thu_phccc", "f) Tuân thủ quy định phòng cháy chữa cháy, bảo vệ môi trường"],
  ["y_kien_khac", "g) Các ý kiến khác (nếu có)"],
];

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
  const [form, setForm] = useState<Record<string, string>>({ dia_diem: "", thanh_phan: "", ly_do: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [signatures, setSignatures] = useState<SignatureStore>({});
  const [sigOpen, setSigOpen] = useState(false);
  const [sigError, setSigError] = useState("");
  const [sigLoadError, setSigLoadError] = useState("");
  const [sigLinks, setSigLinks] = useState<Partial<Record<SignatureKey, string>>>({});

  async function changeSignatureLink(key: SignatureKey, url: string) {
    setSigError(""); setBusy(true);
    try {
      setSignatures(await saveRfiSignature(key, url));
      setSigLinks((cur) => ({ ...cur, [key]: "" }));
    } catch (e) { setSigError(e instanceof Error ? e.message : "Không lưu được link."); } finally { setBusy(false); }
  }
  const hoSo = record?.ho_so.find((h) => h.loai === LOAI[kind]);
  const revisions = (record?.sua_doi ?? []).filter((r) => r.ho_so_id === hoSo?.id);
  const latest = revisions[revisions.length - 1];

  useEffect(() => {
    if (kind === "rfi") loadRfiSignatures().then((v) => { setSignatures(v); setSigLoadError(""); }).catch((e) => setSigLoadError(e instanceof Error ? e.message : "Không tải được chữ ký"));
  }, [kind]);

  async function changeSignature(key: SignatureKey, file: File | null) {
    setSigError(""); setBusy(true);
    try {
      setSignatures(await saveRfiSignature(key, file ? await uploadSignatureImage(file) : null));
    } catch (e) { setSigError(e instanceof Error ? e.message : "Không lưu được chữ ký."); } finally { setBusy(false); }
  }

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
      const { ly_do, ...thongTin } = form;
      await reviseRecord(hoSo.id, thongTin, ly_do.trim() || "Cập nhật nội dung nhập tay");
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
        {kind === "rfi" ? (
          <button type="button" onClick={() => setSigOpen((v) => !v)} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 cursor-pointer hover:bg-slate-50">Chữ ký</button>
        ) : null}
        {hoSo && (
          <button type="button" onClick={() => { setForm({ dia_diem: String(latest?.thong_tin.dia_diem ?? ((record?.dot.thong_tin as Record<string, string> | undefined)?.dia_diem ?? "")), thanh_phan: String(latest?.thong_tin.thanh_phan ?? ((record?.dot.thong_tin as Record<string, string> | undefined)?.thanh_phan ?? "")), ...Object.fromEntries(FREE_TEXT_FIELDS.map(([k]) => [k, String(latest?.thong_tin[k] ?? "")])), ly_do: "" }); setEditing((v) => !v); }}
            className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 cursor-pointer hover:bg-slate-50">Sửa thông tin in</button>
        )}
        <button type="button" onClick={() => window.print()} className="h-10 rounded-lg bg-[#0047AB] px-5 text-sm font-semibold text-white cursor-pointer hover:bg-[#00388A]">In / Lưu PDF</button>
        <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-300 bg-slate-100 px-5 text-sm font-semibold text-slate-900 cursor-pointer hover:bg-slate-200">Thoát</button>
      </div>
      {kind === "rfi" && sigLoadError && (
        <p role="alert" className="weld-doc-actions mx-auto mb-3 max-w-3xl rounded-lg bg-red-50 p-2 text-sm text-red-700">Không tải được chữ ký đã lưu: {sigLoadError}</p>
      )}
      {kind === "rfi" && sigOpen && (
        <div className="weld-doc-actions mx-auto mb-3 max-w-3xl space-y-2 rounded-xl bg-white p-4 text-sm">
          <p className="text-xs text-slate-600">Chữ ký hiện trên phiếu của dự án Phú Quốc. Chọn ảnh PNG/JPG (nền trắng); ảnh được tải lên Cloudinary một lần và lưu lại để mọi máy dùng chung, không cần tải lại.</p>
          {(["chi-huy-truong", "nha-thau-phu", "gach-trang-tri"] as SignatureKey[]).map((key) => (
            <div key={key} className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-2">
              <span className="w-44 font-semibold">{SIG_LABELS[key]}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {signatures[key] ? <img src={signatures[key]} alt="" className="h-10 max-w-[8rem] object-contain" /> : <span className="text-xs text-slate-500">Chưa có</span>}
              <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">
                {signatures[key] ? "Đổi ảnh" : "Tải ảnh lên"}
                <input type="file" accept="image/png,image/jpeg" disabled={busy} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void changeSignature(key, f); }} />
              </label>
              {signatures[key] && <button type="button" disabled={busy} onClick={() => void changeSignature(key, null)} className="text-xs font-semibold text-rose-600 cursor-pointer">Xóa</button>}
              <div className="flex w-full gap-2">
                <input type="url" inputMode="url" placeholder="Hoặc dán link ảnh (https://…)" value={sigLinks[key] ?? ""} onChange={(e) => setSigLinks((cur) => ({ ...cur, [key]: e.target.value }))}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 px-2 text-xs" />
                <button type="button" disabled={busy || !(sigLinks[key] ?? "").trim()} onClick={() => void changeSignatureLink(key, (sigLinks[key] ?? "").trim())}
                  className="h-9 rounded-lg bg-[#0047AB] px-3 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer">Lưu link</button>
              </div>
            </div>
          ))}
          {sigError && <p role="alert" className="text-red-600">{sigError}</p>}
        </div>
      )}
      {editing && (
        <div className="weld-doc-actions mx-auto mb-3 max-w-3xl space-y-2 rounded-xl bg-white p-4 text-sm">
          <p className="text-xs text-slate-600">Sửa địa điểm, thành phần tham dự và các mục nhập tay (BB hoàn thành). Số đo và danh sách mối đã chốt không thay đổi; bản sửa đổi được lưu kèm lý do và người sửa.</p>
          <input className="h-9 w-full rounded-lg border border-slate-300 px-2" placeholder="Địa điểm" value={form.dia_diem} onChange={(e) => setForm({ ...form, dia_diem: e.target.value })} />
          <input className="h-9 w-full rounded-lg border border-slate-300 px-2" placeholder="Thành phần tham dự" value={form.thanh_phan} onChange={(e) => setForm({ ...form, thanh_phan: e.target.value })} />
          {kind === "hoan-thanh" && FREE_TEXT_FIELDS.map(([key, label]) => (
            <label key={key} className="block text-xs font-semibold text-slate-700">{label}
              <textarea rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm font-normal" value={form[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </label>
          ))}
          <input className="h-9 w-full rounded-lg border border-slate-300 px-2" placeholder="Lý do sửa đổi (không bắt buộc)" value={form.ly_do} onChange={(e) => setForm({ ...form, ly_do: e.target.value })} />
          {error && <p role="alert" className="text-red-600">{error}</p>}
          <button type="button" disabled={busy} onClick={() => void saveRevision()} className="h-9 rounded-lg bg-[#0047AB] px-4 font-semibold text-white disabled:opacity-50 cursor-pointer">Lưu bản sửa đổi</button>
        </div>
      )}
      {kind === "rfi" && view.rfi ? <RfiForm {...view.rfi} signatures={signatures} /> : (
      record ? <WeldAcceptanceRecordPages record={record} kind={kind as RecordKind} /> : null)}
    </div>
  );
}

const PQ = {
  duAn: "Tuyến tàu điện đô thị đoạn 1", goiThau: "Gói thầu XL03: Cung cấp và thi công lắp đặt hệ thống ray", diaDiem: "Đặc khu Phú Quốc, Tỉnh An Giang", noiLap: "Phú Quốc",
  kinhGui: ["Ban Quản lý dự án - Công ty TNHH MTV BOT tàu điện Phú Quốc;", "Tư vấn giám sát – Công ty CP TVTK XDCT GT Miền Bắc (Tedi North)."],
  chinh: { ten: "Nguyễn Tất Đạt", chucVu: "Chỉ huy trưởng", chuKy: "/chu-ky/chi-huy-truong.jpg", key: "chi-huy-truong" as SignatureKey },
  phu: { ten: "Nguyễn Văn Trinh", chucVu: "PBĐH", chuKy: "/chu-ky/nha-thau-phu.jpg", key: "nha-thau-phu" as SignatureKey },
};
const DOTS = "……………";
const SIG_LABELS: Record<SignatureKey, string> = { "chi-huy-truong": "Chữ ký Nhà thầu chính", "nha-thau-phu": "Chữ ký Nhà thầu phụ", "gach-trang-tri": "Gạch trang trí dưới tiêu đề" };

/** Khối ký của nhà thầu: chữ ký ảnh dán sẵn (chỉ có cho dự án Phú Quốc), phần còn lại để trống cho nhà thầu khác. */
function Signer({ title, org, who, signatures }: { title: string; org: string; who?: { ten: string; chucVu: string; chuKy: string; key: SignatureKey }; signatures: SignatureStore }) {
  return (
    <div className="text-center">
      <p className="font-bold">{title}</p>
      <p className="italic">({org})</p>
      <div className="flex h-20 items-center justify-center overflow-hidden">
        {/* Kích thước cố định (không dùng % chiều cao) để ảnh luôn hiện khi in; không hiệu ứng blend. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {who && signatures[who.key] && <img key={signatures[who.key]} src={signatures[who.key]} alt="" className="block h-20 w-auto max-w-full object-contain" />}
      </div>
      <p className="italic"><b>Tên:</b> {who?.ten ?? DOTS} &nbsp;<b>Chức vụ:</b> {who?.chucVu ?? DOTS}</p>
    </div>
  );
}

function RfiForm({ rfi, welds, projectName, signatures }: { rfi: RfiSummary; welds: RfiWeld[]; projectName: string; signatures: SignatureStore }) {
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
  const tuyen = upper && lower ? "tuyến thượng và tuyến hạ" : upper ? "tuyến thượng" : lower ? "tuyến hạ" : `tuyến ${DOTS}`;
  const chainage = (value?: string) => value ? `Km${value.replace(/^\s*km\s*/i, "")}` : `Km ${DOTS}`;
  const gio = (t.gio_bat_dau || "").trim();
  const [hh, mm] = gio.includes(":") ? gio.split(":") : ["", ""];
  const ngay = `${d ?? "……"} tháng ${m ?? "……"} năm ${y ?? "……"}`;
  // Ngày nghiệm thu (mục 2) = ngày phát phiếu + 1.
  const ngayNghiemThu = (() => {
    const next = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d) + 1));
    if (!y || !m || !d || Number.isNaN(next.getTime())) return ngay;
    return `${String(next.getUTCDate()).padStart(2, "0")} tháng ${String(next.getUTCMonth() + 1).padStart(2, "0")} năm ${next.getUTCFullYear()}`;
  })();
  const heading = "mt-3 font-bold";
  return (
    <article id="weld-doc-print" className="weld-rfi mx-auto max-w-3xl bg-white p-10 text-[11pt] leading-[1.55] text-black" style={{ fontFamily: "'Times New Roman', serif" }}>
      <div className="text-center font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br />Độc lập - Tự do - Hạnh phúc</div>
      {signatures["gach-trang-tri"] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={signatures["gach-trang-tri"]} alt="" className="mx-auto my-0.5 block h-[5.3mm] w-[55mm] max-w-full object-cover contrast-125" />
      ) : (
        <p className="text-center font-bold leading-none" style={{ fontFamily: "'Segoe UI Symbol', 'Noto Sans Symbols2', 'Times New Roman', serif" }} aria-hidden="true">
          ----------- ☙★❧ -----------
        </p>
      )}
      <p className="mt-3 text-right italic">{pq?.noiLap ?? DOTS}, ngày {ngay}</p>
      <h2 className="mt-3 text-center font-bold">PHIẾU YÊU CẦU NGHIỆM THU</h2>
      <p className="text-center">Số: {rfi.so_phieu.replace(/^RFI-/i, "")}/PYC-HR</p>
      <dl className="mt-3 grid grid-cols-[6rem_1fr] font-bold">
        <dt>Dự án</dt><dd className="font-normal">: {pq?.duAn ?? projectName ?? DOTS}</dd>
        <dt>Hạng mục</dt><dd className="font-normal">: {pq?.goiThau ?? DOTS}</dd>
        <dt>Địa điểm</dt><dd className="font-normal">: {t.dia_diem || pq?.diaDiem || DOTS}</dd>
      </dl>
      <div className="mt-2 flex gap-2 pl-[6rem]"><b className="shrink-0 whitespace-nowrap italic">Kính gửi:</b><div className="min-w-0 flex-1 font-bold">{kinhGui.map((k) => <p key={k}>- {k}</p>)}</div></div>
      <p className={heading}>1. Đối tượng nghiệm thu:</p>
      <p>- Giám sát thi công hàn ray {tuyen}{t.pham_vi ? ` (${t.pham_vi})` : ""}</p>
      {missingRoutes.length > 0 && !hasRouteOverride && <p className="weld-doc-actions text-red-600">Chưa xác định tuyến: {missingRoutes.map((w) => w.ma_lich_su).join(", ")}</p>}
      <p className={`${heading} mt-6`}>2. Thời gian và vị trí nghiệm thu: Ngày {ngayNghiemThu}</p>
      <p className="pl-3">{hh ? String(Number(hh)) : "…. "}h{mm || "…"} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {chainage(monitoring ? t.kmFrom : km[0]?.v)}-{chainage(monitoring ? t.kmTo : km[km.length - 1]?.v)}</p>
      <p className={`${heading} mt-6`}>3. Đánh giá công việc:</p>
        <p className="text-justify">- Nhà thầu cam kết hạng mục trên đã đáp ứng yêu cầu chất lượng theo hồ sơ thiết kế, chỉ dẫn kỹ thuật, Hợp đồng thi công xây dựng và các tài liệu có liên quan khác;</p>
        <p className="mt-2 text-justify">- Công việc chuẩn bị hồ sơ, thủ tục đã đầy đủ sẵn sàng để kiểm tra nghiệm thu;</p>
        <p className="mt-2 text-justify">- Đề nghị Tư vấn giám sát đến công trường kiểm tra, nghiệm thu các công việc đề nghị nêu trên để nhà thầu triển khai các công việc tiếp theo.</p>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <Signer title="NHÀ THẦU PHỤ" org="Công ty CP công trình Thành Phát" who={pq?.phu} signatures={signatures} />
        <Signer title="NHÀ THẦU CHÍNH" org="Liên danh VNR-CRCC16" who={pq?.chinh} signatures={signatures} />
      </div>
      <table className="mt-3 w-full border-collapse border border-black">
        <tbody>
          <tr className="h-28">
            <td className="w-1/4 border border-black text-center font-bold">TƯ VẤN<br />GIÁM SÁT</td>
            <td className="w-[40%] border border-black p-1 align-top">
              <div className="flex h-full min-h-[6.5rem] flex-col justify-between">
                <span>Người nhận: {pq ? "Trần Văn Thanh" : DOTS}</span>
                <span>Ngày nhận: {ngay}</span>
              </div>
            </td>
            <td className="border border-black p-1 align-top">
              <div className="flex h-full min-h-[6.5rem] flex-col justify-between">
                <span>Chức vụ: Tư vấn giám sát trưởng</span>
                <span>Chữ ký:..........................................</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}
