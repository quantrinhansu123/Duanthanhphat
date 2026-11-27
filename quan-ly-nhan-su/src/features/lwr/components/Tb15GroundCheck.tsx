"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { catalogByKey, type Tb15Row } from "@/lib/tb15Catalogs";
import { useAccess } from "@/lib/useAccess";
import type { Tb15Trial, Tb15TrialForm, Tb15TrialParameter, Tb15TrialSummary } from "../lib/tb15-trial";
import type { GaugeMm, VehicleKind } from "../lib/tb15-gauge";
import { checkTb15Ground, type GroundCheckInput, type IrregularInput, type RiseMethod } from "../lib/tb15-ground";
import { buildTb15Step10, type Step10Origin } from "../lib/tb15-step10";
import { GAUGE_STANDARD, gaugeNumbers, type GaugeDraft } from "../lib/tb15-gauge";
import { Tb15AxleDiagram, wheelsFromFirstAxle } from "./Tb15AxleDiagram";
import { Tb15GaugeTable } from "./Tb15GaugeTable";
import { Tb15SheetPrint, type Tb15PrintPage } from "./Tb15SheetPrint";
import { Tb15Step10Report } from "./Tb15Step10Report";

const catalogs = [
  ["khi_hau", "Trạm khí hậu", (r: Tb15Row) => `${r.ten_tram} · ${r.tinh ?? ""}`],
  ["loai_ray", "Mặt cắt ray", (r: Tb15Row) => `${r.loai_kg_m} kg/m · mòn ${r.do_mon_mm} mm`],
  ["mac_thep", "Mác thép", (r: Tb15Row) => {
    const grade = String(r.mac_thep ?? "").trim() || "Mác thép";
    const allowable = seatAmount(r.sigma_cho_phep_mpa);
    return allowable ? `${grade} · [σ] = ${allowable} MPa` : grade;
  }],
  ["ket_cau_duong", "Kết cấu đường", (r: Tb15Row) => String(r.ten)],
  ["do_cung_goi", "Độ cứng gối", seatOptionLabel],
  ["so_do_tai", "Sơ đồ tải một ray", (r: Tb15Row) => String(r.ten)],
  ["he_so_tai", "Hệ số lực ngang", (r: Tb15Row) => `${r.nhan} · f = ${r.he_so}`],
  ["on_dinh_nen", "Ổn định nền đá (B.0.4-1)", (r: Tb15Row) => `Tà vẹt ${r.loai_ta_vet} · q₀ = ${r.q0}`],
  ["mo_men_can", "Mô men cản phụ kiện (B.0.4-2)", (r: Tb15Row) => String(r.loai_phu_kien)],
] as const;

type CatalogKey = typeof catalogs[number][0];
type Catalog = { rows: Tb15Row[]; backend?: string };
// E, α, K và l₀, i₀, ΔP lấy từ mặt cắt ray; đệm D lấy từ độ cứng gối. Không nhập tay.
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function monthAir(row: Tb15Row | undefined, month: number, field: "t_min_thang" | "t_max_thang") {
  const list = row?.[field];
  if (!Array.isArray(list) || list.length < month) return NaN;
  return Number(list[month - 1]);
}

const fields = [
  ["speed", "Tốc độ thiết kế (km/h)", ""],
  ["cant", "Siêu cao thiếu hoặc thừa Δh (mm)", ""],
  ["tolerance", "Biên độ khóa ± (3 hoặc 5 °C)", "5"],
  ["adjustment", "Hiệu chỉnh tâm khóa (−5 đến +5 °C)", "0"],
  ["gap", "Giới hạn khe đứt (mm)", "70"],
  ["extra", "Ứng suất kéo phụ σf (MPa)", ""],
  ["braking", "Ứng suất kéo/hãm σz (MPa)", ""],
] as const;
const control = "mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm";
const locked = "mt-1 block w-full rounded border border-slate-200 bg-slate-50 px-2 py-2 text-sm text-slate-800";
const format = (n: number | null) => n === null ? "—" : n.toLocaleString("vi-VN", { maximumFractionDigits: 4 });

function tractionKind(value: unknown) {
  const text = String(value ?? "").trim().toLowerCase();
  if (text.startsWith("dien") || text.startsWith("điện") || text === "electric") return "dien";
  if (text.startsWith("diesel")) return "diesel";
  return "";
}

function openBound(value: unknown, whenEmpty: number) {
  if (value === null || value === undefined || value === "") return whenEmpty;
  const n = Number(value);
  return Number.isFinite(n) ? n : whenEmpty;
}

function inSpeedBand(row: Tb15Row, speed: number) {
  const min = openBound(row.v_min_kmh, -Infinity);
  const max = openBound(row.v_max_kmh, Infinity);
  return speed >= min && speed <= max;
}

/** A.0.2-1: dòng có loại kéo khi v nằm trong khoảng; không có loại kéo là hệ số khi vượt ngưỡng. */
function matchSpeedFactor(rows: Tb15Row[] | undefined, speed: number, traction: "electric" | "diesel") {
  const want = traction === "electric" ? "dien" : "diesel";
  const table = (rows ?? []).filter((row) => row.loai === "van_toc");
  const band = table.filter((row) => inSpeedBand(row, speed));
  const specific = band.find((row) => tractionKind(row.loai_keo) === want);
  const cap = table.find((item) => !tractionKind(item.loai_keo) && Number.isFinite(openBound(item.v_min_kmh, NaN)));
  const capMin = openBound(cap?.v_min_kmh, NaN);
  const aboveCap = cap && Number.isFinite(capMin) && speed > capMin - 0.01;
  const row = specific ?? band.find((item) => !tractionKind(item.loai_keo)) ?? (aboveCap ? cap : undefined);
  const coefficient = Number(row?.he_so);
  const high = Number(cap?.he_so);
  if (!row || !(coefficient > 0)) {
    throw new Error("Không có hệ số vận tốc trong danh mục cho tốc độ và loại sức kéo này.");
  }
  return {
    row,
    coefficient,
    speedCapKmh: Number.isFinite(capMin) ? capMin - 0.01 : 160,
    highSpeedFactor: Number.isFinite(high) ? high : 1,
  };
}

