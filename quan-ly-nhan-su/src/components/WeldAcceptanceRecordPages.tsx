"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { RecordSet } from "@/lib/weldQualityClient";
import PrintFrame from "@/components/PrintFrame";
import { rfiScope, SIGNER_PARTIES, DEFAULT_SIGNERS, loadSignerDefaults } from "@/lib/weldAcceptance";
import { loadSignatureByName, personNameKey } from "@/lib/personnelCertificatesDb";
import { fieldWeldCode } from "@/lib/weldCode";
import { GEOMETRY_CRITERIA, evaluateGeometry, evaluateGeometryCriterion, type GeometryLimits, type GeometryMeasurements } from "@/lib/weldQuality";

export type RecordKind = "phu-luc" | "giai-doan" | "hoan-thanh";
export const ACCEPTANCE_DOCS: { kind: RecordKind; loai: string; title: string }[] = [
  { kind: "phu-luc", loai: "Phụ lục công việc", title: "PHỤ LỤC BIÊN BẢN NGHIỆM THU MỐI HÀN CHẢY GIÁP MÉP" },
  { kind: "giai-doan", loai: "Giai đoạn xây dựng", title: "BIÊN BẢN NGHIỆM THU CÔNG VIỆC XÂY DỰNG" },
  { kind: "hoan-thanh", loai: "Hoàn thành công việc", title: "BIÊN BẢN NGHIỆM THU HOÀN THÀNH GIAI ĐOẠN THI CÔNG" },
];

const BOX = "❐";
// Mỗi trang phụ lục tối đa 30 mối để bảng + chân trang + khối ký luôn nằm vừa 1 tờ A4.
const ROWS_PER_PAGE = 30;
// Số dòng tối thiểu của bảng: không in thêm dòng trống thừa.
const MIN_BLANK_ROWS = 5;
/**
 * Phụ lục tối đa 30 mối/trang (nhiều hơn thì sang trang kế, mỗi trang có khối ký). Co giãn theo số dòng của trang: đủ 30 dòng → hàng 16px, chữ 10px (vừa 1 trang);
 * ít dòng hơn → hàng cao hơn (tối đa 24px, tổng bảng ≤ 420px để chừa chỗ tiêu đề cột), chữ to hơn (tối đa 11px).
 */
function annexSizing(rows: number) {
  const row = rows >= ROWS_PER_PAGE ? 16 : Math.max(16, Math.min(24, Math.floor(420 / Math.max(rows, 1))));
  const font = row >= 22 ? 11 : row >= 19 ? 10.5 : 10;
  return { "--annex-row": `${row}px`, "--annex-font": `${font}px` } as CSSProperties;
}

