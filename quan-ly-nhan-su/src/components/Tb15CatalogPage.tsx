"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DotsThreeVertical, X } from "@/components/icons";
import { useAccess } from "@/lib/useAccess";
import {
  catalogByTabId,
  type Tb15CatalogMeta,
  type Tb15Row,
  type Tb15Wheel,
} from "@/lib/tb15Catalogs";

function emptyForm(meta: Tb15CatalogMeta): Record<string, string> {
  const form: Record<string, string> = { id: "" };
  for (const f of meta.fields) form[f.key] = f.type === "select" && f.options?.[0] ? f.options[0].value : "";
  return form;
}

function rowToForm(meta: Tb15CatalogMeta, row: Tb15Row): Record<string, string> {
  const form: Record<string, string> = { id: String(row.id ?? "") };
  for (const f of meta.fields) {
    const v = row[f.key];
    form[f.key] = v == null ? "" : String(v);
  }
  return form;
}

function fmtNum(value: unknown) {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
}

/** Hệ số nhánh dốc (x ≤ 2 mm): hiển thị dạng "0,6x". */
function fmtSlope(value: unknown) {
  return value == null || value === "" ? "—" : `${fmtNum(value)}x`;
}

function displayCell(key: string, value: unknown) {
  if (value == null || value === "") return "—";
  if (key === "loai_duong") {
    if (value === "co_ba_lat") return "Có ba lát";
    if (value === "khong_ba_lat") return "Không ba lát";
  }
  if (key === "loai") {
    if (value === "van_toc") return "Vận tốc";
    if (value === "luc_ngang") return "Lực ngang";
  }
  return String(value);
}

type KhiTab = "min" | "max";

const KHI_TABS: { id: KhiTab; label: string }[] = [
  { id: "min", label: "Nhiệt độ kk thấp nhất" },
  { id: "max", label: "Nhiệt độ kk cao nhất" },
];

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const emptyMonths = () => MONTHS.map(() => "");
const monthsToForm = (v: unknown) => MONTHS.map((m) => (Array.isArray(v) && v[m - 1] != null ? String(v[m - 1]) : ""));

function fmtTemp(v: unknown) {
  return typeof v === "number" && Number.isFinite(v)
    ? v.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : "—";
}