function matchLateralFactor(rows: Tb15Row[] | undefined, radius: number) {
  return (rows ?? [])
    .filter((row) => radius === 0 ? row.r_tu_m === 0 : Number(row.r_tu_m) >= 300 && Number(row.r_tu_m) <= radius)
    .sort((a, b) => Number(b.r_tu_m) - Number(a.r_tu_m))[0];
}

function seatAmount(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
}

/** Cùng tên tà vẹt vẫn khác nhau ở độ cứng đệm; D là số đi vào u = D/a. */
function seatOptionLabel(row: Tb15Row) {
  const name = String(row.phuong_an ?? "").trim() || "Gối";
  const pad = seatAmount(row.dem_kn_mm);
  const tol = seatAmount(row.dem_sai_so_kn_mm);
  const support = seatAmount(row.d_kn_mm);
  const padText = pad ? (tol ? `đệm ${pad} ± ${tol} kN/mm` : `đệm ${pad} kN/mm`) : "";
  const supportText = support ? `D = ${support} kN/mm` : "";
  return [name, padText, supportText].filter(Boolean).join(" · ");
}

/** Loại II/III đọc từ tên hiện trên form hoặc từ cột loại tà vẹt. */
function sleeperType(value: unknown): "II" | "III" | "" {
  const text = String(value ?? "").replace(/\u2162/g, "III").replace(/\u2161/g, "II");
  const labeled = text.match(/(?:tà\s*vẹt|loại)\s*(III|II)\b/i)?.[1]?.toUpperCase();
  if (labeled === "II" || labeled === "III") return labeled;
  const bare = text.trim().toUpperCase().match(/^(III|II)\b/)?.[1];
  return bare === "II" || bare === "III" ? bare : "";
}

function suggestedTitle(origin: Step10Origin) {
  const when = new Date().toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
  return [origin.climate, origin.rail, when].filter(Boolean).join(" · ").slice(0, 120);
}

function whenText(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString("vi-VN");
}

const pickKeys = ["khi_hau", "loai_ray", "mac_thep", "ket_cau_duong", "do_cung_goi", "so_do_tai", "mo_men_can", "traction", "riseMethod"] as const;
type PickKey = typeof pickKeys[number];
type Picks = Record<PickKey, string>;
const emptyPicks: Picks = { khi_hau: "", loai_ray: "", mac_thep: "", ket_cau_duong: "", do_cung_goi: "", so_do_tai: "", mo_men_can: "", traction: "", riseMethod: "irregular" };
type Nums = { speed: string; tolerance: string; adjustment: string; gap: string; extra: string; braking: string };
const defaultNums: Nums = { speed: "", tolerance: "5", adjustment: "0", gap: "70", extra: "", braking: "" };

function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase();
}