export const acceptancePrintCss = `
.acceptance-page { box-sizing: border-box; width: 210mm; min-height: 297mm; margin: 0 auto 16px; padding: 12mm 17mm; background: white; color: black; font: 13px/1.35 'Times New Roman', serif; }
.acceptance-page.annex-page { width: 210mm; min-height: 297mm; padding: 15mm 5mm 5mm 20mm; font: 11px/1.25 'Times New Roman', serif; }
.acceptance-page h2 { font-size: 15px; font-weight: bold; text-align: center; margin: 12px 0 2px; }
.acceptance-page.annex-page h2 { font-size: 14.5px; margin: 0; padding: 4px 2px; text-transform: uppercase; }
.acceptance-page h3 { font-weight: bold; margin-top: 8px; }
.acceptance-page p { margin: 3px 0; }
.acceptance-page table { width: 100%; border-collapse: collapse; }
.acceptance-page th, .acceptance-page td { border: 1px solid black; padding: 3px; overflow-wrap: anywhere; }
.acceptance-page .annex-sheet { width: 100%; border-collapse: collapse; table-layout: fixed; }
.acceptance-page .annex-sheet > tbody > tr > td { border: 1px solid black; padding: 2px 4px; vertical-align: top; }
.acceptance-page .annex-sheet .title-cell { text-align: center; font-weight: bold; font-size: 16px; text-transform: uppercase; padding: 5px 2px; }
.acceptance-page .annex-sheet .head-left { font-weight: bold; text-transform: uppercase; font-size: 12.5px; line-height: 1.35; }
.acceptance-page .annex-sheet .head-right { width: 28%; font-size: 12px; }
.acceptance-page .annex { font-size: var(--annex-font, 10px); table-layout: fixed; border-collapse: collapse; width: 100%; }
.acceptance-page .annex th { text-align: center; vertical-align: middle; font-weight: bold; padding: 1px; line-height: 1.15; }
.acceptance-page .annex th.serial-heading { white-space: nowrap; }
.acceptance-page .annex td { height: var(--annex-row, 16px); text-align: center; padding: 0 1px; vertical-align: middle; }
.acceptance-page .annex td.weld-name { white-space: nowrap; }
.acceptance-page .annex-meta-grid { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11.5px; }
.acceptance-page .annex-meta-grid td { border: 1px solid black; padding: 2px 4px; vertical-align: middle; }
.acceptance-page .annex-foot { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12.5px; }
.acceptance-page .annex-foot > tbody > tr > td { border: 1px solid black; padding: 3px 4px; vertical-align: top; }
.acceptance-page .annex-tol { width: 100%; border-collapse: collapse; }
.acceptance-page .annex-tol th, .acceptance-page .annex-tol td { font-size: 12px; padding: 1px 3px; }
.acceptance-page .annex-sign { width: 100%; border-collapse: collapse; margin-top: 0; }
.acceptance-page .annex-sign th, .acceptance-page .annex-sign td { border: 1px solid black; text-align: center; vertical-align: top; padding: 4px 6px; }
.acceptance-page .annex-sign th { font-weight: bold; text-transform: uppercase; font-size: 12px; }
.acceptance-page .annex-sign .sig-img { position: absolute; left: 62px; bottom: 3px; height: 38px; max-width: 55%; object-fit: contain; }
.acceptance-page .annex-sign td { position: relative; height: 82px; font-size: 12px; text-align: left; font-weight: normal; }
.acceptance-page .signature { text-align: center; font-weight: bold; margin-top: 10px; min-height: 95px; }
.acceptance-page .signature small { display: block; font-weight: normal; font-style: italic; }
.acceptance-page .dots { border-bottom: 1px dotted black; min-height: 21px; }
.acceptance-page.work-page { font: 12.5px/1.35 'Times New Roman', serif; }
.acceptance-page.work-page h3 { margin-top: 6px; margin-bottom: 2px; }
.acceptance-page .nation { text-align: center; font-weight: bold; line-height: 1.3; }
.acceptance-page .nation .motto { border-bottom: 1px solid black; display: inline-block; padding: 0 8px 1px; }
.acceptance-page .nation .ornament { margin-top: 2px; font-weight: normal; letter-spacing: 1px; }
.acceptance-page .place-date { text-align: right; font-style: italic; margin: 10px 0 8px; }
.acceptance-page .doc-no { text-align: center; margin: 2px 0 8px; }
.acceptance-page .field-row { margin: 1px 0; }
.acceptance-page .field-label { display: inline-block; min-width: 5.2rem; }
.acceptance-page .party { margin: 4px 0 5px; }
.acceptance-page .party .person { margin: 1px 0 1px 1.2rem; }
.acceptance-page .conclude-line { margin: 3px 0 3px 0.5rem; }
.acceptance-page .work-sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 22px; text-align: center; font-weight: bold; text-transform: uppercase; }
.acceptance-page .work-sign div { min-height: 96px; }
.acceptance-page .work-sign .auto-sign { display: block; margin-top: 4px; }
.acceptance-page .work-sign .auto-sign img { display: block; margin: 0 auto; height: 52px; max-width: 80%; object-fit: contain; }
.acceptance-page .work-sign small { display: block; margin-top: 4px; font-weight: normal; font-style: italic; text-transform: none; }
.acceptance-page .complete-sign { text-align: center; font-weight: bold; text-transform: uppercase; min-height: 120px; margin-top: 10px; }
.acceptance-page .complete-sign small { display: block; margin-top: 4px; font-weight: normal; font-style: italic; text-transform: none; }
.acceptance-page .complete-sign-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 8px; }
.acceptance-page .conclude-table { margin: 8px 0 14px; }
.acceptance-page .conclude-table td { padding: 6px 8px; vertical-align: middle; }
.acceptance-page .sign-roster { margin-top: 14px; }
.acceptance-page .sign-roster th, .acceptance-page .sign-roster td { height: 52px; padding: 4px 6px; vertical-align: middle; }
.acceptance-page .sign-roster th { height: 28px; }
@media print {
  body > *:not(.acceptance-print-root) { display: none !important; }
  .acceptance-print-root { position: static !important; overflow: visible !important; padding: 0 !important; background: white !important; }
  .acceptance-print-root .weld-doc-actions, .acceptance-print-root .weld-print-pack-actions { display: none !important; }
  /* Mỗi tờ/mẫu bắt đầu trang mới — không dính liền nhau. */
  .acceptance-page {
    width: auto; min-height: 0; height: auto; margin: 0; padding: 0;
    break-before: page !important; page-break-before: always !important;
    break-after: auto; page-break-after: auto;
    break-inside: avoid; page-break-inside: avoid;
  }
  .acceptance-page:first-of-type {
    break-before: auto !important; page-break-before: auto !important;
  }
  /* PrintFrame áp dụng lề của phụ lục khi in. */
  .acceptance-page.annex-page { padding: 0; }
  .acceptance-page .annex-sign { break-inside: avoid; page-break-inside: avoid; }
  .acceptance-page .annex td.weld-name { white-space: nowrap; }
  .acceptance-page tr { break-inside: avoid; page-break-inside: avoid; }
  .acceptance-page thead { display: table-header-group; }
  @page { size: A4 portrait; margin: 0; }
}`;

const blank = "………………";
const show = (v: unknown) => v == null || v === "" ? blank : String(v);
const dateParts = (v: unknown) => {
  const [y, m, d] = String(v ?? "").slice(0, 10).split("-");
  return y && m && d ? { d, m, y } : { d: "……", m: "……", y: "……" };
};
const timeText = (v: unknown) => {
  const raw = String(v ?? "").trim();
  if (!raw) return "………";
  return raw.slice(0, 5);
};
const labels = ["TƯ VẤN GIÁM SÁT", "NHÀ THẦU CHÍNH", "NHÀ THẦU PHỤ"];
const PARTY_KEYS = SIGNER_PARTIES.map(([key]) => key);

