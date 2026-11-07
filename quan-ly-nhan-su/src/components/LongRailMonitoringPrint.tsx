"use client";

import { createPortal } from "react-dom";
import { getPlacementSpan, parseChainage, railCellLockTemp, railRowKey, type TrackLayout } from "@lwr/lib/track-editor";
import { reportEndMovement } from "@lwr/lib/stress-release";
import type { RailCell } from "@lwr/types/track";

export default function LongRailMonitoringPrint({ layout, cells, project, onClose }: {
  layout: TrackLayout; cells: RailCell[]; project: string; onClose: () => void;
}) {
  return createPortal(<div className="long-rail-monitor-print" role="dialog" aria-modal="true" aria-label="Theo dõi ray hàn dài">
    <style>{`
      .long-rail-monitor-print{position:fixed;inset:0;z-index:150;overflow:auto;background:#e2e8f0;color:#111;font:12px Arial,sans-serif;padding:20px}
      .long-rail-monitor-print article{background:white;width:190mm;max-width:100%;margin:16px auto;padding:12mm;box-sizing:border-box}
      .long-rail-monitor-print h1{text-align:center;font-size:17px;font-weight:bold;margin:0 0 16px}
      .long-rail-monitor-print table{width:100%;border-collapse:collapse;margin-top:8px;font-size:11px}
      .long-rail-monitor-print th,.long-rail-monitor-print td{border:1px solid black;padding:5px;text-align:center}
      .long-rail-monitor-print th{background:#002060;color:white;font-weight:normal}
      .long-rail-monitor-print .warm{background:#ffe699}.long-rail-monitor-print .cool{background:#ddebf7}
      .long-rail-monitor-print .toolbar{display:flex;justify-content:center;gap:12px;position:sticky;top:0}
      .long-rail-monitor-print button{padding:10px 20px;background:#0047ab;color:white;border-radius:8px}
      @media print{@page{size:A4 portrait;margin:10mm}body > :not(.long-rail-monitor-print){display:none!important}.long-rail-monitor-print{position:static;padding:0;background:white;overflow:visible}.long-rail-monitor-print .toolbar{display:none}.long-rail-monitor-print article{width:auto;max-width:none;padding:0;margin:0;break-after:page}.long-rail-monitor-print article:last-child{break-after:auto}.long-rail-monitor-print *{print-color-adjust:exact;-webkit-print-color-adjust:exact}.long-rail-monitor-print tr{break-inside:avoid}}
    `}</style>
    <div className="toolbar"><button onClick={() => window.print()}>In / Lưu PDF</button><button onClick={onClose}>Đóng</button></div>
    {cells.map(cell => {
      const row = layout.rows.find(r => r.cells.some(c => c.id === cell.id));
      const from = parseChainage(cell.from), to = parseChainage(cell.to);
      const params = row ? layout.longRails.filter(rail => {
        const span = getPlacementSpan(layout.rows, rail);
        return rail.rowKey === railRowKey(row) && span && from !== null && to !== null && span.startMetres < to && span.endMetres > from;
      }).sort((a,b) => ((a.endMetres ?? 0)-(a.startMetres ?? 0))-((b.endMetres ?? 0)-(b.startMetres ?? 0)))[0]?.params : undefined;
      const lock = railCellLockTemp(cell);
      return <article key={cell.id}>
        <h1>THEO DÕI RAY HÀN DÀI</h1>
        <p><b>Dự án:</b> {project}</p><p><b>Thanh ray:</b> {cell.id} · {row?.line} · {row?.rail} · Km{cell.from} → Km{cell.to}</p>
        <svg viewBox="0 0 700 210" role="img" aria-label="Sơ đồ đánh dấu điểm giữa thanh M và điểm đầu thanh E" style={{width:"100%",margin:"12px 0"}}>
          <defs><marker id="monitor-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="red"/></marker></defs>
          <text x="10" y="23" fill="red" fontSize="13">Hướng tiếp tục hàn</text><path d="M110 35H10" stroke="red" strokeWidth="2" markerEnd="url(#monitor-arrow)"/>
          <rect x="190" y="4" width="190" height="42" fill="white" stroke="black"/><text x="285" y="21" textAnchor="middle" fontSize="12">Điểm giữa thanh (M)</text><text x="285" y="37" textAnchor="middle" fontSize="12">Đánh dấu trên đế ray</text>
          <rect x="480" y="4" width="205" height="42" fill="white" stroke="black"/><text x="582" y="21" textAnchor="middle" fontSize="12">Điểm đầu thanh (E)</text><text x="582" y="37" textAnchor="middle" fontSize="12">Đánh dấu tại đầu ray</text>
          <text x="10" y="87" fontSize="13">Thanh LWR đã khóa</text><path d="M10 100H582" stroke="#777" strokeWidth="13"/><path d="M10 123H680" stroke="#aaa" strokeWidth="18" strokeDasharray="3 2"/>
          {[285,582].map(x=><g key={x}><path d={`M${x} 47V91M${x} 159V128`} stroke="red" markerEnd="url(#monitor-arrow)"/><rect x={x-100} y="160" width="200" height="42" fill="white" stroke="black"/><text x={x} y="177" textAnchor="middle" fontSize="12">Đánh dấu trên tà vẹt</text><text x={x} y="193" textAnchor="middle" fontSize="12">hoặc plinth</text></g>)}
        </svg>
        <p>1. Hãy đánh dấu ngay sau khi hoàn thành giải tỏa ứng suất (mốc 0).</p>
        <p>2. Hãy đo đạc chuyển vị của ray hàn dài tại các thời điểm nhiệt độ khác nhau.</p>
        <table><thead><tr><th rowSpan={2}>TT</th><th rowSpan={2}>Ngày giờ đo</th><th rowSpan={2}>Không khí<br/>°C</th><th rowSpan={2}>Nhiệt độ khóa<br/>°C</th><th rowSpan={2}>Nhiệt độ đo<br/>°C</th><th rowSpan={2}>Chênh nhiệt độ<br/>°C</th><th colSpan={2}>Điểm M</th><th colSpan={2}>Điểm E</th><th rowSpan={2}>Ghi chú</th></tr><tr><th>Thiết kế¹<br/>(mm)</th><th>Thực tế<br/>(mm)</th><th>Thiết kế²<br/>(mm)</th><th>Thực tế<br/>(mm)</th></tr></thead>
          <tbody>{cell.report?.rows.map((report,index)=>{
            const measured = Number(report.temp.replace(",","."));
            const diff = report.temp.trim() && Number.isFinite(measured) ? measured-lock : null;
            const e = params && diff !== null ? reportEndMovement(params,diff) : null;
            const format = (n:number|null) => n === null ? "—" : String(Math.round(n*1000)/1000);
            const date = report.measuredAt?.split("T");
            return <tr key={index} className={diff !== null && diff < 0 ? "cool" : "warm"}><td>{index+1}</td><td>{date?.[0] ? `${date[0].split("-").reverse().join("/")} ${date[1]??""}`:"—"}</td><td>{report.airTemp||"—"}</td><td>{lock}</td><td>{report.temp||"—"}</td><td>{format(diff)}</td><td>5</td><td>{report.mActual||"—"}</td><td>{format(e)}</td><td>{report.eActual||"—"}</td><td style={{textAlign:"left",whiteSpace:"pre-wrap"}}>{report.note}</td></tr>;
          })}</tbody></table>
        <p style={{marginTop:12}}>(1) Là giá trị cho phép 5 mm theo quy trình.</p><p>(2) Δ = (Pmax − Pj)² / (2EFr); Pmax = EFα × |T đo − T khóa|; Pj = 0. Đổi từ m sang mm.</p><p>Dấu âm thể hiện giảm nhiệt. E, F, α, r lấy từ thông số Giải tỏa của đoạn ray.</p>
      </article>;
    })}
  </div>,document.body);
}
