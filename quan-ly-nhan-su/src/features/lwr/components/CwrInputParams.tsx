"use client";

import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlass } from "@/components/icons";
import { TB15_SEED } from "@/lib/tb15CatalogSeed";
import { TB15_CLIMATE_SEED } from "@/lib/tb15ClimateSeed.generated";
import type { Tb15Row } from "@/lib/tb15Catalogs";

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

const SECTIONS = [
  { id: "A", title: "A. Thông số về nhiệt độ và tính toán nhiệt độ khoá đường theo từng vùng của Việt Nam" },
  { id: "B", title: "B. Thông số về ray, phụ kiện, tà vẹt" },
  { id: "C", title: "C. Thông số về tải trọng" },
  { id: "D", title: "D. Thông số tuyến và tốc độ" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/** B.0.4-1 — sức cản ngang nền đá (chuẩn). */
const B041_ROWS = [
  { loai: "Loại II", boTri: "1 840 thanh/km", q0: 23.0, B: 63, Z: 1.2, C: 106, N: 2.5 },
  { loai: "Loại III", boTri: "1 760 thanh/km", q0: 27.4, B: 92, Z: 1.2, C: 179, N: 2.5 },
] as const;

/** B.0.4-2 — mô men cản phụ kiện. */
const B042_ROWS = [
  { loai: "Loại đàn hồi II", H: "2,2×10⁴", mu: 2, psi: 3.0983 },
] as const;

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

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("vi");
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.stt}. ${r.ten_tram} ${r.tinh}`.toLocaleLowerCase("vi").includes(q),
    );
  }, [rows, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageIndex = Math.min(page, pages - 1);
  const visible = filtered.slice(pageIndex * PAGE, (pageIndex + 1) * PAGE);

  const betaSimple = 0.002 * deltaH;

  const loaiRay = TB15_SEED.loai_ray ?? [];
  const doCung = TB15_SEED.do_cung_goi ?? [];
  const ketCau = TB15_SEED.ket_cau_duong ?? [];

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <p className="text-xs font-bold tracking-wide text-[#0047AB]">01</p>
        <h2 className="text-lg font-bold text-slate-900">
          {en ? "INPUT PARAMETERS" : "CÁC THÔNG SỐ ĐẦU VÀO"}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {en
            ? "A climate · B rail/sleeper · C load · D alignment / speed."
            : "A khí hậu · B ray / phụ kiện / tà vẹt · C tải trọng · D tuyến / tốc độ."}
        </p>
      </header>

      <nav aria-label={en ? "Input parameter groups" : "Nhóm thông số đầu vào"} className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
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

      {section === "A" && (
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

      {section === "B" && (
        <div className="space-y-4">
          <RefBlock
            title={en ? "1. Appendix C — Rail section properties" : "1. Phụ lục C — Thông số mặt cắt ray thường dùng"}
            note={en ? "50 / 60 / 75 kg/m by vertical wear." : "Ray 50 / 60 / 75 kg/m theo độ mòn thẳng đứng."}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] border-collapse text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2">{en ? "Rail" : "Loại ray"}</th>
                    <th className="px-3 py-2 text-right">{en ? "Wear (mm)" : "Độ mòn (mm)"}</th>
                    <th className="px-3 py-2 text-right">F (mm²)</th>
                    <th className="px-3 py-2 text-right">W_đỉnh</th>
                    <th className="px-3 py-2 text-right">W_đế</th>
                    <th className="px-3 py-2 text-right">I_x</th>
                    <th className="px-3 py-2 text-right">I_y</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loaiRay.map((r) => (
                    <tr key={String(r.id)} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{Number(r.loai_kg_m)} kg/m</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(Number(r.do_mon_mm), 0)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(Number(r.f_mm2), 0)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(Number(r.w_dau_mm3), 0)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(Number(r.w_day_mm3), 0)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(Number(r.i_x_mm4), 0)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(Number(r.i_y_mm4), 0)}</td>
                    </tr>
                  ))}
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
                    <th className="px-3 py-2 text-right">r không tải</th>
                    <th className="px-3 py-2 text-right">r có tải</th>
                    <th className="px-3 py-2 text-right">a (m)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ketCau.map((r) => (
                    <tr key={String(r.id)} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{String(r.ten)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(Number(r.r_khong_tai), 1)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(Number(r.r_co_tai), 1)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(Number(r.cu_ly_nut_a_m), 3)}</td>
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
                    <th className="px-3 py-2 text-right">D (kN/mm)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {doCung.map((r) => (
                    <tr key={String(r.id)} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{String(r.phuong_an)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(Number(r.d_kn_mm), 1)}</td>
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
                  {B041_ROWS.map((r) => (
                    <tr key={r.loai} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{r.loai}</td>
                      <td className="px-3 py-2">{r.boTri}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(r.q0, 1)}</td>
                      <td className="px-3 py-2 text-right font-mono">{r.B}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(r.Z, 1)}</td>
                      <td className="px-3 py-2 text-right font-mono">{r.C}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(r.N, 1)}</td>
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
                  {B042_ROWS.map((r) => (
                    <tr key={r.loai} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{r.loai}</td>
                      <td className="px-3 py-2 text-right font-mono">{r.H}</td>
                      <td className="px-3 py-2 text-right font-mono">{r.mu}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(r.psi, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </RefBlock>
        </div>
      )}

      {section === "C" && (
        <div className="space-y-4">
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

      {section === "D" && (
        <div className="space-y-4">
          <RefBlock
            title={en ? "Load eccentricity β on curves (A.0.2-2 / A.0.2-3)" : "Hệ số lệch tải β trên đường cong (A.0.2-2 / A.0.2-3)"}
            note={en
              ? "β = 0.002·Δh (A.0.2-3), Δh in mm"
              : "β = 0,002·Δh (A.0.2-3), Δh tính bằng mm"}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-700">
                Δh — {en ? "unbalanced cant (mm)" : "siêu cao không cân bằng (mm)"}
                <input type="number" value={deltaH} onChange={(e) => setDeltaH(Number(e.target.value))}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm" />
              </label>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-semibold text-emerald-800">{en ? "Load eccentricity" : "Hệ số lệch tải"}</p>
                <p className="mt-1 font-mono text-lg font-bold text-emerald-950">β = 0,002·Δh = {fmt(betaSimple, 4)}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {en
                ? "Straight track: R = 0. Curve: enter R and cant; pick bridge vs open track in the calculation sheet."
                : "Đường thẳng: R = 0. Đường cong: nhập R và siêu cao; chọn đoạn cầu / đoạn nền ở sheet tính toán."}
            </p>
          </RefBlock>
        </div>
      )}
    </div>
  );
}

function RefBlock({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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
    <section className="space-y-4" aria-labelledby="cwr-input-a-title">
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
