"use client";

import type { RecordSet } from "@/lib/weldQualityClient";

const ROWS_PER_PAGE = 20;
const css = `@media print {
  body * { visibility: hidden !important; }
  #weld-bbnt-print, #weld-bbnt-print * { visibility: visible !important; }
  #weld-bbnt-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0; background: #fff; }
  #weld-bbnt-print section { break-after: page; } #weld-bbnt-print section:last-child { break-after: auto; }
  .weld-doc-actions { display: none !important; }
  @page { size: A4 landscape; margin: 8mm; }
}`;
const th = "border border-slate-700 p-1 text-center font-bold";
const td = "border border-slate-700 p-1 text-center";
const BOX = "❐";

type Row = { code: string; rail: string; visual: string; ndt: string; geo: (number | null | undefined)[]; result: string; note: string };

const str = (v: unknown) => (v == null ? "" : String(v));

/** Mối đã nghiệm thu (Đạt / Không đạt) lấy từ dữ liệu chốt của đợt nghiệm thu. */
function rowsOf(record: RecordSet): Row[] {
  return record.moi.filter((m) => m.ket_qua !== "Chưa nghiệm thu").map((m) => {
    const w = m.du_lieu_chot.moi_han ?? {}, k = m.du_lieu_chot.kiem_tra ?? {};
    const g = (k.gia_tri_do ?? {}) as Record<string, number | null>;
    const method = str(k.phuong_phap_ndt);
    return { code: str(w.ma_lich_su), rail: str(w.loai_ray), visual: str(k.truc_quan),
      ndt: k.ket_qua_ndt ? `${k.ket_qua_ndt}${method && method !== "Siêu âm" ? ` (${method})` : ""}` : "",
      geo: [g.doc_mat_lan, g.ngang_nam_ray, g.ngang_chan_ray, g.phang_mat_lan],
      result: m.ket_qua, note: m.ly_do ?? "" };
  }).sort((a, b) => a.code.localeCompare(b.code, "vi", { numeric: true }));
}

