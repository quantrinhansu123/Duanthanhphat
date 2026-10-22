import { Fragment } from "react";
import type { BufferGapRow } from "@lwr/lib/buffer-gap";

export function BufferGapTable({ rows }: { rows: BufferGapRow[] }) {
  return <table className="buffer-gap-table result-table w-full border-collapse text-sm">
    <thead><tr>
      <th className="border border-purple-300 bg-purple-50 p-2 text-left">Vị trí khe hở</th>
      <th className="border border-purple-300 bg-purple-50 p-2">Ở nhiệt độ ray cao nhất<br /><span className="font-normal">(khe hở &gt; 0)</span></th>
      <th className="border border-purple-300 bg-purple-50 p-2">Ký hiệu</th>
      <th className="border border-purple-300 bg-purple-50 p-2">Ở nhiệt độ ray thấp nhất<br /><span className="font-normal">(khe hở &lt; khe hở cấu tạo)</span></th>
    </tr></thead>
    <tbody>{rows.map(row => <Fragment key={row.symbol}>
      <tr>
        <th rowSpan={2} className="border border-purple-300 p-2 text-left font-normal">{row.label}</th>
        <td className="border border-purple-300 p-2 text-center">{row.lowerFormula}</td>
        <td className="border border-purple-300 p-2 text-center">{row.symbol}</td>
        <td className="border border-purple-300 p-2 text-center">{row.upperFormula}</td>
      </tr>
      <tr className="bg-purple-100 font-semibold text-purple-900">
        <td className="border border-purple-300 p-2 text-center">{row.lower === null ? "Chờ số liệu Δ" : `${row.lower} mm`}</td>
        <td className="border border-purple-300 p-2 text-center">≤ {row.symbol} ≤</td>
        <td className="border border-purple-300 p-2 text-center">{row.upper === null ? "Chờ số liệu Δ" : `${row.upper} mm`}</td>
      </tr>
      {row.feasible === false && <tr><td colSpan={4} className="border border-purple-300 p-2 font-semibold text-red-700">{row.symbol}: không có khoảng khe hở thoả mãn đồng thời hai giới hạn.</td></tr>}
    </Fragment>)}</tbody>
  </table>;
}
