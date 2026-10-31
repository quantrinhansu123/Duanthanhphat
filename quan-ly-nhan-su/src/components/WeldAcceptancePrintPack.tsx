"use client";

import { useEffect } from "react";
import type { RecordSet } from "@/lib/weldQualityClient";

const DOCS: { loai: string; title: string }[] = [
  { loai: "Phụ lục công việc", title: "PHỤ LỤC BIÊN BẢN NGHIỆM THU MỐI HÀN" },
  { loai: "Giai đoạn xây dựng", title: "BIÊN BẢN NGHIỆM THU CÔNG VIỆC" },
  { loai: "Hoàn thành công việc", title: "BIÊN BẢN HOÀN THÀNH CÔNG VIỆC" },
];

const css = `@media print {
  body * { visibility: hidden !important; }
  #weld-print-pack, #weld-print-pack * { visibility: visible !important; }
  #weld-print-pack { position: absolute; left: 0; top: 0; width: 100%; background: #fff; color: #000; }
  .weld-print-pack-actions { display: none !important; }
  #weld-print-pack .pack-page { break-after: page; page-break-after: always; }
  #weld-print-pack .pack-page:last-child { break-after: auto; page-break-after: auto; }
  @page { size: A4; margin: 14mm; }
}`;

type Row = { code: string; date: string; result: string };

function weldRows(record: RecordSet): Row[] {
  return record.moi
    .map((m) => {
      const w = m.du_lieu_chot.moi_han ?? {};
      return { code: String(w.ma_lich_su ?? ""), date: String(w.ngay_thuc_hien ?? ""), result: m.ket_qua };
    })
    .sort((a, b) => a.code.localeCompare(b.code, "vi", { numeric: true }));
}

export default function WeldAcceptancePrintPack({
  record,
  onClose,
  autoPrint = true,
}: {
  record: RecordSet;
  onClose: () => void;
  autoPrint?: boolean;
}) {
  const { dot } = record;
  const rfi = dot.phieu_yeu_cau_nghiem_thu as Record<string, unknown> & { so_phieu?: string; du_an?: Record<string, unknown> };
  const projectName = String(rfi.du_an?.du_an ?? rfi.du_an?.ten_du_an ?? rfi.du_an?.name ?? "");
  const t = (dot.thong_tin ?? {}) as Record<string, string>;
  const rows = weldRows(record);
  const missing = DOCS.filter((d) => !record.ho_so.some((h) => h.loai === d.loai));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!autoPrint || missing.length) return;
    const previous = document.title;
    document.title = " ";
    const timer = window.setTimeout(() => {
      window.print();
      const restore = () => { document.title = previous; };
      window.addEventListener("afterprint", restore, { once: true });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [autoPrint, missing.length]);

  function printNow() {
    const previous = document.title;
    document.title = " ";
    const restore = () => { document.title = previous; };
    window.addEventListener("afterprint", restore, { once: true });
    window.print();
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-auto bg-slate-900/70 p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="In bộ biên bản nghiệm thu">
      <style>{css}</style>
      <div className="weld-print-pack-actions mx-auto mb-3 flex max-w-3xl flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
        <p className="text-sm text-slate-700">
          Bộ hồ sơ mang hiện trường: <b>(1) Phụ lục</b> · <b>(2) Nghiệm thu công việc</b> · <b>(3) Hoàn thành công việc</b>
          {missing.length ? <span className="text-amber-700"> — thiếu {missing.length} biên bản (chạy migration phát RFI nếu chưa có).</span> : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={Boolean(missing.length)} onClick={printNow} className="h-10 rounded-lg bg-[#0047AB] px-5 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer hover:bg-[#00388A]">
            In / Lưu PDF
          </button>
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-300 bg-slate-100 px-5 text-sm font-semibold text-slate-900 cursor-pointer hover:bg-slate-200">
            Thoát
          </button>
        </div>
      </div>

      <div id="weld-print-pack" className="mx-auto max-w-3xl space-y-0 text-sm text-black">
        {DOCS.map((doc) => (
          <article key={doc.loai} className="pack-page bg-white p-8">
            <div className="text-center text-xs font-bold uppercase">
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
              <br />
              <span className="underline normal-case">Độc lập - Tự do - Hạnh phúc</span>
            </div>
            <h2 className="mt-4 text-center text-base font-extrabold">{doc.title}</h2>
            <p className="mt-2 text-center">Dự án: <b>{projectName || "………………"}</b></p>
            <dl className="mt-4 grid grid-cols-[11rem_1fr] gap-y-1">
              <div className="contents"><dt className="font-semibold">Số RFI:</dt><dd>{String(rfi.so_phieu ?? "……")}</dd></div>
              <div className="contents"><dt className="font-semibold">Ngày:</dt><dd>{String(dot.ngay_nghiem_thu ?? "……")}</dd></div>
              <div className="contents"><dt className="font-semibold">Địa điểm:</dt><dd>{t.dia_diem || "………………"}</dd></div>
              <div className="contents"><dt className="font-semibold">Người lập:</dt><dd>{String(dot.nguoi_lap ?? "……")}</dd></div>
            </dl>
            <p className="mt-3">
              Tổng {rows.length} mối trong phiếu. Kết quả hiện trường sẽ cập nhật sau siêu âm / nghiệm thu.
            </p>
            {rows.length > 0 && (
              <table className="mt-3 w-full border-collapse text-xs">
                <thead>
                  <tr>
                    {["STT", "Mã mối hàn", "Ngày hàn", "Kết quả"].map((h) => (
                      <th key={h} className="border border-black p-1">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.code + i}>
                      <td className="border border-black p-1 text-center">{i + 1}</td>
                      <td className="border border-black p-1">{r.code}</td>
                      <td className="border border-black p-1 text-center">{r.date || "—"}</td>
                      <td className="border border-black p-1 text-center">{r.result === "Chưa nghiệm thu" ? "………………" : r.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-10 grid grid-cols-3 gap-4 text-center text-sm">
              {["Đại diện nhà thầu", "Tư vấn giám sát", "Chủ đầu tư"].map((s) => (
                <div key={s}>
                  <b>{s}</b>
                  <div className="mt-14 text-slate-500">(ký, ghi rõ họ tên)</div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
