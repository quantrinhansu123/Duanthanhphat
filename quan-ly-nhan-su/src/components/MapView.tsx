"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  googleOpenPoint,
  googleOpenRoute,
  googleOpenVietnam,
  mapPoints as seedMapPoints,
  type MapBaseLayer,
  type MapPoint,
  type MapViewMode,
} from "@/data/mapPoints";
import {
  deleteMapPoint,
  fetchMapPointsFromDb,
  hasSupabaseEnv,
  insertMapPoint,
  seedMapPointsToDb,
  upsertMapPoints,
} from "@/lib/mapPointsDb";
import {
  downloadCoordinatesExcelTemplate,
  parseCoordinatesExcel,
} from "@/lib/parseCoordinatesExcel";

const GoogleCoordinateMap = dynamic(() => import("@/components/GoogleCoordinateMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl bg-[#e8eef8] text-[13px] text-[#64748b]">
      Đang tải Google Maps…
    </div>
  ),
});

const CoordinateLeafletMap = dynamic(() => import("@/components/CoordinateLeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl bg-[#dbeafe] text-[13px] text-[#64748b]">
      Đang tải bản đồ dự phòng…
    </div>
  ),
});

const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";

const emptyForm = {
  code: "",
  longitude: "",
  latitude: "",
  chainage: "",
};

