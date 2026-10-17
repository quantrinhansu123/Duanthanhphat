"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { calculateStressRelease, DEFAULT_STRESS_INPUT, lookupExtension, lookupPullForce, validateStressInput, type StressInput } from "@lwr/lib/stress-release";
import { ChartSkeleton } from "./ChartSkeleton";

const StressChart = dynamic(() => import("./StressChart").then((module) => module.StressChart), { ssr: false, loading: () => <ChartSkeleton /> });

type NumericKey = { [K in keyof StressInput]: StressInput[K] extends number ? K : never }[keyof StressInput];
const groups: { title: string; fields: [NumericKey, string, string][] }[] = [
  { title: "Chiều dài và nhiệt độ", fields: [
    ["leftLength", "Chiều dài trái Lt", "m"], ["rightLength", "Chiều dài phải Lp", "m"],
    ["radius", "Bán kính đường cong R", "m"], ["neutralTemp", "Nhiệt độ khóa đường T", "°C"],
    ["leftTemp", "Nhiệt độ neo trái Tt", "°C"], ["rightTemp", "Nhiệt độ neo phải Tp", "°C"],
    ["maxTemp", "Nhiệt độ ray lớn nhất", "°C"], ["minTemp", "Nhiệt độ ray nhỏ nhất", "°C"],
  ] },
  { title: "Thông số ray 60R2 (có thể hiệu chỉnh)", fields: [
    ["area", "Tiết diện A", "m²"], ["modulus", "Mô đun đàn hồi E", "kN/m²"],
    ["alpha", "Hệ số giãn nở α", "/°C"], ["resistance", "Lực cản dọc r", "kN/m"],
    ["jointResistance", "Lực cản mối nối Pj", "kN"], ["structuralGap", "Khe hở cấu tạo Ag", "mm"],
  ] },
  { title: "Hàn và đo chuyển vị", fields: [
    ["weldGap", "Khe hở hàn ATW Ga", "mm"], ["fbwAllowance", "Bù hàn FBW (có dấu)", "mm"],
    ["currentGap", "Khe hở hiện tại Gr", "mm"], ["leftMovement", "Chuyển vị mốc trong Mt", "mm"],
    ["rightMovement", "Chuyển vị mốc trong Mp", "mm"],
  ] },
];
const format = (value: number) => value.toLocaleString("vi-VN", { maximumFractionDigits: 4 });
const fieldClass = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";

function initialFields(initialInput: StressInput): Record<NumericKey, string> {
  return Object.fromEntries(groups.flatMap((g) => g.fields.map(([key]) => [key, String(initialInput[key])]))) as Record<NumericKey, string>;
}

