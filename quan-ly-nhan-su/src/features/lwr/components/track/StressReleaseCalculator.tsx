"use client";

import { useEffect, useState } from "react";
import {
  ALLOWED_GAP_RANGE,
  BUFFER_RAIL_LENGTH,
  calculateStressRelease,
  DEFAULT_STRESS_INPUT,
  FBW_OVERLAP_MM,
  formatStressNumber,
  getRailProfile,
  isUserDefineRail,
  RAIL_TYPE_OPTIONS,
  releaseMethodLabel,
  SELECTABLE_GAP_RANGE,
  validateStressInput,
  type StressInput,
} from "@lwr/lib/stress-release";
import { formatChainage, parseChainage } from "@lwr/lib/track-editor";
import { StressReleasePrint, type StressGapRow, type StressPrintRow } from "./StressReleasePrint";

type NumericKey = { [K in keyof StressInput]: StressInput[K] extends number ? K : never }[keyof StressInput];
const groups: { title: string; fields: [NumericKey, string, string][] }[] = [
  { title: "Chiều dài và nhiệt độ", fields: [
    ["leftLength", "Chiều dài ray trái Lt", "m"], ["rightLength", "Chiều dài ray phải Lp", "m"],
    ["radius", "Bán kính đường cong R", "m"], ["neutralTemp", "Nhiệt độ khóa đường T", "°C"],
    ["lockTempOffset", "Cộng/trừ nhiệt độ khóa đường ±", "°C"],
    ["leftTemp", "Nhiệt độ ray neo trái Tt", "°C"], ["rightTemp", "Nhiệt độ ray neo phải Tp", "°C"],
    ["maxTemp", "Nhiệt độ ray lớn nhất", "°C"], ["minTemp", "Nhiệt độ ray nhỏ nhất", "°C"],
  ] },
  { title: "Thông số ray", fields: [
    ["area", "Tiết diện ray A", "m²"], ["modulus", "Mô đun đàn hồi E", "kN/m²"],
    ["alpha", "Hệ số giãn nở α", "/°C"], ["resistance", "Lực cản dọc r (theo dự án)", "kN/m"],
    ["jackCylinderArea", "Diện tích xi lanh Rail Tensor", "mm²"],
  ] },
  { title: "Hàn và đo chuyển vị", fields: [
    ["weldGap", "Khe hở hàn Ga", "mm"], ["fbwAllowance", "Overlap / độ rút ngắn mối hàn", "mm"],
    ["currentGap", "Khe hở hiện tại Gr", "mm"], ["leftMovement", "Chuyển vị mốc trong Mt", "mm"],
    ["rightMovement", "Chuyển vị mốc trong Mp", "mm"],
  ] },
];
const RAIL_LOCKED_KEYS: NumericKey[] = ["area", "modulus", "alpha"];
const fieldClass = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";
const lockedClass = "mt-1 w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600";

function initialFields(initialInput: StressInput): Record<NumericKey, string> {
  return Object.fromEntries(groups.flatMap((g) => g.fields.map(([key]) => [key, String(initialInput[key])]))) as Record<NumericKey, string>;
}

type Mode = StressInput["method"] | "BUFFER";
type Row = StressPrintRow;
const modes: Record<Mode, string> = {
  ATW: "Hàn nhiệt nhôm (ATW)", FBW: "Hàn chảy giáp mép (FBW)",
  SINGLE: "Giải toả dây đơn", BUFFER: "Khe hở ray vùng đệm",
};

function ResultTable({ title, rows }: { title: string; rows: Row[] }) {
  return <section className="rounded-xl border bg-white p-4">
    <h3 className="mb-2 font-semibold text-blue-900">{title}</h3>
    <table className="w-full text-left text-sm"><tbody>{rows.map(([label, value, unit]) =>
      <tr key={label} className="border-t"><th className="py-2 pr-3 font-normal">{label}</th>
        <td className="py-2 text-right font-semibold">{value === null ? "Không áp dụng" : typeof value === "string" ? `${value}${unit ? ` ${unit}` : ""}` : `${formatStressNumber(value)} ${unit}`}</td></tr>)}</tbody></table>
  </section>;
}

