"use client";

import { useEffect, useState } from "react";
import { catalogByKey, type Tb15Row } from "@/lib/tb15Catalogs";
import { checkTb15Ground, type IrregularInput, type RiseMethod } from "../lib/tb15-ground";
import { GAUGE_STANDARD, gaugeNumbers, type GaugeDraft } from "../lib/tb15-gauge";
import { Tb15AxleDiagram } from "./Tb15AxleDiagram";
import { Tb15GaugeTable } from "./Tb15GaugeTable";
import { Tb15SheetPrint, type Tb15PrintPage } from "./Tb15SheetPrint";

const catalogs = [
  ["khi_hau", "Trạm khí hậu", (r: Tb15Row) => `${r.ten_tram} · ${r.tinh ?? ""}`],
  ["loai_ray", "Mặt cắt ray", (r: Tb15Row) => `${r.loai_kg_m} kg/m · mòn ${r.do_mon_mm} mm`],
  ["mac_thep", "Mác thép", (r: Tb15Row) => String(r.mac_thep)],
  ["ket_cau_duong", "Kết cấu đường", (r: Tb15Row) => String(r.ten)],
  ["do_cung_goi", "Độ cứng gối", (r: Tb15Row) => String(r.phuong_an)],
  ["so_do_tai", "Sơ đồ tải một ray", (r: Tb15Row) => String(r.ten)],
  ["he_so_tai", "Hệ số lực ngang", (r: Tb15Row) => `${r.nhan} · f = ${r.he_so}`],
  ["on_dinh_nen", "Ổn định nền đá (B.0.4-1)", (r: Tb15Row) => `Tà vẹt ${r.loai_ta_vet} · q₀ = ${r.q0}`],
  ["mo_men_can", "Mô men cản phụ kiện (B.0.4-2)", (r: Tb15Row) => String(r.loai_phu_kien)],
] as const;

type CatalogKey = typeof catalogs[number][0];
type Catalog = { rows: Tb15Row[]; backend?: string };
// E, α, K và l₀, i₀, ΔP lấy từ mặt cắt ray; đệm D lấy từ độ cứng gối. Không nhập tay.
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

function matchLateralFactor(rows: Tb15Row[] | undefined, radius: number) {
  return (rows ?? [])
    .filter((row) => radius === 0 ? row.r_tu_m === 0 : Number(row.r_tu_m) >= 300 && Number(row.r_tu_m) <= radius)
    .sort((a, b) => Number(b.r_tu_m) - Number(a.r_tu_m))[0];
}

/** Loại II/III đọc từ tên hiện trên form hoặc từ cột loại tà vẹt. */
function sleeperType(value: unknown): "II" | "III" | "" {
  const text = String(value ?? "").replace(/\u2162/g, "III").replace(/\u2161/g, "II");
  const labeled = text.match(/(?:tà\s*vẹt|loại)\s*(III|II)\b/i)?.[1]?.toUpperCase();
  if (labeled === "II" || labeled === "III") return labeled;
  const bare = text.trim().toUpperCase().match(/^(III|II)\b/)?.[1];
  return bare === "II" || bare === "III" ? bare : "";
}

