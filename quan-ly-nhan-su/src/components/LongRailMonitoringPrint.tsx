"use client";

import { createPortal } from "react-dom";
import { displayRailCode, getPlacementSpan, parseChainage, railCellLockTemp, railRowKey, type TrackLayout } from "@lwr/lib/track-editor";
import { reportEndMovement } from "@lwr/lib/stress-release";
import type { RailCell } from "@lwr/types/track";

export default function LongRailMonitoringPrint({ layout, cells, project, onClose }: {
  layout: TrackLayout; cells: RailCell[]; project: string; onClose: () => void;
}) {
  return createPortal(<div className="long-rail-monitor-print" role="dialog" aria-modal="true" aria-label="Theo dõi ray hàn dài">
    <style>{`
      .long-rail-monitor-print{position:fixed;inset:0;z-index:150;overflow:auto;background:#e2e8f0;color:#111;font:12px Arial,sans-serif;padding:20px}
      .long-rail-monitor-print article{background:white;width:190mm;max-width:100%;margin:16px auto;padding:12mm;box-sizing:border-box}
      .long-rail-monitor-print .doc-head{display:flex;align-items:center;justify-content:space-between;gap:8mm;padding-bottom:2.5mm;border-bottom:0.5mm solid #9333ea;margin-bottom:5mm}
      .long-rail-monitor-print .brand{display:flex;align-items:center;gap:2.5mm}
      .long-rail-monitor-print .logo-img{width:12mm;height:12mm;object-fit:contain}
      .long-rail-monitor-print .brand-kicker{font-size:6.5pt;font-weight:700;letter-spacing:.04em;color:#7e22ce}
      .long-rail-monitor-print .brand-name{font-size:13.5pt;font-weight:900;line-height:1;color:#581c87;letter-spacing:.06em}
      .long-rail-monitor-print .head-meta{text-align:right;font-size:8pt;font-weight:700;color:#334155;line-height:1.45}
      .long-rail-monitor-print h1{text-align:center;font-size:17px;font-weight:bold;margin:0 0 16px}
      .long-rail-monitor-print table{width:100%;border-collapse:collapse;margin-top:8px;font-size:11px}
      .long-rail-monitor-print th,.long-rail-monitor-print td{border:1px solid black;padding:5px;text-align:center}
      .long-rail-monitor-print th{background:#002060;color:white;font-weight:normal}
      .long-rail-monitor-print .warm{background:#ffe699}.long-rail-monitor-print .cool{background:#ddebf7}
      .long-rail-monitor-print .toolbar{display:flex;justify-content:center;gap:12px;position:sticky;top:0}
      .long-rail-monitor-print button{padding:10px 20px;background:#0047ab;color:white;border-radius:8px}
      @media print{@page{size:A4 portrait;margin:15mm 10mm 10mm 20mm}body > :not(.long-rail-monitor-print){display:none!important}.long-rail-monitor-print{position:static;padding:0;background:white;overflow:visible}.long-rail-monitor-print .toolbar{display:none}.long-rail-monitor-print article{width:auto;max-width:none;padding:0;margin:0;break-after:page}.long-rail-monitor-print article:last-child{break-after:auto}.long-rail-monitor-print *{print-color-adjust:exact;-webkit-print-color-adjust:exact}.long-rail-monitor-print tr{break-inside:avoid}}
    `}</style>
    <div className="toolbar"><button onClick={() => window.print()}>In / Lưu PDF</button><button onClick={onClose}>Đóng</button></div>
    {cells.map(cell => {
      const row = layout.rows.find(r => r.cells.some(c => c.id === cell.id));
      const from = parseChainage(cell.from), to = parseChainage(cell.to);
      const longRail = row ? layout.longRails.filter(rail => {
        const span = getPlacementSpan(layout.rows, rail);
        return rail.rowKey === railRowKey(row) && span && from !== null && to !== null && span.startMetres < to && span.endMetres > from;
      }).sort((a,b) => ((a.endMetres ?? 0)-(a.startMetres ?? 0))-((b.endMetres ?? 0)-(b.startMetres ?? 0)))[0] : undefined;
      const params = longRail?.params;
      const name = displayRailCode(longRail ? longRail.code : cell.id); // cùng tên với sơ đồ / bảng GTUS
      const lock = railCellLockTemp(cell);
      return <article key={cell.id}>
        <header className="doc-head">
          <div className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="logo-img" />
            <div>
              <div className="brand-kicker">CÔNG TY CỔ PHẦN CÔNG TRÌNH</div>
              <div className="brand-name">THÀNH PHÁT</div>
              <div className="brand-kicker">CONSTRUCTION WORK JOINT STOCK COMPANY</div>
            </div>
          </div>
          <div className="head-meta">
            <div>Mẫu theo dõi ray hàn dài</div>
            <div>Thanh ray: {name}</div>
          </div>
        </header>
        <h1>THEO DÕI RAY HÀN DÀI</h1>
        <p><b>Dự án:</b> {project}</p><p><b>Thanh ray:</b> {name} · {row?.line} · {row?.rail} · Km{cell.from} → Km{cell.to}</p>
        <p>1. Hãy đánh dấu ngay sau khi hoàn thành giải tỏa ứng suất (mốc 0).</p>
        <p>2. Hãy đo đạc chuyển vị của ray hàn dài tại các thời điểm nhiệt độ khác nhau.</p>
        <table><thead><tr><th rowSpan={2}>TT</th><th rowSpan={2}>Tên thanh ray</th><th rowSpan={2}>Ngày giờ đo</th><th rowSpan={2}>Không khí<br/>°C</th><th rowSpan={2}>Nhiệt độ khóa<br/>°C</th><th rowSpan={2}>Nhiệt độ đo<br/>°C</th><th rowSpan={2}>Chênh nhiệt độ<br/>°C</th><th colSpan={2}>Điểm M</th><th colSpan={2}>Điểm E</th><th rowSpan={2}>Ghi chú</th></tr><tr><th>Thiết kế¹<br/>(mm)</th><th>Thực tế<br/>(mm)</th><th>Thiết kế²<br/>(mm)</th><th>Thực tế<br/>(mm)</th></tr></thead>
          <tbody>{cell.report?.rows.map((report,index)=>{
            const measured = Number(report.temp.replace(",","."));
            const diff = report.temp.trim() && Number.isFinite(measured) ? measured-lock : null;
            const e = params && diff !== null ? reportEndMovement(params,diff) : null;
            const format = (n:number|null) => n === null ? "—" : String(Math.round(n*1000)/1000);
            const date = report.measuredAt?.split("T");
            return <tr key={index} className={diff !== null && diff < 0 ? "cool" : "warm"}><td>{index+1}</td><td style={{whiteSpace:"nowrap"}}>{name}</td><td>{date?.[0] ? `${date[0].split("-").reverse().join("/")} ${date[1]??""}`:"—"}</td><td>{report.airTemp||"—"}</td><td>{lock}</td><td>{report.temp||"—"}</td><td>{format(diff)}</td><td>5</td><td>{report.mActual||"—"}</td><td>{format(e)}</td><td>{report.eActual||"—"}</td><td style={{textAlign:"left",whiteSpace:"pre-wrap"}}>{report.note}</td></tr>;
          })}</tbody></table>
        <p style={{marginTop:12}}>(1) Là giá trị cho phép 5 mm theo quy trình.</p><p>(2) Δ = (Pmax − Pj)² / (2EFr); Pmax = EFα × |T đo − T khóa|; Pj = 0. Đổi từ m sang mm.</p><p>Dấu âm thể hiện giảm nhiệt. E, F, α, r lấy từ thông số Giải tỏa của đoạn ray.</p>
      </article>;
    })}
  </div>,document.body);
}
