"use client";

import { useMemo, useState } from "react";
import { Check } from "@/components/icons";
import {
  deriveSparePartStatus,
  sparePartCategories,
  spareParts as seedParts,
  type SparePart,
  type SparePartStatus,
} from "@/data/spareParts";
import { MACHINE_MODELS } from "@/data/machines";

type ModalState =
  | { mode: "add" }
  | { mode: "view" | "edit"; row: SparePart };

const statusStyle: Record<SparePartStatus, string> = {
  "Còn hàng": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Sắp hết": "border-amber-200 bg-amber-50 text-amber-800",
  "Hết hàng": "border-rose-200 bg-rose-50 text-rose-700",
  "Đặt hàng": "border-blue-200 bg-blue-50 text-[#0047AB]",
};

const statusOptions: SparePartStatus[] = ["Còn hàng", "Sắp hết", "Hết hàng", "Đặt hàng"];

function emptyForm(): SparePart {
  return {
    id: "",
    code: "",
    name: "",
    manufacturer: "",
    compatibleModels: [],
    category: sparePartCategories[0],
    unit: "cái",
    stockQty: 0,
    minStock: 1,
    unitPriceVnd: 0,
    status: "Còn hàng",
    note: "",
  };
}

function formatVnd(value: number) {
  return value.toLocaleString("vi-VN");
}