export default function MapView() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<MapViewMode>("route");
  const [baseLayer, setBaseLayer] = useState<MapBaseLayer>("roadmap");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusSelected, setFocusSelected] = useState(false);
  const [points, setPoints] = useState<MapPoint[]>(seedMapPoints);
  const [dataSource, setDataSource] = useState<"supabase" | "seed">("seed");
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const useGoogle = Boolean(googleApiKey);
  const supabaseReady = hasSupabaseEnv();

  const reload = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const res = await fetchMapPointsFromDb();
    setPoints(res.points.length ? res.points : res.source === "seed" ? seedMapPoints : []);
    setDataSource(res.source);
    if (res.error) setErrorMsg(res.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!mapFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMapFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Leaflet / Google cần resize sau khi đổi kích thước khung
    const t = window.setTimeout(() => window.dispatchEvent(new Event("resize")), 80);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      window.clearTimeout(t);
      window.dispatchEvent(new Event("resize"));
    };
  }, [mapFullscreen]);

  function toggleMapFullscreen() {
    setMapFullscreen((v) => !v);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return points;
    return points.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.chainage.toLowerCase().includes(q) ||
        String(p.latitude).includes(q) ||
        String(p.longitude).includes(q),
    );
  }, [query, points]);

  const selected = filtered.find((p) => p.id === selectedId) ?? null;

  function selectPoint(id: string) {
    if (!id) {
      setSelectedId(null);
      setFocusSelected(false);
      return;
    }
    setSelectedId(id);
    setFocusSelected(true);
    setMode("route");
  }

  function setViewMode(next: MapViewMode) {
    setMode(next);
    setFocusSelected(false);
    if (next === "vietnam") setSelectedId(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    setErrorMsg(null);

    const longitude = Number(form.longitude.replace(",", "."));
    const latitude = Number(form.latitude.replace(",", "."));
    const order = points.length + 1;

    const res = await insertMapPoint({
      code: form.code,
      longitude,
      latitude,
      chainage: form.chainage,
      order,
    });

    setSaving(false);
    if (res.error) {
      setErrorMsg(res.error);
      return;
    }

    setForm(emptyForm);
    setShowForm(false);
    setStatusMsg(`Đã thêm ${res.point?.code}`);
    await reload();
    if (res.point) selectPoint(res.point.id);
  }

  async function handleSeed() {
    setSaving(true);
    setStatusMsg(null);
    setErrorMsg(null);
    const res = await seedMapPointsToDb();
    setSaving(false);
    if (res.error) {
      setErrorMsg(res.error);
      return;
    }
    setStatusMsg(`Đã seed ${res.inserted} điểm mẫu vào Supabase`);
    await reload();
  }

  async function handleDelete(id: string, code: string) {
    if (!confirm(`Xóa điểm ${code}?`)) return;
    setSaving(true);
    setErrorMsg(null);
    const res = await deleteMapPoint(id);
    setSaving(false);
    if (res.error) {
      setErrorMsg(res.error);
      return;
    }
    if (selectedId === id) {
      setSelectedId(null);
      setFocusSelected(false);
    }
    setStatusMsg(`Đã xóa ${code}`);
    await reload();
  }

  async function handleExcelFile(file: File | null) {
    if (!file) return;
    setSaving(true);
    setStatusMsg(null);
    setErrorMsg(null);

    try {
      const parsed = await parseCoordinatesExcel(file);
      if (!parsed.rows.length) {
        setErrorMsg(
          parsed.errors[0] ??
            "Không đọc được dòng nào. Kiểm tra cột: ma_diem, kinh_do, vi_do.",
        );
        setSaving(false);
        return;
      }

      const res = await upsertMapPoints(parsed.rows);
      if (res.error) {
        setErrorMsg(res.error);
        setSaving(false);
        return;
      }

      const warn =
        parsed.errors.length > 0
          ? ` · ${parsed.errors.length} dòng lỗi (bỏ qua)`
          : "";
      setStatusMsg(
        `Đã import ${res.upserted} điểm từ Excel (${file.name})${warn}`,
      );
      await reload();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Không đọc được file Excel");
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <main className="mx-auto max-w-[1400px] px-6 pb-8">
      {useGoogle ? (
        <div className="mb-4 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[13px] text-[#166534]">
          <strong>Google Maps:</strong> marker + đường tuyến từ bảng <code className="rounded bg-white px-1">toa_do</code>.
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-[13px] text-[#92400e]">
          <strong>Chưa có Google API key.</strong> Đang dùng OSM. Thêm{" "}
          <code className="rounded bg-white px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> nếu cần nền Google.
        </div>
      )}

      {!supabaseReady && (
        <div className="mb-4 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[13px] text-[#991b1b]">
          Chưa có Supabase. Thêm vào <code className="rounded bg-white px-1">.env.local</code>:{" "}
          <code className="rounded bg-white px-1">NEXT_PUBLIC_SUPABASE_URL</code> và{" "}
          <code className="rounded bg-white px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, rồi chạy SQL{" "}
          <code className="rounded bg-white px-1">supabase/toa_do.sql</code>.
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[13px] text-[#991b1b]">
          {errorMsg}
        </div>
      )}
      {statusMsg && (
        <div className="mb-4 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[13px] text-[#166534]">
          {statusMsg}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#475569]">
        <span>
          <strong className="text-[#0f172a]">{filtered.length}</strong> điểm
          {loading ? " · đang tải…" : ""}
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          Nguồn:{" "}
          <strong className="text-[#0f172a]">
            {dataSource === "supabase" ? "Supabase · toa_do" : "Seed cục bộ"}
          </strong>
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span className="font-medium text-[#0047AB]">{useGoogle ? "Google Maps" : "OSM (dự phòng)"}</span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-[#d9e2f1] bg-white p-1">
          <button
            type="button"
            onClick={() => setViewMode("vietnam")}
            className={`rounded-md px-3 py-2 text-[13px] font-semibold transition ${
              mode === "vietnam" && !focusSelected
                ? "bg-[#0047AB] text-white"
                : "text-[#64748b] hover:bg-[#f8fafc]"
            }`}
          >
            Toàn Việt Nam
          </button>
          <button
            type="button"
            onClick={() => setViewMode("route")}
            className={`rounded-md px-3 py-2 text-[13px] font-semibold transition ${
              mode === "route" || focusSelected
                ? "bg-[#0047AB] text-white"
                : "text-[#64748b] hover:bg-[#f8fafc]"
            }`}
          >
            Theo tuyến điểm
          </button>
        </div>

        <div className="inline-flex rounded-lg border border-[#d9e2f1] bg-white p-1">
          <button
            type="button"
            onClick={() => setBaseLayer("roadmap")}
            className={`rounded-md px-3 py-2 text-[13px] font-semibold transition ${
              baseLayer === "roadmap"
                ? "bg-[#0f172a] text-white"
                : "text-[#64748b] hover:bg-[#f8fafc]"
            }`}
          >
            Bản đồ
          </button>
          <button
            type="button"
            onClick={() => setBaseLayer("satellite")}
            className={`rounded-md px-3 py-2 text-[13px] font-semibold transition ${
              baseLayer === "satellite"
                ? "bg-[#0f172a] text-white"
                : "text-[#64748b] hover:bg-[#f8fafc]"
            }`}
          >
            Vệ tinh
          </button>
        </div>

        <div className="relative min-w-[200px] flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm mã điểm, lý trình, tọa độ..."
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] outline-none focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15"
          />
        </div>

        <button
          type="button"
          disabled={!supabaseReady || saving}
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-10 items-center rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white hover:bg-[#003987] disabled:opacity-50"
        >
          {showForm ? "Đóng form" : "+ Thêm toạ độ"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          className="hidden"
          onChange={(e) => void handleExcelFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          disabled={!supabaseReady || saving}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-10 items-center rounded-lg border border-[#0047AB] bg-white px-4 text-[13px] font-semibold text-[#0047AB] hover:bg-[#eef4ff] disabled:opacity-50"
        >
          {saving ? "Đang import…" : "Tải Excel lên"}
        </button>
        <button
          type="button"
          onClick={() => downloadCoordinatesExcelTemplate()}
          className="inline-flex h-10 items-center rounded-lg border border-[#d9e2f1] bg-white px-4 text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc]"
        >
          Mẫu Excel
        </button>
        <button
          type="button"
          disabled={!supabaseReady || saving}
          onClick={() => void handleSeed()}
          className="inline-flex h-10 items-center rounded-lg border border-[#d9e2f1] bg-white px-4 text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc] disabled:opacity-50"
        >
          Seed 14 điểm HN
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void reload()}
          className="inline-flex h-10 items-center rounded-lg border border-[#d9e2f1] bg-white px-4 text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc]"
        >
          Tải lại
        </button>
        <a
          href={googleOpenVietnam()}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center rounded-lg border border-[#d9e2f1] bg-white px-4 text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc]"
        >
          Mở Google Maps
        </a>
        <a
          href={googleOpenRoute(filtered.length ? filtered : points)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center rounded-lg border border-[#d9e2f1] bg-white px-4 text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc]"
        >
          Tuyến trên Google
        </a>
        {selected && (
          <a
            href={googleOpenPoint(selected.latitude, selected.longitude)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center rounded-lg border border-[#0047AB] bg-white px-4 text-[13px] font-semibold text-[#0047AB] hover:bg-[#eef4ff]"
          >
            Điểm trên Google
          </a>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={(e) => void handleAdd(e)}
          className="mb-4 grid gap-3 rounded-xl border border-[#d9e2f1] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:grid-cols-2 lg:grid-cols-5"
        >
          <label className="text-[12px] font-semibold text-[#64748b]">
            Mã điểm
            <input
              required
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="TT0015"
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] text-[#0f172a] outline-none focus:border-[#0047AB]"
            />
          </label>
          <label className="text-[12px] font-semibold text-[#64748b]">
            Kinh độ (lon)
            <input
              required
              value={form.longitude}
              onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
              placeholder="105.8412"
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] text-[#0f172a] outline-none focus:border-[#0047AB]"
            />
          </label>
          <label className="text-[12px] font-semibold text-[#64748b]">
            Vĩ độ (lat)
            <input
              required
              value={form.latitude}
              onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
              placeholder="21.0245"
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] text-[#0f172a] outline-none focus:border-[#0047AB]"
            />
          </label>
          <label className="text-[12px] font-semibold text-[#64748b]">
            Lý trình
            <input
              value={form.chainage}
              onChange={(e) => setForm((f) => ({ ...f, chainage: e.target.value }))}
              placeholder="Km0+350.00"
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] text-[#0f172a] outline-none focus:border-[#0047AB]"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving || !supabaseReady}
              className="h-10 w-full rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white hover:bg-[#003987] disabled:opacity-50"
            >
              {saving ? "Đang lưu…" : "Lưu vào Supabase"}
            </button>
          </div>
        </form>
      )}

      <div className={`grid gap-4 ${mapFullscreen ? "" : "xl:grid-cols-[1fr_340px]"}`}>
        <div
          className={
            mapFullscreen
              ? "fixed inset-0 z-[80] flex flex-col bg-white"
              : "relative overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
          }
        >
          <button
            type="button"
            onClick={toggleMapFullscreen}
            title={mapFullscreen ? "Thu nhỏ (Esc)" : "Phóng to màn hình"}
            aria-label={mapFullscreen ? "Thu nhỏ" : "Phóng to"}
            className="absolute left-3 top-3 z-[500] inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#d9e2f1] bg-white/95 text-[#334155] shadow-sm backdrop-blur hover:bg-white hover:text-[#0f172a]"
          >
            {mapFullscreen ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M8 3v3a2 2 0 0 1-2 2H3M16 3v3a2 2 0 0 0 2 2h3M8 21v-3a2 2 0 0 0-2-2H3M16 21v-3a2 2 0 0 1 2-2h3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          <div
            className={
              mapFullscreen
                ? "min-h-0 flex-1"
                : "h-[min(62vh,560px)] min-h-[420px]"
            }
          >
            {useGoogle ? (
              <GoogleCoordinateMap
                apiKey={googleApiKey}
                points={filtered}
                mode={mode}
                baseLayer={baseLayer}
                selectedId={selected?.id}
                focusSelected={focusSelected}
                onSelect={selectPoint}
              />
            ) : (
              <CoordinateLeafletMap
                points={filtered}
                mode={mode}
                baseLayer={baseLayer}
                selectedId={selected?.id}
                focusSelected={focusSelected}
                onSelect={selectPoint}
              />
            )}
          </div>
          {selected && (
            <div className="border-t border-[#e8eef8] bg-[#f8fafc] px-4 py-2.5 text-[12px] text-[#475569]">
              Đã chọn: <strong className="text-[#0f172a]">{selected.code}</strong> · {selected.chainage}{" "}
              · {selected.latitude}, {selected.longitude}
            </div>
          )}
        </div>

        {!mapFullscreen && (
        <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="border-b border-[#e8eef8] bg-[#f8fafc] px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#64748b]">
            Danh sách điểm ({filtered.length})
          </div>
          <div className="max-h-[min(62vh,560px)] overflow-auto">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-[#e8eef8] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748b]">
                  <th className="px-3 py-2.5">Mã</th>
                  <th className="px-3 py-2.5">Lý trình</th>
                  <th className="px-3 py-2.5">Lon / Lat</th>
                  <th className="px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-[#64748b]">
                      Chưa có điểm. Bấm <strong>Seed 14 điểm HN</strong> hoặc <strong>+ Thêm toạ độ</strong>.
                    </td>
                  </tr>
                )}
                {filtered.map((p: MapPoint) => {
                  const active = p.id === selected?.id;
                  const canDelete = dataSource === "supabase" && p.id.length > 8;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => selectPoint(p.id)}
                      className={`cursor-pointer border-b border-[#f1f5f9] ${
                        active ? "bg-[#eef4ff]" : "hover:bg-[#f8fafc]"
                      }`}
                    >
                      <td className="px-3 py-2.5 font-semibold text-[#0f172a]">{p.code}</td>
                      <td className="px-3 py-2.5 text-[#334155]">{p.chainage}</td>
                      <td className="px-3 py-2.5 text-[12px] text-[#64748b]">
                        {p.longitude}
                        <br />
                        {p.latitude}
                      </td>
                      <td className="px-2 py-2.5">
                        {canDelete && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDelete(p.id, p.code);
                            }}
                            className="text-[12px] font-medium text-[#dc2626] hover:underline"
                          >
                            Xóa
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>
    </main>
  );
}
