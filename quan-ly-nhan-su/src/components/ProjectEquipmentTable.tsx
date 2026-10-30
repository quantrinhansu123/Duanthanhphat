"use client";
import type { ProjectEquipment } from "@/lib/projectEquipment";

export default function ProjectEquipmentTable({ rows }: { rows: ProjectEquipment[] }) {
  return <div className="space-y-3">{([["welding", "1. Máy hàn"], ["other", "2. Máy và thiết bị khác"]] as const).map(([group, title]) => <section key={group}>
    <h3 className="mb-1 text-sm font-bold">{title}</h3>
    <table className="w-full border-collapse text-left text-sm"><thead><tr>{["Mã", "Tên máy / thiết bị", "Model", "Số lượng (bộ)"].map((label) => <th key={label} className="border border-slate-300 p-2">{label}</th>)}</tr></thead>
      <tbody>{rows.filter((r) => r.group === group).map((r) => <tr key={r.id}><td className="border border-slate-300 p-2">{r.code}</td><td className="border border-slate-300 p-2">{r.name}</td><td className="border border-slate-300 p-2">{r.model}</td><td className="border border-slate-300 p-2 text-right">{r.missing ? "Cần gán lại" : r.quantity}</td></tr>)}{!rows.some((r) => r.group === group) && <tr><td colSpan={4} className="border border-slate-300 p-2">Chưa gán thiết bị</td></tr>}</tbody>
    </table></section>)}</div>;
}
