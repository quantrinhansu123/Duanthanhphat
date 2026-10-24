"use client";

import { useEffect, useState } from "react";
import {
  BUFFER_RAIL_LENGTH,
  calculateStressRelease,
  DEFAULT_STRESS_INPUT,
  FBW_OVERLAP_MM,
  formatStressNumber,
  getRailProfile,
  isUserDefineRail,
  RAIL_TYPE_OPTIONS,
  releaseMethodLabel,
  validateStressInput,
  type StressInput,
} from "@lwr/lib/stress-release";
import { parseChainage } from "@lwr/lib/track-editor";
import { StressReleasePrint, type StressPrintRow } from "./StressReleasePrint";
import { BufferGapTable } from "./BufferGapTable";
import { calculateBufferGaps } from "@lwr/lib/buffer-gap";

type NumericKey = { [K in keyof StressInput]-?: StressInput[K] extends number ? K : never }[keyof StressInput];
const groups: { title: string; fields: [NumericKey, string, string][] }[] = [
  { title: "Chiều dài và nhiệt độ", fields: [
    ["leftLength", "Chiều dài phía Km giảm L₁", "m"], ["rightLength", "Chiều dài phía Km tăng L₂", "m"],
    ["radius", "Bán kính đường cong R", "m"], ["neutralTemp", "Nhiệt độ khóa đường T", "°C"], ["airTemp", "Nhiệt độ không khí", "°C"],
    ["lockTempOffset", "Cộng/trừ nhiệt độ khóa đường ±", "°C"],
    ["leftTemp", "Nhiệt độ neo phía Km giảm T₁", "°C"], ["rightTemp", "Nhiệt độ neo phía Km tăng T₂", "°C"],
    ["maxTemp", "Nhiệt độ ray lớn nhất", "°C"], ["minTemp", "Nhiệt độ ray nhỏ nhất", "°C"],
  ] },
  { title: "Thông số ray", fields: [
    ["area", "Tiết diện ray A", "m²"], ["modulus", "Mô đun đàn hồi E", "kN/m²"],
    ["alpha", "Hệ số giãn nở α", "/°C"], ["resistance", "Lực cản dọc r (theo dự án)", "kN/m"],
    ["jointResistance", "Lực cản mối nối Pj", "kN"],
    ["jackCylinderArea", "Diện tích xi lanh Rail Tensor", "mm²"],
  ] },
  { title: "Hàn và đo chuyển vị", fields: [
    ["structuralGap", "Khe hở cấu tạo ag", "mm"],
    ["weldGap", "Khe hở hàn Ga", "mm"], ["fbwAllowance", "Overlap / độ rút ngắn mối hàn", "mm"],
    ["currentGap", "Khe hở hiện tại Gr", "mm"], ["leftMovement", "Chuyển vị mốc trong Mt (phía Km giảm)", "mm"],
    ["rightMovement", "Chuyển vị mốc trong Mp (phía Km tăng)", "mm"],
  ] },
  { title: "Kiểm tra mốc ngoài F khi kéo thử", fields: [
    ["leftOuterMovement", "Chuyển vị mốc cố định F phía Km giảm", "mm"],
    ["rightOuterMovement", "Chuyển vị mốc cố định F phía Km tăng", "mm"],
  ] },
];
const RAIL_LOCKED_KEYS: NumericKey[] = ["area", "modulus", "alpha"];
const fieldClass = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";
// Fields filled in on site (chainage, rail/air temperatures): tinted so they stand out from design parameters.
const siteClass = "mt-1 w-full rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600";
const SITE_KEYS: NumericKey[] = ["leftTemp", "rightTemp", "airTemp"];
const formatTime = (iso: string) => iso ? new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "Chưa ghi";
const lockedClass = "mt-1 w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600";

function initialFields(initialInput: StressInput): Record<NumericKey, string> {
  return Object.fromEntries(groups.flatMap((g) => g.fields.map(([key]) => [key, String(initialInput[key] ?? DEFAULT_STRESS_INPUT[key])]))) as Record<NumericKey, string>;
}

type Mode = StressInput["method"] | "BUFFER";
type Row = StressPrintRow;
const modes: Record<Mode, string> = {
  ATW: "Hàn nhiệt nhôm (ATW)", FBW: "Hàn chảy giáp mép (FBW)",
  SINGLE: "Giải toả ray đơn", BUFFER: "Khe hở ray vùng đệm",
};