export default function SparePartsList() {
  const [list, setList] = useState<SparePart[]>(seedParts);
  const [manufacturerFilter, setManufacturerFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modal, setModal] = useState<ModalState | null>(null);
  const [form, setForm] = useState<SparePart>(emptyForm());
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const manufacturers = useMemo(() => {
    const set = new Set(list.map((item) => item.manufacturer).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [list]);

  const models = useMemo(() => {
    const set = new Set<string>([...MACHINE_MODELS]);
    for (const item of list) for (const model of item.compatibleModels) set.add(model);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [list]);

  const filtered = useMemo(() => {
    return list.filter((row) => {
      if (manufacturerFilter && row.manufacturer !== manufacturerFilter) return false;
      if (modelFilter && !row.compatibleModels.includes(modelFilter)) return false;
      if (categoryFilter && row.category !== categoryFilter) return false;
      if (statusFilter && row.status !== statusFilter) return false;
      return true;
    });
  }, [list, manufacturerFilter, modelFilter, categoryFilter, statusFilter]);

  const lowStockCount = filtered.filter((row) => row.status === "Sắp hết" || row.status === "Hết hàng").length;
  const hasFilter = Boolean(manufacturerFilter || modelFilter || categoryFilter || statusFilter);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  }

  function openAdd() {
    setForm(emptyForm());
    setError("");
    setModal({ mode: "add" });
  }

  function openRow(mode: "view" | "edit", row: SparePart) {
    setForm({ ...row, compatibleModels: [...row.compatibleModels] });
    setError("");
    setModal({ mode, row });
  }

  function toggleModel(model: string) {
    setForm((current) => {
      const next = new Set(current.compatibleModels);
      if (next.has(model)) next.delete(model);
      else next.add(model);
      return { ...current, compatibleModels: Array.from(next) };
    });
  }

  function handleSave() {
    const code = form.code.trim();
    const name = form.name.trim();
    const manufacturer = form.manufacturer.trim();
    if (!code || !name || !manufacturer) {
      setError("Nhập mã, tên phụ tùng và nhà sản xuất.");
      return;
    }
    if (form.compatibleModels.length === 0) {
      setError("Chọn ít nhất một model máy tương thích.");
      return;
    }
    const stockQty = Math.max(0, Number(form.stockQty) || 0);
    const minStock = Math.max(0, Number(form.minStock) || 0);
    const unitPriceVnd = Math.max(0, Number(form.unitPriceVnd) || 0);
    const status = deriveSparePartStatus(stockQty, minStock, form.status);
    const payload: SparePart = {
      ...form,
      id: modal?.mode === "edit" ? modal.row.id : `sp-${Date.now()}`,
      code,
      name,
      manufacturer,
      stockQty,
      minStock,
      unitPriceVnd,
      status,
      note: form.note.trim(),
      unit: form.unit.trim() || "cái",
    };

    if (modal?.mode === "edit") {
      setList((current) => current.map((item) => (item.id === modal.row.id ? payload : item)));
      showToast("Đã cập nhật phụ tùng");
    } else {
      setList((current) => [payload, ...current]);
      showToast("Đã thêm phụ tùng");
    }
    setModal(null);
  }

  function handleDelete(row: SparePart) {
    if (!window.confirm(`Xóa phụ tùng ${row.code} — ${row.name}?`)) return;
    setList((current) => current.filter((item) => item.id !== row.id));
    showToast("Đã xóa phụ tùng");
  }

  const readOnly = modal?.mode === "view";

  return (
    <main className="w-full px-4 pb-8 sm:px-6">
      <div className="mb-4 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Tổng phụ tùng</div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-900">{filtered.length}</div>
          <div className="mt-1.5 text-xs text-slate-400">Theo bộ lọc hiện tại</div>
        </div>
        <div className="rounded-xl border border-amber-200/80 bg-white p-4.5 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Cần chú ý</div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-amber-700">{lowStockCount}</div>
          <div className="mt-1.5 text-xs text-slate-400">Sắp hết / hết hàng</div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Nhà sản xuất</div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-[#0047AB]">{manufacturers.length}</div>
          <div className="mt-1.5 text-xs text-slate-400">Trong danh mục</div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Model máy</div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-emerald-700">{models.length}</div>
          <div className="mt-1.5 text-xs text-slate-400">Có phụ tùng tương thích</div>
        </div>
      </div>

      <section className="mb-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Danh mục phụ tùng thay thế</h2>
            <p className="mt-0.5 text-xs text-slate-500">Theo nhà sản xuất và model máy hàn tương thích</p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] px-4 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#00388A] sm:text-sm"
          >
            <span className="text-base leading-none">+</span> Thêm phụ tùng
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <select
            value={manufacturerFilter}
            onChange={(event) => setManufacturerFilter(event.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] sm:text-sm"
            aria-label="Lọc theo nhà sản xuất"
          >
            <option value="">Tất cả nhà sản xuất</option>
            {manufacturers.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select
            value={modelFilter}
            onChange={(event) => setModelFilter(event.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] sm:text-sm"
            aria-label="Lọc theo model máy"
          >
            <option value="">Tất cả model máy</option>
            {models.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] sm:text-sm"
            aria-label="Lọc theo nhóm"
          >
            <option value="">Tất cả nhóm</option>
            {sparePartCategories.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] sm:text-sm"
            aria-label="Lọc theo trạng thái"
          >
            <option value="">Tất cả trạng thái</option>
            {statusOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          {hasFilter && (
            <button
              type="button"
              onClick={() => {
                setManufacturerFilter("");
                setModelFilter("");
                setCategoryFilter("");
                setStatusFilter("");
              }}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:text-sm"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </section>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="px-4 py-3">Mã / Tên</th>
                <th className="px-3.5 py-3">Nhà sản xuất</th>
                <th className="px-3.5 py-3">Model máy</th>
                <th className="px-3.5 py-3">Nhóm</th>
                <th className="px-3.5 py-3 text-right">Tồn kho</th>
                <th className="px-3.5 py-3 text-right">Đơn giá</th>
                <th className="px-3.5 py-3">Trạng thái</th>
                <th className="px-3.5 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <div className="font-mono font-bold text-[#0047AB]">{row.code}</div>
                    <div className="mt-0.5 font-medium text-slate-900">{row.name}</div>
                  </td>
                  <td className="px-3.5 py-3 text-slate-700">{row.manufacturer}</td>
                  <td className="px-3.5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.compatibleModels.map((model) => (
                        <span key={model} className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                          {model}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3.5 py-3 text-slate-700">{row.category}</td>
                  <td className="px-3.5 py-3 text-right font-mono tabular-nums text-slate-900">
                    {row.stockQty.toLocaleString("vi-VN")} {row.unit}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono tabular-nums text-slate-700">
                    {formatVnd(row.unitPriceVnd)} ₫
                  </td>
                  <td className="px-3.5 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle[row.status]}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3.5 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => openRow("view", row)} className="rounded-lg px-2.5 py-1.5 font-semibold text-[#0047AB] hover:bg-blue-50">Xem</button>
                      <button type="button" onClick={() => openRow("edit", row)} className="rounded-lg px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100">Sửa</button>
                      <button type="button" onClick={() => handleDelete(row)} className="rounded-lg px-2.5 py-1.5 font-medium text-rose-600 hover:bg-rose-50">Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                    Chưa có phụ tùng phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={() => setModal(null)}>
          <div
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">Phụ tùng thay thế</div>
                <h3 className="mt-0.5 text-base font-bold text-slate-900">
                  {modal.mode === "add" ? "Thêm phụ tùng" : modal.mode === "edit" ? "Sửa phụ tùng" : "Chi tiết phụ tùng"}
                </h3>
              </div>
              <button type="button" onClick={() => setModal(null)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Đóng
              </button>
            </div>

            <div className="space-y-3.5 p-4 sm:p-5">
              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</div>
              )}
              <div className="grid gap-3.5 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
                  Mã phụ tùng
                  <input
                    value={form.code}
                    disabled={readOnly}
                    onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs outline-hidden focus:border-[#0047AB] disabled:bg-slate-100 sm:text-sm"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
                  Nhóm
                  <select
                    value={form.category}
                    disabled={readOnly}
                    onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] disabled:bg-slate-100 sm:text-sm"
                  >
                    {sparePartCategories.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
                Tên phụ tùng
                <input
                  value={form.name}
                  disabled={readOnly}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] disabled:bg-slate-100 sm:text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
                Nhà sản xuất
                <input
                  value={form.manufacturer}
                  disabled={readOnly}
                  onChange={(event) => setForm((current) => ({ ...current, manufacturer: event.target.value }))}
                  placeholder="VD: Chengdu Aigre Technology / TCW"
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] disabled:bg-slate-100 sm:text-sm"
                />
              </label>
              <div className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
                Model máy tương thích
                <div className="mt-1.5 max-h-36 overflow-y-auto rounded-lg border border-slate-300 bg-white p-2">
                  {models.map((model) => (
                    <label key={model} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs font-mono text-slate-700 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={form.compatibleModels.includes(model)}
                        onChange={() => toggleModel(model)}
                        className="h-4 w-4 accent-[#0047AB]"
                      />
                      {model}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
                  Đơn vị
                  <input
                    value={form.unit}
                    disabled={readOnly}
                    onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] disabled:bg-slate-100 sm:text-sm"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
                  Tồn kho
                  <input
                    type="number"
                    min={0}
                    value={form.stockQty}
                    disabled={readOnly}
                    onChange={(event) => setForm((current) => ({ ...current, stockQty: Number(event.target.value) }))}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs outline-hidden focus:border-[#0047AB] disabled:bg-slate-100 sm:text-sm"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
                  Tồn tối thiểu
                  <input
                    type="number"
                    min={0}
                    value={form.minStock}
                    disabled={readOnly}
                    onChange={(event) => setForm((current) => ({ ...current, minStock: Number(event.target.value) }))}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs outline-hidden focus:border-[#0047AB] disabled:bg-slate-100 sm:text-sm"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
                  Đơn giá (₫)
                  <input
                    type="number"
                    min={0}
                    value={form.unitPriceVnd}
                    disabled={readOnly}
                    onChange={(event) => setForm((current) => ({ ...current, unitPriceVnd: Number(event.target.value) }))}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs outline-hidden focus:border-[#0047AB] disabled:bg-slate-100 sm:text-sm"
                  />
                </label>
              </div>
              <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
                Trạng thái
                <select
                  value={form.status}
                  disabled={readOnly}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as SparePartStatus }))}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] disabled:bg-slate-100 sm:text-sm"
                >
                  {statusOptions.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
                Ghi chú
                <textarea
                  value={form.note}
                  disabled={readOnly}
                  rows={3}
                  onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-hidden focus:border-[#0047AB] disabled:bg-slate-100 sm:text-sm"
                />
              </label>
            </div>

            {!readOnly && (
              <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
                <button type="button" onClick={() => setModal(null)} className="h-10 rounded-lg border border-slate-300 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:text-sm">
                  Hủy
                </button>
                <button type="button" onClick={handleSave} className="h-10 rounded-lg bg-[#0047AB] px-4 text-xs font-semibold text-white hover:bg-[#00388A] sm:text-sm">
                  Lưu
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-xl sm:text-sm">
          <Check size={16} weight="bold" aria-hidden className="text-emerald-500" />
          {toast}
        </div>
      )}
    </main>
  );
}