export default function Tb15CatalogPage({ tabId }: { tabId: string }) {
  const meta = catalogByTabId(tabId);
  const { can } = useAccess();
  const [rows, setRows] = useState<Tb15Row[]>([]);
  const [form, setForm] = useState<Record<string, string>>(() => (meta ? emptyForm(meta) : { id: "" }));
  const [wheels, setWheels] = useState<Tb15Wheel[]>([{ stt: 1, x_m: 0, p_j_kn: 0 }]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<Tb15Row | null>(null);
  const [khiTab, setKhiTab] = useState<KhiTab>("min");
  const [monthMin, setMonthMin] = useState<string[]>(emptyMonths);
  const [monthMax, setMonthMax] = useState<string[]>(emptyMonths);
  const [menuId, setMenuId] = useState("");
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [portalReady, setPortalReady] = useState(false);
  const [grades, setGrades] = useState<Tb15Row[]>([]);
  const [gradeId, setGradeId] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const isRay = meta?.key === "loai_ray";
  const isSleeper = meta?.key === "ket_cau_duong";

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const canEdit = meta ? can(meta.tabId, "edit") : false;
  const canDelete = meta ? can(meta.tabId, "delete") : false;
  const isKhi = meta?.key === "khi_hau";
  const columns = useMemo(() => meta?.fields ?? [], [meta]);
  // Cột hiển thị trên bảng danh sách (bỏ các trường đã ẩn, ví dụ nhiệt độ năm của khí hậu).
  const listColumns = useMemo(() => columns.filter((c) => !c.hiddenInList), [columns]);

  const load = useCallback(async () => {
    if (!meta) return;
    setLoading(true);
    setStatus("");
    try {
      const res = await fetch(`/api/tb15-catalogs/${meta.key}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tải được dữ liệu.");
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Không tải được dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, [meta]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isRay) return;
    let cancel = false;
    void fetch("/api/tb15-catalogs/mac_thep")
      .then((res) => res.json())
      .then((data) => {
        if (cancel) return;
        const list: Tb15Row[] = Array.isArray(data.rows) ? data.rows : [];
        setGrades(list);
        setGradeId((prev) => prev || String(list[0]?.id ?? ""));
      })
      .catch(() => {
        if (!cancel) setGrades([]);
      });
    return () => {
      cancel = true;
    };
  }, [isRay]);

  useEffect(() => {
    if (meta) setForm(emptyForm(meta));
  }, [meta]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const el = e.target as HTMLElement | null;
      if (menuRef.current?.contains(el)) return;
      if (el?.closest?.("[data-tb15-menu-trigger]")) return;
      setMenuId("");
    }
    function onScroll() {
      setMenuId("");
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  if (!meta) {
    return <p className="px-4 text-sm text-rose-700">Không tìm thấy cấu hình bảng.</p>;
  }

  function openCreate() {
    const next = emptyForm(meta!);
    if (meta!.key === "loai_ray") {
      next.k_an_toan = "1.3";
      next.e_mpa = "210000";
      next.alpha = "0.0000118";
      next.pj_kn = "400";
      next.khe_ho_mm = "18";
    }
    setForm(next);
    setMonthMin(emptyMonths());
    setMonthMax(emptyMonths());
    setWheels([{ stt: 1, x_m: 0, p_j_kn: 0 }]);
    setFormOpen(true);
    setMenuId("");
  }

  function openEdit(row: Tb15Row) {
    setForm(rowToForm(meta!, row));
    if (isKhi) {
      setMonthMin(monthsToForm(row.t_min_thang));
      setMonthMax(monthsToForm(row.t_max_thang));
    }
    if (meta!.hasWheels) {
      const w = Array.isArray(row.wheels) ? row.wheels : [];
      setWheels(w.length ? w.map((x) => ({ ...x })) : [{ stt: 1, x_m: 0, p_j_kn: 0 }]);
    }
    setFormOpen(true);
    setMenuId("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const payload: Record<string, unknown> = { ...form };
      if (meta!.hasWheels) payload.wheels = wheels;
      if (isKhi) {
        payload.t_min_thang = monthMin;
        payload.t_max_thang = monthMax;
      }
      const editing = Boolean(form.id);
      const res = await fetch(`/api/tb15-catalogs/${meta!.key}`, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không lưu được.");
      setFormOpen(false);
      setForm(emptyForm(meta!));
      setMonthMin(emptyMonths());
      setMonthMax(emptyMonths());
      setWheels([{ stt: 1, x_m: 0, p_j_kn: 0 }]);
      setStatus(editing ? "Đã cập nhật." : "Đã thêm.");
      await load();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Không lưu được.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteRow?.id) return;
    setBusy(true);
    setStatus("");
    try {
      const res = await fetch(`/api/tb15-catalogs/${meta!.key}?id=${encodeURIComponent(String(deleteRow.id))}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không xóa được.");
      setDeleteRow(null);
      setStatus("Đã xóa.");
      await load();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Không xóa được.");
    } finally {
      setBusy(false);
    }
  }

  const selectedGrade = grades.find((g) => String(g.id) === gradeId) ?? grades[0];
  const sigmaS = Number(selectedGrade?.sigma_s_mpa);

  function allowStress(row: Tb15Row) {
    const k = Number(row.k_an_toan);
    if (!Number.isFinite(sigmaS) || !Number.isFinite(k) || k === 0) return "—";
    return (sigmaS / k).toLocaleString("vi-VN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  }

  function fieldInput(field: (typeof columns)[number], label?: string, className?: string) {
    return (
      <label key={field.key} className={`text-sm font-semibold ${className ?? ""}`}>
        {label ?? field.label}
        {field.type === "select" ? (
          <select
            required={field.required}
            disabled={busy}
            value={form[field.key] ?? ""}
            onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal"
          >
            {(field.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            required={field.required}
            type={field.type === "number" ? "number" : "text"}
            step={field.step}
            disabled={busy}
            value={form[field.key] ?? ""}
            onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal"
          />
        )}
      </label>
    );
  }

  function fieldBy(key: string) {
    const field = columns.find((item) => item.key === key);
    if (!field) throw new Error(`Thiếu trường ${key}`);
    return field;
  }

  return (
    <div className="space-y-4 px-4 pb-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {isRay && (
          <label className="mr-auto text-sm font-semibold text-slate-800">
            Mác thép để tính [σ]
            <select
              value={gradeId}
              onChange={(e) => setGradeId(e.target.value)}
              className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-2 font-normal"
            >
              {grades.map((g) => (
                <option key={String(g.id)} value={String(g.id)}>
                  {String(g.mac_thep)} · σ_s {String(g.sigma_s_mpa)} MPa
                </option>
              ))}
            </select>
          </label>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-[#0047AB] px-4 py-2 text-sm font-semibold text-white"
          >
            Thêm mới
          </button>
        )}
      </div>

      {status && (
        <p role="status" className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          {status}
        </p>
      )}

      {loading ? (
        <p role="status">Đang tải…</p>
      ) : isKhi ? (
        <div className="space-y-3">
          <div role="tablist" aria-label="Loại nhiệt độ" className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
            {KHI_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={khiTab === t.id}
                onClick={() => setKhiTab(t.id)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  khiTab === t.id ? "bg-[#0047AB] text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-3 font-semibold whitespace-nowrap">Mã trạm</th>
                    <th className="p-3 font-semibold whitespace-nowrap">Tên trạm</th>
                    <th className="p-3 font-semibold whitespace-nowrap">Tỉnh / thành</th>
                    {MONTHS.map((m) => (
                      <th key={m} className="p-2 text-right font-semibold whitespace-nowrap">
                        T{m} (°C)
                      </th>
                    ))}
                    <th className="sticky right-0 z-[1] w-[1%] bg-slate-50 p-3 text-right font-semibold whitespace-nowrap shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)]">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const vals = khiTab === "min" ? row.t_min_thang : row.t_max_thang;
                    return (
                      <tr key={String(row.id)} className="group border-t border-slate-200">
                        <td className="p-3 align-middle">{displayCell("ma_tram", row.ma_tram)}</td>
                        <td className="p-3 align-middle font-medium text-slate-900">{displayCell("ten_tram", row.ten_tram)}</td>
                        <td className="p-3 align-middle">{displayCell("tinh", row.tinh)}</td>
                        {MONTHS.map((m) => (
                          <td key={m} className="p-2 align-middle text-right tabular-nums">
                            {fmtTemp(Array.isArray(vals) ? vals[m - 1] : null)}
                          </td>
                        ))}
                        <td className="sticky right-0 z-[1] w-[1%] bg-white p-3 align-middle text-right whitespace-nowrap shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)] group-hover:bg-[#eff6ff]">
                          {(canEdit || canDelete) && (
                            <button
                              type="button"
                              data-tb15-menu-trigger
                              aria-label="Thao tác"
                              disabled={busy}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (menuId === String(row.id)) {
                                  setMenuId("");
                                  return;
                                }
                                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                setMenuPos({ top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) });
                                setMenuId(String(row.id));
                              }}
                            >
                              <DotsThreeVertical size={20} weight="bold" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!rows.length && (
                    <tr>
                      <td colSpan={3 + MONTHS.length + 1} className="p-6 text-center text-slate-500">
                        Chưa có dữ liệu.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {rows.some((r) => !Array.isArray(r.t_min_thang) || !Array.isArray(r.t_max_thang)) && (
            <p className="text-xs text-amber-700">
              Một số trạm chưa có dữ liệu theo tháng (hiển thị “—”). Cần chạy migration và import lại bảng khí hậu từ QCVN.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className={`w-full border-collapse text-left text-sm ${isSleeper ? "min-w-[1100px]" : "min-w-[720px]"}`}>
              <thead className="bg-slate-50">
                {isSleeper ? (
                  <>
                    <tr>
                      <th rowSpan={3} className="p-3 align-bottom font-semibold">Tên phương án</th>
                      <th rowSpan={3} className="p-3 align-bottom font-semibold whitespace-nowrap">Loại đường</th>
                      <th rowSpan={3} className="p-3 align-bottom font-semibold whitespace-nowrap">Số thanh/km</th>
                      <th colSpan={4} className="border-b border-l border-slate-200 px-3 pt-3 pb-1 text-center font-semibold">
                        Có tải
                        <span className="mt-0.5 block text-[11px] font-normal text-slate-500">kN/(m·ray)</span>
                      </th>
                      <th colSpan={2} rowSpan={2} className="border-b border-l border-slate-200 px-3 pt-3 pb-1 text-center align-top font-semibold">
                        Không tải
                        <span className="mt-0.5 block text-[11px] font-normal text-slate-500">kN/(m·ray)</span>
                      </th>
                      <th rowSpan={3} className="p-3 align-bottom font-semibold whitespace-nowrap">Q (kN/m)</th>
                      <th rowSpan={3} className="p-3 align-bottom font-semibold whitespace-nowrap">Cự ly nút a (m)</th>
                      <th rowSpan={3} className="sticky right-0 z-[1] w-[1%] bg-slate-50 p-3 text-right align-bottom font-semibold whitespace-nowrap shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)]">
                        Thao tác
                      </th>
                    </tr>
                    <tr>
                      <th colSpan={2} className="border-b border-l border-slate-200 px-3 py-1.5 text-center font-semibold whitespace-nowrap">
                        Dưới đầu máy
                      </th>
                      <th colSpan={2} className="border-b border-l border-slate-200 px-3 py-1.5 text-center font-semibold whitespace-nowrap">
                        Dưới toa xe
                      </th>
                    </tr>
                    <tr>
                      {[0, 1, 2].map((g) => (
                        <Fragment key={g}>
                          <th className="border-l border-slate-200 px-3 pt-1 pb-2 text-center font-medium whitespace-nowrap text-slate-600">≤ 2 mm</th>
                          <th className="px-3 pt-1 pb-2 text-center font-medium whitespace-nowrap text-slate-600">&gt; 2 mm</th>
                        </Fragment>
                      ))}
                    </tr>
                  </>
                ) : (
                  <tr>
                    {listColumns.map((c) => (
                      <th key={c.key} className="p-3 font-semibold whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                    {meta.hasWheels && <th className="p-3 font-semibold whitespace-nowrap">Số bánh</th>}
                    {isRay && <th className="p-3 font-semibold whitespace-nowrap">[σ] (MPa)</th>}
                    <th className="sticky right-0 z-[1] w-[1%] bg-slate-50 p-3 text-right font-semibold whitespace-nowrap shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)]">
                      Thao tác
                    </th>
                  </tr>
                )}
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={String(row.id)} className="group border-t border-slate-200">
                    {isSleeper ? (
                      <>
                        <td className="p-3 align-middle">{displayCell("ten", row.ten)}</td>
                        <td className="p-3 align-middle whitespace-nowrap">{displayCell("loai_duong", row.loai_duong)}</td>
                        <td className="p-3 align-middle tabular-nums">{fmtNum(row.so_thanh_km)}</td>
                        {/* Có tải — dưới đầu máy */}
                        <td className="border-l border-slate-100 p-3 text-center align-middle tabular-nums">{fmtSlope(row.r_dau_may_hs)}</td>
                        <td className="p-3 text-center align-middle tabular-nums">{fmtNum(row.r_co_tai)}</td>
                        {/* Có tải — dưới toa xe */}
                        <td className="border-l border-slate-100 p-3 text-center align-middle tabular-nums">{fmtSlope(row.r_toa_xe_hs)}</td>
                        <td className="p-3 text-center align-middle tabular-nums">{fmtNum(row.r_toa_xe)}</td>
                        {/* Không tải */}
                        <td className="border-l border-slate-100 p-3 text-center align-middle tabular-nums">{fmtSlope(row.r_khong_tai_hs)}</td>
                        <td className="p-3 text-center align-middle tabular-nums">{fmtNum(row.r_khong_tai)}</td>
                        <td className="p-3 align-middle tabular-nums">{fmtNum(row.q_kn_m)}</td>
                        <td className="p-3 align-middle tabular-nums">{fmtNum(row.cu_ly_nut_a_m)}</td>
                      </>
                    ) : (
                      listColumns.map((c) => (
                        <td key={c.key} className="p-3 align-middle">
                          {displayCell(c.key, row[c.key])}
                        </td>
                      ))
                    )}
                    {meta.hasWheels && (
                      <td className="p-3 align-middle whitespace-nowrap">
                        {Array.isArray(row.wheels) ? row.wheels.length : 0}
                      </td>
                    )}
                    {isRay && <td className="p-3 align-middle tabular-nums">{allowStress(row)}</td>}
                    <td className="sticky right-0 z-[1] w-[1%] bg-white p-3 align-middle text-right whitespace-nowrap shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)] group-hover:bg-[#eff6ff]">
                      {(canEdit || canDelete) && (
                        <button
                          type="button"
                          data-tb15-menu-trigger
                          aria-label="Thao tác"
                          disabled={busy}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (menuId === String(row.id)) {
                              setMenuId("");
                              return;
                            }
                            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                            setMenuPos({ top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) });
                            setMenuId(String(row.id));
                          }}
                        >
                          <DotsThreeVertical size={20} weight="bold" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={isSleeper ? 12 : listColumns.length + (meta.hasWheels ? 1 : 0) + (isRay ? 1 : 0) + 1} className="p-6 text-center text-slate-500">
                      Chưa có dữ liệu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {portalReady &&
        menuId &&
        (canEdit || canDelete) &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[1500] min-w-[140px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            {canEdit && (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  const row = rows.find((r) => String(r.id) === menuId);
                  if (row) openEdit(row);
                }}
              >
                Sửa
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
                onClick={() => {
                  const row = rows.find((r) => String(r.id) === menuId);
                  if (row) setDeleteRow(row);
                  setMenuId("");
                }}
              >
                Xóa
              </button>
            )}
          </div>,
          document.body,
        )}

      {portalReady && formOpen && createPortal(
        <div
          className="fixed inset-0 z-[1600] flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={form.id ? "Sửa bản ghi" : "Thêm mới"}
        >
          <form
            onSubmit={save}
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-900">{form.id ? "Sửa bản ghi" : "Thêm mới"}</h2>
              <button
                type="button"
                disabled={busy}
                aria-label="Đóng"
                onClick={() => setFormOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
              >
                <X size={20} weight="bold" />
              </button>
            </div>
            {isSleeper ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {fieldInput(fieldBy("ten"), undefined, "sm:col-span-2")}
                  {fieldInput(fieldBy("loai_duong"))}
                  {fieldInput(fieldBy("so_thanh_km"))}
                  {fieldInput(fieldBy("loai_ta_vet"))}
                  {fieldInput(fieldBy("cu_ly_nut_a_m"))}
                  {fieldInput(fieldBy("q_kn_m"))}
                </div>
                <fieldset className="rounded-xl border border-slate-200 p-3">
                  <legend className="px-1 text-sm font-semibold">Có tải, kN/(m·ray)</legend>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="mb-2 text-sm font-semibold text-slate-800">Dưới đầu máy</p>
                      <div className="grid grid-cols-2 gap-2">
                        {fieldInput(fieldBy("r_dau_may_hs"), "x ≤ 2 mm")}
                        {fieldInput(fieldBy("r_co_tai"), "x > 2 mm")}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="mb-2 text-sm font-semibold text-slate-800">Dưới toa xe</p>
                      <div className="grid grid-cols-2 gap-2">
                        {fieldInput(fieldBy("r_toa_xe_hs"), "x ≤ 2 mm")}
                        {fieldInput(fieldBy("r_toa_xe"), "x > 2 mm")}
                      </div>
                    </div>
                  </div>
                </fieldset>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="mb-2 text-sm font-semibold text-slate-800">Không tải, kN/(m·ray)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {fieldInput(fieldBy("r_khong_tai_hs"), "x ≤ 2 mm")}
                    {fieldInput(fieldBy("r_khong_tai"), "x > 2 mm")}
                  </div>
                </div>
                {fieldInput(fieldBy("ghi_chu"))}
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {columns.map((f) => fieldInput(f))}
              </div>
            )}

            {isKhi &&
              (
                [
                  { id: "min", title: "Nhiệt độ kk thấp nhất theo tháng (°C)", values: monthMin, set: setMonthMin },
                  { id: "max", title: "Nhiệt độ kk cao nhất theo tháng (°C)", values: monthMax, set: setMonthMax },
                ] as const
              ).map((block) => (
                <fieldset key={block.id} className="mt-4 min-w-0 space-y-2">
                  <legend className="text-sm font-semibold">{block.title}</legend>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {MONTHS.map((m) => (
                      <label key={m} className="text-xs font-semibold text-slate-600">
                        Tháng {m}
                        <input
                          required
                          type="number"
                          step="0.1"
                          disabled={busy}
                          value={block.values[m - 1] ?? ""}
                          onChange={(e) => {
                            const next = [...block.values];
                            next[m - 1] = e.target.value;
                            block.set(next);
                          }}
                          className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm font-normal text-slate-900"
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            {isKhi && (
              <p className="mt-2 text-xs text-slate-500">
                Nhiệt độ năm không nhập: hệ thống tự lấy giá trị lớn nhất (cao nhất) và nhỏ nhất (thấp nhất) trong 12 tháng.
              </p>
            )}

            {meta.hasWheels && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Bánh xe (tối đa 12)</h3>
                  <button
                    type="button"
                    disabled={busy || wheels.length >= 12}
                    onClick={() => setWheels([...wheels, { stt: wheels.length + 1, x_m: 0, p_j_kn: 0 }])}
                    className="text-sm font-semibold text-[#0047AB]"
                  >
                    + Thêm bánh
                  </button>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="p-2 text-left">STT</th>
                        <th className="p-2 text-left">x (m)</th>
                        <th className="p-2 text-left">P_j (kN)</th>
                        <th className="p-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {wheels.map((w, i) => (
                        <tr key={w.id ?? i} className="border-t">
                          <td className="p-2">
                            <input
                              type="number"
                              className="w-16 rounded border p-1"
                              value={w.stt}
                              disabled={busy}
                              onChange={(e) => {
                                const next = [...wheels];
                                next[i] = { ...w, stt: Number(e.target.value) };
                                setWheels(next);
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.001"
                              className="w-28 rounded border p-1"
                              value={w.x_m}
                              disabled={busy}
                              onChange={(e) => {
                                const next = [...wheels];
                                next[i] = { ...w, x_m: Number(e.target.value) };
                                setWheels(next);
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.001"
                              className="w-28 rounded border p-1"
                              value={w.p_j_kn}
                              disabled={busy}
                              onChange={(e) => {
                                const next = [...wheels];
                                next[i] = { ...w, p_j_kn: Number(e.target.value) };
                                setWheels(next);
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <button
                              type="button"
                              disabled={busy || wheels.length <= 1}
                              className="text-rose-700"
                              onClick={() => setWheels(wheels.filter((_, j) => j !== i))}
                            >
                              Xóa
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setFormOpen(false)}
                className="rounded-lg border px-4 py-2 text-sm font-semibold"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-[#0047AB] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Đang lưu…" : "Lưu"}
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}

      {portalReady &&
        deleteRow &&
        createPortal(
          <div
            className="fixed inset-0 z-[1600] flex items-center justify-center bg-slate-900/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Xác nhận xóa"
          >
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900">Xóa bản ghi?</h2>
                <button
                  type="button"
                  disabled={busy}
                  aria-label="Đóng"
                  onClick={() => setDeleteRow(null)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
                >
                  <X size={20} weight="bold" />
                </button>
              </div>
              <p className="mt-2 text-sm text-slate-600">Thao tác này không hoàn tác được. Bạn có chắc muốn xóa?</p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setDeleteRow(null)}
                  className="rounded-lg border px-4 py-2 text-sm font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void confirmDelete()}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "Đang xóa…" : "Xóa"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
