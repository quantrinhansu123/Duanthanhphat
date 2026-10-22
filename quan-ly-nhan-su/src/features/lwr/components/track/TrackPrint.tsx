"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { formatChainage, getPlacementSpan, railRowKey, trackExtent, type TrackLayout } from "@lwr/lib/track-editor";
import { jointDisplayMethod, weldMethodTone } from "@lwr/lib/weld-track-map";
import type { RailJoint } from "@lwr/types/weld";

const FORMATS = {
  A4: { label: "A4 ngang", size: "297mm 210mm", width: "297mm", metres: 2000 },
  A3: { label: "A3 ngang", size: "420mm 297mm", width: "420mm", metres: 4000 },
  LONG: { label: "A3 kéo dài (841 × 297 mm)", size: "841mm 297mm", width: "841mm", metres: 10000 },
};

export function TrackPrint({ layout, joints, onClose, projectName }: { layout: TrackLayout; joints: RailJoint[]; onClose: () => void; projectName?: string }) {
  const [format, setFormat] = useState<keyof typeof FORMATS>("A4");
  const config = FORMATS[format];
  const extent = trackExtent(layout.rows);
  const count = Math.max(1, Math.ceil((extent.endMetres - extent.startMetres) / config.metres));
  const stamp = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  const plotted = layout.longRails.flatMap(rail => { const span = getPlacementSpan(layout.rows, rail); return span ? [{ rail, span }] : []; });
  return createPortal(<div id="lwr-track-print" role="dialog" aria-modal="true" aria-label="Xem trước bản in sơ đồ tuyến">
    <style>{`
      #lwr-track-print { position:fixed; inset:0; z-index:2100; background:#e2e8f0; overflow:auto; color:#111; }
      #lwr-track-print .toolbar { position:sticky; top:0; z-index:1; display:flex; gap:12px; padding:12px; background:white; border-bottom:1px solid #aaa; }
      #lwr-track-print .toolbar button, #lwr-track-print select { border:1px solid #aaa; border-radius:4px; padding:6px 12px; }
      #lwr-track-print article { width:${config.width}; box-sizing:border-box; margin:16px auto; padding:10mm; background:white; font:10pt 'Times New Roman',serif; }
      #lwr-track-print h1 { font-size:15pt; text-align:center; font-weight:bold; margin:4px; }
      #lwr-track-print p { margin:3px 0; }
      #lwr-track-print table { border-collapse:collapse; width:100%; margin-top:8px; font-size:9pt; }
      #lwr-track-print th,#lwr-track-print td { border:1px solid #888; padding:4px 6px; text-align:left; }
      #lwr-track-print tr { break-inside:avoid; }
      #lwr-track-print svg { width:100%; height:${format === "A4" ? "90mm" : "130mm"}; }
      @media print {
        @page { size:${config.size}; margin:8mm; }
        body:has(#lwr-track-print) > :not(#lwr-track-print) { display:none!important; }
        #lwr-track-print { position:static; overflow:visible; background:white; print-color-adjust:exact; -webkit-print-color-adjust:exact; }
        #lwr-track-print .toolbar { display:none; }
        #lwr-track-print article { width:auto; margin:0; padding:0; break-after:page; }
        #lwr-track-print article:last-child { break-after:auto; }
        #lwr-track-print thead { display:table-header-group; }
      }
    `}</style>
    <div className="toolbar"><select aria-label="Khổ giấy" value={format} onChange={e => setFormat(e.target.value as keyof typeof FORMATS)}>{Object.entries(FORMATS).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select><button onClick={() => window.print()}>In / lưu PDF</button><button onClick={onClose}>Đóng</button></div>
    {Array.from({ length: count }, (_, index) => {
      const start = extent.startMetres + index * config.metres, end = Math.min(extent.endMetres, start + config.metres);
      const x = (metres: number) => 140 + (metres - start) / Math.max(1, end - start) * 900;
      const pageRails = plotted.filter(({ span }) => span.endMetres > start && span.startMetres < end);
      return <article key={index}>
        <p>CÔNG TY CỔ PHẦN CÔNG TRÌNH THÀNH PHÁT</p>
        <h1>SƠ ĐỒ TUYẾN VÀ GIẢI TOẢ ỨNG SUẤT LWR</h1>
        <p>Dự án: {projectName ?? "Chưa gán dự án"}</p>
        <p>Km{formatChainage(start)} – Km{formatChainage(end)} · Tờ {index + 1}/{count} · {stamp}</p>
        <p>Ray trái/phải nhìn theo chiều lý trình tăng. Mối hàn: trắng = chưa chọn; xanh = FBW; đỏ = nhiệt nhôm; vàng = ray đơn.</p>
        <svg viewBox={`0 0 1100 ${layout.rows.length * 110 + 45}`} aria-label="Sơ đồ theo lý trình">
          {Array.from({ length: 6 }, (_, tick) => { const m = start + Math.round((end - start) * tick / 5); return <g key={tick}><line x1={x(m)} x2={x(m)} y1={20} y2={layout.rows.length * 110 + 20} stroke="#ddd" /><text x={x(m)} y={14} textAnchor="middle" fontSize={11}>{formatChainage(m)}</text></g>; })}
          {layout.rows.map((row, rowIndex) => {
            const key = railRowKey(row), y = 55 + rowIndex * 110;
            return <g key={key}>
              <text x={0} y={y} fontSize={12}>{row.line}</text><text x={0} y={y + 17} fontSize={12}>{row.rail}</text>
              <line x1={140} x2={1040} y1={y} y2={y} stroke="#111" strokeWidth={4} />
              {layout.rows[rowIndex + 1]?.line === row.line ? <line x1={140} x2={1040} y1={y + 55} y2={y + 55} stroke="#111" strokeWidth={3} strokeDasharray="16 10" /> : null}
              {layout.placements.filter(p => p.rowKey === key).map(p => { const span = getPlacementSpan(layout.rows, p); if (!span || span.endMetres <= start || span.startMetres >= end) return null; const a = x(Math.max(start, span.startMetres)), b = x(Math.min(end, span.endMetres)); return <g key={p.id}><rect x={a} y={y - 9} width={b - a} height={18} fill="#fbbf24" fillOpacity={0.4} /><title>{p.label}</title><text x={(a + b) / 2} y={y - 16} textAnchor="middle" fontSize={10}>{p.label}</text></g>; })}
              {joints.filter(j => j.rowKey === key && j.metres >= start && (j.metres < end || index === count - 1 && j.metres === end)).map(j => { const tone = weldMethodTone(jointDisplayMethod(j, layout.longRails, layout.rows)); return <g key={j.id}><circle cx={x(j.metres)} cy={y} r={3.2} stroke="white" strokeWidth={0.9} fill={tone.includes("blue") ? "#2563eb" : tone.includes("red") ? "#dc2626" : tone.includes("amber") ? "#d97706" : tone.includes("purple") ? "#7c3aed" : "white"} /><text x={x(j.metres)} y={y + 19} fontSize={8} textAnchor="middle">{j.welds[0]?.code}</text></g>; })}
              {pageRails.filter(p => p.rail.rowKey === key).map(({ rail, span }) => { const a = x(Math.max(start, span.startMetres)), b = x(Math.min(end, span.endMetres)); return <g key={rail.id}><rect x={a} y={y + 28} width={b - a} height={18} fill={rail.completedAt ? "#059669" : "#e2e8f0"} stroke="#64748b" /><text x={(a + b) / 2} y={y + 61} fontSize={10} textAnchor="middle">{rail.code}</text></g>; })}
            </g>;
          })}
        </svg>
        <p>Đoạn thi công: xanh lá = đã giải toả; xám = chưa hoàn thành. Đoạn qua biên tờ được tiếp nối ở tờ kế tiếp.</p>
        <table><thead><tr><th>Mã</th><th>Dải ray</th><th>Ngày thi công</th><th>Lý trình thực</th><th>Chiều dài</th><th>Trạng thái</th></tr></thead><tbody>{pageRails.map(({ rail, span }) => <tr key={rail.id}><td>{rail.code}</td><td>{rail.rowKey}</td><td>{rail.releaseDate ?? "—"}</td><td>{formatChainage(span.startMetres)} – {formatChainage(span.endMetres)}</td><td>{span.endMetres - span.startMetres} m</td><td>{rail.completedAt ? "Đã giải toả" : "Chưa hoàn thành"}</td></tr>)}</tbody></table>
        <div style={{ display: "flex", justifyContent: "space-around", marginTop: "6mm", marginBottom: "6mm" }}><b>Người lập</b><b>Người kiểm tra</b><b>Đại diện bên A</b></div>
      </article>;
    })}
  </div>, document.body);
}
