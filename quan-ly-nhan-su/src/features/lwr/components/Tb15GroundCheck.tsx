"use client";

import { useEffect, useState } from "react";
import { catalogByKey, type Tb15Row } from "@/lib/tb15Catalogs";
import { checkTb15Ground, type IrregularInput, type RiseMethod } from "../lib/tb15-ground";

const catalogs = [
  ["khi_hau", "Trạm khí hậu", (r: Tb15Row) => `${r.ten_tram} · ${r.tinh ?? ""}`],
  ["loai_ray", "Mặt cắt ray", (r: Tb15Row) => `${r.loai_kg_m} kg/m · mòn ${r.do_mon_mm} mm`],
  ["mac_thep", "Mác thép", (r: Tb15Row) => String(r.mac_thep)],
  ["ket_cau_duong", "Kết cấu có ba lát", (r: Tb15Row) => String(r.ten)],
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
  ["radius", "Bán kính cong (m, 0 nếu thẳng)", ""],
  ["cant", "Siêu cao thiếu hoặc thừa Δh (mm)", ""],
  ["tolerance", "Biên độ khóa ± (3 hoặc 5 °C)", "5"],
  ["adjustment", "Hiệu chỉnh tâm khóa (−5 đến +5 °C)", "0"],
  ["gap", "Giới hạn khe đứt (mm)", "70"],
  ["extra", "Ứng suất kéo phụ σf (MPa)", ""],
  ["braking", "Ứng suất kéo/hãm σz (MPa)", ""],
] as const;
const control = "mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm";
const format = (n: number | null) => n === null ? "—" : n.toLocaleString("vi-VN", { maximumFractionDigits: 4 });