export function StressReleaseCalculator({
  initialInput = DEFAULT_STRESS_INPUT,
  segmentId,
  compact = false,
  onSave,
}: {
  initialInput?: StressInput;
  segmentId?: string;
  compact?: boolean;
  onSave?: (input: StressInput) => void;
}) {
  const [fields, setFields] = useState(() => initialFields(initialInput));
  const [railType, setRailType] = useState(initialInput.railType || "60R2");
  const [startChainage, setStartChainage] = useState("");
  const [endChainage, setEndChainage] = useState("");
  const [mode, setMode] = useState<Mode>(initialInput.method);
  const [rollers, setRollers] = useState(initialInput.sideRollers);
  useEffect(() => {
    setFields((current) => {
      const leftLength = String(initialInput.leftLength);
      const rightLength = String(initialInput.rightLength);
      const neutralTemp = String(initialInput.neutralTemp);
      if (
        current.leftLength === leftLength
        && current.rightLength === rightLength
        && current.neutralTemp === neutralTemp
      ) {
        return current;
      }
      return { ...current, leftLength, rightLength, neutralTemp };
    });
  }, [initialInput.leftLength, initialInput.rightLength, initialInput.neutralTemp]);
  const [printOpen, setPrintOpen] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const buffer = mode === "BUFFER";
  const customRail = isUserDefineRail(railType);
  const railLabel = RAIL_TYPE_OPTIONS.find((item) => item.id === railType)?.label ?? railType;
  const relevant = (key: NumericKey) => {
    if (buffer) {
      return ([
        "area", "modulus", "alpha", "resistance", "neutralTemp",
        "lockTempOffset", "maxTemp", "minTemp",
      ] as NumericKey[]).includes(key);
    }
    if (key === "weldGap") return mode === "ATW";
    if (key === "fbwAllowance") return mode === "FBW";
    if (key === "currentGap") return mode !== "SINGLE";
    if (key === "jackCylinderArea") return mode === "ATW" || mode === "FBW";
    return true;
  };
  const visibleGroups = groups.map(g => ({ ...g, fields: g.fields.filter(([key]) => relevant(key)) })).filter(g => g.fields.length);
  const input: StressInput = { ...DEFAULT_STRESS_INPUT, railType, method: buffer ? "SINGLE" : mode, sideRollers: buffer ? false : rollers };
  for (const group of visibleGroups) for (const [key] of group.fields) input[key] = fields[key].trim() === "" ? NaN : Number(fields[key].replace(",", "."));
  const errors = validateStressInput(input);
  const result = errors.length ? null : calculateStressRelease(input);
  const tension: Row[] = result ? [
    ["Độ giảm nhiệt độ lớn nhất", result.tensionDelta, "°C"],
    ["Lực nhiệt kéo lớn nhất", result.tensionForce, "kN"],
    [buffer ? `Chiều dài co ray đệm ${BUFFER_RAIL_LENGTH} m` : "Chiều dài co", buffer ? result.bufferContraction : result.tensionContraction, "mm"],
  ] : [];
  const compression: Row[] = result ? [
    ["Độ tăng nhiệt độ lớn nhất", result.compressionDelta, "°C"],
    ["Lực nhiệt nén lớn nhất", result.compressionForce, "kN"],
    [buffer ? `Chiều dài giãn ray đệm ${BUFFER_RAIL_LENGTH} m` : "Chiều dài giãn", buffer ? result.bufferExpansion : result.compressionExtension, "mm"],
  ] : [];
  const rows: Row[] = !result || buffer ? [] : [
    ...(mode === "ATW" || mode === "FBW" ? [["Phương pháp giải toả", releaseMethodLabel(result.releaseMethod), ""]] as Row[] : []),
    ["Tổng chiều dài giải toả", result.length, "m"],
    ["Nhiệt độ môi trường", result.averageTemp, "°C"],
    ["Chênh nhiệt giải toả", result.deltaTemp, "°C"],
    ["Lực kéo giải toả", result.appliedPullForce, "kN"],
    ...((mode === "ATW" || mode === "FBW") ? [["Áp lực dầu", result.jackPressure, "MPa"]] as Row[] : []),
    ["Chiều dài neo thiết kế", result.anchorLength, "m"],
    ["Chiều dài neo áp dụng", result.actualAnchorLength, "m"],
    ["Giãn dài khi giải toả", result.freeExtension, "mm"],
    ["Chiều dài kéo", result.pullLength, "mm"],
    ...(mode !== "SINGLE" ? [["Khe hở cắt mục tiêu (khe hở giữa hai đầu ray)", result.cutGap, "mm"]] as Row[] : []),
    ["Con lăn cạnh", rollers ? "Có" : "Không", ""],
  ];
  const gapRows: StressGapRow[] = result ? [
    { label: "Ray dài – ray đệm 25 m", expansion: result.bufferExpansion, contraction: result.bufferContraction, allowedRange: ALLOWED_GAP_RANGE },
    { label: "Ray đệm 25 m – ray đệm 25 m", expansion: result.bufferExpansion, contraction: result.bufferContraction, allowedRange: SELECTABLE_GAP_RANGE },
  ] : [];
  const notices: string[] = [];
  if (result && !buffer) {
    if (result.deltaTemp < 0) notices.push("Nhiệt độ ray cao hơn nhiệt độ khóa đường; không dùng kết quả âm làm lệnh căng kéo.");
    notices.push(`Kiểm tra chiều dài: ${result.lengthPass === null ? "Chưa xác định giới hạn" : result.lengthPass ? "Đạt" : "Vượt giới hạn"}${result.lengthLimit === null ? "." : ` (giới hạn ${result.lengthLimit} m).`}`);
    if (result.actualAnchorLength > result.anchorLength) {
      notices.push(`Chiều dài neo áp dụng lấy ${formatStressNumber(input.minAnchorLength)} m vì neo thiết kế nhỏ hơn mức tối thiểu.`);
    }
    if (result.skipPull) {
      notices.push(`Nhiệt độ môi trường ≥ ${formatStressNumber(result.skipThreshold)}°C: giải toả tự nhiên, chiều dài kéo = 0.`);
    }
    if (mode === "FBW") {
      notices.push("Giá trị dương là khe hở giữa hai đầu ray; giá trị âm là ray đặt chồng (overlap). Gap = chiều dài kéo − 35,5 mm để chủ động cắt và bù phần ray tụt khi hàn.");
    }
    if (result.cutGap !== null && result.cutGap >= 0 && result.cutGap < input.currentGap) {
      notices.push("Khe hở mục tiêu nhỏ hơn khe hở hiện tại; cần kiểm tra phương án cắt ray.");
    }
  }
  const inputRows: StressPrintRow[] = [
    ["Loại ray", railLabel, ""],
    ...visibleGroups.flatMap(g => g.fields.map(([key, label, unit]) => [label, input[key], unit] as StressPrintRow)),
  ];
  function applyRailType(nextType: string) {
    setRailType(nextType);
    const profile = getRailProfile(nextType);
    if (!profile) return;
    setFields((current) => ({
      ...current,
      area: String(profile.area),
      modulus: String(profile.modulus),
      alpha: String(profile.alpha),
    }));
  }
  function exportCsv() {
    if (!result) return;
    const data = [["Bảng tính toán giải tỏa công suất", modes[mode]], ...(segmentId ? [["Đoạn ray", segmentId]] : []),
      ["Loại ray", railLabel],
      ...(!buffer ? [["Con lăn cạnh", rollers ? "Có" : "Không"]] : []),
      ...inputRows.map(([label, value, unit]) => [label, String(value), unit]),
      ["KÉO (nhiệt độ giảm)"], ...tension.map(([label, value, unit]) => [label, String(value), unit]),
      ["NÉN (nhiệt độ tăng)"], ...compression.map(([label, value, unit]) => [label, String(value), unit]),
      ["Kết quả", "Giá trị", "Đơn vị"], ...rows.map(([label, value, unit]) => [label, value === null ? "Không áp dụng" : String(value), unit]),
      ...(buffer ? [
        ["Bố trí khe hở", "Chiều dài giãn (mm)", "Chiều dài co (mm)", "Khoảng khe hở cho phép"],
        ...gapRows.map(row => [row.label, String(row.expansion), String(row.contraction), row.allowedRange]),
        ["Khoảng khe hở cho phép", ALLOWED_GAP_RANGE],
        ["Khoảng khe hở có thể lựa chọn", SELECTABLE_GAP_RANGE],
      ] : []),
      ...notices.map(note => ["Ghi chú", note])];
    const csv = "\uFEFF" + data.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `giai-toa-${mode}${segmentId ? `-${segmentId}` : ""}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  const results = result && <>
    <div className="thermal-results grid gap-3 sm:grid-cols-2">
      <ResultTable title="KÉO (nhiệt độ giảm) · biên độ giảm lớn nhất" rows={tension} />
      <ResultTable title="NÉN (nhiệt độ tăng) · biên độ tăng lớn nhất" rows={compression} />
    </div>
    {!buffer && <p className="text-xs text-slate-500">Ray trái: bên trái vị trí kéo về Km0. Biến dạng tự do trên toàn chiều dài giải toả; phần KÉO hiển thị chiều dài co, phần NÉN hiển thị chiều dài giãn. Lực nhiệt xét theo dải khóa đường T ± {formatStressNumber(input.lockTempOffset)}°C.</p>}
    {buffer ? (
      <section className="rounded-xl border bg-white p-4">
        <h3 className="mb-2 font-semibold text-blue-900">Bố trí khe hở ray vùng đệm 25 m</h3>
        <table className="w-full text-left text-xs sm:text-sm">
          <thead><tr><th className="py-2 pr-2">Vị trí</th><th className="p-2 text-right">Chiều dài giãn (mm)</th><th className="p-2 text-right">Chiều dài co (mm)</th><th className="py-2 pl-2 text-right">Khoảng khe hở cho phép</th></tr></thead>
          <tbody>{gapRows.map(row => <tr key={row.label} className="border-t"><th className="py-2 pr-2 font-normal">{row.label}</th><td className="p-2 text-right">{formatStressNumber(row.expansion)}</td><td className="p-2 text-right">{formatStressNumber(row.contraction)}</td><td className="py-2 pl-2 text-right font-semibold">{row.allowedRange}</td></tr>)}</tbody>
        </table>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">Khoảng khe hở cho phép: <b>{ALLOWED_GAP_RANGE}</b></p>
          <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">Khoảng khe hở có thể lựa chọn: <b>{SELECTABLE_GAP_RANGE}</b></p>
        </div>
      </section>
    ) : <ResultTable title="Kết quả giải toả" rows={rows} />}
    {notices.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">{notices.map(note => <p key={note}>{note}</p>)}</div>}
  </>;
  const title = (
    <div>
        <h2 className={compact ? "text-base font-bold" : "text-2xl font-bold"}>Bảng tính toán giải tỏa công suất</h2>
        <p className="mt-1 text-sm font-medium text-emerald-700">Bảng tính {railLabel}{buffer ? " · Khe hở ray vùng đệm" : ""}</p>
      {segmentId && <p className="text-sm">Đoạn ray: {segmentId}</p>}
    </div>
  );
  const actions = (
    <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setFields(initialFields(initialInput)); setRailType(initialInput.railType || "60R2"); setStartChainage(""); setEndChainage(""); setMode(initialInput.method); setRollers(initialInput.sideRollers); setSaveNotice(null); }} className="rounded-lg border bg-white px-3 py-2 text-sm">Khôi phục mẫu</button>
      {onSave && (
        <button
          type="button"
          disabled={errors.length > 0}
          onClick={() => {
            onSave(input);
            setSaveNotice("Đã lưu thông số thanh dài.");
          }}
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 disabled:opacity-40"
        >
          Lưu thông số
        </button>
      )}
      <button type="button" disabled={!result} onClick={exportCsv} className="rounded-lg border bg-white px-3 py-2 text-sm disabled:opacity-40">Xuất CSV</button>
      <button type="button" disabled={!result} onClick={() => setPrintOpen(true)} className="rounded-lg bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-40">In A4</button>
    </div>
  );
  return <div className="mx-auto max-w-7xl space-y-4 text-slate-800">
    <header className={`flex gap-3 ${compact ? "flex-col" : "flex-wrap items-start justify-between"}`}>
      {compact ? actions : title}
      {compact ? title : actions}
    </header>
    {saveNotice && <p role="status" className="text-sm text-emerald-700">{saveNotice}</p>}
    <label className="block text-sm font-semibold">Mục tính toán<select className={fieldClass} value={mode} onChange={e => setMode(e.target.value as Mode)}>{Object.entries(modes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <div className={compact ? "grid gap-4" : "grid items-start gap-5 xl:grid-cols-[400px_1fr]"}>
      <section className="space-y-4 rounded-xl border bg-white p-4">
        <h3 className="font-semibold">Thông số đầu vào</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs text-slate-600">Lý trình đầu
            <input className={fieldClass} value={startChainage} onChange={(e) => {
              const next = e.target.value;
              setStartChainage(next);
              const from = parseChainage(next);
              const to = parseChainage(endChainage);
              if (from !== null && to !== null && to > from) setFields((current) => ({ ...current, leftLength: String(to - from), rightLength: "0" }));
            }} placeholder="0+000" />
          </label>
          <label className="text-xs text-slate-600">Lý trình cuối
            <input className={fieldClass} value={endChainage} onChange={(e) => {
              const next = e.target.value;
              setEndChainage(next);
              const from = parseChainage(startChainage);
              const to = parseChainage(next);
              if (from !== null && to !== null && to > from) setFields((current) => ({ ...current, leftLength: String(to - from), rightLength: "0" }));
            }} placeholder="0+800" />
          </label>
        </div>
        {(() => {
          const from = parseChainage(startChainage);
          const to = parseChainage(endChainage);
          if (from === null || to === null || to <= from) return <p className="text-xs text-slate-500">Nhập lý trình đầu/cuối dạng 0+000 để tự tính chiều dài đoạn giải tỏa.</p>;
          return <p className="text-xs text-emerald-700">Chiều dài đoạn: <b>{to - from} m</b> · Km {formatChainage(from)} – {formatChainage(to)}</p>;
        })()}
        <label className="block text-xs text-slate-600">Loại ray
          <select className={fieldClass} value={railType} onChange={e => applyRailType(e.target.value)}>
            {RAIL_TYPE_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        {!customRail && <p className="text-xs text-slate-500">Thông số kỹ thuật của loại ray đã chọn được gán cố định và không được sửa.</p>}
        {customRail && <p className="text-xs text-slate-500">User Define: nhập tiết diện, mô đun đàn hồi và hệ số giãn nở cho loại ray tự định nghĩa.</p>}
        {!buffer && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rollers} onChange={e => setRollers(e.target.checked)} />Sử dụng con lăn cạnh</label>}
        {visibleGroups.map(group => <fieldset key={group.title} className="border-t pt-3">
          <legend className="pr-2 text-sm font-semibold text-blue-800">{group.title}</legend>
          {group.title === "Chiều dài và nhiệt độ" && <p className="mb-2 text-xs text-slate-500">Ray trái: bên trái vị trí kéo về Km0. Giới hạn khóa ray thiết kế = T ± biên độ (cộng/trừ).</p>}
          {group.title === "Thông số ray" && <p className="mb-2 text-xs text-slate-500">Lực cản dọc nhập theo từng dự án; dùng để tính lực kéo và lượng co/giãn theo biên độ nhiệt độ.</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{group.fields.map(([key, label, unit]) => {
            const locked = !customRail && RAIL_LOCKED_KEYS.includes(key);
            return <label key={key} className="text-xs text-slate-600">{label} ({unit})<input inputMode="decimal" readOnly={locked} value={fields[key]} onChange={e => { if (!locked) setFields({ ...fields, [key]: e.target.value }); }} className={locked ? lockedClass : fieldClass} /></label>;
          })}</div>
          {group.title === "Chiều dài và nhiệt độ" && result && (
            <p className="mt-2 text-xs text-slate-600">Giới hạn trên khóa ray thiết kế: <b>{formatStressNumber(result.lockTempUpper)} °C</b> · Giới hạn dưới: <b>{formatStressNumber(result.lockTempLower)} °C</b> · Ngưỡng Rail Tensor: nhiệt độ môi trường &lt; <b>{formatStressNumber(result.skipThreshold)} °C</b>.</p>
          )}
        </fieldset>)}
        {mode === "FBW" && <p className="text-xs text-slate-500">Gap = khoảng cách kéo cần thiết − 35,5 mm (mặc định overlap {FBW_OVERLAP_MM} mm). Đặt ray chồng để chủ động cắt và bù phần ray tụt khi hàn.</p>}
        {mode === "ATW" || mode === "FBW" ? <p className="text-xs text-slate-500">Áp lực dầu = 1000 F / (2 A), làm tròn lên số nguyên MPa. A là diện tích một xi lanh Rail Tensor (mm²).</p> : null}
      </section>
      <div className="space-y-3">{errors.length > 0 && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{errors.map(error => <p key={error}>{error}</p>)}</div>}{results}</div>
    </div>
    {result ? (
      <StressReleasePrint
        open={printOpen}
        modeLabel={modes[mode]}
        buffer={buffer}
        rollers={rollers}
        segmentId={segmentId}
        railLabel={railLabel}
        input={input}
        inputRows={inputRows}
        tension={tension}
        compression={compression}
        rows={rows}
        gapRows={gapRows}
        notices={notices}
        result={result}
        onClose={() => setPrintOpen(false)}
        onPrint={() => window.print()}
      />
    ) : null}
  </div>;
}