function ResultTable({ title, rows }: { title: string; rows: Row[] }) {
  return <section className="rounded-xl border bg-white p-4">
    <h3 className="mb-2 font-semibold text-blue-900">{title}</h3>
    <table className="w-full text-left text-sm"><tbody>{rows.map(([label, value, unit]) =>
      <tr key={label} className="border-t"><th className="py-2 pr-3 font-normal">{label}</th>
        <td className="py-2 text-right font-semibold">{value === null ? "Không áp dụng" : typeof value === "string" ? `${value}${unit ? ` ${unit}` : ""}` : `${formatStressNumber(value)} ${unit}`}</td></tr>)}</tbody></table>
  </section>;
}

export type StressSaveResult = { ok: boolean; message: string };

export function StressReleaseCalculator({
  initialInput = DEFAULT_STRESS_INPUT,
  segmentId,
  compact = false,
  onSave,
  onModeChange,
}: {
  initialInput?: StressInput;
  segmentId?: string;
  compact?: boolean;
  onSave?: (input: StressInput) => StressSaveResult | boolean | void;
  onModeChange?: (mode: Mode) => void;
}) {
  const [fields, setFields] = useState(() => initialFields(initialInput));
  const [railType, setRailType] = useState(initialInput.railType || "60R2");
  const [startChainage, setStartChainage] = useState(initialInput.startChainage ?? "");
  const [endChainage, setEndChainage] = useState(initialInput.endChainage ?? "");
  const [jointChainage, setJointChainage] = useState(initialInput.jointChainage ?? "");
  const [trackSide, setTrackSide] = useState<"LEFT" | "RIGHT">(initialInput.trackSide ?? "LEFT");
  const [mode, setMode] = useState<Mode>(initialInput.method);
  const [startTime, setStartTime] = useState(initialInput.startTime ?? "");
  const [endTime, setEndTime] = useState(initialInput.endTime ?? "");
  const [rollers, setRollers] = useState(initialInput.sideRollers);
  useEffect(() => {
    setStartChainage(initialInput.startChainage ?? "");
    setEndChainage(initialInput.endChainage ?? "");
    setTrackSide(initialInput.trackSide ?? "LEFT");
  }, [initialInput.startChainage, initialInput.endChainage, initialInput.trackSide]);
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
  const [saveOk, setSaveOk] = useState(false);
  const buffer = mode === "BUFFER";
  const customRail = isUserDefineRail(railType);
  const railLabel = RAIL_TYPE_OPTIONS.find((item) => item.id === railType)?.label ?? railType;
  const relevant = (key: NumericKey) => {
    if (buffer) {
      return ([
        "area", "modulus", "alpha", "resistance", "jointResistance", "neutralTemp",
        "lockTempOffset", "airTemp", "maxTemp", "minTemp", "structuralGap", "leftLength", "rightLength",
      ] as NumericKey[]).includes(key);
    }
    if (key === "structuralGap") return false;
    if (key === "jointResistance") return false;
    if (key === "weldGap") return mode === "ATW";
    if (key === "fbwAllowance") return mode === "FBW";
    if (key === "currentGap") return mode !== "SINGLE";
    if (key === "jackCylinderArea") return !buffer;
    return true;
  };
  const visibleGroups = groups.map(g => ({ ...g, fields: g.fields.filter(([key]) => relevant(key)).map(([key, label, unit]): [NumericKey, string, string] => [key, buffer && key === "area" ? "Diện tích tiết diện ray F" : label, unit]) })).filter(g => g.fields.length);
  const input: StressInput = { ...DEFAULT_STRESS_INPUT, ...initialInput, trackSide, startChainage, endChainage, jointChainage, startTime, endTime, railType, method: buffer ? "SINGLE" : mode, sideRollers: buffer ? false : rollers };
  for (const group of visibleGroups) for (const [key] of group.fields) input[key] = fields[key].trim() === "" ? NaN : Number(fields[key].replace(",", "."));
  const chainErrors: string[] = [];
  const from = parseChainage(startChainage);
  const to = parseChainage(endChainage);
  const joint = jointChainage.trim() ? parseChainage(jointChainage) : to;
  if (!buffer && (startChainage.trim() || endChainage.trim() || jointChainage.trim())) {
    if (from === null || to === null || to <= from) chainErrors.push("Nhập lý trình đầu/cuối hợp lệ, cuối lớn hơn đầu.");
    else if (joint === null || joint < from || joint > to) chainErrors.push("Vị trí kéo phải nằm trong đoạn giải toả.");
    else { input.leftLength = joint - from; input.rightLength = to - joint; }
  }
  // Legacy manually entered deformations must never override the thermal calculation.
  delete input.bufferDeformations;
  const errors = [...chainErrors, ...validateStressInput(input), ...(buffer && input.structuralGap <= 0 ? ["Khe hở cấu tạo ag phải lớn hơn 0."] : [])];
  const result = errors.length ? null : calculateStressRelease(input);
  const deltas = result?.bufferDeformations;
  const deltasReady = !!deltas && Object.values(deltas).every(value => Number.isFinite(value) && value >= 0)
    && result.compressionForceRaw >= input.jointResistance && result.tensionForceRaw >= input.jointResistance;
  const gapRows = result && buffer ? calculateBufferGaps(input.structuralGap, deltasReady ? deltas : undefined) : [];
  const canExport = Boolean(result) && (!buffer || deltasReady);
  const tension: Row[] = result ? [
    ["Độ giảm nhiệt độ lớn nhất", result.tensionDelta, "°C"],
    [buffer ? "Pmax kéo — biên độ giảm nhiệt lớn nhất" : "Lực nhiệt kéo lớn nhất", buffer ? result.tensionForceRaw : result.tensionForce, "kN"],
    ...(buffer ? [["Co đầu ray dài Δdài,co (B)", deltasReady ? deltas.longContraction : "Chờ số liệu", "mm"], ["Co đầu ray đệm Δđệm,co (D)", deltasReady ? deltas.bufferContraction : "Chờ số liệu", "mm"]] as Row[] : [["Chiều dài co", result.tensionContraction, "mm"]] as Row[]),
  ] : [];
  const compression: Row[] = result ? [
    ["Độ tăng nhiệt độ lớn nhất", result.compressionDelta, "°C"],
    [buffer ? "Pmax nén — biên độ tăng nhiệt lớn nhất" : "Lực nhiệt nén lớn nhất", buffer ? result.compressionForceRaw : result.compressionForce, "kN"],
    ...(buffer ? [["Giãn đầu ray dài Δdài,giãn (A)", deltasReady ? deltas.longExpansion : "Chờ số liệu", "mm"], ["Giãn đầu ray đệm Δđệm,giãn (C)", deltasReady ? deltas.bufferExpansion : "Chờ số liệu", "mm"]] as Row[] : [["Chiều dài giãn", result.compressionExtension, "mm"]] as Row[]),
  ] : [];
  const rows: Row[] = !result || buffer ? [] : [
    ["Phương pháp giải toả", releaseMethodLabel(result.releaseMethod), ""],
    ["Tổng chiều dài giải toả", result.length, "m"],
    ["Nhiệt độ ray trung bình", result.averageTemp, "°C"],
    ["Chênh nhiệt giải toả", result.deltaTemp, "°C"],
    ["Lực kéo giải toả", result.appliedPullForce, "kN"],
    ["Áp lực dầu", result.jackPressure, "MPa"],
    ["Chiều dài neo thiết kế", result.anchorLength, "m"],
    ["Chiều dài neo áp dụng", result.actualAnchorLength, "m"],
    ["Giãn dài khi giải toả", result.freeExtension, "mm"],
    ["Chiều dài kéo tính toán (chưa bù chuyển vị)", result.calculatedPullLength, "mm"],
    ["Chuyển vị mốc trong Mt", input.leftMovement, "mm"],
    ["Chuyển vị mốc trong Mp", input.rightMovement, "mm"],
    ["Tổng bù chuyển vị Mt + Mp", result.movementCompensation, "mm"],
    ["Chiều dài kéo sau bù chuyển vị", result.pullLength, "mm"],
    ...(mode !== "SINGLE" ? [["Khe hở cắt mục tiêu (khe hở giữa hai đầu ray)", result.cutGap, "mm"]] as Row[] : []),
  ];
  const notices: string[] = buffer ? ["Giới hạn dưới dùng lượng giãn ở nhiệt độ cao nhất; giới hạn trên dùng lượng co ở nhiệt độ thấp nhất. Cộng các giá trị Δ chưa làm tròn, sau đó làm tròn giới hạn dưới lên và giới hạn trên xuống đến mm nguyên.", "Tự động tính riêng cho nén và kéo: Pmax = EFαΔT; Δdài = (Pmax − Pj)²/(2EFr); Δđệm = [(Pmax − Pj)L − rL²/4]/(2EF), với L = 25 m. Nhân 1.000 để đổi chuyển vị từ m sang mm."] : ["Chỉ cộng chuyển vị mốc trong Mt + Mp vào khoảng cách kéo để bù mất mát. Mt = Mp = 0: giữ chiều dài kéo tính toán; tổng Mt + Mp = 3 mm: cộng thêm 3 mm. Giải toả tự nhiên không ra lệnh kéo."];
  if (result && !buffer) {
    if (!result.fixedAnchorsStable) notices.push("Mốc ngoài F dịch chuyển khi kéo thử: neo chưa đạt. Phải tăng chiều dài neo hoặc áp dụng biện pháp tăng cường khác và kiểm tra lại; không cộng chuyển vị F vào khoảng cách kéo.");
    notices.push(`Nhiệt độ < ${formatStressNumber(result.skipThreshold)}°C: có lực kéo; ≥ ${formatStressNumber(result.skipThreshold)}°C: giải toả tự nhiên.`);
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
    ...(buffer ? [["Chiều dài ray đệm L", BUFFER_RAIL_LENGTH, "m"]] as StressPrintRow[] : []),
    ...(!buffer ? [
      ["Ray của tuyến", trackSide === "LEFT" ? "Ray trái" : "Ray phải", ""],
      ["Lý trình đầu", startChainage || "Chưa nhập", ""],
      ["Lý trình cuối", endChainage || "Chưa nhập", ""],
      ["Lý trình vị trí kéo", jointChainage || endChainage || "Chưa nhập", ""],
      ["Con lăn cạnh", rollers ? "Có" : "Không", ""],
    ] as StressPrintRow[] : []),
    ["Thời gian bắt đầu", formatTime(startTime), ""],
    ["Thời gian kết thúc", formatTime(endTime), ""],
    ...visibleGroups.flatMap(g => g.fields.filter(([key]) => !["leftMovement", "rightMovement", "leftOuterMovement", "rightOuterMovement"].includes(key)).map(([key, label, unit]) => [label, input[key], unit] as StressPrintRow)),
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
    if (!result || !canExport) return;
    const data = [["Bảng tính toán giải tỏa ứng suất", modes[mode]], ...(segmentId ? [["Đoạn ray", segmentId]] : []),
      ["Loại ray", railLabel],
      ...inputRows.map(([label, value, unit]) => [label, String(value), unit]),
      ["KÉO (nhiệt độ giảm)"], ...tension.map(([label, value, unit]) => [label, String(value), unit]),
      ["NÉN (nhiệt độ tăng)"], ...compression.map(([label, value, unit]) => [label, String(value), unit]),
      ["Kết quả", "Giá trị", "Đơn vị"], ...rows.map(([label, value, unit]) => [label, value === null ? "Không áp dụng" : String(value), unit]),
      ...(buffer ? [
        ["Khe hở tính toán (dự phòng)", "Giới hạn dưới ở nhiệt độ cao nhất (mm)", "Ký hiệu", "Giới hạn trên ở nhiệt độ thấp nhất (mm)", "Công thức dưới", "Công thức trên", "Kết luận"],
        ...gapRows.map(row => [row.label, String(row.lower), row.symbol, String(row.upper), row.lowerFormula, row.upperFormula, row.feasible ? "Có khoảng thoả mãn" : "Không có khoảng thoả mãn"]),
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
    {!buffer && <p className="text-xs text-slate-500">Ray trái/phải của tuyến xác định khi nhìn theo chiều lý trình tăng. L₁/L₂ là hai phía Km giảm/Km tăng của vị trí kéo trên cùng một ray. Biến dạng tự do trên toàn chiều dài giải toả; phần KÉO hiển thị chiều dài co, phần NÉN hiển thị chiều dài giãn. Lực nhiệt xét theo dải khóa đường T ± {formatStressNumber(input.lockTempOffset)}°C.</p>}
    {buffer ? (
      <section className="rounded-xl border bg-white p-4">
        <h3 className="mb-2 font-semibold text-purple-900">Khe hở tính toán (dự phòng)</h3>
        <div className="overflow-x-auto"><BufferGapTable rows={gapRows} /></div>
        <p className="mt-2 text-xs text-purple-900">Khe hở cấu tạo ag = {formatStressNumber(input.structuralGap)} mm. Δgiãn xét tại {formatStressNumber(input.maxTemp)}°C; Δco xét tại {formatStressNumber(input.minTemp)}°C.</p>
      </section>
    ) : <ResultTable title="Kết quả giải toả" rows={rows} />}
    {notices.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">{notices.map(note => <p key={note}>{note}</p>)}</div>}
  </>;
  const title = (
    <div>
        <h2 className={compact ? "text-base font-bold" : "text-2xl font-bold"}>Bảng tính toán giải tỏa ứng suất</h2>
        <p className="mt-1 text-sm font-medium text-emerald-700">Bảng tính {railLabel}{buffer ? " · Khe hở ray vùng đệm" : ""}</p>
      {segmentId && <p className="text-sm">Đoạn ray: {segmentId}</p>}
    </div>
  );
  const actions = (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => {
          if (errors.length > 0) {
            setSaveOk(false);
            setSaveNotice(`Chưa lưu được: ${errors.join(" ")}`);
            return;
          }
          if (buffer && !deltasReady) {
            setSaveOk(false);
            setSaveNotice("Chưa lưu được: chưa tính được khe hở vùng đệm. Kiểm tra thông số đầu vào — Pmax phải ≥ Pj và chuyển vị tính toán không âm.");
            return;
          }
          if (!onSave) {
            setSaveOk(false);
            setSaveNotice("Chưa lưu được: bảng tính độc lập không gắn thanh dài. Mở Tổng quan (Track Map), bấm thanh dài trên sơ đồ, rồi Lưu thông số.");
            return;
          }
          const saved = onSave(input);
          if (saved && typeof saved === "object") {
            setSaveOk(saved.ok);
            setSaveNotice(saved.message);
            return;
          }
          if (saved === false) {
            setSaveOk(false);
            setSaveNotice("Chưa lưu được thông số. Đọc thông báo lỗi trên trang — thường do lý trình chồng lấn, dải ray không khớp, hoặc sơ đồ chưa ghi được.");
            return;
          }
          setSaveOk(true);
          setSaveNotice("Đã lưu thông số thanh dài.");
        }}
        className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900"
      >
        Lưu thông số
      </button>
      <button type="button" disabled={!canExport} onClick={exportCsv} className="rounded-lg border bg-white px-3 py-2 text-sm disabled:opacity-40">Xuất CSV</button>
      <button type="button" disabled={!canExport} onClick={() => setPrintOpen(true)} className="rounded-lg bg-purple-700 px-3 py-2 text-sm text-white disabled:opacity-40">In A4</button>
    </div>
  );
  return <div className="mx-auto max-w-7xl space-y-4 text-slate-800">
    <header className={`flex gap-3 ${compact ? "flex-col" : "flex-wrap items-start justify-between"}`}>
      {compact ? actions : title}
      {compact ? title : actions}
    </header>
    {saveNotice && (
      <p
        role="status"
        className={`rounded-lg border p-3 text-sm ${saveOk ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}
      >
        {saveNotice}
      </p>
    )}
    <label className="block text-sm font-semibold">Mục tính toán<select className={fieldClass} value={mode} onChange={e => { const next = e.target.value as Mode; setMode(next); onModeChange?.(next); }}>{Object.entries(modes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <div className={compact ? "grid gap-4" : "grid items-start gap-5 xl:grid-cols-[400px_1fr]"}>
      <section className="space-y-4 rounded-xl border bg-white p-4">
        <h3 className="font-semibold">Thông số đầu vào</h3>
        {buffer && <p className="rounded border border-purple-200 bg-purple-50 p-3 text-xs text-purple-900">L = {BUFFER_RAIL_LENGTH} m (ray đệm). E: mô đun đàn hồi; F: diện tích tiết diện ray; r: sức cản dọc; Pj: lực cản mối nối. Pmax nén và Pmax kéo tính riêng theo biên độ tăng và giảm nhiệt lớn nhất.</p>}
        {buffer && !deltasReady && <p role="alert" className="text-sm text-red-700">Chưa thể tính khe hở: kiểm tra thông số đầu vào, Pmax phải ≥ Pj và chuyển vị tính toán phải không âm.</p>}
        {!buffer && <>
          <label className="block text-xs text-slate-600">Ray của tuyến (nhìn theo chiều lý trình tăng)
            <select className={fieldClass} value={trackSide} onChange={e => setTrackSide(e.target.value as "LEFT" | "RIGHT")}>
              <option value="LEFT">Ray trái</option><option value="RIGHT">Ray phải</option>
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-amber-800">Lý trình đầu<input className={siteClass} value={startChainage} onChange={e => setStartChainage(e.target.value)} placeholder="Km0+000" /></label>
            <label className="text-xs text-amber-800">Lý trình cuối<input className={siteClass} value={endChainage} onChange={e => setEndChainage(e.target.value)} placeholder="Km0+800" /></label>
            <label className="text-xs text-amber-800 sm:col-span-2">Lý trình vị trí kéo / mối hàn<input className={siteClass} value={jointChainage} onChange={e => setJointChainage(e.target.value)} placeholder="Để trống: kéo ở cuối đoạn" /></label>
          </div>
          <p className="text-xs text-slate-500">Chiều dài giải toả = lý trình cuối − lý trình đầu. L₁ = vị trí kéo − đầu; L₂ = cuối − vị trí kéo. Nhập riêng cho từng ray của tuyến.</p>
          {from !== null && to !== null && to > from && <p className="text-xs text-emerald-700">Chiều dài: {formatStressNumber(to - from)} m</p>}
        </>}
        <div className="grid grid-cols-2 gap-3">
          {([["Bắt đầu", startTime, setStartTime], ["Kết thúc", endTime, setEndTime]] as const).map(([label, value, set]) => (
            <div key={label} className="rounded-md border border-amber-400 bg-amber-50 p-2 text-xs text-amber-800">
              <button type="button" onClick={() => set(new Date().toISOString())} className="w-full rounded bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600">{label}</button>
              <div className="mt-1 flex items-center justify-between gap-1"><span>{formatTime(value)}</span>{value && <button type="button" onClick={() => set("")} className="underline">Xóa</button>}</div>
            </div>
          ))}
        </div>
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
          {group.title === "Kiểm tra mốc ngoài F khi kéo thử" && <p className="mb-2 text-xs text-slate-500">F (Fix) phải cố định, chuyển vị bằng 0. Nếu F dịch chuyển, phải tăng chiều dài neo hoặc áp dụng biện pháp tăng cường khác và kéo thử lại. Số đo F chỉ dùng kiểm tra neo, không cộng bù và không đưa vào bảng số liệu báo cáo cuối.</p>}
          {group.title === "Chiều dài và nhiệt độ" && <p className="mb-2 text-xs text-slate-500">Ray trái/phải của tuyến xác định khi nhìn theo chiều lý trình tăng. L₁/L₂ là hai phía Km giảm/Km tăng của vị trí kéo trên cùng một ray. Giới hạn khóa ray thiết kế = T ± biên độ (cộng/trừ).</p>}
          {group.title === "Thông số ray" && <p className="mb-2 text-xs text-slate-500">Lực cản dọc nhập theo từng dự án; dùng để tính lực kéo và lượng co/giãn theo biên độ nhiệt độ.</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{group.fields.map(([key, label, unit]) => {
            const chainLength = !buffer && Boolean(startChainage || endChainage) && (key === "leftLength" || key === "rightLength");
            const locked = chainLength || (!customRail && RAIL_LOCKED_KEYS.includes(key));
            return <label key={key} className={`text-xs ${SITE_KEYS.includes(key) ? "font-medium text-amber-800" : "text-slate-600"}`}>{label} ({unit})<input inputMode="decimal" readOnly={locked} value={chainLength ? String(input[key]) : fields[key]} onChange={e => { if (!locked) setFields({ ...fields, [key]: e.target.value }); }} className={locked ? lockedClass : SITE_KEYS.includes(key) ? siteClass : fieldClass} /></label>;
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