export default function Tb15GroundCheck() {
  const [data, setData] = useState<Partial<Record<CatalogKey, Catalog>>>({});
  const [failures, setFailures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ReturnType<typeof checkTb15Ground> | null>(null);
  const [sourceLines, setSourceLines] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all(catalogs.map(async ([key, title]) => {
      try {
        const response = await fetch(`/api/tb15-catalogs/${key}`, { signal: controller.signal, cache: "no-store" });
        const value = await response.json();
        if (!response.ok || !Array.isArray(value.rows)) throw new Error(String(response.status));
        const rows = (value.rows as Tb15Row[]).filter((r) =>
          (key !== "ket_cau_duong" || r.loai_duong === "co_ba_lat") &&
          (key !== "he_so_tai" || r.loai === "luc_ngang"));
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
      const lateral = getRow("he_so_tai");
      const radius = read("radius");
      const matchingFactor = data.he_so_tai?.rows
        .filter((r) => radius === 0 ? r.r_tu_m === 0 : number(r.r_tu_m) >= 300 && number(r.r_tu_m) <= radius)
        .sort((a, b) => number(b.r_tu_m) - number(a.r_tu_m))[0];
      if (!lateral || matchingFactor?.id !== lateral.id) {
        throw new Error("Chọn hệ số lực ngang tương ứng bán kính theo bảng danh mục. Đường cong dưới 300 m cần phương pháp riêng.");
      }
      const selectedSeat = getRow("do_cung_goi");
      const seatName = String(selectedSeat?.phuong_an ?? "");
      const seatSleeper = seatName.match(/tà vẹt (III|II)\b/i)?.[1];
      if (!seatSleeper || seatSleeper !== track?.loai_ta_vet) {
        throw new Error("Chọn độ cứng gối phù hợp với loại tà vẹt của kết cấu có ba lát.");
      }

      const riseMethod = (String(values.get("riseMethod") || "irregular")) as RiseMethod;
      // B.0.4-1 theo loại tà vẹt của kết cấu; B.0.4-2 theo phụ kiện đàn hồi loại II (Excel 2_Ổn định, H = 22 000).
      const onDinh = data.on_dinh_nen?.rows.find((r) => r.loai_ta_vet === track?.loai_ta_vet);
      const moMen = data.mo_men_can?.rows.find((r) => r.loai_phu_kien === "Loại đàn hồi II");
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
      setSourceLines([
        `Ray ${rail?.loai_kg_m} kg/m, mòn ${rail?.do_mon_mm} mm (Kiểm toán CWR): E = ${railE} MPa, α = ${railAlpha} /°C, K = ${railK}.`,
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
        steelModulus: railE, expansion: railAlpha, yieldStress: number(getRow("mac_thep")?.sigma_s_mpa),
        safety: railK, seatStiffness: number(selectedSeat?.d_kn_mm), spacing: number(track?.cu_ly_nut_a_m),
        resistance: number(track?.r_khong_tai), lateralResistance: number(track?.q_kn_m),
        speed: read("speed"), speedCoefficient: values.get("traction") === "electric" ? 0.6 : 0.4,
        lateralFactor: number(lateral.he_so), radius, cantDeficiency: read("cant"),
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

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <header>
        <h2 className="text-lg font-bold text-slate-900">Tính thử kiểm toán nền đường có ba lát</h2>
        <p className="mt-1 text-sm text-slate-600">Phạm vi thiết kế khổ 1.435 mm, Phụ lục A, B.0.3 và B.0.4. E, α, K và l₀, i₀, ΔP lấy theo mặt cắt ray; đệm D theo độ cứng gối; B.0.4-1/B.0.4-2 theo tà vẹt và phụ kiện. Nhiệt độ ray lấy theo phương án slide: Tmin bằng Tmin không khí, Tmax bằng Tmax không khí + 20 °C. Kết quả cần thẩm tra theo hồ sơ đoạn tuyến, mặt cắt và tải đoàn tàu áp dụng.</p>
      </header>
      {loading && <p role="status" className="text-sm">Đang tải danh mục…</p>}
      {failures.length > 0 && <p role="alert" className="text-sm text-red-800">Không tải được danh mục hoặc tài khoản thiếu quyền xem: {failures.join(", ")}.</p>}
      <form onChange={() => { setResult(null); setSourceLines([]); setError(""); }} onSubmit={(event) => { event.preventDefault(); run(event.currentTarget); }}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {catalogs.map(([key, title, rowLabel]) => (
            <label key={key} className="text-sm font-medium text-slate-800">
              {title} {data[key]?.backend && <span className="text-xs font-normal text-slate-500">· {data[key]?.backend === "supabase" ? "Supabase" : "JSON dự phòng"}</span>}
              <select name={key} defaultValue="" required className={control}>
                <option value="">Chọn {catalogByKey(key)?.title.toLowerCase()}</option>
                {data[key]?.rows.map((row) => <option key={row.id} value={row.id}>{rowLabel(row)}</option>)}
              </select>
            </label>
          ))}
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
              <input name={name} type="number" step="any" required defaultValue={value} className={control} />
            </label>
          ))}
        </div>
        <label className="mt-4 flex gap-2 text-sm text-slate-800">
          <input type="checkbox" required className="mt-0.5 self-start" />
          Đã đối chiếu trạm khí hậu, mặt cắt, sức cản dọc, tải bánh và ứng suất phụ với giả thiết dùng để tính. Phạm vi là nền đường có ba lát, khổ 1.435 mm, ngoài cầu và ghi.
        </label>
        <button type="submit" disabled={loading || failures.length > 0} className="mt-4 rounded bg-[#0047AB] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Tính kiểm toán</button>
      </form>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-900">{error}</p>}
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
          {sourceLines.length > 0 && (
            <div className="rounded bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Dữ liệu đồng bộ từ Kiểm toán CWR</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">{sourceLines.map((line) => <li key={line}>{line}</li>)}</ul>
            </div>
          )}
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
              ["Hệ số lệch tải β = 0,002·Δh", result.betaLoad],
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
    </section>
  );
}