export default function Tb15GroundCheck() {
  const { can } = useAccess();
  const canEdit = can("lwr-cong-thuc-tb10015", "edit");
  const canDelete = can("lwr-cong-thuc-tb10015", "delete");
  const [data, setData] = useState<Partial<Record<CatalogKey, Catalog>>>({});
  const [failures, setFailures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState<{ input: GroundCheckInput; result: ReturnType<typeof checkTb15Ground>; origin: Step10Origin; parameters: Tb15TrialParameter[] } | null>(null);
  const result = audit?.result ?? null;
  const [sourceLines, setSourceLines] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [ballast, setBallast] = useState<"co" | "khong">("co");
  const [place, setPlace] = useState<"nen" | "cau">("nen");
  const [alignment, setAlignment] = useState<"thang" | "cong">("thang");
  const [climateMonth, setClimateMonth] = useState(() => new Date().getMonth() + 1);
  const [gauge, setGauge] = useState<GaugeDraft>(GAUGE_STANDARD);
  const [deltaH, setDeltaH] = useState(0);
  const [schemeId, setSchemeId] = useState("");
  const [trackId, setTrackId] = useState("");
  const [radiusDraft, setRadiusDraft] = useState("");
  const [factorId, setFactorId] = useState("");
  const [ballastRowId, setBallastRowId] = useState("");
  const [picks, setPicks] = useState<Picks>(emptyPicks);
  const [nums, setNums] = useState<Nums>(defaultNums);
  const [confirmed, setConfirmed] = useState(false);
  const [printPages, setPrintPages] = useState<Tb15PrintPage[] | null>(null);
  const viewingRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [trials, setTrials] = useState<Tb15TrialSummary[]>([]);
  const [trialsNote, setTrialsNote] = useState("");
  const [saveTitle, setSaveTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [opened, setOpened] = useState<Tb15Trial | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Tb15TrialSummary | null>(null);
  const radiusValue = alignment === "thang" ? 0 : Number(radiusDraft);

  async function loadTrials() {
    const response = await fetch("/api/lwr/tb15-trials", { cache: "no-store" });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || "Không tải được bản lưu.");
    setTrials(Array.isArray(value.trials) ? value.trials : []);
  }

  useEffect(() => {
    let live = true;
    void loadTrials().catch((error) => {
      if (live) setTrialsNote(error instanceof Error ? error.message : "Không tải được bản lưu.");
    });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (viewingRef.current) return;
    if (alignment === "cong" && !(radiusValue >= 300)) {
      setFactorId("");
      return;
    }
    const match = matchLateralFactor(data.he_so_tai?.rows, radiusValue);
    setFactorId(match?.id ? String(match.id) : "");
  }, [alignment, radiusValue, data.he_so_tai]);

  useEffect(() => {
    if (viewingRef.current) return;
    const track = data.ket_cau_duong?.rows.find((row) => row.id === trackId);
    const type = sleeperType(track?.ten) || sleeperType(track?.loai_ta_vet);
    const match = data.on_dinh_nen?.rows.find((row) => sleeperType(row.loai_ta_vet) === type);
    setBallastRowId(match?.id ? String(match.id) : "");
  }, [trackId, data.ket_cau_duong, data.on_dinh_nen]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all(catalogs.map(async ([key, title]) => {
      try {
        const response = await fetch(`/api/tb15-catalogs/${key}`, { signal: controller.signal, cache: "no-store" });
        const value = await response.json();
        if (!response.ok || !Array.isArray(value.rows)) throw new Error(String(response.status));
        return { key, value: { rows: value.rows as Tb15Row[], backend: value.backend } };
      } catch {
        return { key, title };
      }
    })).then((entries) => {
      if (controller.signal.aborted) return;
      setData(Object.fromEntries(entries.flatMap(({ key, value }) => value ? [[key, value]] : [])));
      setFailures(entries.flatMap(({ title }) => title ? [title] : []));
      setLoading(false);
    });
    return () => controller.abort();
  }, []);

  function run(form: HTMLFormElement) {
    setAudit(null);
    setSourceLines([]);
    setError("");
    try {
      const values = new FormData(form);
      const getRow = (key: CatalogKey) => data[key]?.rows.find((r) => r.id === values.get(key));
      const number = (v: unknown) => v === null || v === undefined || v === "" ? NaN : Number(v);
      const read = (name: string) => number(values.get(name));
      const rail = getRow("loai_ray");
      const track = getRow("ket_cau_duong");
      const climate = getRow("khi_hau");
      const selectedSeat = getRow("do_cung_goi");
      const moMenPicked = getRow("mo_men_can");
      const geometry = gaugeNumbers(gauge);
      if ("error" in geometry) throw new Error(geometry.error);
      const caseLine = `Trường hợp: ${ballast === "co" ? "có ba lát" : "không ba lát"}, ${place === "cau" ? "trên cầu" : "trên nền đường"}, ${alignment === "thang" ? "đường thẳng" : "đường cong"}. Phụ kiện: ${moMenPicked?.loai_phu_kien ?? "chưa chọn"}. Kết cấu: ${track?.ten ?? "chưa chọn"}.`;
      if (place === "cau" || ballast === "khong") {
        setSourceLines([
          caseLine,
          `Khổ ${gauge.gauge} mm, H = ${geometry.cgHeightMm} mm, S = ${geometry.railCenterMm} mm.`,
        ]);
        throw new Error(place === "cau"
          ? "Đã gắn dữ liệu trên cầu. Sheet này kiểm cường độ và ổn định nền có ba lát, chưa tính lực tương tác ray–cầu."
          : "Đã gắn dữ liệu không ba lát. Ổn định B.0.3 / B.0.4 của sheet này dùng sức cản nền đá của đường có ba lát.");
      }
      const radius = alignment === "thang" ? 0 : read("radius");
      const matchingFactor = data.he_so_tai?.rows.find((row) => String(row.id) === factorId)
        ?? matchLateralFactor(data.he_so_tai?.rows, radius);
      if (!matchingFactor) {
        throw new Error("Không có hệ số lực ngang cho bán kính này. Đường cong dưới 300 m cần phương pháp riêng.");
      }
      const trackType = sleeperType(track?.ten) || sleeperType(track?.loai_ta_vet);
      const riseMethod = (String(values.get("riseMethod") || "irregular")) as RiseMethod;
      const onDinh = data.on_dinh_nen?.rows.find((row) => String(row.id) === ballastRowId)
        ?? data.on_dinh_nen?.rows.find((row) => sleeperType(row.loai_ta_vet) === trackType);
      const moMen = moMenPicked;
      let irregular: IrregularInput | undefined;
      if (riseMethod !== "uniform") {
        if (!onDinh || !moMen || !rail) {
          throw new Error("Thiếu bảng B.0.4-1 (theo tà vẹt), B.0.4-2 (mô men cản) hoặc B.0.4-3 (theo ray) trong danh mục.");
        }
        irregular = {
          q0: number(onDinh.q0), B: number(onDinh.b_hs), Z: number(onDinh.z_hs), C: number(onDinh.c_hs), N: number(onDinh.n_hs),
          H: number(moMen.h_ncm_cm), mu: number(moMen.mu),
          l0: number(rail.l0_cm), i0Permil: number(rail.i0_permil), dpKn: number(rail.dp_kn),
        };
      }

      const railE = number(rail?.e_mpa);
      const railAlpha = number(rail?.alpha);
      const railK = number(rail?.k_an_toan);
      const steel = getRow("mac_thep");
      const sigmaS = number(steel?.sigma_s_mpa);
      const allowable = number(steel?.sigma_cho_phep_mpa);
      if (!Number.isFinite(sigmaS)) throw new Error("Dòng mác thép đã chọn không có σs trong danh mục.");
      if (!Number.isFinite(allowable)) throw new Error("Dòng mác thép đã chọn không có ứng suất cho phép [σ] trong danh mục.");
      const traction = values.get("traction");
      if (traction !== "electric" && traction !== "diesel") {
        throw new Error("Chọn loại sức kéo điện hoặc diesel.");
      }
      const speedFactor = matchSpeedFactor(data.he_so_tai?.rows, read("speed"), traction);
      const airMin = monthAir(climate, climateMonth, "t_min_thang");
      const airMax = monthAir(climate, climateMonth, "t_max_thang");
      if (!Number.isFinite(airMin) || !Number.isFinite(airMax)) {
        throw new Error(`Trạm ${climate?.ten_tram ?? "đã chọn"} chưa có nhiệt độ không khí tháng ${climateMonth}.`);
      }
      setSourceLines([
        caseLine,
        `Trạm ${climate?.ten_tram}, tháng ${climateMonth}: Tmin không khí = ${airMin} °C, Tmax không khí = ${airMax} °C. Tmin ray = ${airMin} °C, Tmax ray = ${airMax + 20} °C.`,
        `Khổ ${gauge.gauge} mm, H = ${geometry.cgHeightMm} mm (${gauge.vehicle === "dau_may" ? "đầu máy" : "toa xe"}), S = ${geometry.railCenterMm} mm. Hệ số lực ngang f = ${matchingFactor.he_so} (${matchingFactor.nhan}). Hệ số vận tốc ${speedFactor.row.nhan}: ${speedFactor.coefficient}.`,
        `Ray ${rail?.loai_kg_m} kg/m, mòn ${rail?.do_mon_mm} mm: E = ${railE} MPa, α = ${railAlpha} /°C, K = ${railK}. Mác ${steel?.mac_thep}: σ_s = ${sigmaS} MPa, [σ] = ${allowable} MPa.`,
        `Gối ${selectedSeat ? seatOptionLabel(selectedSeat) : "chưa chọn"} (${selectedSeat?.loai_duong === "co_ba_lat" ? "có ba lát" : "không ba lát"}).`,
        `Kết cấu ${track?.ten}: tà vẹt ${track?.loai_ta_vet || "—"}, nút ${track?.cu_ly_nut_a_m} m, sức cản dọc ${track?.r_khong_tai} kN/(m·ray).`,
        ...(irregular ? [
          `B.0.4-1 (tà vẹt ${onDinh?.loai_ta_vet}): q₀ = ${irregular.q0} N/cm, B = ${irregular.B}, Z = ${irregular.Z}, C = ${irregular.C}, N = ${irregular.N}.`,
          `B.0.4-2: H = ${irregular.H} N·cm/cm, μ = ${irregular.mu}. B.0.4-3 (ray): l₀ = ${irregular.l0} cm, i₀ = ${irregular.i0Permil} ‰, ΔP = ${irregular.dpKn} kN.`,
        ] : []),
      ]);

      const scheme = getRow("so_do_tai");
      const wheels = wheelsFromFirstAxle(scheme && Array.isArray(scheme.wheels) ? scheme.wheels : []);
      const input: GroundCheckInput = {
        area: number(rail?.f_mm2), ix: number(rail?.i_x_mm4), iy: number(rail?.i_y_mm4),
        headModulus: number(rail?.w_dau_mm3), baseModulus: number(rail?.w_day_mm3),
        steelModulus: railE, expansion: railAlpha, yieldStress: sigmaS, allowableStress: allowable,
        safety: railK, seatStiffness: number(selectedSeat?.d_kn_mm), spacing: number(track?.cu_ly_nut_a_m),
        resistance: number(track?.r_khong_tai), lateralResistance: number(track?.q_kn_m),
        speed: read("speed"), speedCoefficient: speedFactor.coefficient,
        speedCapKmh: speedFactor.speedCapKmh, highSpeedFactor: speedFactor.highSpeedFactor,
        lateralFactor: number(matchingFactor.he_so), radius, cantDeficiency: read("cant"),
        cgHeightMm: geometry.cgHeightMm, railCenterMm: geometry.railCenterMm,
        minRailTemperature: airMin,
        maxRailTemperature: airMax + 20, lockTolerance: read("tolerance"), lockAdjustment: read("adjustment"),
        gapLimit: read("gap"), additionalStress: read("extra"), brakingStress: read("braking"),
        wheels: wheels.map((wheel) => ({ position: number(wheel.x_m), load: number(wheel.p_j_kn) })),
        riseMethod,
        irregular,
      };
      const riseLabel = riseMethod === "uniform"
        ? "B.0.3 — bước sóng đều"
        : riseMethod === "min"
          ? "Giá trị nhỏ hơn của B.0.3 và B.0.4"
          : "B.0.4 — bước sóng không đều";
      const parameters: Tb15TrialParameter[] = [
        ["Kết cấu", "Có ba lát"],
        ["Vị trí", "Trên nền đường"],
        ["Tuyến", alignment === "thang" ? "Đường thẳng" : "Đường cong"],
        ["Bán kính R (m)", format(radius)],
        ["Khổ ray (mm)", format(gauge.gauge)],
        ["Phương tiện", gauge.vehicle === "dau_may" ? "Đầu máy" : "Toa xe"],
        ["Chiều cao trọng tâm H (mm)", format(geometry.cgHeightMm)],
        ["Khoảng cách tim ray S (mm)", format(geometry.railCenterMm)],
        ["Trạm khí hậu", String(climate?.ten_tram ?? "—")],
        ["Tỉnh", String(climate?.tinh ?? "—")],
        ["Tháng", String(climateMonth)],
        ["Tmin không khí (°C)", format(airMin)],
        ["Tmax không khí (°C)", format(airMax)],
        ["Tmin ray (°C)", format(airMin)],
        ["Tmax ray (°C)", format(airMax + 20)],
        ["Mặt cắt ray", rail ? `${rail.loai_kg_m} kg/m, mòn ${rail.do_mon_mm} mm` : "—"],
        ["F (mm²)", format(number(rail?.f_mm2))],
        ["Ix (mm⁴)", format(number(rail?.i_x_mm4))],
        ["Iy (mm⁴)", format(number(rail?.i_y_mm4))],
        ["W đầu (mm³)", format(number(rail?.w_dau_mm3))],
        ["W đáy (mm³)", format(number(rail?.w_day_mm3))],
        ["E (MPa)", format(railE)],
        ["α (1/°C)", railAlpha.toLocaleString("vi-VN", { maximumSignificantDigits: 6 })],
        ["K", format(railK)],
        ["Mác thép", String(steel?.mac_thep ?? "—")],
        ["σs (MPa)", format(sigmaS)],
        ["[σ] (MPa)", format(allowable)],
        ["Kết cấu đường", String(track?.ten ?? "—")],
        ["Loại tà vẹt", String(track?.loai_ta_vet || "—")],
        ["Cự ly nút a (m)", format(number(track?.cu_ly_nut_a_m))],
        ["Sức cản dọc r (kN/m·ray)", format(number(track?.r_khong_tai))],
        ["Sức cản ngang q (kN/m)", format(number(track?.q_kn_m))],
        ["Độ cứng gối", selectedSeat ? seatOptionLabel(selectedSeat) : "—"],
        ["D (kN/mm)", format(number(selectedSeat?.d_kn_mm))],
        ["Sơ đồ tải", String(scheme?.ten ?? "—")],
        ["Bánh xe", wheels.map((wheel, index) => `${index + 1}: x ${format(wheel.x_m)} m, Y ${format(wheel.p_j_kn)} kN`).join("; ") || "—"],
        ["Hệ số lực ngang f", `${matchingFactor.nhan}: ${format(number(matchingFactor.he_so))}`],
        ["Loại sức kéo", traction === "electric" ? "Điện" : "Diesel"],
        ["Hệ số vận tốc", `${speedFactor.row.nhan}: ${format(speedFactor.coefficient)}`],
        ["Tốc độ thiết kế (km/h)", format(read("speed"))],
        ["Siêu cao Δh (mm)", format(read("cant"))],
        ["Phương pháp [ΔTu]", riseLabel],
        ["Biên độ khóa (°C)", format(read("tolerance"))],
        ["Hiệu chỉnh tâm khóa (°C)", format(read("adjustment"))],
        ["Giới hạn khe đứt (mm)", format(read("gap"))],
        ["σf (MPa)", format(read("extra"))],
        ["σz (MPa)", format(read("braking"))],
        ...(irregular ? [
          ["B.0.4-1", `tà vẹt ${onDinh?.loai_ta_vet}: q₀ ${format(irregular.q0)}, B ${format(irregular.B)}, Z ${format(irregular.Z)}, C ${format(irregular.C)}, N ${format(irregular.N)}`],
          ["B.0.4-2", `${moMen?.loai_phu_kien}: H ${format(irregular.H)} N·cm/cm, μ ${format(irregular.mu)}`],
          ["B.0.4-3", `l₀ ${format(irregular.l0)} cm, i₀ ${format(irregular.i0Permil)} ‰, ΔP ${format(irregular.dpKn)} kN`],
        ] as [string, string][] : []),
      ].map(([label, value]) => ({ label, value }));
      const origin: Step10Origin = {
        climate: climate?.ten_tram ? `${climate.ten_tram}, tháng ${climateMonth}` : undefined,
        rail: rail ? `${rail.loai_kg_m} kg/m, mòn ${rail.do_mon_mm} mm` : undefined,
        steel: steel?.mac_thep ? String(steel.mac_thep) : undefined,
        track: track?.ten ? String(track.ten) : undefined,
        seat: selectedSeat ? seatOptionLabel(selectedSeat) : undefined,
        scheme: scheme?.ten ? String(scheme.ten) : undefined,
        factor: matchingFactor?.nhan ? String(matchingFactor.nhan) : undefined,
        ballast: onDinh?.loai_ta_vet ? `tà vẹt ${onDinh.loai_ta_vet}` : undefined,
        fastener: moMen?.loai_phu_kien ? String(moMen.loai_phu_kien) : undefined,
        speed: speedFactor.row.nhan ? String(speedFactor.row.nhan) : undefined,
      };
      setAudit({ input, result: checkTb15Ground(input), origin, parameters });
      setSaveTitle(suggestedTitle(origin));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tính được kết quả.");
    }
  }

  function rowsFor(key: CatalogKey) {
    const rows = data[key]?.rows ?? [];
    const bridge = (row: Tb15Row) => /cầu|cau/i.test(`${row.ten ?? ""} ${row.ghi_chu ?? ""}`);
    if (key === "ket_cau_duong") {
      return rows.filter((row) => place === "cau"
        ? bridge(row)
        : !bridge(row) && (ballast === "co" ? row.loai_duong === "co_ba_lat" : row.loai_duong === "khong_ba_lat"));
    }
    if (key === "do_cung_goi") {
      const kind = ballast === "khong" && place !== "cau" ? "khong_ba_lat" : "co_ba_lat";
      return rows.filter((row) => row.loai_duong === kind);
    }
    return rows;
  }

  function currentForm(): Tb15TrialForm {
    return {
      ballast, place, alignment, radius: radiusDraft,
      gauge: gauge.gauge, vehicle: gauge.vehicle,
      railCenterMm: gauge.railCenterMm, cgLocomotiveMm: gauge.cgLocomotiveMm, cgWagonMm: gauge.cgWagonMm,
      climateMonth,
      khi_hau: picks.khi_hau, loai_ray: picks.loai_ray, mac_thep: picks.mac_thep,
      ket_cau_duong: picks.ket_cau_duong, do_cung_goi: picks.do_cung_goi, so_do_tai: picks.so_do_tai,
      mo_men_can: picks.mo_men_can, he_so_tai: factorId, on_dinh_nen: ballastRowId,
      traction: picks.traction, riseMethod: picks.riseMethod,
      speed: nums.speed, cant: String(deltaH), tolerance: nums.tolerance, adjustment: nums.adjustment,
      gap: nums.gap, extra: nums.extra, braking: nums.braking,
    };
  }

  function savedForm(trial: Tb15Trial): Tb15TrialForm {
    if (trial.form) return trial.form;
    const named = (label: string) => trial.parameters.find((row) => row.label === label)?.value ?? "";
    const stationName = (trial.origin.climate ?? named("Trạm khí hậu")).split(",")[0].trim();
    const month = Number((trial.origin.climate ?? "").match(/tháng\s+(\d+)/i)?.[1] ?? named("Tháng"));
    const same = (rows: Tb15Row[] | undefined, field: string, text: string) =>
      rows?.find((row) => fold(String(row[field] ?? "")) === fold(text));
    const railParts = (trial.origin.rail ?? named("Mặt cắt ray")).match(/[\d]+(?:[.,]\d+)?/g)?.map((part) => Number(part.replace(",", "."))) ?? [];
    const rail = data.loai_ray?.rows.find((row) => Number(row.loai_kg_m) === railParts[0] && Number(row.do_mon_mm) === (railParts[1] ?? 0));
    const steelText = trial.origin.steel ?? named("Mác thép");
    const steel = data.mac_thep?.rows.find((row) => fold(String(row.mac_thep)) === fold(steelText))
      ?? data.mac_thep?.rows.find((row) => fold(steelText).includes(fold(String(row.mac_thep))));
    const seatText = trial.origin.seat ?? named("Độ cứng gối");
    const seat = data.do_cung_goi?.rows.find((row) => seatOptionLabel(row) === seatText);
    const ballastName = (trial.origin.ballast ?? "").replace(/^tà vẹt\s*/i, "");
    const tractionText = `${named("Loại sức kéo")} ${trial.origin.speed ?? ""}`;
    const vehicle: VehicleKind = /toa/i.test(fold(named("Phương tiện"))) ? "toa_xe" : "dau_may";
    const center = trial.input.railCenterMm ?? 1500;
    const height = trial.input.cgHeightMm ?? 2300;
    const gaugeMm: GaugeMm = center === 1500 ? 1435 : 1000;
    return {
      ballast: "co", place: "nen",
      alignment: trial.input.radius > 0 ? "cong" : "thang",
      radius: trial.input.radius > 0 ? String(trial.input.radius) : "",
      gauge: gaugeMm, vehicle,
      railCenterMm: String(center),
      cgLocomotiveMm: vehicle === "dau_may" ? String(height) : "2300",
      cgWagonMm: vehicle === "toa_xe" ? String(height) : "2300",
      climateMonth: month >= 1 && month <= 12 ? month : 1,
      khi_hau: String(same(data.khi_hau?.rows, "ten_tram", stationName)?.id ?? ""),
      loai_ray: String(rail?.id ?? ""),
      mac_thep: String(steel?.id ?? ""),
      ket_cau_duong: String(same(data.ket_cau_duong?.rows, "ten", trial.origin.track ?? named("Kết cấu đường"))?.id ?? ""),
      do_cung_goi: String(seat?.id ?? ""),
      so_do_tai: String(same(data.so_do_tai?.rows, "ten", trial.origin.scheme ?? named("Sơ đồ tải"))?.id ?? ""),
      mo_men_can: String(same(data.mo_men_can?.rows, "loai_phu_kien", trial.origin.fastener ?? "")?.id ?? ""),
      he_so_tai: String(same(data.he_so_tai?.rows, "nhan", trial.origin.factor ?? "")?.id ?? ""),
      on_dinh_nen: String(same(data.on_dinh_nen?.rows, "loai_ta_vet", ballastName)?.id ?? ""),
      traction: /diesel/i.test(tractionText) ? "diesel" : /điện|dien|electric/i.test(fold(tractionText)) ? "electric" : "",
      riseMethod: trial.input.riseMethod ?? "irregular",
      speed: String(trial.input.speed),
      cant: String(trial.input.cantDeficiency),
      tolerance: String(trial.input.lockTolerance),
      adjustment: String(trial.input.lockAdjustment),
      gap: String(trial.input.gapLimit),
      extra: String(trial.input.additionalStress),
      braking: String(trial.input.brakingStress),
    };
  }

  function applyForm(form: Tb15TrialForm) {
    viewingRef.current = true;
    setBallast(form.ballast);
    setPlace(form.place);
    setAlignment(form.alignment);
    setRadiusDraft(form.radius);
    setClimateMonth(form.climateMonth);
    setGauge({
      gauge: form.gauge,
      vehicle: form.vehicle,
      railCenterMm: form.gauge === 1435 ? "1500" : form.railCenterMm,
      cgLocomotiveMm: form.cgLocomotiveMm,
      cgWagonMm: form.cgWagonMm,
    });
    setDeltaH(Number(form.cant) || 0);
    setSchemeId(form.so_do_tai);
    setTrackId(form.ket_cau_duong);
    setFactorId(form.he_so_tai);
    setBallastRowId(form.on_dinh_nen);
    setPicks({
      khi_hau: form.khi_hau, loai_ray: form.loai_ray, mac_thep: form.mac_thep,
      ket_cau_duong: form.ket_cau_duong, do_cung_goi: form.do_cung_goi, so_do_tai: form.so_do_tai,
      mo_men_can: form.mo_men_can, traction: form.traction, riseMethod: form.riseMethod || "irregular",
    });
    setNums({
      speed: form.speed, tolerance: form.tolerance, adjustment: form.adjustment,
      gap: form.gap, extra: form.extra, braking: form.braking,
    });
    setConfirmed(true);
  }

  async function saveTrial() {
    if (!audit) return;
    const title = saveTitle.trim();
    if (!title) {
      setTrialsNote("Nhập tên bản lưu.");
      return;
    }
    setSaving(true);
    setTrialsNote("");
    try {
      const response = await fetch("/api/lwr/tb15-trials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, sourceLines, input: audit.input, origin: audit.origin, parameters: audit.parameters, form: currentForm() }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Không lưu được.");
      await loadTrials();
      setTrialsNote("Đã lưu thông số đầu vào và kết quả tính. Mở lại trong danh sách bản lưu.");
    } catch (error) {
      setTrialsNote(error instanceof Error ? error.message : "Không lưu được.");
    } finally {
      setSaving(false);
    }
  }

  async function openTrial(id: string) {
    setTrialsNote("");
    try {
      const response = await fetch(`/api/lwr/tb15-trials?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Không mở được bản lưu.");
      const trial = value.trial as Tb15Trial;
      applyForm(savedForm(trial));
      setSourceLines(trial.sourceLines);
      setAudit({ input: trial.input, result: trial.result, origin: trial.origin, parameters: trial.parameters });
      setSaveTitle(trial.title);
      setOpened(trial);
      setError("");
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setTrialsNote(error instanceof Error ? error.message : "Không mở được bản lưu.");
    }
  }

  async function removeTrial() {
    if (!pendingDelete) return;
    setSaving(true);
    setTrialsNote("");
    try {
      const response = await fetch(`/api/lwr/tb15-trials?id=${encodeURIComponent(pendingDelete.id)}`, { method: "DELETE" });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Không xóa được.");
      if (opened?.id === pendingDelete.id) setOpened(null);
      setPendingDelete(null);
      await loadTrials();
      setTrialsNote("Đã xóa bản lưu.");
    } catch (error) {
      setTrialsNote(error instanceof Error ? error.message : "Không xóa được.");
    } finally {
      setSaving(false);
    }
  }

  function openPrint() {
    if (!result) {
      setPrintPages([{
        kicker: "Sheet kiểm toán",
        title: "SHEET KIỂM TOÁN NỀN ĐƯỜNG",
        subtitle: "TB 10015-2012",
        sections: [{ heading: "I. Kết quả", note: "Chưa có kết quả. Bấm Tính kiểm toán rồi in lại." }],
      }]);
      return;
    }
    if (!audit) return;
    const sheets = buildTb15Step10(audit.input, audit.result, audit.origin);
    setPrintPages([
      {
        kicker: "Bước 10",
        title: "DỮ LIỆU GẮN VÀO SHEET",
        subtitle: result.lockTemperature === null ? "KHÔNG ĐẠT" : `ĐẠT — nhiệt độ khóa ${format(result.lockTemperature)} °C`,
        sections: [{ heading: "Dữ liệu đã chọn", table: { headers: ["Nội dung"], rows: sourceLines.map((line) => [line]) } }],
      },
      ...sheets.map((sheet) => ({
        kicker: "Bước 10",
        title: sheet.title,
        subtitle: sheet.scope,
        sections: [
          { heading: sheet.scope, pairs: sheet.items.map((entry) => [entry.label, entry.display] as [string, string]) },
          ...(sheet.table ? [{ heading: sheet.table.caption, table: { headers: sheet.table.headers, rows: sheet.table.rows } }] : []),
        ],
      })),
    ]);
  }

  return (
    <section className="tb15-print-root space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Tính thử kiểm toán nền đường có ba lát</h2>
          <p className="mt-1 text-sm text-slate-600">E, α, K, σ_s và l₀, i₀, ΔP lấy theo danh mục. Đệm D theo độ cứng gối. B.0.4-1 theo tà vẹt, B.0.4-2 theo phụ kiện đã chọn. Hệ số lực ngang tra theo đường thẳng hoặc bán kính. Hệ số vận tốc tra theo tốc độ và loại sức kéo trong cùng bảng. Nhiệt độ không khí lấy theo tháng đã chọn của trạm. Tmin ray bằng Tmin tháng đó, Tmax ray bằng Tmax tháng đó cộng 20 °C. Sheet này chạy cho nền có ba lát. Trên cầu và không ba lát được gắn dữ liệu, chưa có mô hình lực tương tác.</p>
        </div>
        <button type="button" onClick={openPrint} className="tb15-no-print h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800">In sheet kiểm toán</button>
      </header>
      {loading && <p role="status" className="text-sm">Đang tải danh mục…</p>}
      {failures.length > 0 && <p role="alert" className="text-sm text-red-800">Không tải được danh mục hoặc tài khoản thiếu quyền xem: {failures.join(", ")}.</p>}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <h3 className="text-sm font-bold text-[#0047AB]">Bản lưu để xem lại</h3>
        <p className="mt-1 text-xs text-slate-600">Xem lại điền các ô đã lưu và mở kết quả tính.</p>
        {trialsNote && <p role="status" className="mt-2 text-sm text-slate-800">{trialsNote}</p>}
        {pendingDelete && (
          <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            <p>Xóa bản lưu «{pendingDelete.title}»?</p>
            <div className="mt-2 flex gap-2">
              <button type="button" disabled={saving} onClick={() => { void removeTrial(); }} className="h-8 rounded-md bg-red-700 px-3 text-xs font-semibold text-white disabled:opacity-50">Xóa</button>
              <button type="button" onClick={() => setPendingDelete(null)} className="h-8 rounded-md border border-red-200 bg-white px-3 text-xs font-semibold">Hủy</button>
            </div>
          </div>
        )}
        {trials.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Chưa có bản lưu.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {trials.map((trial) => (
              <li key={trial.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${trial.passed ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"}`}>{trial.passed ? "ĐẠT" : "KHÔNG ĐẠT"}</span>
                <span className="min-w-0 grow font-medium text-slate-900">{trial.title}</span>
                <span className="text-xs text-slate-500">{whenText(trial.createdAt)}{trial.lockTemperature === null ? "" : ` · khóa ${format(trial.lockTemperature)} °C`}</span>
                <button type="button" onClick={() => { void openTrial(trial.id); }} className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-[#0047AB]">Xem lại</button>
                {canDelete && <button type="button" onClick={() => setPendingDelete(trial)} className="h-8 rounded-md border border-red-200 px-2 text-xs font-semibold text-red-700">Xóa</button>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {opened && (
        <p className="rounded-lg border border-[#0047AB] bg-blue-50 px-3 py-2 text-sm text-slate-800">
          Đang xem bản lưu «{opened.title}». Các ô bên dưới đã được điền lại.
        </p>
      )}
      <form ref={formRef} onChange={() => { viewingRef.current = false; setAudit(null); setSourceLines([]); setError(""); setOpened(null); }} onSubmit={(event) => { event.preventDefault(); run(event.currentTarget); }}>
        <fieldset className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">Trường hợp tính</legend>
          <label className="text-sm font-medium text-slate-800">Kết cấu
            <select value={ballast} onChange={(e) => {
              setBallast(e.target.value as "co" | "khong");
              setTrackId("");
              setSchemeId("");
              setPicks((prev) => ({ ...prev, ket_cau_duong: "", do_cung_goi: "", so_do_tai: "" }));
            }} className={control}>
              <option value="co">Có ba lát</option>
              <option value="khong">Không ba lát</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-800">Vị trí
            <select value={place} onChange={(e) => {
              setPlace(e.target.value as "nen" | "cau");
              setTrackId("");
              setSchemeId("");
              setPicks((prev) => ({ ...prev, ket_cau_duong: "", do_cung_goi: "", so_do_tai: "" }));
            }} className={control}>
              <option value="nen">Trên nền đường</option>
              <option value="cau">Trên cầu</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-800">Tuyến
            <select value={alignment} onChange={(e) => setAlignment(e.target.value as "thang" | "cong")} className={control}>
              <option value="thang">Đường thẳng</option>
              <option value="cong">Đường cong</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-800">Bán kính cong R (m)
            {alignment === "thang" ? (
              <input value="0" readOnly aria-readonly="true" className={locked} />
            ) : (
              <input name="radius" type="number" min={300} step="any" required value={radiusDraft} onChange={(e) => setRadiusDraft(e.target.value)} className={control} />
            )}
          </label>
        </fieldset>
        <div className="mt-3 rounded-lg border border-slate-200">
          <p className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900">Khổ ray và chiều cao trọng tâm</p>
          <Tb15GaugeTable draft={gauge} onChange={setGauge} deltaH={deltaH} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {catalogs.map(([key, title, rowLabel]) => {
            if (key === "he_so_tai" || key === "on_dinh_nen") {
              const hint = key === "he_so_tai" ? "tự chọn theo bán kính" : "tự chọn theo loại tà vẹt của kết cấu";
              const selected = key === "he_so_tai" ? factorId : ballastRowId;
              const empty = key === "he_so_tai"
                ? (alignment === "cong" && !(radiusValue >= 300) ? "Nhập bán kính cong để tra hệ số" : "Chưa có hệ số cho bán kính này")
                : "Chọn kết cấu đường để lấy B.0.4-1";
              return (
                <label key={key} className="text-sm font-medium text-slate-800">
                  {title} <span className="text-xs font-normal text-slate-500">· {hint}</span>
                  <select name={key} value={selected} required className={control} onChange={(e) => key === "he_so_tai" ? setFactorId(e.target.value) : setBallastRowId(e.target.value)}>
                    <option value="">{empty}</option>
                    {(data[key]?.rows ?? []).filter((row) => key !== "he_so_tai" || row.loai !== "van_toc").map((row) => <option key={row.id} value={String(row.id)}>{rowLabel(row)}</option>)}
                  </select>
                </label>
              );
            }
            const station = (
              <label key={key} className="text-sm font-medium text-slate-800">
                {title} {data[key]?.backend && <span className="text-xs font-normal text-slate-500">· {data[key]?.backend === "supabase" ? "Supabase" : "JSON dự phòng"}</span>}
                <select name={key} value={picks[key as PickKey] ?? ""} required className={control} onChange={(e) => {
                  const value = e.target.value;
                  setPicks((prev) => ({ ...prev, [key]: value }));
                  if (key === "so_do_tai") setSchemeId(value);
                  if (key === "ket_cau_duong") setTrackId(value);
                }}>
                  <option value="">Chọn {catalogByKey(key)?.title.toLowerCase()}</option>
                  {rowsFor(key).map((row) => <option key={row.id} value={row.id}>{rowLabel(row)}</option>)}
                </select>
              </label>
            );
            if (key !== "khi_hau") return station;
            return (
              <Fragment key={key}>
                {station}
                <label className="text-sm font-medium text-slate-800">Tháng
                  <select name="climateMonth" value={climateMonth} required className={control} onChange={(e) => setClimateMonth(Number(e.target.value))}>
                    {MONTHS.map((month) => <option key={month} value={month}>Tháng {month}</option>)}
                  </select>
                  <span className="mt-1 block text-xs font-normal text-slate-500">Mặc định là tháng hiện tại. Tmin và Tmax không khí lấy theo tháng này.</span>
                </label>
              </Fragment>
            );
          })}
          <label className="text-sm font-medium text-slate-800">Loại sức kéo
            <select name="traction" value={picks.traction} required className={control} onChange={(e) => setPicks((prev) => ({ ...prev, traction: e.target.value }))}>
              <option value="">Chọn loại sức kéo</option>
              <option value="electric">Điện</option>
              <option value="diesel">Diesel</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-800">Phương pháp [ΔT_u] ổn định
            <select name="riseMethod" value={picks.riseMethod} required className={control} onChange={(e) => setPicks((prev) => ({ ...prev, riseMethod: e.target.value }))}>
              <option value="irregular">B.0.4 — bước sóng không đều (mặc định)</option>
              <option value="uniform">B.0.3 — bước sóng đều</option>
              <option value="min">Lấy giá trị nhỏ hơn của B.0.3 và B.0.4</option>
            </select>
          </label>
          {fields.map(([name, label, value]) => (
            <label key={name} className="text-sm font-medium text-slate-800">{label}
              {name === "cant" ? (
                <input name="cant" type="number" step="any" required value={deltaH} onChange={(e) => setDeltaH(Number(e.target.value))} className={control} />
              ) : (
                <input name={name} type="number" step="any" required value={nums[name as keyof Nums]} onChange={(e) => setNums((prev) => ({ ...prev, [name]: e.target.value }))} className={control} />
              )}
            </label>
          ))}
        </div>
        {(() => {
          const scheme = data.so_do_tai?.rows.find((row) => row.id === schemeId);
          const wheels = wheelsFromFirstAxle(scheme && Array.isArray(scheme.wheels) ? scheme.wheels : []);
          return wheels.length > 0 ? <Tb15AxleDiagram title={String(scheme?.ten ?? "")} wheels={wheels} /> : null;
        })()}
        <label className="mt-4 flex gap-2 text-sm text-slate-800">
          <input type="checkbox" required checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 self-start" />
          Đã đối chiếu trạm khí hậu, mặt cắt, mác thép, sức cản dọc, phụ kiện, tải bánh và ứng suất phụ. Sheet này tính nền có ba lát, ngoài ghi.
        </label>
        <button type="submit" disabled={loading || failures.length > 0} className="mt-4 rounded bg-[#0047AB] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Tính kiểm toán</button>
      </form>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      {sourceLines.length > 0 && (
        <div className="rounded bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Dữ liệu gắn vào sheet</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">{sourceLines.map((line) => <li key={line}>{line}</li>)}</ul>
        </div>
      )}
      {audit && (
        <div className="space-y-3">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <span className={`rounded px-2 py-0.5 text-sm font-bold ${audit.result.lockTemperature === null ? "bg-red-100 text-red-900" : "bg-emerald-100 text-emerald-900"}`}>
              {audit.result.lockTemperature === null ? "KHÔNG ĐẠT" : "ĐẠT"}
            </span>
            {audit.result.lockMin > audit.result.lockMax
              ? "Không có khoảng nhiệt độ khóa thỏa đồng thời các điều kiện."
              : audit.result.lockTemperature === null
                ? `Tâm khóa tính được ${format(audit.result.candidate)} °C nằm ngoài khoảng khả dụng.`
                : `Nhiệt độ khóa tính thử ${format(audit.result.lockTemperature)} °C`}
          </p>
          <Tb15Step10Report sheets={buildTb15Step10(audit.input, audit.result, audit.origin)} />
          {canEdit && (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-3">
              <label className="min-w-0 grow text-sm font-medium text-slate-800">Tên bản lưu
                <input value={saveTitle} maxLength={120} onChange={(event) => setSaveTitle(event.target.value)} className={control} />
              </label>
              <button type="button" disabled={saving} onClick={() => { void saveTrial(); }} className="h-10 rounded bg-[#0047AB] px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Đang lưu…" : "Lưu để xem lại"}</button>
            </div>
          )}
        </div>
      )}
      {printPages && <Tb15SheetPrint pages={printPages} onClose={() => setPrintPages(null)} />}
    </section>
  );
}
