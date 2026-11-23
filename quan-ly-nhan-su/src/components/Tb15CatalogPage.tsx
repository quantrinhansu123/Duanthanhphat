"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [menuId, setMenuId] = useState("");
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [portalReady, setPortalReady] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const canEdit = meta ? can(meta.tabId, "edit") : false;
  const canDelete = meta ? can(meta.tabId, "delete") : false;
  const columns = useMemo(() => meta?.fields ?? [], [meta]);

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
    setForm(emptyForm(meta!));
    setWheels([{ stt: 1, x_m: 0, p_j_kn: 0 }]);
    setFormOpen(true);
    setMenuId("");
  }

  function openEdit(row: Tb15Row) {
    setForm(rowToForm(meta!, row));
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

  return (
    <div className="space-y-4 px-4 pb-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
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
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className="p-3 font-semibold whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                  {meta.hasWheels && <th className="p-3 font-semibold whitespace-nowrap">Số bánh</th>}
                  <th className="sticky right-0 z-[1] w-[1%] bg-slate-50 p-3 text-right font-semibold whitespace-nowrap shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)]">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={String(row.id)} className="group border-t border-slate-200">
                    {columns.map((c) => (
                      <td key={c.key} className="p-3 align-middle">
                        {displayCell(c.key, row[c.key])}
                      </td>
                    ))}
                    {meta.hasWheels && (
                      <td className="p-3 align-middle whitespace-nowrap">
                        {Array.isArray(row.wheels) ? row.wheels.length : 0}
                      </td>
                    )}
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
                    <td colSpan={columns.length + (meta.hasWheels ? 2 : 1)} className="p-6 text-center text-slate-500">
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
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {columns.map((f) => (
                <label key={f.key} className="text-sm font-semibold">
                  {f.label}
                  {f.type === "select" ? (
                    <select
                      required={f.required}
                      disabled={busy}
                      value={form[f.key] ?? ""}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal"
                    >
                      {(f.options ?? []).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      required={f.required}
                      type={f.type === "number" ? "number" : "text"}
                      step={f.step}
                      disabled={busy}
                      value={form[f.key] ?? ""}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal"
                    />
                  )}
                </label>
              ))}
            </div>

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