export default function WeldBbntDocument({ record, onClose }: { record: RecordSet; onClose: () => void }) {
  const { dot } = record, rfi = dot.phieu_yeu_cau_nghiem_thu;
  const info = (dot.thong_tin ?? {}) as Record<string, string>;
  const projectName = str(rfi.du_an?.du_an ?? rfi.du_an?.ten_du_an ?? rfi.du_an?.name);
  const rows = rowsOf(record);
  const pages = Array.from({ length: Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE)) }, (_, p) => rows.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE));

  return (
    <div className="fixed inset-0 z-[100] overflow-auto bg-slate-900/70 p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Biên bản nghiệm thu mối hàn">
      <style>{css}</style>
      <div className="weld-doc-actions sticky top-0 z-[110] mx-auto mb-3 flex max-w-[1100px] flex-wrap justify-end gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
        <button type="button" onClick={() => window.print()} className="h-10 rounded-lg bg-[#0047AB] px-5 text-sm font-semibold text-white cursor-pointer hover:bg-[#00388A]">In / Lưu PDF</button>
        <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-300 bg-slate-100 px-5 text-sm font-semibold text-slate-900 cursor-pointer hover:bg-slate-200">Thoát</button>
      </div>
      <div id="weld-bbnt-print" className="mx-auto max-w-[1100px] text-[11px] text-slate-900">
        {pages.map((page, p) => (
          <section key={p} className="mb-4 bg-white p-6">
            <div className="flex justify-between font-bold uppercase">
              <div>Dự án: {projectName}<br />Hạng mục: Thi công hàn ray</div>
              <div className="text-right normal-case">Địa điểm: {info.dia_diem}</div>
            </div>
            <h2 className="my-2 text-center text-base font-extrabold uppercase">Biên bản nghiệm thu mối hàn chảy giáp mép</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              <p><b>TÊN TÀI LIỆU:</b> NGHIỆM THU CÔNG TÁC HÀN HIỆN TRƯỜNG (HÀN SẢN XUẤT)</p>
              <p><b>CA HÀN:</b> {BOX} Ngày &nbsp; {BOX} Đêm</p>
              <p><b>RFI/ ITR No:</b> {str(rfi.so_phieu)}</p>
              <p><b>BIỆN PHÁP HÀN:</b> {BOX} Hàn cố định &nbsp; {BOX} Hàn di động</p>
              <p><b>NGÀY NGHIỆM THU:</b> {str(dot.ngay_nghiem_thu)}</p>
              <p><b>LÝ TRÌNH:</b> Từ: ……………… Đến: ………………</p>
              <p><b>TÊN THỢ HÀN:</b> ………………………… &nbsp; <b>ID:</b> …………</p>
              <p><b>TUYẾN:</b> {BOX} Tuyến thượng &nbsp; {BOX} Tuyến hạ</p>
              <p><b>VỊ TRÍ:</b> ……………………………</p>
              <p><b>MÁY HÀN CHẢY GIÁP MÉP:</b> Máy hàn: ………… Goòng phẳng: …………</p>
            </div>
            <table className="mt-2 w-full border-collapse">
              <thead>
                <tr>
                  <th className={th} rowSpan={3}>No.</th><th className={th} rowSpan={3}>TÊN MỐI HÀN</th>
                  <th className={th} rowSpan={3}>MÃ HIỆU RAY<br />(60R2 - U75V)</th><th className={th} rowSpan={3}>LÝ TRÌNH MỐI HÀN</th>
                  <th className={th} colSpan={2} rowSpan={2}>RAY</th>
                  <th className={th} colSpan={8}>NGHIỆM THU KÍCH THƯỚC HÌNH HỌC (ĐẠT/KHÔNG ĐẠT)</th>
                  <th className={th} rowSpan={3}>GHI CHÚ</th>
                </tr>
                <tr>
                  <th className={th} rowSpan={2}>KIỂM TRA TỔNG THỂ MỐI HÀN BẰNG MẮT THƯỜNG</th><th className={th} rowSpan={2}>KIỂM TRA SIÊU ÂM</th>
                  <th className={th} colSpan={5}>Kiểm tra độ thẳng và độ phẳng của mối hàn</th><th className={th} rowSpan={2}>Nằm trong giới hạn cho phép</th>
                </tr>
                <tr>
                  <th className={th}>RAY TRÁI</th><th className={th}>RAY PHẢI</th>
                  {[1, 2, 3, 4, 5].map((n) => <th key={n} className={th}>{n}</th>)}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: ROWS_PER_PAGE }, (_, i) => {
                  const r = page[i];
                  return (
                    <tr key={i} className="h-7">
                      <td className={td}>{p * ROWS_PER_PAGE + i + 1}</td><td className={td}>{r?.code}</td><td className={td}>{r?.rail}</td><td className={td} />
                      <td className={td} /><td className={td} />
                      <td className={td}>{r?.visual}</td><td className={td}>{r?.ndt}</td>
                      {[0, 1, 2, 3].map((n) => <td key={n} className={td}>{r?.geo[n] ?? ""}</td>)}<td className={td} />
                      <td className={td}>{r?.result}</td><td className={td}>{r?.note}</td>
                    </tr>);
                })}
              </tbody>
            </table>
            <div className="mt-2 grid grid-cols-2 gap-6 text-[10px]">
              <div>
                <p>1. Tên tiêu chuẩn áp dụng: TCVN 13965-2:2024 – Ứng dụng đường sắt – Hàn ray – Hàn chảy giáp mối – Phần 2</p>
                <p>2. Tiêu chuẩn tham chiếu bổ sung cho ray rãnh và các nội dung chưa được quy định chi tiết trong TCVN: CECS 429 : 2016 – Tiêu chuẩn nghiệm thu chất lượng hàn chảy giáp mép ray rãnh cho đường sắt đô thị.</p>
              </div>
              <table className="border-collapse">
                <thead><tr><th className={th}>Đối chiếu độ phẳng và thẳng mối hàn</th><th className={th}>Sai số cho phép (mm)</th></tr></thead>
                <tbody>
                  {[["1. Theo chiều dọc trên mặt lăn.", "+0.4 / -0.10"], ["2. Theo chiều ngang trên nấm ray.", "± 0.4 (1)"], ["3. Theo chiều ngang trên các đầu chân ray.", "± 2.0"],
                    ["4. Độ phẳng mặt lăn, được đo trên chiều dài khu vực mài.", "0.2 (2)"], ["5. Chiều dài mài hoàn thiện", "≤ 800"]].map(([a, b]) => (
                    <tr key={a}><td className="border border-slate-700 p-1">{a}</td><td className={td}>{b}</td></tr>))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px]">(1): Đối với độ thẳng theo phương ngang, dung sai dương (+) sẽ làm tăng khổ đường. (2): Đối với độ phẳng mặt lăn, chỉ đo giá trị lớn nhất.</p>
            <div className="mt-3 grid grid-cols-3 gap-4 font-bold uppercase">
              {["Đại diện tư vấn giám sát", "Đại diện nhà thầu chính", "Đại diện nhà thầu phụ"].map((s) => (
                <div key={s}>{s}<div className="mt-1 font-normal normal-case leading-6">Họ và tên: …………………<br />Ngày: …………………<br />Chữ ký:</div></div>))}
            </div>
            <p className="mt-1 text-right text-[9px] text-slate-500">Trang {p + 1}/{pages.length}</p>
          </section>))}
      </div>
    </div>
  );
}