/** Ảnh chữ ký trong hồ sơ Nhân sự theo tên (đã chuẩn hoá); tải một lần rồi dùng lại. */
function usePersonSignatures() {
  const [map, setMap] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let live = true;
    void loadSignatureByName().then((m) => { if (live) setMap(m); }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  return map;
}

/** Người ký i (1–2) của một bên: bản sửa của biên bản → người đã nhớ → mặc định. */
function resolveSigner(t: Record<string, string>, defaults: Record<string, string>, party: string, i: number) {
  const pick = (field: "ten" | "cv") => {
    const key = `nguoi_${party}_${i}_${field}`;
    return t[key]?.trim() || defaults[key] || DEFAULT_SIGNERS[key] || "";
  };
  return { ten: pick("ten"), cv: pick("cv") };
}
/** Nhiều RFI → «RFI đầu đến RFI cuối» (chọn tới RFI cuối khi đã ký đủ hình học + siêu âm). */
function rfiRange(value: string) {
  const list = value.split(/[,;]\s*/).map((x) => x.trim()).filter(Boolean);
  if (list.length < 2) return show(value);
  const sorted = [...list].sort((a, b) => a.localeCompare(b, "vi", { numeric: true }));
  return `${sorted[0]} đến ${sorted[sorted.length - 1]}`;
}
const str = (v: unknown) => (v == null ? "" : String(v));
const unique = (values: unknown[]) => [...new Set(values.map(str).filter(Boolean))];
const kmText = (v: unknown) => {
  const raw = str(v).trim();
  if (!raw) return "…………";
  return raw.replace(/^\s*km\s*/i, "");
};

/** "Km5+407.01" → mét; null nếu không đọc được. */
function chainageMetres(v: string) {
  const m = /(\d+)\s*\+\s*(\d+(?:[.,]\d+)?)/.exec(v);
  return m ? Number(m[1]) * 1000 + Number(m[2].replace(",", ".")) : null;
}

/**
 * Tên máy trên biên bản: luôn ghi "Máy hàn chảy giáp mép" + mã model (UN5-…, KCM-…).
 * VD "Máy hàn tiếp xúc đối đầu ray lưu động UN5-150ZC2-C6" → "Máy hàn chảy giáp mép UN5-150ZC2-C6".
 */
function machinePrintName(name: string) {
  const cleaned = name.replace(/\s+/g, " ").trim();
  if (!cleaned) return cleaned;
  const model = /\b((?:UN5|KCM|K922)[A-Z0-9./()-]*)\b/i.exec(cleaned)?.[1];
  if (model) return `Máy hàn chảy giáp mép ${model}`;
  if (/máy hàn tiếp xúc|flash\s*butt|đối đầu/i.test(cleaned)) {
    return "Máy hàn chảy giáp mép";
  }
  return cleaned;
}

function mark(on: boolean) {
  return on ? "☑" : BOX;
}

function isDayShift(ca: string) {
  const v = ca.toLocaleLowerCase("vi");
  return /ca\s*1|ngày|sang|day/.test(v);
}
function isNightShift(ca: string) {
  const v = ca.toLocaleLowerCase("vi");
  return /ca\s*[23]|đêm|toi|tối|night/.test(v);
}

export default function WeldAcceptanceRecordPages({ record, kind }: { record: RecordSet; kind?: RecordKind }) {
  const signatureByName = usePersonSignatures();
  const signatureOf = (name: string) => (name ? signatureByName.get(personNameKey(name)) : undefined);
  const rfi = record.dot.phieu_yeu_cau_nghiem_thu;
  const project = rfi.du_an ?? {};
  const projectName = String(project.du_an ?? project.ten_du_an ?? project.name ?? "");
  const pq = /phú quốc/i.test(projectName);
  const base = { ...((rfi.thong_tin ?? {}) as Record<string, string>), ...((record.dot.thong_tin ?? {}) as Record<string, string>) };
  const rows = [...record.moi].sort((a, b) => String(a.du_lieu_chot.moi_han?.ma_lich_su ?? "").localeCompare(String(b.du_lieu_chot.moi_han?.ma_lich_su ?? ""), "vi", { numeric: true }));

  return <>{ACCEPTANCE_DOCS.filter((d) => !kind || d.kind === kind).map((doc) => {
    const hoSo = record.ho_so.find((h) => h.loai === doc.loai);
    const revision = record.sua_doi?.filter((r) => r.ho_so_id === hoSo?.id).sort((a, b) => a.phien_ban - b.phien_ban).at(-1);
    const t = { ...base, ...(revision?.thong_tin ?? {}) };
    const scope = rfiScope(rfi.thong_tin as Record<string, unknown>);
    const geometryRfi = t.rfi_hinh_hoc_so || (scope.geometry ? String(rfi.so_phieu ?? "") : "");
    const ultrasoundRfi = t.rfi_sieu_am_so || (scope.ultrasound ? String(rfi.so_phieu ?? "") : "");
    // Ngày nghiệm thu: ưu tiên bản sửa đổi in → ngày nghiệm thu của phiếu YCNT (đợt nghiệm thu).
    const acceptanceDate = t.ngay_nghiem_thu || String(record.dot.ngay_nghiem_thu ?? "");
    const parts = dateParts(acceptanceDate || null);
    const day = `${parts.d}/${parts.m}/${parts.y}`;
    // Ngày ở khung chữ ký cuối: bản sửa riêng từng bên → không có thì lấy ngày nghiệm thu ở trên.
    const signDate = (info: Record<string, string>, party: string) => {
      const value = info[`ngay_ky_${party}`] || acceptanceDate;
      if (!value) return "";
      const p = dateParts(value);
      return `${p.d}/${p.m}/${p.y}`;
    };
    // Địa điểm là nơi thi công; lý trình đã có ở mục Vị trí nên không in lại ở đây (kể cả dữ liệu cũ nhập «Lý trình …»).
    const location = (t.dia_diem && !/^s*lý trình/i.test(t.dia_diem) ? t.dia_diem : "") || (pq ? "Phú Quốc - An Giang" : "");
    const packageName = t.goi_thau || (pq ? "Gói thầu XL-03: Cung cấp và thi công lắp đặt hệ thống ray" : "");
    const codes = rows.map((r) => fieldWeldCode(String(r.du_lieu_chot.moi_han?.ma_lich_su ?? ""), r.du_lieu_chot.moi_han?.ma_hien_truong as string | null | undefined)).filter(Boolean);
    const pointRows = rows.map((r) => r.du_lieu_chot.moi_han ?? {});
    const chainage = pointRows.map((w) => w.ly_trinh).filter(Boolean).map(String);
    const sortedChainage = chainage
      .map((c) => ({ c, m: chainageMetres(c) }))
      .filter((x): x is { c: string; m: number } => x.m !== null)
      .sort((a, b) => a.m - b.m)
      .map((x) => x.c);
    const kmFrom = kmText(t.kmFrom || sortedChainage[0] || chainage[0]);
    const kmTo = kmText(t.kmTo || sortedChainage.at(-1) || chainage.at(-1));
    if (doc.kind === "phu-luc") {
      const pages = Array.from({ length: Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE)) }, (_, i) => rows.slice(i * ROWS_PER_PAGE, i * ROWS_PER_PAGE + ROWS_PER_PAGE));
      const shifts = unique(pointRows.map((w) => w.ca_han));
      const dayOn = t.ca_han ? t.ca_han !== "dem" : shifts.some(isDayShift);
      const nightOn = t.ca_han ? t.ca_han !== "ngay" : shifts.some(isNightShift);
      const welders = t.ten_tho_han ? [t.ten_tho_han] : unique(pointRows.map((w) => w.ten_tho_han));
      const welderIds = t.id_tho_han ? [t.id_tho_han] : unique(pointRows.map((w) => w.ma_nhan_su));
      const machines = t.may_han ? [t.may_han] : unique(pointRows.map((w) => w.ten_may || w.ma_may));
      const upper = t.tuyen ? t.tuyen !== "ha" : (t.tuyen_thuong === "1" || pointRows.some((w) => /^(TT|TP)/i.test(str(w.ma_diem))));
      const lower = t.tuyen ? t.tuyen !== "thuong" : (t.tuyen_ha === "1" || pointRows.some((w) => /^(HT|HP)/i.test(str(w.ma_diem))));
      const mobile = t.bien_phap ? t.bien_phap === "di-dong" : /un5|lưu động|di động|mobile/i.test(machines.join(" "));
      const fixed = t.bien_phap ? t.bien_phap === "co-dinh" : /kcm|k922|cố định|fixed/i.test(machines.join(" "));

      return pages.map((page, pageIndex) => (
        <article className="acceptance-page annex-page" key={`${doc.kind}-${pageIndex}`}>
<PrintFrame right="5mm" bottom="5mm">
          <table className="annex-sheet">
            <tbody>
              <tr>
                <td className="head-left">
                  DỰ ÁN: {show(projectName).toUpperCase()}<br />
                  {show(packageName).replace(/^Gói thầu\s*/i, "GÓI THẦU ").toUpperCase()}<br />
                  HẠNG MỤC: THI CÔNG HÀN RAY
                </td>
                <td className="head-right"><b>Địa điểm:</b><br />{show(location)}</td>
              </tr>
              <tr>
                <td className="title-cell" colSpan={2}>{doc.title}</td>
              </tr>
              <tr>
                <td colSpan={2} style={{ padding: 0 }}>
                  <table className="annex-meta-grid">
                    <colgroup>
                      <col style={{ width: "42%" }} />
                      <col style={{ width: "18%" }} />
                      <col style={{ width: "40%" }} />
                    </colgroup>
                    <tbody>
                      <tr>
                        <td colSpan={2}><b>TÊN TÀI LIỆU:</b> NGHIỆM THU CÔNG TÁC HÀN HIỆN TRƯỜNG (HÀN SẢN XUẤT)</td>
                        <td><b>CA HÀN:</b> {mark(dayOn)} Ngày &nbsp; {mark(nightOn)} Đêm</td>
                      </tr>
                      <tr>
                        <td colSpan={2}><b>PYC số:</b> {show(rfi.so_phieu)}</td>
                        <td><b>BIỆN PHÁP HÀN:</b> {mark(fixed)} Hàn cố định &nbsp; {mark(mobile)} Hàn di động</td>
                      </tr>
                      <tr>
                        <td><b>NGÀY NGHIỆM THU:</b> {day}</td>
                        <td colSpan={2}>
                          <b>TÊN THỢ HÀN:</b> {welders.join(", ") || "………………"} &nbsp;
                          <b>ID:</b> {welderIds.join(", ") || "…………"}
                        </td>
                      </tr>
                      <tr>
                        <td><b>VỊ TRÍ:</b> {sortedChainage.length || t.kmFrom || t.kmTo ? `Km${kmFrom} – Km${kmTo}` : show(t.pham_vi)}</td>
                        <td><b>TUYẾN:</b><br />{mark(upper)} Tuyến thượng<br />{mark(lower)} Tuyến hạ</td>
                        <td>
                          {machines.map(machinePrintName).join(", ") || "Máy hàn chảy giáp mép UN5-150ZC2-C6"}
                          <br />
                          Goòng phẳng: {show(t.goong || t.goong_phang || "KPS25-L8")}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
              <tr>
                <td colSpan={2} style={{ padding: 0 }}>
                  <table className="annex" style={annexSizing(Math.max(page.length, MIN_BLANK_ROWS))}>
                    <colgroup>
                      {[3, 15, 7, 9, 5, 5, 8, 7, 4, 4, 4, 4, 4, 9, 12].map((w, i) => (
                        <col key={i} style={{ width: `${w}%` }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        <th rowSpan={3} className="serial-heading">STT</th>
                        <th rowSpan={3}>TÊN MỐI HÀN</th>
                        <th rowSpan={3}>MÃ HIỆU RAY<br />(60R2 - U75V)</th>
                        <th rowSpan={3}>LÝ TRÌNH<br />MỐI HÀN</th>
                        <th colSpan={2} rowSpan={2}>RAY</th>
                        <th colSpan={8}>NGHIỆM THU<br />(ĐẠT/KHÔNG ĐẠT)</th>
                        <th rowSpan={3}>GHI CHÚ</th>
                      </tr>
                      <tr>
                        <th rowSpan={2}>KIỂM TRA TỔNG THỂ MỐI HÀN BẰNG MẮT THƯỜNG</th>
                        <th rowSpan={2}>KIỂM TRA SIÊU ÂM</th>
                        <th colSpan={5}>Kiểm tra độ thẳng và độ phẳng của mối hàn</th>
                        <th rowSpan={2}>Nằm trong giới hạn cho phép</th>
                      </tr>
                      <tr>
                        <th>RAY TRÁI</th>
                        <th>RAY PHẢI</th>
                        {[1, 2, 3, 4, 5].map((n) => <th key={n}>{n}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: Math.max(page.length, MIN_BLANK_ROWS) }, (_, i) => {
                        const row = page[i];
                        const w = row?.du_lieu_chot.moi_han ?? {};
                        // Phiếu con chép dữ liệu chốt ở mức ngoài cùng, phiếu cũ để trong kiem_tra — đọc cả hai.
                        const kt = (row?.du_lieu_chot.kiem_tra ?? row?.du_lieu_chot ?? {}) as NonNullable<typeof row>["du_lieu_chot"]["kiem_tra"] & Record<string, never>;
                        const measurements = (kt.gia_tri_do ?? {}) as Record<string, number | null>;
                        const limits = (row?.du_lieu_chot.tieu_chuan?.dung_sai ?? null) as GeometryLimits | null;
                        const geometry = row
                          ? evaluateGeometry(measurements as GeometryMeasurements, limits)
                          : null;
                        // Số đo chỉ nhập bên trong hệ thống; biên bản không in số đo, chỉ ghi kết quả từng tiêu chí.
                        const cellOf = (k: (typeof GEOMETRY_CRITERIA)[number]) => {
                          const v = measurements[k];
                          if (v == null) return "";
                          return evaluateGeometryCriterion(v, limits?.[k] ?? null) === "Không đạt" ? "Không đạt" : "Đạt";
                        };
                        const code = str(w.ma_diem);
                        const left = /^(TT|HT)/i.test(code) ? "✓" : "";
                        const right = /^(TP|HP)/i.test(code) ? "✓" : "";
                        const inLimit =
                          geometry ?? (row?.ket_qua === "Đạt" || row?.ket_qua === "Không đạt" ? row.ket_qua : "");
                        const passed = inLimit === "Đạt";
                        const hasMeasure = GEOMETRY_CRITERIA.some((k) => measurements[k] != null);
                        return (
                          <tr key={i}>
                            <td>{pageIndex * ROWS_PER_PAGE + i + 1}</td>
                            <td className="weld-name">{fieldWeldCode(str(w.ma_lich_su), w.ma_hien_truong as string | null | undefined)}</td>
                            <td>{str(w.loai_ray)}</td>
                            <td>{str(w.ly_trinh)}</td>
                            <td>{left}</td>
                            <td>{right}</td>
                            {/* Biên bản chỉ hình học: chưa nghiệm thu siêu âm → để trống cột siêu âm. */}
                            <td>{str(kt.truc_quan) || (passed ? "Đạt" : "")}</td>
                            <td>{scope.ultrasound ? str(kt.ket_qua_ndt) || (passed ? "Đạt" : "") : ""}</td>
                            {GEOMETRY_CRITERIA.map((k) => (
                              <td key={k}>{hasMeasure ? cellOf(k) : passed ? "Đạt" : ""}</td>
                            ))}
                            <td>{inLimit}</td>
                            <td />
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </td>
              </tr>
              <tr>
                <td colSpan={2} style={{ padding: 0 }}>
                  <table className="annex-foot">
                    <colgroup>
                      <col style={{ width: "42%" }} />
                      <col style={{ width: "38%" }} />
                      <col style={{ width: "20%" }} />
                    </colgroup>
                    <tbody>
                      <tr>
                        <td>
                          <p style={{ margin: "0 0 3px" }}>
                            1. Tên tiêu chuẩn áp dụng: TCVN 13965-2:2024 – Ứng dụng đường sắt – Hàn ray – Hàn chảy giáp mối – Phần 2
                          </p>
                          <p style={{ margin: 0 }}>
                            2. Tiêu chuẩn tham chiếu bổ sung cho ray rãnh và các nội dung chưa được quy định chi tiết trong TCVN: CECS 429 : 2016 – Tiêu chuẩn nghiệm thu chất lượng hàn chảy giáp mép ray rãnh cho đường sắt đô thị.
                          </p>
                          <p style={{ margin: "6px 0 0", fontSize: "11px" }}>
                            Ghi chú:<br />
                            (1): Đối với độ thẳng theo phương ngang, dung sai dương (+) sẽ làm tăng khổ đường<br />
                            (2): Đối với độ phẳng mặt lăn, chỉ đo giá trị lớn nhất
                          </p>
                        </td>
                        <td style={{ padding: 0 }}>
                          <table className="annex-tol">
                            <thead>
                              <tr>
                                <th>Đối chiếu độ phẳng và thẳng mối hàn</th>
                                <th>Sai số cho phép (mm)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                ["1. Theo chiều dọc trên mặt lăn.", "+0.4 / -0.10"],
                                ["2. Theo chiều ngang trên nấm ray.", "± 0.4 (1)"],
                                ["3. Theo chiều ngang trên các đầu chân ray.", "± 2.0"],
                                ["4. Độ phẳng mặt lăn, được đo trên chiều dài khu vực mài.", "0.2 (2)"],
                                ["5. Chiều dài mài hoàn thiện", "≤ 800"],
                              ].map(([a, b]) => (
                                <tr key={a}>
                                  <td style={{ textAlign: "left" }}>{a}</td>
                                  <td style={{ textAlign: "center" }}>{b}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                        <td><b>GHI CHÚ:</b></td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
              <tr>
                <td colSpan={2} style={{ padding: 0 }}>
                  <table className="annex-sign">
                    <thead>
                      <tr>
                        <th>TƯ VẤN GIÁM SÁT</th>
                        <th>NHÀ THẦU CHÍNH</th>
                        <th>NHÀ THẦU PHỤ</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {PARTY_KEYS.map((party) => {
                          const signer = resolveSigner(t, loadSignerDefaults(), party, 1);
                          return (
                            <td key={party}>
                              HỌ VÀ TÊN: {signer.ten}<br /><br />
                              NGÀY: {signDate(t, party)}<br /><br />
                              CHỮ KÝ:
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
          <p style={{ margin: "3px 2px 0", textAlign: "right", fontSize: "11px" }}>Trang {pageIndex + 1}/{pages.length}</p>
        </PrintFrame>
</article>
      ));
    }
    if (doc.kind === "giai-doan") {
      const tvgs = t.ben_nhan || (pq ? "Công ty cổ phần Tư vấn thiết kế xây dựng công trình giao thông Miền Bắc (TEDI - NORTH)" : blank);
      const ntc = t.ben_moi || (pq ? "Tập đoàn đường sắt quốc gia Việt Nam" : blank);
      const ntp = "Công ty cổ phần công trình Thành Phát";
      // Tên mối hàn: liệt kê đủ, không thêm «……» ở cuối.
      const weldNames = codes.length ? codes.join(", ") : "……………………";
      // Tháng / năm tự lấy hiện tại; ngày để trống cho người dùng tự chọn (chọn ở «Sửa thông tin in» thì in đủ ngày).
      const nowDate = new Date();
      const wp = acceptanceDate ? parts : { d: "……", m: String(nowDate.getMonth() + 1).padStart(2, "0"), y: String(nowDate.getFullYear()) };
      // Số biên bản: FBW/01/BBNTCV (01 = số thứ tự lấy từ số RFI; sửa được ở «Sửa thông tin in»).
      const seq = /(\d+)\s*$/.exec(String(rfi.so_phieu ?? ""))?.[1];
      const bbNo = t.so_bb?.trim() || `${pointRows.some((w) => w.cong_nghe_han === "ATW") ? "ATW" : "FBW"}/${seq ? String(Number(seq)).padStart(2, "0") : "01"}/BBNTCV`;
      // Người ký: theo bản sửa của biên bản, chưa có thì lấy người ký gần nhất đã nhớ.
      const signerDefaults = loadSignerDefaults();
      const signer = (key: string) => t[key]?.trim() || signerDefaults[key] || "……………………";
      const objectText = pointRows.some((w) => w.cong_nghe_han === "ATW")
        ? "Nghiệm thu mối hàn ray"
        : "Nghiệm thu mối hàn chảy giáp mép - Hàn trên tuyến";
      return (
        <article className="acceptance-page work-page" key={doc.kind}>
<PrintFrame>
          <div className="nation">
            CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM<br />
            <span className="motto">Độc lập - Tự do - Hạnh phúc</span>
            <div className="ornament">----------- ✦ -----------</div>
          </div>
          <p className="place-date">
            {pq ? "Phú Quốc" : (location.split(",")[0]?.trim() || "…………")}, ngày {wp.d} tháng {wp.m} năm {wp.y}
          </p>
          <h2>{doc.title}</h2>
          <p className="doc-no">Số: {bbNo}</p>
          <p>RFI hình học: {rfiRange(geometryRfi)} · RFI siêu âm: {rfiRange(ultrasoundRfi)}</p>

          <p className="field-row"><span className="field-label">Dự án</span>: {show(projectName)}</p>
          <p className="field-row"><span className="field-label">Gói thầu</span>: {show(packageName)}</p>
          <p className="field-row"><span className="field-label">Hạng mục</span>: Thi công hàn ray</p>
          <p className="field-row"><span className="field-label">Địa điểm</span>: {show(location)}</p>

          <h3>1. Đối tượng nghiệm thu:</h3>
          <p>- {objectText}</p>

          <h3>2. Thời gian nghiệm thu:</h3>
          <p>Bắt đầu&nbsp;&nbsp;: {timeText(t.gio_bat_dau)} ngày {wp.d} tháng {wp.m} năm {wp.y}</p>
          <p>Kết thúc&nbsp;: {timeText(t.gio_ket_thuc)} ngày {wp.d} tháng {wp.m} năm {wp.y}</p>

          <h3>3. Vị trí nghiệm thu:</h3>
          <p>Lý trình: Từ : Km {kmFrom} đến Km {kmTo}.</p>
          <p>Tên mối hàn: {weldNames}</p>

          <h3>4. Thành phần trực tiếp tham gia nghiệm thu:</h3>
          {([
            ["a) Tư vấn Giám sát", tvgs, SIGNER_PARTIES[0][0]],
            ["b) Nhà thầu chính", ntc, SIGNER_PARTIES[1][0]],
            ["c) Nhà thầu phụ", ntp, SIGNER_PARTIES[2][0]],
          ] as const).map(([role, company, party]) => (
            <div className="party" key={role}>
              <p><b>{role}:</b> {company}</p>
              {[1, 2].map((i) => (
                <p className="person" key={i}>Ông: {signer(`nguoi_${party}_${i}_ten`)} &nbsp; Chức vụ: {signer(`nguoi_${party}_${i}_cv`)}</p>
              ))}
            </div>
          ))}

          <h3>5. Kết luận:</h3>
          <p className="conclude-line">{mark(true)} Chấp thuận nghiệm thu, đồng ý cho triển khai các công việc xây dựng tiếp theo.</p>
          <p className="conclude-line">{BOX} Không đồng ý nghiệm thu.</p>
          <div className="dots" />
          <div className="dots" />

          <h3>6. Các thành phần trực tiếp tham gia nghiệm thu:</h3>
          <div className="work-sign">
            {labels.map((name, index) => {
              const party = PARTY_KEYS[index];
              const signed = [1, 2].map((i) => resolveSigner(t, signerDefaults, party, i)).filter((s) => signatureOf(s.ten));
              return (
                <div key={name}>
                  {name}
                  <small>(Ký và ghi rõ họ tên)</small>
                  {signed.map((s) => (
                    <span className="auto-sign" key={s.ten}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={signatureOf(s.ten)} alt="" />
                      <small>{s.ten}</small>
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        </PrintFrame>
</article>
      );
    }

    // (3) Biên bản nghiệm thu hoàn thành công việc — theo mẫu PDF 2 trang.
    const cdt = pq ? "Ban Quản lý dự án - Công ty TNHH MTV BOT tàu điện Phú Quốc" : blank;
    const tvgsHt = t.ben_nhan || (pq ? "Tư vấn giám sát – Công ty CP TVTK XDCT GT Miền Bắc (Tedi North)" : blank);
    const ntcHt = t.ben_moi || (pq ? "Tập đoàn Đường sắt Quốc gia Việt Nam" : blank);
    const ntpHt = "Công ty cổ phần công trình Thành Phát";
    const stamp = (title: string) => (
      <div className="complete-sign" key={title}>
        {title}
        <small>(Ký đóng dấu và ghi rõ họ tên)</small>
      </div>
    );
    // Các thành phần tham gia: dùng chung cho mục 4, chữ ký và bảng chức vụ để luôn khớp nhau.
    const parties = [
      { no: "4.1", label: "Chủ đầu tư", stamp: "CHỦ ĐẦU TƯ", org: cdt, role: "Trưởng ban Ban QLDA" },
      { no: "4.2", label: "Tư vấn Giám sát", stamp: "TƯ VẤN GIÁM SÁT", org: tvgsHt, role: "Giám sát trưởng" },
      { no: "4.3", label: "Tư vấn thiết kế", stamp: "TƯ VẤN THIẾT KẾ", org: "", role: "Chủ trì thiết kế" },
      { no: "4.4", label: "Nhà thầu chính", stamp: "NHÀ THẦU CHÍNH", org: ntcHt, role: "Chỉ huy trưởng nhà thầu chính" },
      { no: "4.5", label: "Nhà thầu phụ", stamp: "NHÀ THẦU PHỤ", org: ntpHt, role: "Chỉ huy trưởng nhà thầu phụ" },
    ];
    // Phần tự nhập (lưu qua "Sửa thông tin in"): có nội dung thì in ra, chưa có thì để dòng chấm.
    const field = (key: string, lines: number) => {
      const text = str((t as Record<string, unknown>)[key]).trim();
      return text
        ? <p style={{ whiteSpace: "pre-wrap", margin: "2px 0 4px" }}>{text}</p>
        : <>{Array.from({ length: lines }, (_, i) => <div className="dots" key={i} />)}</>;
    };
    const personBlock = () => (
      <>
        <p className="person">Ông: …………………… &nbsp; Chức vụ: ……………………</p>
        <p className="person">Ông: …………………… &nbsp; Chức vụ: ……………………</p>
      </>
    );

    return (
      <>
        <article key={`${doc.kind}-1`} className="acceptance-page work-page">
<PrintFrame>
          <div className="nation">
            CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM<br />
            <span className="motto">Độc lập - Tự do - Hạnh phúc</span>
            <div className="ornament">----------- ✦ -----------</div>
          </div>
          <p className="place-date">
            {pq ? "Phú Quốc" : (location.split(",")[0]?.trim() || "…………")}, ngày {parts.d} tháng {parts.m} năm {parts.y}
          </p>
          <h2>{doc.title}</h2>
          <p className="doc-no">Số: {show(rfi.so_phieu)}/BBNTHT</p>
          <p>RFI hình học: {show(geometryRfi)} · RFI siêu âm: {show(ultrasoundRfi)}</p>

          <p className="field-row"><span className="field-label">Dự án</span>: {show(projectName)}</p>
          <p className="field-row"><span className="field-label">Gói thầu</span>: {show(packageName)}</p>
          <p className="field-row"><span className="field-label">Hạng mục</span>: Thi công hàn ray</p>
          <p className="field-row"><span className="field-label">Địa điểm</span>: {show(location)}</p>

          <h3>1. Đối tượng nghiệm thu:</h3>
          <p>- Nghiệm thu mối hàn ray</p>

          <h3>2. Thời gian nghiệm thu:</h3>
          <p>Bắt đầu&nbsp;&nbsp;: {timeText(t.gio_bat_dau)} ngày {parts.d} tháng {parts.m} năm {parts.y}</p>
          <p>Kết thúc&nbsp;: {timeText(t.gio_ket_thuc)} ngày {parts.d} tháng {parts.m} năm {parts.y}</p>

          <h3>3. Vị trí nghiệm thu:</h3>
          <p>Lý trình : Từ: Km {kmFrom} đến Km {kmTo}</p>

          <h3>4. Thành phần trực tiếp tham gia nghiệm thu:</h3>
          {parties.map((pt) => (
            <div className="party" key={pt.no}>
              <p><b>{pt.no}. {pt.label}:</b> {pt.org}</p>
              {personBlock()}
            </div>
          ))}

          <h3>5. Đánh giá công việc đã thực hiện:</h3>
          <p><b>a) Các tài liệu căn cứ nghiệm thu:</b></p>
          {field("tai_lieu_can_cu", 2)}
          <p><b>b) Đánh giá về chất lượng về chất lượng công trình xây dựng so với thiết kế được phê duyệt:</b></p>
          {field("danh_gia_chat_luong", 2)}
        </PrintFrame>
</article>

        <article key={`${doc.kind}-2`} className="acceptance-page work-page">
<PrintFrame>
          <p><b>c) Những điều chỉnh và thay đổi bổ sung trong quá trình thi công so với thiết kế được phê duyệt ( có phụ lục đính kèm):</b></p>
          {field("dieu_chinh", 2)}
          <p><b>d) Đánh giá chất lượng hạng mục công trình:</b></p>
          <p>- So với thiết kế, chỉ dẫn kỹ thuật: {show(t.so_voi_thiet_ke)}</p>
          <p>- So với hợp đồng: {show(t.so_voi_hop_dong)}</p>
          <p><b>e) Kết quả thí nghiệm, kiểm tra, kiểm định, thử nghiệm, chạy thử theo các yêu cầu kỹ thuật theo quy định của thiết kế xây dựng:</b></p>
          {field("ket_qua_thi_nghiem", 2)}
          <p><b>f) Tuân thủ các quy định của pháp luật về phòng cháy và chữa cháy, bảo vệ môi trường trong thi công xây dựng công trình và quy định của pháp luật chuyên ngành khác có liên quan</b></p>
          {field("tuan_thu_phccc", 1)}
          <p><b>g) Các ý kiến khác nếu có:</b></p>
          {field("y_kien_khac", 2)}

          <h3>6. Kết luận :</h3>
          <table className="conclude-table">
            <tbody>
              <tr>
                <td>
                  - Chấp thuận nghiệm thu hoàn thành hạng mục công trình hoặc công trình xây dựng để chuyển giai đoạn thi công
                </td>
                <td style={{ width: 40, textAlign: "center" }}>{mark(true)}</td>
              </tr>
              <tr>
                <td>- Không đồng ý nghiệm thu</td>
                <td style={{ width: 40, textAlign: "center" }}>{BOX}</td>
              </tr>
            </tbody>
          </table>

          <h3>7. Chữ ký các thành phần trực tiếp tham gia nghiệm thu:</h3>
          <div style={{ display: "grid", justifyItems: "center" }}>{stamp(parties[0].stamp)}</div>
          <div className="complete-sign-row">
            {stamp(parties[1].stamp)}
            {stamp(parties[2].stamp)}
          </div>
          <div className="complete-sign-row">
            {stamp(parties[3].stamp)}
            {stamp(parties[4].stamp)}
          </div>

          <table className="sign-roster">
            <thead>
              <tr>
                <th style={{ width: "26%" }}>Thành phần</th>
                <th style={{ width: "22%" }}>Chức vụ</th>
                <th style={{ width: "26%" }}>Họ và tên</th>
                <th style={{ width: "26%" }}>Chữ ký</th>
              </tr>
            </thead>
            <tbody>
              {parties.map((pt) => (
                <tr key={pt.no}>
                  <td>{pt.label}{pt.org ? <><br /><small>{pt.org}</small></> : null}</td>
                  <td>{pt.role}</td>
                  <td />
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </PrintFrame>
</article>
      </>
    );
  })}</>;
}
