"use client";

import { renderToStaticMarkup } from "react-dom/server";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import PrintFrame from "@/components/PrintFrame";
import type { ContractData } from "@/components/ContractForm";

const css = `@media print {
  body * { visibility: hidden !important; }
  #contract-print, #contract-print * { visibility: visible !important; }
  #contract-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0; background: #fff; }
  .contract-actions { display: none !important; }
  @page { size: A4; margin: 0; }
}`;

const dmy = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "……");
const money = (v: string) => (v ? `${Number(v).toLocaleString("vi-VN")} đồng` : "……");

const C: CSSProperties = { textAlign: "center" };
const J: CSSProperties = { textAlign: "justify", marginTop: 8 };
const P: CSSProperties = { marginTop: 8 };

/** Nội dung hợp đồng. Dùng style nội tuyến (không Tailwind) để bản xem trước và file Word giống hệt nhau. */
function ContractBody({ d }: { d: ContractData }) {
  const [y, m, day] = (d.ngayKy || "").split("-");
  return (
    <div style={{ fontFamily: '"Times New Roman", serif', fontSize: "13pt", lineHeight: 1.4, color: "#000" }}>
      <div style={{ ...C, fontWeight: "bold" }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br />Độc lập – Tự do – Hạnh phúc</div>
      <p style={{ ...C, marginTop: 4 }}>{d.diaDiemKy}, ngày {day} tháng {m} năm {y}</p>
      <h1 style={{ ...C, marginTop: 16, fontSize: "16pt", fontWeight: "bold", textTransform: "uppercase" }}>Hợp đồng thi công</h1>
      <p style={C}>Số: {d.soHD}</p>
      <p style={{ ...J, marginTop: 12 }}>Hôm nay, ngày {dmy(d.ngayKy)}, tại {d.diaDiemKy}, chúng tôi gồm:</p>
      <p style={P}><b>BÊN A (Chủ đầu tư / Bên giao thầu): {d.aTen}</b><br />Địa chỉ: {d.aDiaChi}<br />Đại diện: {d.aDaiDien} — Chức vụ: {d.aChucVu}</p>
      <p style={P}><b>BÊN B (Nhà thầu): {d.bTen}</b><br />Đại diện: {d.bDaiDien} — Chức vụ: {d.bChucVu}</p>
      <p style={J}>Hai bên thống nhất ký kết hợp đồng thi công với các điều khoản sau:</p>
      <p style={J}><b>Điều 1. Nội dung công việc.</b> Bên A giao và Bên B nhận thực hiện thi công hạng mục <b>{d.hangMuc}</b> thuộc dự án <b>{d.duAn}</b>.</p>
      <p style={J}><b>Điều 2. Thời gian thực hiện.</b> Từ ngày {dmy(d.tuNgay)} đến ngày {dmy(d.denNgay)}.</p>
      <p style={J}><b>Điều 3. Giá trị hợp đồng.</b> Tổng giá trị hợp đồng là <b>{money(d.giaTri)}</b>.</p>
      <p style={J}><b>Điều 4. Thanh toán.</b> {d.thanhToan?.trim() || "Hai bên thỏa thuận thanh toán theo khối lượng nghiệm thu thực tế."}</p>
      <p style={J}><b>Điều 5. Điều khoản chung.</b> Hai bên cam kết thực hiện đúng các điều khoản của hợp đồng. Mọi thay đổi phải được hai bên thống nhất bằng văn bản. Hợp đồng được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.</p>
      <table style={{ width: "100%", marginTop: 32, textAlign: "center", fontWeight: "bold", textTransform: "uppercase" }}>
        <tbody><tr>
          <td>Đại diện Bên A<div style={{ fontSize: "11pt", fontWeight: "normal", textTransform: "none", fontStyle: "italic", marginBottom: 64 }}>(Ký, ghi rõ họ tên)</div><span style={{ textTransform: "none" }}>{d.aDaiDien}</span></td>
          <td>Đại diện Bên B<div style={{ fontSize: "11pt", fontWeight: "normal", textTransform: "none", fontStyle: "italic", marginBottom: 64 }}>(Ký, ghi rõ họ tên)</div><span style={{ textTransform: "none" }}>{d.bDaiDien}</span></td>
        </tr></tbody>
      </table>
    </div>
  );
}

/** Tải hợp đồng thành file Word (.doc: HTML mà Word mở được), lề chuẩn A4 của team: trái 2, trên 1.5, phải 1, dưới 1 cm. */
export function downloadContractDoc(d: ContractData) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Hợp đồng ${d.soHD ?? ""}</title><style>@page Section1 { size: 21cm 29.7cm; margin: 1.5cm 1cm 1cm 2cm; } div.Section1 { page: Section1; }</style></head><body><div class="Section1">${renderToStaticMarkup(<ContractBody d={d} />)}</div></body></html>`;
  const url = URL.createObjectURL(new Blob(["﻿", html], { type: "application/msword" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `Hop-dong-${(d.soHD || "moi").replace(/[^\w.-]+/g, "-")}.doc` });
  a.click();
  URL.revokeObjectURL(url);
}

/** Bản in hợp đồng A4. Render qua portal vì khung chat bị ẩn khi in. */
export default function ContractDocument({ data: d, onClose }: { data: ContractData; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-auto bg-slate-900/70 p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Hợp đồng thi công">
      <style>{css}</style>
      <div className="contract-actions sticky top-0 z-[110] mx-auto mb-3 flex max-w-[800px] justify-end gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
        <button type="button" onClick={() => downloadContractDoc(d)} className="h-10 rounded-lg border border-slate-300 bg-slate-100 px-5 text-sm font-semibold text-slate-900 cursor-pointer hover:bg-slate-200">Tải file Word</button>
        <button type="button" onClick={() => window.print()} className="h-10 rounded-lg bg-[#0047AB] px-5 text-sm font-semibold text-white cursor-pointer hover:bg-[#00388A]">In / Lưu PDF</button>
        <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-300 bg-slate-100 px-5 text-sm font-semibold text-slate-900 cursor-pointer hover:bg-slate-200">Đóng</button>
      </div>
      <div id="contract-print" className="mx-auto max-w-[800px] bg-white">
        <PrintFrame>
          <div className="p-6 print:p-0"><ContractBody d={d} /></div>
        </PrintFrame>
      </div>
    </div>,
    document.body,
  );
}
