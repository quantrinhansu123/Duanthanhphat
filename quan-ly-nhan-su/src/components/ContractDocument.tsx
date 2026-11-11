"use client";

import { createPortal } from "react-dom";
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

/** Bản in hợp đồng A4. Render qua portal vì khung chat bị ẩn khi in. */
export default function ContractDocument({ data: d, onClose }: { data: ContractData; onClose: () => void }) {
  const [y, m, day] = (d.ngayKy || "").split("-");
  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-auto bg-slate-900/70 p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Hợp đồng thi công">
      <style>{css}</style>
      <div className="contract-actions sticky top-0 z-[110] mx-auto mb-3 flex max-w-[800px] justify-end gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
        <button type="button" onClick={() => window.print()} className="h-10 rounded-lg bg-[#0047AB] px-5 text-sm font-semibold text-white cursor-pointer hover:bg-[#00388A]">In / Lưu PDF</button>
        <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-300 bg-slate-100 px-5 text-sm font-semibold text-slate-900 cursor-pointer hover:bg-slate-200">Đóng</button>
      </div>
      <div id="contract-print" className="mx-auto max-w-[800px] bg-white text-[13px] leading-relaxed text-slate-900">
        <PrintFrame>
          <div className="p-6 print:p-0">
            <div className="text-center font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br />Độc lập – Tự do – Hạnh phúc</div>
            <p className="mt-1 text-center">{d.diaDiemKy}, ngày {day} tháng {m} năm {y}</p>
            <h1 className="mt-4 text-center text-lg font-extrabold uppercase">Hợp đồng thi công</h1>
            <p className="text-center">Số: {d.soHD}</p>
            <p className="mt-3 text-justify">Hôm nay, ngày {dmy(d.ngayKy)}, tại {d.diaDiemKy}, chúng tôi gồm:</p>
            <p className="mt-2"><b>BÊN A (Chủ đầu tư / Bên giao thầu): {d.aTen}</b><br />Địa chỉ: {d.aDiaChi}<br />Đại diện: {d.aDaiDien} — Chức vụ: {d.aChucVu}</p>
            <p className="mt-2"><b>BÊN B (Nhà thầu): {d.bTen}</b><br />Đại diện: {d.bDaiDien} — Chức vụ: {d.bChucVu}</p>
            <p className="mt-2 text-justify">Hai bên thống nhất ký kết hợp đồng thi công với các điều khoản sau:</p>
            <p className="mt-2 text-justify"><b>Điều 1. Nội dung công việc.</b> Bên A giao và Bên B nhận thực hiện thi công hạng mục <b>{d.hangMuc}</b> thuộc dự án <b>{d.duAn}</b>.</p>
            <p className="mt-2 text-justify"><b>Điều 2. Thời gian thực hiện.</b> Từ ngày {dmy(d.tuNgay)} đến ngày {dmy(d.denNgay)}.</p>
            <p className="mt-2 text-justify"><b>Điều 3. Giá trị hợp đồng.</b> Tổng giá trị hợp đồng là <b>{money(d.giaTri)}</b>.</p>
            <p className="mt-2 text-justify"><b>Điều 4. Thanh toán.</b> {d.thanhToan?.trim() || "Hai bên thỏa thuận thanh toán theo khối lượng nghiệm thu thực tế."}</p>
            <p className="mt-2 text-justify"><b>Điều 5. Điều khoản chung.</b> Hai bên cam kết thực hiện đúng các điều khoản của hợp đồng. Mọi thay đổi phải được hai bên thống nhất bằng văn bản. Hợp đồng được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.</p>
            <div className="mt-8 grid grid-cols-2 text-center font-bold uppercase">
              <div>Đại diện Bên A<div className="mb-16 text-[11px] font-normal normal-case italic">(Ký, ghi rõ họ tên)</div><span className="normal-case">{d.aDaiDien}</span></div>
              <div>Đại diện Bên B<div className="mb-16 text-[11px] font-normal normal-case italic">(Ký, ghi rõ họ tên)</div><span className="normal-case">{d.bDaiDien}</span></div>
            </div>
          </div>
        </PrintFrame>
      </div>
    </div>,
    document.body,
  );
}
