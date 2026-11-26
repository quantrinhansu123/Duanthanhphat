"use client";

import { useEffect, useState } from "react";
import { MagnifyingGlass } from "@/components/icons";
import { TB15_SEED } from "@/lib/tb15CatalogSeed";
import { TB15_CLIMATE_SEED } from "@/lib/tb15ClimateSeed.generated";
import type { Tb15Row, Tb15Wheel } from "@/lib/tb15Catalogs";
import { GAUGE_STANDARD, gaugeNumbers, type GaugeDraft } from "../lib/tb15-gauge";
import { cantBeta } from "../lib/tb15-ground";
import { Tb15AxleEditor } from "./Tb15AxleEditor";
import { Tb15GaugeTable } from "./Tb15GaugeTable";
import { Tb15SheetPrint, type Tb15PrintPage } from "./Tb15SheetPrint";

const RAIL_MAX_OFFSET = 20;
const PAGE = 40;

type ClimateRow = {
  stt: number;
  ten_tram: string;
  tinh: string;
  t_kk_min: number;
  t_kk_max: number;
  /** 12 tháng (A.6 thấp nhất, A.5 cao nhất); null nếu bản ghi chưa có dữ liệu theo tháng. */
  t_min_thang: number[] | null;
  t_max_thang: number[] | null;
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function monthList(v: unknown): number[] | null {
  return Array.isArray(v) && v.length === 12 && v.every((x) => Number.isFinite(Number(x))) ? v.map(Number) : null;
}

function toClimate(rows: Tb15Row[]): ClimateRow[] {
  return rows
    .map((row, i) => ({
      stt: Number(row.ma_tram) || i + 1,
      ten_tram: String(row.ten_tram ?? "").trim(),
      tinh: String(row.tinh ?? "").trim(),
      t_kk_min: Number(row.t_kk_min),
      t_kk_max: Number(row.t_kk_max),
      t_min_thang: monthList(row.t_min_thang),
      t_max_thang: monthList(row.t_max_thang),
    }))
    .filter((r) => r.ten_tram && Number.isFinite(r.t_kk_min) && Number.isFinite(r.t_kk_max))
    .sort((a, b) => a.stt - b.stt || a.ten_tram.localeCompare(b.ten_tram, "vi"));
}

function fmt(n: number, digits = 1) {
  return n.toLocaleString("vi-VN", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

function num(v: unknown, digits = 1) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? fmt(n, digits) : "—";
}

function loaiDuong(v: unknown, en: boolean) {
  if (v === "co_ba_lat") return en ? "Ballasted" : "Có ba lát";
  if (v === "khong_ba_lat") return en ? "Ballastless" : "Không ba lát";
  return "—";
}

const INPUT_CATALOGS = ["loai_ray", "mac_thep", "ket_cau_duong", "do_cung_goi", "on_dinh_nen", "mo_men_can", "so_do_tai"] as const;

const SECTIONS = [
  { id: "A", title: "A. Thông số về nhiệt độ và tính toán nhiệt độ khoá đường theo từng vùng của Việt Nam" },
  { id: "B", title: "B. Thông số về ray, phụ kiện, tà vẹt" },
  { id: "C", title: "C. Thông số về tải trọng" },
  { id: "D", title: "D. Thông số tuyến và tốc độ" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/** A.0.2-1 — hệ số tốc độ α. */
const A021_ROWS = [
  { tocDo: "v ≤ 160 km/h", dien: "0,6v / 100", diesel: "0,4v / 100" },
  { tocDo: "v > 160 km/h", dien: "1,0", diesel: "1,0" },
] as const;

/** A.0.2-2 — hệ số lực ngang f. */
const A022_COLS = [
  { nhan: "Đường thẳng", f: 1.25 },
  { nhan: "R = 300 m", f: 2.0 },
  { nhan: "R = 400 m", f: 1.8 },
  { nhan: "R = 500 m", f: 1.7 },
  { nhan: "R = 600 m", f: 1.6 },
  { nhan: "R = 800–2000 m", f: 1.45 },
  { nhan: "R ≥ 2000 m", f: 1.3 },
] as const;

/** Bảng 12 tháng: không khí thấp nhất (A.6) và cao nhất (A.5) cho từng trạm. */
function ClimateMonthTable({ rows, en }: { rows: ClimateRow[]; en: boolean }) {
  const cell = (values: number[] | null, month: number) => {
    const v = values?.[month - 1];
    return v === undefined ? "—" : fmt(v);
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[90rem] border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          <tr className="border-b border-slate-200">
            <th className="px-3 py-2.5" rowSpan={2}>{en ? "Station" : "Trạm"}</th>
            <th className="px-3 py-2.5" rowSpan={2}>{en ? "Province" : "Tỉnh"}</th>
            <th className="border-l border-slate-200 px-3 py-2 text-center text-sky-800" colSpan={12}>
              {en ? "Air min by month (A.6, °C)" : "Không khí thấp nhất theo tháng (A.6, °C)"}
            </th>
            <th className="border-l border-slate-200 px-3 py-2 text-center text-rose-700" colSpan={12}>
              {en ? "Air max by month (A.5, °C)" : "Không khí cao nhất theo tháng (A.5, °C)"}
            </th>
          </tr>
          <tr className="border-b border-slate-200">
            {MONTHS.map((m) => (
              <th key={`min-${m}`} className={`px-2 py-2 text-right ${m === 1 ? "border-l border-slate-200" : ""}`}>T{m}</th>
            ))}
            {MONTHS.map((m) => (
              <th key={`max-${m}`} className={`px-2 py-2 text-right ${m === 1 ? "border-l border-slate-200" : ""}`}>T{m}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={`${r.stt}-${r.ten_tram}`} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-medium text-slate-900">{r.stt}. {r.ten_tram}</td>
              <td className="px-3 py-2 text-slate-600">{r.tinh || "—"}</td>
              {MONTHS.map((m) => (
                <td key={`min-${m}`} className={`px-2 py-2 text-right font-mono tabular-nums text-sky-800 ${m === 1 ? "border-l border-slate-100" : ""}`}>{cell(r.t_min_thang, m)}</td>
              ))}
              {MONTHS.map((m) => (
                <td key={`max-${m}`} className={`px-2 py-2 text-right font-mono tabular-nums text-rose-700 ${m === 1 ? "border-l border-slate-100" : ""}`}>{cell(r.t_max_thang, m)}</td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={26} className="px-3 py-8 text-center text-slate-500">
                {en ? "No stations match." : "Không có trạm khớp."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Tab «Thông số đầu vào» — A khí hậu; B ray/tà vẹt; C tải; D tuyến. */
export default function CwrInputParams({ en = false }: { en?: boolean }) {
  const [rows, setRows] = useState<ClimateRow[]>(() => toClimate(TB15_CLIMATE_SEED));
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [section, setSection] = useState<SectionId>("A");
  const [status, setStatus] = useState("");
  const [monthly, setMonthly] = useState(false);
  const [deltaH, setDeltaH] = useState(0);
  const [gauge, setGauge] = useState<GaugeDraft>(GAUGE_STANDARD);
  const [printPages, setPrintPages] = useState<Tb15PrintPage[] | null>(null);
  const [catalogs, setCatalogs] = useState<Partial<Record<(typeof INPUT_CATALOGS)[number], Tb15Row[]>>>({
    loai_ray: TB15_SEED.loai_ray,
    mac_thep: TB15_SEED.mac_thep,
    ket_cau_duong: TB15_SEED.ket_cau_duong,
    do_cung_goi: TB15_SEED.do_cung_goi,
    on_dinh_nen: TB15_SEED.on_dinh_nen,
    mo_men_can: TB15_SEED.mo_men_can,
    so_do_tai: TB15_SEED.so_do_tai,
  });
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const res = await fetch("/api/tb15-catalogs/khi_hau");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Không tải được bảng khí hậu.");
        const next = toClimate(Array.isArray(data.rows) ? data.rows : []);
        if (live && next.length) setRows(next);
      } catch (e) {
        if (live) setStatus(e instanceof Error ? e.message : "Dùng bản seed QCVN trên máy.");
      }
    })();
    return () => { live = false; };
  }, []);

  useEffect(() => {
    let live = true;
    void Promise.all(INPUT_CATALOGS.map(async (key) => {
      try {
        const res = await fetch(`/api/tb15-catalogs/${key}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !Array.isArray(data.rows) || !data.rows.length) return null;
        return [key, data.rows as Tb15Row[]] as const;
      } catch {
        return null;
      }
    })).then((entries) => {
      if (!live) return;
      setCatalogs((prev) => {
        const next = { ...prev };
        for (const entry of entries) if (entry) next[entry[0]] = entry[1];
        return next;
      });
    });
    return () => { live = false; };
  }, []);

  function axleTable(scheme: Tb15Row): string[][] {
    const wheels = (Array.isArray(scheme.wheels) ? scheme.wheels : []) as Tb15Wheel[];
    const sorted = [...wheels].sort((a, b) => a.stt - b.stt || a.x_m - b.x_m);
    if (!sorted.length) return [];
    const origin = sorted[0].x_m;
    return sorted.map((wheel, index) => [
      String(index + 1),
      num(wheel.p_j_kn, 1),
      num(wheel.x_m - origin, 3),
    ]);
  }

  function pageFor(id: SectionId): Tb15PrintPage {
    if (id === "A") {
      return {
        kicker: "Sheet A",
        title: en ? "SHEET A — CLIMATE AND RAIL TEMPERATURE" : "SHEET A — KHÍ HẬU VÀ NHIỆT ĐỘ RAY",
        subtitle: en ? "QCVN 02:2022/BXD, tables A.5 and A.6" : "QCVN 02:2022/BXD, bảng A.5 và A.6",
        sections: [{
          heading: en ? "I. Stations" : "I. Trạm khí hậu",
          note: en
            ? `Lowest rail temperature = lowest air temperature. Highest rail temperature = highest air temperature + ${RAIL_MAX_OFFSET} °C.`
            : `Nhiệt độ ray thấp nhất = nhiệt độ không khí thấp nhất. Cao nhất = nhiệt độ không khí cao nhất + ${RAIL_MAX_OFFSET} °C.`,
          table: {
            headers: en
              ? ["Station", "Province", "Air min", "Air max", "Rail min", "Rail max"]
              : ["Trạm", "Tỉnh", "KK thấp nhất", "KK cao nhất", "Ray thấp nhất", "Ray cao nhất"],
            rows: filtered.map((row) => [
              `${row.stt}. ${row.ten_tram}`,
              row.tinh || "—",
              fmt(row.t_kk_min),
              fmt(row.t_kk_max),
              fmt(row.t_kk_min),
              fmt(Math.round((row.t_kk_max + RAIL_MAX_OFFSET) * 10) / 10),
            ]),
          },
        }],
      };
    }
    if (id === "B") {
      const k = kValues.length === 1 ? kValues[0] : NaN;
      return {
        kicker: "Sheet B",
        title: en ? "SHEET B — RAIL, FASTENER, SLEEPER" : "SHEET B — RAY, PHỤ KIỆN, TÀ VẸT",
        subtitle: "TB 10015-2012",
        sections: [
          {
            heading: en ? "I. Rail section" : "I. Mặt cắt ray",
            table: {
              headers: ["kg/m", en ? "Wear" : "Mòn", "F", "W đầu", "W đáy", "K", "E", "α"],
              rows: loaiRay.map((row) => [
                num(row.loai_kg_m, 0), num(row.do_mon_mm, 0), num(row.f_mm2, 0),
                num(row.w_dau_mm3, 0), num(row.w_day_mm3, 0), num(row.k_an_toan, 2),
                num(row.e_mpa, 0), num(row.alpha, 7),
              ]),
            },
          },
          {
            heading: en ? "II. Yield strength" : "II. Cường độ chảy σ_s",
            note: en ? "[σ] = σ_s / K" : "[σ] = σ_s / K",
            table: {
              headers: [en ? "Grade" : "Mác thép", "σ_s", "[σ]"],
              rows: macThep.map((row) => {
                const sigma = Number(row.sigma_s_mpa);
                const allow = Number.isFinite(sigma) && Number.isFinite(k) && k > 0 ? fmt(sigma / k, 2) : "—";
                return [String(row.mac_thep ?? "—"), num(row.sigma_s_mpa, 0), allow];
              }),
            },
          },
          {
            heading: en ? "III. Longitudinal resistance" : "III. Sức cản dọc",
            table: {
              headers: [en ? "Option" : "Phương án", en ? "Track" : "Loại đường", "r không tải", "r có tải", "a (m)"],
              rows: ketCau.map((row) => [
                String(row.ten ?? "—"), loaiDuong(row.loai_duong, en),
                num(row.r_khong_tai, 1), num(row.r_co_tai, 1), num(row.cu_ly_nut_a_m, 3),
              ]),
            },
          },
          {
            heading: en ? "IV. Seat stiffness D" : "IV. Độ cứng gối D",
            table: {
              headers: [en ? "Option" : "Phương án", en ? "Track" : "Loại đường", en ? "Pad" : "Đệm", "D"],
              rows: doCung.map((row) => [
                String(row.phuong_an ?? "—"), loaiDuong(row.loai_duong, en), num(row.dem_kn_mm, 1), num(row.d_kn_mm, 1),
              ]),
            },
          },
          {
            heading: "V. B.0.4-1",
            table: {
              headers: [en ? "Sleeper" : "Tà vẹt", en ? "Layout" : "Bố trí", "q₀", "B", "Z", "C", "N"],
              rows: onDinh.map((row) => [
                String(row.loai_ta_vet ?? "—"), String(row.bo_tri ?? "—"),
                num(row.q0, 1), num(row.b_hs, 1), num(row.z_hs, 1), num(row.c_hs, 1), num(row.n_hs, 1),
              ]),
            },
          },
          {
            heading: "VI. B.0.4-2",
            table: {
              headers: [en ? "Fastener" : "Phụ kiện", "H", "μ", "ψ"],
              rows: moMen.map((row) => [
                String(row.loai_phu_kien ?? "—"), num(row.h_ncm_cm, 0), num(row.mu, 2), num(row.psi, 4),
              ]),
            },
          },
        ],
      };
    }
    if (id === "C") {
      return {
        kicker: "Sheet C",
        title: en ? "SHEET C — TRAIN LOAD" : "SHEET C — TẢI TRỌNG ĐOÀN TÀU",
        subtitle: en ? "Axle load Y and distance x from axle 1" : "Lực trục Y và khoảng cách x kể từ trục 1",
        sections: [
          ...soDoTai.map((scheme, index) => ({
            heading: `${en ? "Scheme" : "Sơ đồ"} ${index + 1}. ${String(scheme.ma ?? "")} · ${String(scheme.ten ?? "")}`,
            table: {
              headers: [en ? "Axle" : "Trục", "Y (kN)", "x (m)"],
              rows: axleTable(scheme),
            },
          })),
          {
            heading: en ? "Speed factor α — A.0.2-1" : "Hệ số tốc độ α — A.0.2-1",
            table: {
              headers: [en ? "Speed" : "Tốc độ", en ? "Electric" : "Điện", "Diesel"],
              rows: A021_ROWS.map((row) => [row.tocDo, row.dien, row.diesel]),
            },
          },
          {
            heading: en ? "Lateral factor f — A.0.2-2" : "Hệ số lực ngang f — A.0.2-2",
            table: {
              headers: A022_COLS.map((col) => col.nhan),
              rows: [A022_COLS.map((col) => fmt(col.f, 2))],
            },
          },
        ],
      };
    }
    const geometry = gaugeNumbers(gauge);
    const beta = "error" in geometry
      ? geometry.error
      : (() => {
          const value = cantBeta(deltaH, geometry.cgHeightMm, geometry.railCenterMm);
          return `${fmt(value.beta, 4)} (${value.standard ? "β = 0,002·Δh" : "β = 2·Δh·H/S²"})`;
        })();
    return {
      kicker: "Sheet D",
      title: en ? "SHEET D — ALIGNMENT AND SPEED" : "SHEET D — TUYẾN VÀ TỐC ĐỘ",
      subtitle: en ? "Gauge, centre of gravity and load eccentricity" : "Khổ ray, chiều cao trọng tâm và hệ số lệch tải",
      sections: [{
        heading: en ? "I. Gauge" : "I. Khổ ray",
        pairs: [
          [en ? "Gauge (mm)" : "Khổ ray (mm)", String(gauge.gauge)],
          [en ? "Rail spacing S (mm)" : "Khoảng cách tim ray S (mm)", gauge.railCenterMm || "—"],
          [en ? "Locomotive H (mm)" : "H đầu máy (mm)", gauge.cgLocomotiveMm || "—"],
          [en ? "Wagon H (mm)" : "H toa xe (mm)", gauge.cgWagonMm || "—"],
          [en ? "Vehicle" : "Phương tiện", gauge.vehicle === "dau_may" ? (en ? "Locomotive" : "Đầu máy") : (en ? "Wagon" : "Toa xe")],
          ["Δh (mm)", fmt(deltaH, 1)],
          ["β", beta],
        ],
      }],
    };
  }

  const climateQuery = query.trim().toLocaleLowerCase("vi");
  const filtered = climateQuery
    ? rows.filter((r) => `${r.stt}. ${r.ten_tram} ${r.tinh}`.toLocaleLowerCase("vi").includes(climateQuery))
    : rows;

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageIndex = Math.min(page, pages - 1);
  const visible = filtered.slice(pageIndex * PAGE, (pageIndex + 1) * PAGE);

  const loaiRay = catalogs.loai_ray ?? [];
  const doCung = catalogs.do_cung_goi ?? [];
  const ketCau = catalogs.ket_cau_duong ?? [];
  const macThep = catalogs.mac_thep ?? [];
  const onDinh = catalogs.on_dinh_nen ?? [];
  const moMen = catalogs.mo_men_can ?? [];
  const soDoTai = catalogs.so_do_tai ?? [];
  const show = (id: SectionId) => section === id;
  const kValues = [...new Set(loaiRay.map((r) => Number(r.k_an_toan)).filter((n) => Number.isFinite(n)))];

  return (
    <div className="tb15-print-root space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-wide text-[#0047AB]">01</p>
            <h2 className="text-lg font-bold text-slate-900">
              {en ? "INPUT PARAMETERS" : "CÁC THÔNG SỐ ĐẦU VÀO"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {en
                ? "A climate · B rail/sleeper · C load · D alignment / speed."
                : "A khí hậu · B ray / phụ kiện / tà vẹt · C tải trọng · D tuyến / tốc độ."}
            </p>
          </div>
          <div className="tb15-no-print flex flex-wrap gap-2">
            <button type="button" onClick={() => setPrintPages([pageFor(section)])}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50">
              {en ? `Print sheet ${section}` : `In sheet ${section}`}
            </button>
            <button type="button" onClick={() => setPrintPages(["A", "B", "C", "D"].map(pageFor))}
              className="h-9 rounded-lg bg-[#0047AB] px-3 text-xs font-semibold text-white hover:bg-[#00388a]">
              {en ? "Print all input sheets" : "In tất cả sheet đầu vào"}
            </button>
          </div>
        </div>
      </header>

      <nav aria-label={en ? "Input parameter groups" : "Nhóm thông số đầu vào"} className="tb15-no-print grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={section === s.id}
            onClick={() => setSection(s.id)}
            title={s.title}
            className={`min-h-12 w-full rounded-lg border px-3 py-2 text-left text-xs font-semibold leading-snug sm:text-sm ${
              section === s.id
                ? "border-[#0047AB] bg-[#0047AB] text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span className="line-clamp-3">{s.title}</span>
          </button>
        ))}
      </nav>

      {show("A") && (
        <ClimateSection
          en={en}
          query={query}
          setQuery={(v) => { setQuery(v); setPage(0); }}
          status={status}
          filteredCount={filtered.length}
          totalCount={rows.length}
          visible={visible}
          pageIndex={pageIndex}
          pages={pages}
          setPage={setPage}
          monthly={monthly}
          setMonthly={setMonthly}
        />
      )}

      {show("B") && (
        <div className="space-y-4">
          <RefBlock
            title={en ? "1. Appendix C — Rail section properties" : "1. Phụ lục C — Thông số mặt cắt ray thường dùng"}
            note={en ? "K, E and α come from the rail catalog and feed the strength check." : "K, E và α lấy từ danh mục loại ray và được đưa vào kiểm tra cường độ."}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[64rem] border-collapse text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2">{en ? "Rail" : "Loại ray"}</th>
                    <th className="px-3 py-2 text-right">{en ? "Wear (mm)" : "Độ mòn (mm)"}</th>
                    <th className="px-3 py-2 text-right">F (mm²)</th>
                    <th className="px-3 py-2 text-right">W_đỉnh</th>
                    <th className="px-3 py-2 text-right">W_đế</th>
                    <th className="px-3 py-2 text-right">I_x</th>
                    <th className="px-3 py-2 text-right">I_y</th>
                    <th className="px-3 py-2 text-right">K</th>
                    <th className="px-3 py-2 text-right">E (MPa)</th>
                    <th className="px-3 py-2 text-right">α (1/°C)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loaiRay.map((r) => (
                    <tr key={String(r.id)} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{num(r.loai_kg_m, 0)} kg/m</td>
                      <td className="px-3 py-2 text-right font-mono">{num(r.do_mon_mm, 0)}</td>
                      <td className="px-3 py-2 text-right font-mono">{num(r.f_mm2, 0)}</td>
                      <td className="px-3 py-2 text-right font-mono">{num(r.w_dau_mm3, 0)}</td>
                      <td className="px-3 py-2 text-right font-mono">{num(r.w_day_mm3, 0)}</td>
                      <td className="px-3 py-2 text-right font-mono">{num(r.i_x_mm4, 0)}</td>
                      <td className="px-3 py-2 text-right font-mono">{num(r.i_y_mm4, 0)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{num(r.k_an_toan, 2)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{num(r.e_mpa, 0)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{num(r.alpha, 7)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </RefBlock>

          <RefBlock
            title={en ? "1b. Steel yield strength σ_s — Table 3.2.4" : "1b. Cường độ chảy σ_s của thép ray — Bảng 3.2.4"}
            note={en ? "[σ] = σ_s / K. K is the safety factor on the rail row." : "[σ] = σ_s / K. K là hệ số an toàn trên dòng loại ray."}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2">{en ? "Grade" : "Mác thép"}</th>
                    <th className="px-3 py-2 text-right">σ_s (MPa)</th>
                    <th className="px-3 py-2 text-right">[σ] = σ_s / K (MPa)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {macThep.map((r) => {
                    const sigma = Number(r.sigma_s_mpa);
                    const k = kValues.length === 1 ? kValues[0] : NaN;
                    const allow = Number.isFinite(sigma) && Number.isFinite(k) && k > 0 ? sigma / k : null;
                    return (
                      <tr key={String(r.id)} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium">{String(r.mac_thep ?? "—")}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold">{num(r.sigma_s_mpa, 0)}</td>
                        <td className="px-3 py-2 text-right font-mono">{allow === null ? (kValues.length > 1 ? (en ? "Depends on rail K" : "Theo K của dòng ray") : "—") : fmt(allow, 2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </RefBlock>

          <RefBlock
            title={en ? "2. Longitudinal resistance r (3.2.2) — plateau values" : "2. Sức cản dọc r (điều 3.2.2) — giá trị cao nguyên"}
            note={en ? "From seeded track-structure catalog." : "Theo catalog kết cấu đường đã seed."}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2">{en ? "Option" : "Phương án"}</th>
                    <th className="px-3 py-2">{en ? "Track" : "Loại đường"}</th>
                    <th className="px-3 py-2 text-right">r không tải</th>
                    <th className="px-3 py-2 text-right">r có tải</th>
                    <th className="px-3 py-2 text-right">a (m)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ketCau.map((r) => (
                    <tr key={String(r.id)} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{String(r.ten ?? "—")}</td>
                      <td className="px-3 py-2">{loaiDuong(r.loai_duong, en)}</td>
                      <td className="px-3 py-2 text-right font-mono">{num(r.r_khong_tai, 1)}</td>
                      <td className="px-3 py-2 text-right font-mono">{num(r.r_co_tai, 1)}</td>
                      <td className="px-3 py-2 text-right font-mono">{num(r.cu_ly_nut_a_m, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </RefBlock>

          <RefBlock
            title={en ? "3. Rail seat stiffness D (A.0.3)" : "3. Độ cứng gối ray D (A.0.3)"}
            note={en ? "u = D/a · used for foundation modulus." : "u = D/a — dùng tính module đàn hồi nền ray."}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2">{en ? "Option" : "Phương án"}</th>
                    <th className="px-3 py-2">{en ? "Track" : "Loại đường"}</th>
                    <th className="px-3 py-2 text-right">{en ? "Pad (kN/mm)" : "Đệm (kN/mm)"}</th>
                    <th className="px-3 py-2 text-right">D (kN/mm)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {doCung.map((r) => (
                    <tr key={String(r.id)} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{String(r.phuong_an ?? "—")}</td>
                      <td className="px-3 py-2">{loaiDuong(r.loai_duong, en)}</td>
                      <td className="px-3 py-2 text-right font-mono">{num(r.dem_kn_mm, 1)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{num(r.d_kn_mm, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </RefBlock>

          <RefBlock
            title={en ? "4. Lateral ballast resistance — Table B.0.4-1" : "4. Sức cản ngang nền đá — Bảng B.0.4-1"}
            note={en ? "q = q₀ − B y^Z + C y^(1/N)" : "q = q₀ − B·y^Z + C·y^(1/N)  (B.0.4-3)"}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2">{en ? "Sleeper" : "Loại tà vẹt"}</th>
                    <th className="px-3 py-2">{en ? "Layout" : "Bố trí"}</th>
                    <th className="px-3 py-2 text-right">q₀</th>
                    <th className="px-3 py-2 text-right">B</th>
                    <th className="px-3 py-2 text-right">Z</th>
                    <th className="px-3 py-2 text-right">C</th>
                    <th className="px-3 py-2 text-right">N</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {onDinh.map((r) => (
                    <tr key={String(r.id)} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{String(r.loai_ta_vet ?? "—")}</td>
                      <td className="px-3 py-2">{String(r.bo_tri ?? "—")}</td>
                      <td className="px-3 py-2 text-right font-mono">{num(r.q0, 1)}</td>
                      <td className="px-3 py-2 text-right font-mono">{num(r.b_hs, 1)}</td>
                      <td className="px-3 py-2 text-right font-mono">{num(r.z_hs, 1)}</td>
                      <td className="px-3 py-2 text-right font-mono">{num(r.c_hs, 1)}</td>
                      <td className="px-3 py-2 text-right font-mono">{num(r.n_hs, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </RefBlock>

          <RefBlock
            title={en ? "5. Fastener resistance moment — Table B.0.4-2" : "5. Mô men cản phụ kiện — Bảng B.0.4-2"}
            note={en ? "M = H · β^(1/μ)" : "M = H · β^(1/μ)  (B.0.4-4)"}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] border-collapse text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2">{en ? "Fastener" : "Loại phụ kiện"}</th>
                    <th className="px-3 py-2 text-right">H (N·cm/cm)</th>
                    <th className="px-3 py-2 text-right">μ</th>
                    <th className="px-3 py-2 text-right">ψ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {moMen.map((r) => (
                    <tr key={String(r.id)} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{String(r.loai_phu_kien ?? "—")}</td>
                      <td className="px-3 py-2 text-right font-mono">{num(r.h_ncm_cm, 0)}</td>
                      <td className="px-3 py-2 text-right font-mono">{num(r.mu, 2)}</td>
                      <td className="px-3 py-2 text-right font-mono">{num(r.psi, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </RefBlock>
        </div>
      )}

      {show("C") && (
        <div className="space-y-4">
          <RefBlock
            title={en ? "0. Train axle loads — Y and x" : "0. Tải trọng đoàn tàu theo trục — Y và x"}
            note={en
              ? "Enter Y (kN) and x from axle 1 (m). x of axle 1 is 0. Save the scheme, then select it on the check sheet."
              : "Nhập Y (kN) và x kể từ trục 1 (m). Trục 1 có x = 0. Lưu sơ đồ, rồi chọn sơ đồ đó ở tab Kiểm toán nền đường."}
          >
            <Tb15AxleEditor
              en={en}
              schemes={soDoTai}
              onSaved={(rows) => setCatalogs((prev) => ({ ...prev, so_do_tai: rows }))}
            />
          </RefBlock>
          <RefBlock
            title={en ? "1. Speed coefficient α — Table A.0.2-1" : "1. Hệ số tốc độ α — Bảng A.0.2-1"}
            note={en ? "P_d = (1+α)·P_j · v = design speed (km/h)." : "P_d = (1+α)·P_j · v là tốc độ thiết kế (km/h)."}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] border-collapse text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2">{en ? "Speed" : "Tốc độ"}</th>
                    <th className="px-3 py-2 text-right">{en ? "Electric" : "Sức kéo điện"}</th>
                    <th className="px-3 py-2 text-right">{en ? "Diesel" : "Sức kéo diesel"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {A021_ROWS.map((r) => (
                    <tr key={r.tocDo} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{r.tocDo}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{r.dien}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{r.diesel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </RefBlock>

          <RefBlock
            title={en ? "2. Lateral force coefficient f — Table A.0.2-2" : "2. Hệ số lực ngang f — Bảng A.0.2-2"}
            note={en ? "Between two radius steps, use the smaller f." : "R nằm giữa hai mốc: lấy hệ số của mốc nhỏ hơn."}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  <tr className="border-b border-slate-200">
                    {A022_COLS.map((c) => (
                      <th key={c.nhan} className="px-3 py-2 text-center">{c.nhan}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-slate-50">
                    {A022_COLS.map((c) => (
                      <td key={c.nhan} className="px-3 py-3 text-center font-mono text-base font-bold text-[#0047AB]">
                        {fmt(c.f, 2)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </RefBlock>
        </div>
      )}

      {show("D") && (
        <div className="space-y-4">
          <RefBlock
            title={en ? "Gauge, center of gravity and load eccentricity β" : "Khổ ray, chiều cao trọng tâm và hệ số lệch tải β"}
            note={en
              ? "1,435 mm uses S = 1,500 mm and H = 2,300 mm. 1,000 mm needs S and H entered. The same choice is on the check sheet."
              : "Khổ 1.435 mm dùng S = 1.500 mm và H = 2.300 mm. Khổ 1.000 mm nhập S và H. Cùng lựa chọn này có trên sheet kiểm toán."}
          >
            <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
              <label className="text-xs font-semibold text-slate-700">
                Δh — {en ? "unbalanced cant (mm)" : "siêu cao không cân bằng (mm)"}
                <input type="number" value={deltaH} onChange={(e) => setDeltaH(Number(e.target.value))}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm" />
              </label>
            </div>
            <Tb15GaugeTable en={en} draft={gauge} onChange={setGauge} deltaH={deltaH} />
          </RefBlock>
        </div>
      )}
      {printPages && <Tb15SheetPrint pages={printPages} onClose={() => setPrintPages(null)} />}
    </div>
  );
}

function RefBlock({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="tb15-sheet overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
        <h3 className="text-sm font-bold text-slate-900 sm:text-base">{title}</h3>
        {note && <p className="mt-1 text-xs text-slate-600 sm:text-sm">{note}</p>}
      </div>
      <div className="p-0 sm:p-1">{children}</div>
    </section>
  );
}

function ClimateSection({
  en, query, setQuery, status, filteredCount, totalCount, visible, pageIndex, pages, setPage, monthly, setMonthly,
}: {
  en: boolean;
  query: string;
  setQuery: (v: string) => void;
  status: string;
  filteredCount: number;
  totalCount: number;
  visible: ClimateRow[];
  pageIndex: number;
  pages: number;
  setPage: (fn: (p: number) => number) => void;
  monthly: boolean;
  setMonthly: (value: boolean) => void;
}) {
  return (
    <section className="tb15-sheet space-y-4" aria-labelledby="cwr-input-a-title">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <h3 id="cwr-input-a-title" className="text-sm font-bold text-slate-900 sm:text-base">
          1. {en
            ? "Absolute min/max air temperature — QCVN 02:2022/BXD (A.5 + A.6)"
            : "Lập bảng dữ liệu nhiệt độ không khí thấp nhất và cao nhất tuyệt đối theo QCVN 02:2022/BXD (gộp A.5 + A.6)"}
        </h3>
        <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
          <span className="font-bold">2.</span>{" "}
          {en
            ? `Lowest rail temperature = lowest air temperature. Highest rail temperature = highest air temperature + ${RAIL_MAX_OFFSET} °C.`
            : `Nhiệt độ ray thấp nhất = nhiệt độ không khí thấp nhất; cao nhất = nhiệt độ không khí cao nhất + ${RAIL_MAX_OFFSET} °C.`}
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="min-w-0 grow basis-56 text-xs font-semibold text-slate-700">
            {en ? "Search station / province" : "Tìm trạm / tỉnh"}
            <span className="relative mt-1 block">
              <MagnifyingGlass aria-hidden size={17} className="absolute top-3.5 left-3 text-slate-500" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={en ? "e.g. Mường Tè, Lai Châu…" : "VD: Mường Tè, Lai Châu…"}
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-[#0047AB]"
              />
            </span>
          </label>
          <p className="text-xs font-semibold text-slate-500">
            {filteredCount.toLocaleString("vi-VN")} / {totalCount.toLocaleString("vi-VN")} {en ? "stations" : "trạm"}
          </p>
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-xs font-semibold">
            <button type="button" aria-pressed={!monthly} onClick={() => setMonthly(false)}
              className={`h-8 rounded-md px-3 ${!monthly ? "bg-[#0047AB] text-white" : "text-slate-700"}`}>
              {en ? "By year" : "Theo năm"}
            </button>
            <button type="button" aria-pressed={monthly} onClick={() => setMonthly(true)}
              className={`h-8 rounded-md px-3 ${monthly ? "bg-[#0047AB] text-white" : "text-slate-700"}`}>
              {en ? "By month" : "Theo tháng"}
            </button>
          </div>
        </div>
        {status && <p className="mt-2 text-xs text-amber-700">{status}</p>}
      </div>

      {monthly ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ClimateMonthTable rows={visible} en={en} />
        </div>
      ) : (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-left text-xs sm:text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2.5" rowSpan={2}>{en ? "Station" : "Trạm"}</th>
                <th className="px-3 py-2.5" rowSpan={2}>{en ? "Province" : "Tỉnh"}</th>
                <th className="border-l border-slate-200 px-3 py-2 text-center" colSpan={2}>
                  {en ? "Air temperature (°C) — Year" : "Nhiệt độ không khí (°C) — Năm"}
                </th>
                <th className="border-l border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-emerald-900" colSpan={2}>
                  {en ? "Rail temperature (°C)" : "Nhiệt độ ray (°C)"}
                </th>
              </tr>
              <tr className="border-b border-slate-200">
                <th className="border-l border-slate-200 px-3 py-2 text-right font-semibold text-sky-800">
                  {en ? "Min (A.6)" : "Thấp nhất (A.6)"}
                </th>
                <th className="px-3 py-2 text-right font-semibold text-rose-700">
                  {en ? "Max (A.5)" : "Cao nhất (A.5)"}
                </th>
                <th className="border-l border-emerald-200 bg-emerald-50 px-3 py-2 text-right font-semibold text-sky-900">
                  {en ? "Min (= air min)" : "Thấp nhất (= T_kk min)"}
                </th>
                <th className="bg-emerald-50 px-3 py-2 text-right font-semibold text-rose-800">
                  {en ? `Max (= air max + ${RAIL_MAX_OFFSET})` : `Cao nhất (= T_kk max + ${RAIL_MAX_OFFSET})`}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((r) => {
                const tRayMax = Math.round((r.t_kk_max + RAIL_MAX_OFFSET) * 10) / 10;
                return (
                  <tr key={`${r.stt}-${r.ten_tram}`} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-900">{r.stt}. {r.ten_tram}</td>
                    <td className="px-3 py-2 text-slate-600">{r.tinh || "—"}</td>
                    <td className="border-l border-slate-100 px-3 py-2 text-right font-mono tabular-nums text-sky-800">{fmt(r.t_kk_min)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-rose-700">{fmt(r.t_kk_max)}</td>
                    <td className="border-l border-emerald-100 bg-emerald-50/40 px-3 py-2 text-right font-mono font-semibold tabular-nums text-sky-900">{fmt(r.t_kk_min)}</td>
                    <td className="bg-emerald-50/40 px-3 py-2 text-right font-mono font-semibold tabular-nums text-rose-800">{fmt(tRayMax)}</td>
                  </tr>
                );
              })}
              {!visible.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    {en ? "No stations match." : "Không có trạm khớp."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {monthly
            ? (en ? "Monthly values from QCVN (12 months). Rail min = air min of month; rail max = air max of month + 20 °C." : "Giá trị theo 12 tháng từ QCVN. Ray thấp nhất = không khí thấp nhất của tháng; ray cao nhất = không khí cao nhất của tháng + 20 °C.")
            : (en ? "Year column from QCVN. Rail columns calculated." : "Cột Năm theo QCVN. Hai cột nhiệt độ ray tính tự động.")}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" disabled={pageIndex <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold disabled:opacity-40">
            {en ? "Prev" : "Trước"}
          </button>
          <span className="font-mono text-xs text-slate-600">{pageIndex + 1}/{pages}</span>
          <button type="button" disabled={pageIndex >= pages - 1} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold disabled:opacity-40">
            {en ? "Next" : "Sau"}
          </button>
        </div>
      </div>
    </section>
  );
}