export default function Tb15GroundCheck() {
  const [data, setData] = useState<Partial<Record<CatalogKey, Catalog>>>({});
  const [failures, setFailures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ReturnType<typeof checkTb15Ground> | null>(null);
  const [sourceLines, setSourceLines] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [ballast, setBallast] = useState<"co" | "khong">("co");
  const [place, setPlace] = useState<"nen" | "cau">("nen");
  const [alignment, setAlignment] = useState<"thang" | "cong">("thang");
  const [gauge, setGauge] = useState<GaugeDraft>(GAUGE_STANDARD);
  const [deltaH, setDeltaH] = useState(0);
  const [schemeId, setSchemeId] = useState("");
  const [trackId, setTrackId] = useState("");
  const [radiusDraft, setRadiusDraft] = useState("");
  const [factorId, setFactorId] = useState("");
  const [ballastRowId, setBallastRowId] = useState("");
  const [printPages, setPrintPages] = useState<Tb15PrintPage[] | null>(null);
  const radiusValue = alignment === "thang" ? 0 : Number(radiusDraft);

  useEffect(() => { setSchemeId(""); setTrackId(""); }, [ballast, place]);

  useEffect(() => {
    if (alignment === "cong" && !(radiusValue >= 300)) {
      setFactorId("");
      return;
    }
    const match = matchLateralFactor(data.he_so_tai?.rows, radiusValue);
    setFactorId(match?.id ? String(match.id) : "");
  }, [alignment, radiusValue, data.he_so_tai]);

  useEffect(() => {
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
        const rows = (value.rows as Tb15Row[]).filter((r) => key !== "he_so_tai" || r.loai === "luc_ngang");
        return { key, value: { rows, backend: value.backend } };
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
    setResult(null);
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
      const seatType = sleeperType(selectedSeat?.phuong_an);
      const trackType = sleeperType(track?.ten) || sleeperType(track?.loai_ta_vet);
      if (!seatType || seatType !== trackType) {
        throw new Error(seatType && trackType
          ? `Độ cứng gối là tà vẹt loại ${seatType}, kết cấu là tà vẹt loại ${trackType}. Hai ô phải cùng loại.`
          : "Chọn độ cứng gối cùng loại tà vẹt II hoặc III với kết cấu đường.");
      }

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
      setSourceLines([
        caseLine,
        `Khổ ${gauge.gauge} mm, H = ${geometry.cgHeightMm} mm (${gauge.vehicle === "dau_may" ? "đầu máy" : "toa xe"}), S = ${geometry.railCenterMm} mm. Hệ số lực ngang f = ${matchingFactor.he_so} (${matchingFactor.nhan}).`,
        `Ray ${rail?.loai_kg_m} kg/m, mòn ${rail?.do_mon_mm} mm: E = ${railE} MPa, α = ${railAlpha} /°C, K = ${railK}. Mác ${steel?.mac_thep}: σ_s = ${number(steel?.sigma_s_mpa)} MPa.`,
        `Gối ${selectedSeat?.phuong_an} (${selectedSeat?.loai_duong === "co_ba_lat" ? "có ba lát" : "không ba lát"}): đệm D = ${number(selectedSeat?.d_kn_mm)} kN/mm.`,
        `Kết cấu ${track?.ten}: tà vẹt ${track?.loai_ta_vet || "—"}, nút ${track?.cu_ly_nut_a_m} m, sức cản dọc ${track?.r_khong_tai} kN/(m·ray).`,
        ...(irregular ? [
          `B.0.4-1 (tà vẹt ${onDinh?.loai_ta_vet}): q₀ = ${irregular.q0} N/cm, B = ${irregular.B}, Z = ${irregular.Z}, C = ${irregular.C}, N = ${irregular.N}.`,
          `B.0.4-2: H = ${irregular.H} N·cm/cm, μ = ${irregular.mu}. B.0.4-3 (ray): l₀ = ${irregular.l0} cm, i₀ = ${irregular.i0Permil} ‰, ΔP = ${irregular.dpKn} kN.`,
        ] : []),
      ]);

      setResult(checkTb15Ground({
        area: number(rail?.f_mm2), ix: number(rail?.i_x_mm4), iy: number(rail?.i_y_mm4),
        headModulus: number(rail?.w_dau_mm3), baseModulus: number(rail?.w_day_mm3),
        steelModulus: railE, expansion: railAlpha, yieldStress: number(steel?.sigma_s_mpa),
        safety: railK, seatStiffness: number(selectedSeat?.d_kn_mm), spacing: number(track?.cu_ly_nut_a_m),
        resistance: number(track?.r_khong_tai), lateralResistance: number(track?.q_kn_m),
        speed: read("speed"), speedCoefficient: values.get("traction") === "electric" ? 0.6 : 0.4,
        lateralFactor: number(matchingFactor.he_so), radius, cantDeficiency: read("cant"),
        cgHeightMm: geometry.cgHeightMm, railCenterMm: geometry.railCenterMm,
        minRailTemperature: number(climate?.t_kk_min),
        maxRailTemperature: number(climate?.t_kk_max) + 20, lockTolerance: read("tolerance"), lockAdjustment: read("adjustment"),
        gapLimit: read("gap"), additionalStress: read("extra"), brakingStress: read("braking"),
        wheels: (getRow("so_do_tai")?.wheels ?? []).map((w) => ({ position: number(w.x_m), load: number(w.p_j_kn) })),
        riseMethod,
        irregular,
      }));
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
    const text = (value: number | string | null) => typeof value === "string" ? value : format(value);
    setPrintPages([{
      kicker: "Sheet kiểm toán",
      title: "SHEET KIỂM TOÁN NỀN ĐƯỜNG CÓ BA LÁT",
      subtitle: result.lockTemperature === null ? "KHÔNG ĐẠT" : `ĐẠT — nhiệt độ khóa ${format(result.lockTemperature)} °C`,
      sections: [
        {
          heading: "I. Dữ liệu gắn vào sheet",
          table: { headers: ["Nội dung"], rows: sourceLines.map((line) => [line]) },
        },
        {
          heading: "II. Kết quả",
          pairs: [
            ["Khoảng tâm khóa khả dụng (°C)", `${format(result.lockMin)} đến ${format(result.lockMax)}`],
            ["[ΔT_d] theo cường độ (°C)", text(result.dropStrength)],
            ["[ΔT_u] B.0.3 (°C)", text(result.riseUniform)],
            ["[ΔT_u] B.0.4 (°C)", text(result.riseIrregular)],
            ["[ΔT_u] đã chọn (°C)", text(result.riseLimit)],
            ["[ΔT] theo khe đứt (°C)", text(result.dropGap)],
            ["Giảm nhiệt tại tâm khóa (°C)", text(result.drop)],
            ["Tăng nhiệt tại tâm khóa (°C)", text(result.rise)],
            ["Mô đun nền u (N/mm²)", text(result.foundation)],
            ["Hệ số k (1/m)", text(result.k * 1000)],
            ["Hệ số vận tốc αv", text(result.alphaSpeed)],
            [result.betaStandard ? "β = 0,002·Δh" : "β = 2·Δh·H/S²", text(result.betaLoad)],
            ["Ứng suất đầu ray (MPa)", text(result.headStress)],
            ["Ứng suất đáy ray (MPa)", text(result.baseStress)],
            ["Tổng ứng suất / cho phép (MPa)", `${format(result.totalStress)} / ${format(result.stressLimit)}`],
            ["Khe đứt tính toán (mm)", text(result.gap)],
            ["Nửa bước sóng B.0.3 (cm)", text(result.halfWave)],
            ["P_min B.0.4 (kN) / l (cm)", result.irregularMinP === null ? "—" : `${format(result.irregularMinP / 1000)} / ${format(result.irregularHalfWave)}`],
            ["Lực nén cho phép hai ray (kN)", text(result.allowedForce / 1000)],
          ],
        },
        {
          heading: "III. Nội lực tại từng bánh",
          table: {
            headers: ["Vị trí (m)", "P động (kN)", "M tĩnh (kN·m)", "Độ lún (mm)", "Phản lực gối (kN)"],
            rows: result.sections.map((section) => [
              format(section.position), format(section.dynamicLoad), format(section.moment / 1e6), format(section.settlement), format(section.seatLoad),
            ]),
          },
        },
      ],
    }]);
  }

  return (
    <section className="tb15-print-root space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Tính thử kiểm toán nền đường có ba lát</h2>
          <p className="mt-1 text-sm text-slate-600">E, α, K, σ_s và l₀, i₀, ΔP lấy theo danh mục. Đệm D theo độ cứng gối. B.0.4-1 theo tà vẹt, B.0.4-2 theo phụ kiện đã chọn. Hệ số lực ngang tra theo đường thẳng hoặc bán kính. Nhiệt độ ray: Tmin bằng Tmin không khí, Tmax bằng Tmax không khí + 20 °C. Sheet này chạy cho nền có ba lát. Trên cầu và không ba lát được gắn dữ liệu, chưa có mô hình lực tương tác.</p>
        </div>
        <button type="button" onClick={openPrint} className="tb15-no-print h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800">In sheet kiểm toán</button>
      </header>
      {loading && <p role="status" className="text-sm">Đang tải danh mục…</p>}
      {failures.length > 0 && <p role="alert" className="text-sm text-red-800">Không tải được danh mục hoặc tài khoản thiếu quyền xem: {failures.join(", ")}.</p>}
      <form onChange={() => { setResult(null); setSourceLines([]); setError(""); }} onSubmit={(event) => { event.preventDefault(); run(event.currentTarget); }}>
        <fieldset className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">Trường hợp tính</legend>
          <label className="text-sm font-medium text-slate-800">Kết cấu
            <select value={ballast} onChange={(e) => setBallast(e.target.value as "co" | "khong")} className={control}>
              <option value="co">Có ba lát</option>
              <option value="khong">Không ba lát</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-800">Vị trí
            <select value={place} onChange={(e) => setPlace(e.target.value as "nen" | "cau")} className={control}>
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
                    {(data[key]?.rows ?? []).map((row) => <option key={row.id} value={String(row.id)}>{rowLabel(row)}</option>)}
                  </select>
                </label>
              );
            }
            return (
            <label key={key} className="text-sm font-medium text-slate-800">
              {title} {data[key]?.backend && <span className="text-xs font-normal text-slate-500">· {data[key]?.backend === "supabase" ? "Supabase" : "JSON dự phòng"}</span>}
              <select key={`${key}-${ballast}-${place}`} name={key} defaultValue="" required className={control} onChange={key === "so_do_tai" ? (e) => setSchemeId(e.target.value) : key === "ket_cau_duong" ? (e) => setTrackId(e.target.value) : undefined}>
                <option value="">Chọn {catalogByKey(key)?.title.toLowerCase()}</option>
                {rowsFor(key).map((row) => <option key={row.id} value={row.id}>{rowLabel(row)}</option>)}
              </select>
            </label>
            );
          })}
          <label className="text-sm font-medium text-slate-800">Loại sức kéo
            <select name="traction" defaultValue="" required className={control}>
              <option value="">Chọn loại sức kéo</option>
              <option value="electric">Điện</option>
              <option value="diesel">Diesel</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-800">Phương pháp [ΔT_u] ổn định
            <select name="riseMethod" defaultValue="irregular" required className={control}>
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
                <input name={name} type="number" step="any" required defaultValue={value} className={control} />
              )}
            </label>
          ))}
        </div>
        {(() => {
          const scheme = data.so_do_tai?.rows.find((row) => row.id === schemeId);
          const wheels = scheme && Array.isArray(scheme.wheels) ? scheme.wheels : [];
          return wheels.length > 0 ? <Tb15AxleDiagram title={String(scheme?.ten ?? "")} wheels={wheels} /> : null;
        })()}
        <label className="mt-4 flex gap-2 text-sm text-slate-800">
          <input type="checkbox" required className="mt-0.5 self-start" />
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
      {result && (
        <div className="space-y-3" aria-live="polite">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <span className={`rounded px-2 py-0.5 text-sm font-bold ${result.lockTemperature === null ? "bg-red-100 text-red-900" : "bg-emerald-100 text-emerald-900"}`}>
              {result.lockTemperature === null ? "KHÔNG ĐẠT" : "ĐẠT"}
            </span>
            {result.lockMin > result.lockMax
              ? "Không có khoảng nhiệt độ khóa thỏa đồng thời các điều kiện."
              : result.lockTemperature === null
                ? `Tâm khóa tính được ${format(result.candidate)} °C nằm ngoài khoảng khả dụng.`
                : `Nhiệt độ khóa tính thử ${format(result.lockTemperature)} °C`}
          </p>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {([
              ["Khoảng tâm khóa khả dụng (°C)", `${format(result.lockMin)} đến ${format(result.lockMax)}`],
              ["Giảm nhiệt cho phép theo cường độ [ΔT_d] (°C)", result.dropStrength],
              ["[ΔT_u] theo B.0.3 — bước sóng đều (°C)", result.riseUniform],
              ["[ΔT_u] theo B.0.4 — bước sóng không đều (°C)", result.riseIrregular],
              ["Tăng nhiệt cho phép theo ổn định [ΔT_u] đã chọn (°C)", result.riseLimit],
              ["Giảm nhiệt cho phép theo khe đứt (°C)", result.dropGap],
              ["Giảm nhiệt lớn nhất tại tâm khóa đã chọn (°C)", result.drop],
              ["Tăng nhiệt lớn nhất tại tâm khóa đã chọn (°C)", result.rise],
              ["Mô đun nền u (N/mm²)", result.foundation],
              ["Hệ số nền–ray k (1/m)", result.k * 1000],
              ["Hệ số vận tốc αv", result.alphaSpeed],
              [result.betaStandard ? "Hệ số lệch tải β = 0,002·Δh" : "Hệ số lệch tải β = 2·Δh·H/S²", result.betaLoad],
              ["Ứng suất động đầu ray (MPa)", result.headStress],
              ["Ứng suất động đáy ray (MPa)", result.baseStress],
              ["Tổng ứng suất đáy / cho phép (MPa)", `${format(result.totalStress)} / ${format(result.stressLimit)}`],
              ["Khe đứt tính toán (mm)", result.gap],
              ["Nửa bước sóng tới hạn B.0.3 (cm)", result.halfWave],
              ["B.0.4: P_min (kN) / l tại P_min (cm)", result.irregularMinP === null ? null : `${format(result.irregularMinP / 1000)} / ${format(result.irregularHalfWave)}`],
              ["Lực nén cho phép của hai ray B.0.3 (kN)", result.allowedForce / 1000],
            ] as const).map(([label, value]) => (
              <div key={label} className="rounded bg-slate-50 px-3 py-2"><dt>{label}</dt><dd className="font-semibold tabular-nums">{typeof value === "string" ? value : format(value)}</dd></div>
            ))}
          </dl>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="py-2 text-left font-semibold">Nội lực tĩnh tại từng mặt cắt bánh</caption>
              <thead><tr>{["Vị trí (m)", "P động (kN)", "M tĩnh (kN·m)", "Độ lún (mm)", "Phản lực gối (kN)"].map((label) => <th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead>
              <tbody>{result.sections.map((s) => <tr key={s.position} className="border-t">{[s.position, s.dynamicLoad, s.moment / 1e6, s.settlement, s.seatLoad].map((value, index) => <td key={index} className="p-2 tabular-nums">{format(value)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
      {printPages && <Tb15SheetPrint pages={printPages} onClose={() => setPrintPages(null)} />}
    </section>
  );
}
