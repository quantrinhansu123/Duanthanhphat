"use client";

import { useState } from "react";

export type ContractData = Record<string, string>;

type Field = { key: string; label: string; type?: "date" | "number"; optional?: boolean; full?: boolean };

export const CONTRACT_FIELDS: Field[] = [
  { key: "soHD", label: "Số hợp đồng" },
  { key: "ngayKy", label: "Ngày ký", type: "date" },
  { key: "diaDiemKy", label: "Địa điểm ký" },
  { key: "aTen", label: "Bên A — Tên đơn vị", full: true },
  { key: "aDiaChi", label: "Bên A — Địa chỉ", full: true },
  { key: "aDaiDien", label: "Bên A — Người đại diện" },
  { key: "aChucVu", label: "Bên A — Chức vụ" },
  { key: "bTen", label: "Bên B — Tên đơn vị", full: true },
  { key: "bDaiDien", label: "Bên B — Người đại diện" },
  { key: "bChucVu", label: "Bên B — Chức vụ" },
  { key: "duAn", label: "Tên dự án", full: true },
  { key: "hangMuc", label: "Hạng mục", full: true },
  { key: "giaTri", label: "Giá trị hợp đồng (đồng)", type: "number" },
  { key: "tuNgay", label: "Thực hiện từ ngày", type: "date" },
  { key: "denNgay", label: "Đến ngày", type: "date" },
  { key: "thanhToan", label: "Điều kiện thanh toán", optional: true, full: true },
];

const INITIAL: ContractData = { bTen: "Công ty Cổ phần Công trình Thành Phát" };

/** Form tạo hợp đồng nằm trong khung chat. Thiếu trường bắt buộc thì báo đỏ và liệt kê trường còn thiếu. */
export default function ContractForm({ onSubmit }: { onSubmit: (data: ContractData) => void }) {
  const [values, setValues] = useState<ContractData>(INITIAL);
  const [missing, setMissing] = useState<string[]>([]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const lack = CONTRACT_FIELDS.filter((f) => !f.optional && !values[f.key]?.trim()).map((f) => f.key);
    setMissing(lack);
    if (!lack.length) onSubmit(values);
  }

  return (
    <form onSubmit={submit} noValidate className="w-full space-y-2 rounded-xl bg-white p-3 text-sm shadow-2xs">
      <div className="font-bold text-slate-800">Thông tin hợp đồng thi công</div>
      <div className="grid grid-cols-2 gap-2">
        {CONTRACT_FIELDS.map((f) => (
          <label key={f.key} className={`block text-xs font-medium text-slate-600 ${f.full ? "col-span-2" : ""}`}>
            {f.label}{!f.optional && <span className="text-red-600"> *</span>}
            <input
              type={f.type ?? "text"}
              min={f.type === "number" ? 0 : undefined}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              aria-invalid={missing.includes(f.key)}
              className={`mt-0.5 h-9 w-full rounded-lg border px-2.5 text-sm text-slate-900 outline-hidden focus:ring-2 ${
                missing.includes(f.key) ? "border-red-500 bg-red-50 focus:ring-red-200" : "border-slate-200 focus:border-[#0047AB] focus:ring-[#0047AB]/20"
              }`}
            />
          </label>
        ))}
      </div>
      {missing.length > 0 && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          Còn thiếu: {missing.map((k) => CONTRACT_FIELDS.find((f) => f.key === k)?.label).join("; ")}. Vui lòng điền đủ.
        </p>
      )}
      <button type="submit" className="h-10 w-full rounded-xl bg-[#0047AB] text-sm font-semibold text-white hover:bg-[#003d94] cursor-pointer">
        Tạo hợp đồng
      </button>
    </form>
  );
}
