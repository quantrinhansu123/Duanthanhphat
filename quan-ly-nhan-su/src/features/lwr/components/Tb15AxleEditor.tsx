"use client";

import { useMemo, useState } from "react";
import type { Tb15Row, Tb15Wheel } from "@/lib/tb15Catalogs";
import { useAccess } from "@/lib/useAccess";
import { Tb15AxleDiagram } from "./Tb15AxleDiagram";

type DraftAxle = { y: string; x: string };

const emptyAxle = (x = ""): DraftAxle => ({ y: "", x });
const field = "mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-2 font-mono text-sm";

function wheelsOf(row: Tb15Row): Tb15Wheel[] {
  return Array.isArray(row.wheels) ? [...row.wheels].sort((a, b) => a.stt - b.stt || a.x_m - b.x_m) : [];
}

function fromScheme(row: Tb15Row): DraftAxle[] {
  const wheels = wheelsOf(row);
  if (!wheels.length) return [emptyAxle("0")];
  const origin = wheels[0].x_m;
  return wheels.map((wheel) => ({
    y: String(wheel.p_j_kn),
    x: String(Math.round((wheel.x_m - origin) * 1000) / 1000),
  }));
}

/** Nhập Y (kN) và x kể từ trục 1 (m), lưu sơ đồ để sheet kiểm toán dùng. */
export function Tb15AxleEditor({
  en = false,
  schemes,
  onSaved,
}: {
  en?: boolean;
  schemes: Tb15Row[];
  onSaved: (rows: Tb15Row[]) => void;
}) {
  const { can } = useAccess();
  const canEdit = can("lwr-cong-thuc-tb10015", "edit");
  const [schemeId, setSchemeId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [axles, setAxles] = useState<DraftAxle[]>([emptyAxle("0"), emptyAxle()]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => {
    const wheels: Tb15Wheel[] = [];
    axles.forEach((axle, index) => {
      const y = Number(axle.y);
      const x = Number(axle.x);
      if (Number.isFinite(y) && Number.isFinite(x)) wheels.push({ stt: index + 1, x_m: x, p_j_kn: y });
    });
    return wheels;
  }, [axles]);

  function loadScheme(id: string) {
    setSchemeId(id);
    setStatus("");
    const row = schemes.find((item) => item.id === id);
    if (!row) {
      setCode("");
      setName("");
      setAxles([emptyAxle("0"), emptyAxle()]);
      return;
    }
    setCode(String(row.ma ?? ""));
    setName(String(row.ten ?? ""));
    setAxles(fromScheme(row));
  }

  function patchAxle(index: number, partial: Partial<DraftAxle>) {
    setAxles((current) => current.map((axle, i) => (i === index ? { ...axle, ...partial } : axle)));
  }

  async function save() {
    setStatus("");
    if (!canEdit) {
      setStatus(en ? "This account cannot edit catalog data." : "Tài khoản này không có quyền sửa dữ liệu.");
      return;
    }
    const wheels = axles.map((axle, index) => ({
      stt: index + 1,
      x_m: Number(axle.x),
      p_j_kn: Number(axle.y),
    }));
    if (!code.trim() || !name.trim()) {
      setStatus(en ? "Enter a code and a name." : "Nhập mã và tên sơ đồ.");
      return;
    }
    if (wheels.some((wheel) => !Number.isFinite(wheel.x_m) || !Number.isFinite(wheel.p_j_kn) || wheel.p_j_kn <= 0)) {
      setStatus(en ? "Each axle needs Y greater than 0 and a distance x." : "Mỗi trục cần Y lớn hơn 0 và khoảng cách x.");
      return;
    }
    if (new Set(wheels.map((wheel) => wheel.x_m)).size !== wheels.length) {
      setStatus(en ? "Distances x from axle 1 must be different." : "Khoảng cách x kể từ trục 1 không được trùng.");
      return;
    }
    setBusy(true);
    try {
      const editing = Boolean(schemeId);
      const res = await fetch("/api/tb15-catalogs/so_do_tai", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editing ? { id: schemeId } : {}),
          ma: code.trim(),
          ten: name.trim(),
          mo_ta: "",
          wheels,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (en ? "Could not save." : "Không lưu được sơ đồ."));
      const list = await fetch("/api/tb15-catalogs/so_do_tai", { cache: "no-store" });
      const listed = await list.json();
      if (!list.ok || !Array.isArray(listed.rows)) throw new Error(listed.error || (en ? "Saved, but the list did not refresh." : "Đã lưu nhưng chưa tải lại danh sách."));
      onSaved(listed.rows);
      const savedId = String(data.row?.id ?? schemeId);
      setSchemeId(savedId);
      setStatus(en ? "Saved. The check sheet can select this scheme." : "Đã lưu. Tab Kiểm toán nền đường chọn sơ đồ này để tính.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : (en ? "Could not save." : "Không lưu được sơ đồ."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-semibold text-slate-700 sm:col-span-3">
          {en ? "Saved scheme" : "Sơ đồ đã lưu"}
          <select value={schemeId} onChange={(e) => loadScheme(e.target.value)} className={field}>
            <option value="">{en ? "New scheme" : "Sơ đồ mới"}</option>
            {schemes.map((row) => (
              <option key={String(row.id)} value={String(row.id)}>
                {String(row.ma ?? "")} · {String(row.ten ?? "")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-700">
          {en ? "Code" : "Mã sơ đồ"}
          <input value={code} onChange={(e) => setCode(e.target.value)} className={field} />
        </label>
        <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
          {en ? "Name" : "Tên sơ đồ"}
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            <tr className="border-b border-slate-200">
              <th className="px-3 py-2">{en ? "Axle" : "Trục"}</th>
              <th className="px-3 py-2">{en ? "Y (kN)" : "Y (kN)"}</th>
              <th className="px-3 py-2">{en ? "x from axle 1 (m)" : "x kể từ trục 1 (m)"}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {axles.map((axle, index) => (
              <tr key={index} className="border-b border-slate-100">
                <td className="px-3 py-2 font-semibold">{index + 1}</td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={axle.y}
                    aria-label={`${en ? "Axle" : "Trục"} ${index + 1} Y`}
                    onChange={(e) => patchAxle(index, { y: e.target.value })}
                    className={field}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={axle.x}
                    aria-label={`${en ? "Axle" : "Trục"} ${index + 1} x`}
                    onChange={(e) => patchAxle(index, { x: e.target.value })}
                    className={field}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    disabled={axles.length <= 1}
                    onClick={() => setAxles((current) => current.filter((_, i) => i !== index))}
                    className="text-sm font-semibold text-rose-700 disabled:opacity-40"
                  >
                    {en ? "Remove" : "Xóa"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={axles.length >= 12}
          onClick={() => setAxles((current) => [...current, emptyAxle()])}
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 disabled:opacity-40"
        >
          {en ? "Add axle" : "Thêm trục"}
        </button>
        <button
          type="button"
          disabled={busy || !canEdit}
          onClick={() => void save()}
          className="h-9 rounded-lg bg-[#0047AB] px-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? (en ? "Saving…" : "Đang lưu…") : (en ? "Save scheme" : "Lưu sơ đồ")}
        </button>
      </div>
      {status && <p className="text-sm text-slate-700">{status}</p>}
      <Tb15AxleDiagram
        en={en}
        title={name.trim() || (en ? "Axle preview" : "Xem trước sơ đồ trục")}
        wheels={preview}
      />
    </div>
  );
}
