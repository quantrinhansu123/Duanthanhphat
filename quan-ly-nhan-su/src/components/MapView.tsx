"use client";

import dynamic from "next/dynamic";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ArrowsIn, ArrowsOut } from "@/components/icons";
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
    <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl bg-slate-200 text-sm text-slate-500">
      Đang tải Google Maps…
    </div>
  ),
});

const CoordinateLeafletMap = dynamic(() => import("@/components/CoordinateLeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl bg-blue-100 text-sm text-slate-500">
      Đang tải bản đồ dự phòng…
    </div>
  ),
});

const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
const POINT_LIST_RENDER_LIMIT = 200;

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
  const deferredQuery = useDeferredValue(query);
  const useGoogle = Boolean(googleApiKey);
  const supabaseReady = hasSupabaseEnv();

  const reload = useCallback(async (force = false) => {
    setLoading(true);
    setErrorMsg(null);
    const res = await fetchMapPointsFromDb({ force });
    setPoints(res.points.length ? res.points : res.source === "seed" ? seedMapPoints : []);
    setDataSource(res.source);
    if (res.error) setErrorMsg(res.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload(false);
  }, [reload]);

  useEffect(() => {
    if (typeof window === "undefined" || points.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const weldId = params.get("weldId");
    const pointId = params.get("pointId");
    if (weldId) {
      const match = points.find(
        (p) =>
          p.weldId === weldId ||
          p.id === weldId ||
          p.weldCode?.trim().toLowerCase() === weldId.trim().toLowerCase(),
      );
      if (match) {
        setSelectedId(match.id);
        setFocusSelected(true);
        setMode("route");
        return;
      }
    }
    if (pointId) {
      const match = points.find(
        (p) =>
          p.id === pointId ||
          p.code.trim().toLowerCase() === pointId.trim().toLowerCase(),
      );
      if (match) {
        setSelectedId(match.id);
        setFocusSelected(true);
        setMode("route");
      }
    }
  }, [points]);

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
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return points;
    return points.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.chainage.toLowerCase().includes(q) ||
        String(p.latitude).includes(q) ||
        String(p.longitude).includes(q),
    );
  }, [deferredQuery, points]);

  const selected = filtered.find((p) => p.id === selectedId) ?? null;
  const visibleListPoints = useMemo(() => {
    if (filtered.length <= POINT_LIST_RENDER_LIMIT) return filtered;
    const visible = filtered.slice(0, POINT_LIST_RENDER_LIMIT);
    if (selected && !visible.some((point) => point.id === selected.id)) {
      return [selected, ...visible.slice(0, POINT_LIST_RENDER_LIMIT - 1)];
    }
    return visible;
  }, [filtered, selected]);
  const googleRouteUrl = useMemo(() => {
    const source = filtered.length ? filtered : points;
    if (source.length <= 20) return googleOpenRoute(source);
    const step = Math.ceil(source.length / 20);
    return googleOpenRoute(source.filter((_, index) => index % step === 0).slice(0, 20));
  }, [filtered, points]);

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
    await reload(true);
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
    await reload(true);
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
    await reload(true);
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
      await reload(true);
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
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <strong>Google Maps:</strong> marker + đường tuyến từ bảng <code className="rounded bg-white px-1">toa_do</code>.
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <strong>Chưa có Google API key.</strong> Đang dùng OSM. Thêm{" "}
          <code className="rounded bg-white px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> nếu cần nền Google.
        </div>
      )}

      {!supabaseReady && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Chưa có Supabase. Thêm vào <code className="rounded bg-white px-1">.env.local</code>:{" "}
          <code className="rounded bg-white px-1">NEXT_PUBLIC_SUPABASE_URL</code> và{" "}
          <code className="rounded bg-white px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, rồi chạy SQL{" "}
          <code className="rounded bg-white px-1">supabase/toa_do.sql</code>.
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMsg}
        </div>
      )}
      {statusMsg && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {statusMsg}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
        <span>
          <strong className="text-slate-900">{filtered.length}</strong> điểm
          {loading ? " · đang tải…" : ""}
        </span>
        <span className="text-slate-300">|</span>
        <span>
          Nguồn:{" "}
          <strong className="text-slate-900">
            {dataSource === "supabase" ? "Supabase · toa_do" : "Seed cục bộ"}
          </strong>
        </span>
        <span className="text-slate-300">|</span>
        <span className="font-medium text-[#0047AB]">{useGoogle ? "Google Maps" : "OSM (dự phòng)"}</span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setViewMode("vietnam")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mode === "vietnam" && !focusSelected
                ? "bg-[#0047AB] text-white"
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            Toàn Việt Nam
          </button>
          <button
            type="button"
            onClick={() => setViewMode("route")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mode === "route" || focusSelected
                ? "bg-[#0047AB] text-white"
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            Theo tuyến điểm
          </button>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setBaseLayer("roadmap")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              baseLayer === "roadmap"
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            Bản đồ
          </button>
          <button
            type="button"
            onClick={() => setBaseLayer("satellite")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              baseLayer === "satellite"
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:bg-slate-50"
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
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15"
          />
        </div>

        <button
          type="button"
          disabled={!supabaseReady || saving}
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-10 items-center rounded-lg bg-[#0047AB] px-4 text-sm font-semibold text-white hover:bg-[#00388A] disabled:opacity-50"
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
          className="inline-flex h-10 items-center rounded-lg border border-[#0047AB] bg-white px-4 text-sm font-semibold text-[#0047AB] hover:bg-blue-50 disabled:opacity-50"
        >
          {saving ? "Đang import…" : "Tải Excel lên"}
        </button>
        <button
          type="button"
          onClick={() => downloadCoordinatesExcelTemplate()}
          className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Mẫu Excel
        </button>
        <button
          type="button"
          disabled={!supabaseReady || saving}
          onClick={() => void handleSeed()}
          className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Seed 14 điểm HN
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void reload(true)}
          className="inline-flex h-10 items-center rounded-lg border border-[#d9e2f1] bg-white px-4 text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc]"
        >
          Tải lại
        </button>
        <a
          href={googleOpenVietnam()}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Mở Google Maps
        </a>
        <a
          href={googleRouteUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Tuyến trên Google
        </a>
        {selected && (
          <a
            href={googleOpenPoint(selected.latitude, selected.longitude)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center rounded-lg border border-[#0047AB] bg-white px-4 text-sm font-semibold text-[#0047AB] hover:bg-blue-50"
          >
            Điểm trên Google
          </a>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={(e) => void handleAdd(e)}
          className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:grid-cols-2 lg:grid-cols-5"
        >
          <label className="text-xs font-semibold text-slate-500">
            Mã điểm
            <input
              required
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="TT0015"
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-[#0047AB]"
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Kinh độ (lon)
            <input
              required
              value={form.longitude}
              onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
              placeholder="105.8412"
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-[#0047AB]"
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Vĩ độ (lat)
            <input
              required
              value={form.latitude}
              onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
              placeholder="21.0245"
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-[#0047AB]"
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Lý trình
            <input
              value={form.chainage}
              onChange={(e) => setForm((f) => ({ ...f, chainage: e.target.value }))}
              placeholder="Km0+350.00"
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-[#0047AB]"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving || !supabaseReady}
              className="h-10 w-full rounded-lg bg-[#0047AB] px-4 text-sm font-semibold text-white hover:bg-[#00388A] disabled:opacity-50"
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
              : "relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
          }
        >
          <button
            type="button"
            onClick={toggleMapFullscreen}
            title={mapFullscreen ? "Thu nhỏ (Esc)" : "Phóng to màn hình"}
            aria-label={mapFullscreen ? "Thu nhỏ" : "Phóng to"}
            className="absolute left-3 top-3 z-[500] inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-slate-700 shadow-xs backdrop-blur hover:bg-white hover:text-slate-900"
          >
            {mapFullscreen ? (
              <ArrowsIn size={14} weight="bold" aria-hidden />
            ) : (
              <ArrowsOut size={14} weight="bold" aria-hidden />
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
            <div className="border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600 flex flex-wrap items-center gap-2">
              <span>Đã chọn: <strong className="text-slate-900">{selected.code}</strong> · {selected.chainage} · {selected.latitude}, {selected.longitude}</span>
              {selected.weldCode ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-100 px-2 py-0.5 font-medium text-[#0047AB]">
                  Mối hàn: <strong>{selected.weldCode}</strong>
                  {selected.welderName && ` · Thợ: ${selected.welderName}`}
                  {selected.machineName && ` · Máy: ${selected.machineName}`}
                  {selected.result && (
                    <span className={`ml-1 font-bold ${selected.result === "Đạt" ? "text-emerald-700" : "text-rose-600"}`}>
                      ({selected.result})
                    </span>
                  )}
                </span>
              ) : (
                <span className="rounded bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  Chưa liên kết nhật ký hàn
                </span>
              )}
            </div>
          )}
        </div>

        {!mapFullscreen && (
        <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="border-b border-[#e8eef8] bg-[#f8fafc] px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#64748b]">
            Danh sách điểm ({visibleListPoints.length}/{filtered.length})
          </div>
          <div className="max-h-[min(62vh,560px)] overflow-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Mã điểm</th>
                  <th className="px-3 py-2.5">Mối hàn / Thợ</th>
                  <th className="px-3 py-2.5">Lý trình</th>
                  <th className="px-3 py-2.5">Tọa độ</th>
                  <th className="px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      Chưa có điểm. Bấm <strong>Seed 14 điểm HN</strong> hoặc <strong>+ Thêm toạ độ</strong>.
                    </td>
                  </tr>
                )}
                {visibleListPoints.map((p: MapPoint) => {
                  const active = p.id === selected?.id;
                  const canDelete = dataSource === "supabase" && p.id.length > 8;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => selectPoint(p.id)}
                      className={`cursor-pointer border-b border-slate-100 ${
                        active ? "bg-blue-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-3 py-2.5 font-semibold text-slate-900">
                        {p.code}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {p.weldCode ? (
                          <div>
                            <span className="font-semibold text-[#0047AB]">{p.weldCode}</span>
                            {p.welderName && <div className="text-slate-500">{p.welderName}</div>}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Chưa liên kết</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{p.chainage}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">
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
                            className="text-xs font-medium text-rose-600 hover:underline"
                          >
                            Xóa
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length > visibleListPoints.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-center text-xs text-[#64748b]">
                      Đang giới hạn {POINT_LIST_RENDER_LIMIT} dòng để tải nhanh. Dùng ô tìm kiếm để mở điểm khác.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>
    </main>
  );
}
