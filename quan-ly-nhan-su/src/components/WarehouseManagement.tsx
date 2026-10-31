"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { loadEquipmentLocations, saveWarehouse, deleteWarehouse } from "@/lib/warehousesDb";
import type { LocationBundle } from "@/lib/warehouses";
import ProjectEquipmentTable from "@/components/ProjectEquipmentTable";
import { useAccess } from "@/lib/useAccess";

const empty = { id: "", name: "", address: "" };
export default function WarehouseManagement() {
  const { can } = useAccess();
  const [bundle, setBundle] = useState<LocationBundle>({ warehouses: [], locations: [] });
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState("");
  const [removing, setRemoving] = useState("");
  useEffect(() => {
    let live = true;
    loadEquipmentLocations().then((r) => { if (live) setBundle(r); }).catch((e) => { if (live) setStatus(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setStatus("");
    try {
      await saveWarehouse({ ...form, id: form.id || undefined });
      setBundle(await loadEquipmentLocations()); setForm(empty); setStatus("Đã lưu kho.");
    } catch (e) { setStatus(e instanceof Error ? e.message : "Không lưu được kho."); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true); setStatus("");
    try { await deleteWarehouse(id); setBundle(await loadEquipmentLocations()); setRemoving(""); if (form.id === id) setForm(empty); setStatus("Đã xóa kho."); }
    catch (e) { setStatus(e instanceof Error ? e.message : "Không xóa được kho."); }
    finally { setBusy(false); }
  }
  const missing = bundle.locations.filter((m) => !m.warehouseId).reduce((sum, m) => sum + m.warehouseQuantity, 0);
  const conflicts = bundle.locations.filter((m) => m.excessQuantity > 0 || m.projects.some((p) => p.missing));
  return <div className="space-y-5 px-4 pb-8 sm:px-6">
    <p className="text-sm text-slate-600">Chọn kho trong hồ sơ máy/thiết bị. Số bộ trong kho tự giảm khi gán thiết bị cho dự án và tăng khi bỏ gán.</p>
    <Link href="/danh-sach-may" className="inline-block text-sm font-semibold text-[#0047AB] underline">Mở danh sách máy và thiết bị để gán kho / xem dự án</Link>
    {can("quan-ly-kho", "edit") && <form onSubmit={save} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
      <h2 className="font-bold sm:col-span-2">{form.id ? "Sửa kho" : "Thêm kho"}</h2>
      <label className="text-sm font-semibold">Tên kho<input required maxLength={200} disabled={busy} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ví dụ: Kho 1 Hà Nội" className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal" /></label>
      <label className="text-sm font-semibold">Địa chỉ / vị trí kho<input required maxLength={500} disabled={busy} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Địa chỉ cụ thể của kho" className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal" /></label>
      <div className="flex gap-2 sm:col-span-2"><button disabled={busy || loading} className="rounded-lg bg-[#0047AB] px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Đang lưu…" : "Lưu kho"}</button>{form.id && <button type="button" disabled={busy} onClick={() => setForm(empty)} className="rounded-lg border px-4 py-2">Hủy sửa</button>}</div>
    </form>}
    {status && <p role="status" className="rounded-lg border border-slate-200 bg-white p-3 text-sm">{status}</p>}
    {loading ? <p role="status">Đang tải danh sách kho…</p> : <>
      {missing > 0 && <p className="text-sm text-amber-800">Còn {missing} bộ chưa chọn kho lưu trữ.</p>}
      {(conflicts.length > 0 || missing > 0) && (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          {conflicts.length > 0 && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <h2 className="font-bold">Phân công thiết bị cần kiểm tra</h2>
            <ul className="mt-2 space-y-2">{conflicts.map((m) => <li key={m.id}>
              <Link href={`/danh-sach-may?${new URLSearchParams({ may: m.code })}`} className="font-semibold underline">{m.code}</Link>
              {m.excessQuantity > 0 && <span>: đang gán vượt {m.excessQuantity} bộ.</span>}
              {m.projects.filter((p) => p.missing).map((p) => <span key={p.id}> Phân công {p.quantity} bộ còn tham chiếu {p.name.toLowerCase()}.</span>)}
            </li>)}</ul>
            <Link href="/quan-ly-du-an" className="mt-2 inline-block font-semibold underline">Mở dự án để kiểm tra phân công</Link>
          </section>}
          {missing > 0 && <section className="rounded-xl border border-amber-200 bg-white p-4 text-sm">
            <h2 className="font-bold">Thiết bị cần bổ sung vị trí kho</h2>
            <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto">{bundle.locations.filter((m) => !m.warehouseId && m.warehouseQuantity > 0).map((m) => <li key={m.id}>
              <Link href={`/danh-sach-may?${new URLSearchParams({ may: m.code })}`} className="font-semibold text-[#0047AB] underline">{m.code} · {m.name}</Link>: {m.warehouseQuantity} bộ
            </li>)}</ul>
          </section>}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[650px] text-left text-sm">
        <thead className="bg-slate-50"><tr>{["Tên kho", "Địa chỉ / vị trí", "Số bộ trong kho", "Thao tác"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
        <tbody>{bundle.warehouses.map((w) => <tr key={w.id} className="border-t border-slate-200"><td className="p-3 font-semibold">{w.name}</td><td className="p-3">{w.address}</td><td className="p-3">{bundle.locations.filter((m) => m.warehouseId === w.id).reduce((sum, m) => sum + m.warehouseQuantity, 0)}</td><td className="p-3"><div className="flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={() => setExpanded(expanded === w.id ? "" : w.id)} className="text-[#0047AB]">Xem thiết bị</button>
          {can("quan-ly-kho", "edit") && <button type="button" disabled={busy} onClick={() => setForm(w)} className="text-[#0047AB]">Sửa</button>}
          {can("quan-ly-kho", "delete") && (removing === w.id ? <><button type="button" disabled={busy} onClick={() => void remove(w.id)} className="text-rose-700">Xác nhận xóa</button><button type="button" disabled={busy} onClick={() => setRemoving("")}>Hủy</button></> : <button type="button" disabled={busy} onClick={() => setRemoving(w.id)} className="text-rose-700">Xóa</button>)}
        </div></td></tr>)}{!bundle.warehouses.length && <tr><td colSpan={4} className="p-6 text-center text-slate-500">Chưa có kho. Thêm tên và địa chỉ kho ở trên.</td></tr>}</tbody>
      </table></div>
      {bundle.warehouses.filter((w) => w.id === expanded).map((w) => <section key={w.id} className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="mb-3 font-bold">Thiết bị tại {w.name} · {w.address}</h2><ProjectEquipmentTable rows={bundle.locations.filter((m) => m.warehouseId === w.id && m.warehouseQuantity > 0).map((m) => ({ ...m, quantity: m.warehouseQuantity }))} /></section>)}
    </>}
  </div>;
}