export function StressReleaseCalculator({ initialInput = DEFAULT_STRESS_INPUT, segmentId, compact = false }: { initialInput?: StressInput; segmentId?: string; compact?: boolean }) {
  const [fields, setFields] = useState(() => initialFields(initialInput));
  const [method, setMethod] = useState<StressInput["method"]>(initialInput.method);
  const [rollers, setRollers] = useState(initialInput.sideRollers);
  const input: StressInput = { ...DEFAULT_STRESS_INPUT, method, sideRollers: rollers };
  for (const group of groups) for (const [key] of group.fields) input[key] = fields[key].trim() === "" ? NaN : Number(fields[key].replace(",", "."));
  const errors = validateStressInput(input);
  const result = errors.length ? null : calculateStressRelease(input);
  const rows: [string, number | null, string, string][] = result ? [
    ["Tổng chiều dài L", result.length, "m", "K26 = Lt + Lp"],
    ["Nhiệt độ trung bình Ttb", result.averageTemp, "°C", "K31 = ROUND((Tt + Tp + (Tt+Tp)/2)/3, 0)"],
    ["Chênh nhiệt ΔT", result.deltaTemp, "°C", "V31 = T − Ttb"],
    ["Lực kéo P", result.force, "kN", "K40 = ROUND(EAαΔT, 2)"],
    ["Chiều dài neo", result.anchorLength, "m", "V40 = ROUND(P/r, 2)"],
    ["Lực nén lớn nhất", result.compressionForce, "kN", "K41 = ROUND(EAα(Tray max − (T−5)), 2)"],
    ["Lực kéo lớn nhất", result.tensionForce, "kN", "K42 = ROUND(EAα((T+5) − Tray min), 2)"],
    ["Giãn dài tự do ΔL", result.freeExtension, "mm", "K43 = ROUND(ΔTαL × 1000, 2)"],
    ["Chiều dài thở (nén)", result.compressionBreathing, "m", "K44 = (Pmax nén − Pj)/r"],
    ["Chiều dài thở (kéo)", result.tensionBreathing, "m", "K45 = (Pmax kéo − Pj)/r"],
    ["Chuyển vị đầu ray (nén)", result.compressionEnd, "mm", "V41 = (Pmax nén − Pj)²/(2EAr) × 1000"],
    ["Chuyển vị đầu ray (kéo)", result.tensionEnd, "mm", "V42 = (Pmax kéo − Pj)²/(2EAr) × 1000"],
    ["Chuyển vị ray đệm 25 m (nén)", result.compressionBuffer, "mm", "V43 = ((Pmax nén − Pj)25 − r25²/4)/(2EA) × 1000"],
    ["Chuyển vị ray đệm 25 m (kéo)", result.tensionBuffer, "mm", "V44: cùng công thức V43, dùng Pmax kéo"],
    ["Kiểm tra khe hở ray", result.gapCheck, "mm", "K46 = EA(αΔT kéo)²/r × 1000"],
    ["Cận dưới khe ray dài–25 m", result.longGapLower, "mm", "V49 = V41 + V43"],
    ["Cận trên khe ray dài–25 m", result.longGapUpper, "mm", "K49 = Ag − (V42 + V44)"],
    ["Cận dưới khe ray 25 m–25 m", result.bufferGapLower, "mm", "V50 = 2V43"],
    ["Cận trên khe ray 25 m–25 m", result.bufferGapUpper, "mm", "K50 = Ag − 2V44"],
    ["Khoảng kéo Ld", result.pullLength, "mm", "K59 = ΔL + Mt + Mp"],
    ["Khe hở cắt mục tiêu", result.cutGap, "mm", method === "ATW" ? "K60 = Ld + Ga" : method === "FBW" ? "Bảng tính 2/3 FBW: K50 = Ld + Gf (có dấu)" : "Không áp dụng hàn nối trong chế độ ray đơn"],
  ] : [];

  function reset() {
    setFields(initialFields(initialInput)); setMethod(initialInput.method); setRollers(initialInput.sideRollers);
  }
  function exportCsv() {
    if (!result) return;
    const data = [["Tính toán giải toả ứng suất R2", "Mẫu 60R2"], ["Phương pháp", method], ["Con lăn cạnh", rollers ? "Có" : "Không"],
      ...(segmentId ? [["Đoạn ray", segmentId]] : []),
      ...groups.flatMap((g) => g.fields.map(([key, label, unit]) => [label, String(input[key]), unit])),
      ["Kết quả", "Giá trị", "Đơn vị", "Công thức / ô nguồn"],
      ...rows.map(([label, value, unit, formula]) => [label, value === null ? "Không áp dụng" : String(value), unit, formula]),
      ...result.warnings.map((warning) => ["Cần kiểm tra", warning])];
    const csv = "\uFEFF" + data.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = segmentId ? `giai-toa-${segmentId}.csv` : "giai-toa-ung-suat-R2.csv"; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 text-slate-800">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>{compact ? <h3 className="text-base font-bold">Giải toả ứng suất R2</h3> : <h1 className="text-2xl font-bold">Giải toả ứng suất R2</h1>}<p className="mt-1 text-xs text-slate-500">Tính theo sheet “Bảng tính mẫu 60R2” · kết quả cập nhật khi nhập</p></div>
        <div className="flex gap-2"><button onClick={reset} className="rounded-lg border bg-white px-3 py-2 text-sm">Khôi phục mẫu</button><button disabled={!result} onClick={exportCsv} className="rounded-lg bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-40">Xuất CSV</button></div>
      </header>
      <div className={compact ? "grid min-w-0 items-start gap-3" : "grid items-start gap-5 xl:grid-cols-[400px_1fr]"}>
        <section className="space-y-5 rounded-xl border bg-white p-4">
          <details open={!compact}>
            <summary className={compact ? "cursor-pointer text-sm font-semibold text-blue-800" : "hidden"}>Thông số đầu vào</summary>
            <div className={compact ? "space-y-5 pt-3" : "space-y-5"}>
          <label className="block text-sm font-medium">Phương pháp<select value={method} onChange={(e) => setMethod(e.target.value as StressInput["method"])} className={fieldClass}><option value="ATW">Hàn nhiệt nhôm (ATW)</option><option value="FBW">Hàn chảy giáp mép (FBW)</option><option value="SINGLE">Giải toả ray đơn</option></select></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rollers} onChange={(e) => setRollers(e.target.checked)} />Sử dụng con lăn cạnh</label>
          {groups.map((group) => <fieldset key={group.title} className="border-t pt-3"><legend className="pr-2 text-sm font-semibold text-blue-800">{group.title}</legend><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{group.fields.map(([key, label, unit]) => <label key={key} className="text-xs text-slate-600">{label} ({unit})<input inputMode="decimal" value={fields[key]} onChange={(e) => setFields({ ...fields, [key]: e.target.value })} className={fieldClass} /></label>)}</div></fieldset>)}
          <p className="text-xs leading-5 text-slate-500">Dải khóa đường = T ± 5°C. FBW dùng số bù có dấu (mẫu: −35,5 mm). Gr chỉ dùng để so sánh với khe mục tiêu; Excel không trừ Gr trong công thức K60.</p>
          {method === "FBW" && <p className="text-xs leading-5 text-slate-500">FBW chỉ thay công thức khe cắt bằng Ld + Gf. Lực và chiều dài neo vẫn dùng thông số 60R2 ở trên, không dùng bộ đơn vị tấn/cm² của các sheet FBW cũ.</p>}
            </div>
          </details>
        </section>
        <div className="space-y-4">
          {errors.length > 0 && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
          {result && <>
            <div className={compact ? "grid grid-cols-1 gap-2 min-[380px]:grid-cols-3" : "grid gap-3 sm:grid-cols-3"}>{[["Lực kéo", result.force, "kN"], ["Giãn dài tự do", result.freeExtension, "mm"], ["Khoảng kéo Ld", result.pullLength, "mm"]].map(([label, value, unit]) => <div key={label} className={compact ? "min-w-0 rounded-xl border bg-white p-2.5" : "rounded-xl border bg-white p-4"}><p className="text-xs text-slate-500">{label}</p><p className={compact ? "mt-2 text-lg font-bold text-blue-800" : "mt-2 text-2xl font-bold text-blue-800"}>{format(Number(value))} <span className="text-sm font-normal">{unit}</span></p></div>)}</div>
            <StressChart input={input} />
            {result.warnings.length > 0 && <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Các điểm cần kiểm tra</p>{result.warnings.map((warning) => <p key={warning}>• {warning}</p>)}</div>}
            <section className="rounded-xl border bg-white p-4 text-sm"><h2 className="mb-2 font-semibold">Kiểm tra theo dữ liệu nhập</h2><p>Chiều dài: {result.lengthPass === null ? "Chưa xác định" : result.lengthPass ? "Đạt" : "Vượt giới hạn"} · giới hạn {result.lengthLimit === null ? "chưa quy định" : `${result.lengthLimit} m`}.</p><p>Khe hở K46 ≤ Ag: {result.gapPass ? "Đạt" : "Không đạt"} ({format(result.gapCheck)} / {format(input.structuralGap)} mm).</p><p className="mt-2 text-xs text-slate-500">Các trạng thái đo mốc, kéo thử, kiểm tra điểm theo dõi và nghiệm thu cần ghi nhận thực tế; không tự gán “OK” từ mẫu Excel.</p></section>
            <section className="overflow-hidden rounded-xl border bg-white"><h2 className="border-b p-4 font-semibold">Kết quả và công thức đối chiếu</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">Thông số / công thức</th><th className="p-3 text-right">Giá trị</th></tr></thead><tbody>{rows.map(([label, value, unit, formula]) => <tr key={label} className="border-t"><td className="p-3">{label}<span className="mt-1 block text-xs text-slate-500">{formula}</span></td><td className="whitespace-nowrap p-3 text-right font-semibold">{value === null ? "Không áp dụng" : `${format(value)} ${unit}`}</td></tr>)}</tbody></table></div></section>
            <details className="rounded-xl border bg-white p-4 text-sm"><summary className="cursor-pointer font-semibold">Bảng tra nhanh khe kéo và lực kéo</summary><p className="my-3 text-xs text-slate-500">Dùng T khóa = {input.neutralTemp}°C, T ray = {result.averageTemp}°C. Bảng khe kéo giữ hệ số 0,0115 mm/(m·°C) của Excel, không đổi khi chỉnh α ở trên. Bảng tra lực dùng hệ số 0,03232 và đơn vị tấn của sheet “Lực kéo”, độc lập với P = EAαΔT.</p><div className="flex flex-wrap gap-3">{[50, 100, 250, 500, 1000].map((length) => <span key={length} className="rounded bg-slate-50 p-2">{length} m: <b>{lookupExtension(length, input.neutralTemp, result.averageTemp)} mm</b></span>)}</div><div className="mt-3 flex flex-wrap gap-3">{([["PB43", 43], ["P50", 50], ["50N", 50.4], ["54E1", 54.77], ["60R2", 59.75]] as const).map(([name, weight]) => <span key={name} className="rounded bg-blue-50 p-2">{name}: <b>{lookupPullForce(weight, input.neutralTemp, result.averageTemp)} tấn</b></span>)}</div><p className="mt-3 text-xs text-slate-500">Cột áp lực đồng hồ kích trong Excel để trống; cần thông số thiết bị để quy đổi MPa.</p></details>
          </>}
        </div>
      </div>
    </div>
  );
}
