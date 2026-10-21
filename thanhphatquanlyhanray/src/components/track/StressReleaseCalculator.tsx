"use client";

import { useEffect, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { calculateStressRelease, DEFAULT_STRESS_INPUT, validateStressInput, type StressInput } from "@/lib/stress-release";

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


type Mode = StressInput["method"] | "BUFFER";
type Row = [string, number | null, string];
const modes: Record<Mode, string> = {
  ATW: "Hàn nhiệt nhôm (ATW)", FBW: "Hàn chảy giáp mép (FBW)",
  SINGLE: "Giải toả ray đơn", BUFFER: "Khe hở ray vùng đệm",
};

function ResultTable({ title, rows }: { title: string; rows: Row[] }) {
  return <section className="rounded-xl border bg-white p-4">
    <h3 className="mb-2 font-semibold text-blue-900">{title}</h3>
    <table className="w-full text-left text-sm"><tbody>{rows.map(([label, value, unit]) =>
      <tr key={label} className="border-t"><th className="py-2 pr-3 font-normal">{label}</th>
        <td className="py-2 text-right font-semibold">{value === null ? "Không áp dụng" : `${format(value)} ${unit}`}</td></tr>)}</tbody></table>
  </section>;
}

export function StressReleaseCalculator({ initialInput = DEFAULT_STRESS_INPUT, segmentId, compact = false }: { initialInput?: StressInput; segmentId?: string; compact?: boolean }) {
  const [fields, setFields] = useState(() => initialFields(initialInput));
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
  const buffer = mode === "BUFFER";
  const relevant = (key: NumericKey) => {
    if (buffer) return (["area", "modulus", "alpha", "resistance", "jointResistance", "neutralTemp", "maxTemp", "minTemp", "structuralGap"] as NumericKey[]).includes(key);
    if (["jointResistance", "structuralGap"].includes(key)) return false;
    if (key === "weldGap") return mode === "ATW";
    if (key === "fbwAllowance") return mode === "FBW";
    if (key === "currentGap") return mode !== "SINGLE";
    return true;
  };
  const visibleGroups = groups.map(g => ({ ...g, fields: g.fields.filter(([key]) => relevant(key)) })).filter(g => g.fields.length);
  // Hidden inputs must not invalidate or alter the selected calculation.
  const input: StressInput = { ...DEFAULT_STRESS_INPUT, method: buffer ? "SINGLE" : mode, sideRollers: buffer ? false : rollers };
  for (const group of visibleGroups) for (const [key] of group.fields) input[key] = fields[key].trim() === "" ? NaN : Number(fields[key].replace(",", "."));
  const errors = validateStressInput(input);
  const result = errors.length ? null : calculateStressRelease(input);
  const tension: Row[] = result ? [
    ["Độ giảm nhiệt độ lớn nhất", result.tensionDelta, "°C"],
    ["Lực nhiệt kéo lớn nhất", result.tensionForce, "kN"],
    [buffer ? "Co ngắn tự do ray đệm 25 m" : "Co ngắn tự do", buffer ? result.tensionContraction * 25 / result.length : result.tensionContraction, "mm"],
    ...(buffer ? [["Chiều dài thở", result.tensionBreathing, "m"], ["Chuyển vị đầu ray", result.tensionEnd, "mm"], ["Chuyển vị ray đệm 25 m", result.tensionBuffer, "mm"]] as Row[] : []),
  ] : [];
  const compression: Row[] = result ? [
    ["Độ tăng nhiệt độ lớn nhất", result.compressionDelta, "°C"],
    ["Lực nhiệt nén lớn nhất", result.compressionForce, "kN"],
    [buffer ? "Giãn dài tự do ray đệm 25 m" : "Giãn dài tự do", buffer ? result.compressionExtension * 25 / result.length : result.compressionExtension, "mm"],
    ...(buffer ? [["Chiều dài thở", result.compressionBreathing, "m"], ["Chuyển vị đầu ray", result.compressionEnd, "mm"], ["Chuyển vị ray đệm 25 m", result.compressionBuffer, "mm"]] as Row[] : []),
  ] : [];
  const rows: Row[] = !result ? [] : buffer ? [
    ["Khe ray dài – ray đệm: nhỏ nhất", result.longGapLower, "mm"],
    ["Khe ray dài – ray đệm: lớn nhất", result.longGapUpper, "mm"],
    ["Khe ray đệm – ray đệm: nhỏ nhất", result.bufferGapLower, "mm"],
    ["Khe ray đệm – ray đệm: lớn nhất", result.bufferGapUpper, "mm"],
    ["Khe hở cần kiểm tra", result.gapCheck, "mm"],
  ] : [
    ["Tổng chiều dài", result.length, "m"], ["Nhiệt độ ray trung bình", result.averageTemp, "°C"],
    ["Chênh nhiệt giải toả", result.deltaTemp, "°C"], ["Lực kéo giải toả", result.force, "kN"],
    ["Chiều dài neo", result.anchorLength, "m"], ["Giãn dài khi giải toả", result.freeExtension, "mm"],
    ["Khoảng kéo", result.pullLength, "mm"],
    ...(mode !== "SINGLE" ? [["Khe hở cắt mục tiêu", result.cutGap, "mm"]] as Row[] : []),
  ];
  const gapRows = result ? [
    { label: "Ray dài – ray đệm 25 m", lower: result.longGapLower, upper: result.longGapUpper, suggested: "8–11 mm" },
    { label: "Ray đệm 25 m – ray đệm 25 m", lower: result.bufferGapLower, upper: result.bufferGapUpper, suggested: "6–13 mm" },
  ] : [];
  const notices: string[] = [];
  if (result) {
    if (buffer) {
      notices.push("Nguồn: Tính toán giải toả ứng suất R2 (2), sheet Bảng tính mẫu 60R2. Ray đệm dài 25 m.");
      if (result.compressionBreathing < 0 || result.tensionBreathing < 0 || result.compressionBuffer < 0 || result.tensionBuffer < 0)
        notices.push("Chuyển vị hoặc chiều dài thở âm: cần kiểm tra phạm vi áp dụng trước khi chọn khe hở.");
      if (result.longGapLower > result.longGapUpper || result.bufferGapLower > result.bufferGapUpper)
        notices.push("Không có khoảng khe hở phù hợp với các thông số đã nhập.");
      notices.push(`Kiểm tra khe hở cấu tạo: ${result.gapPass ? "Đạt" : "Không đạt"}.`);
    } else {
      if (result.deltaTemp < 0) notices.push("Nhiệt độ ray cao hơn nhiệt độ khóa đường; không dùng kết quả âm làm lệnh căng kéo.");
      notices.push(`Kiểm tra chiều dài: ${result.lengthPass === null ? "Chưa xác định giới hạn" : result.lengthPass ? "Đạt" : "Vượt giới hạn"}${result.lengthLimit === null ? "." : ` (giới hạn ${result.lengthLimit} m).`}`);
      if (result.cutGap !== null && result.cutGap < input.currentGap) notices.push("Khe hở mục tiêu nhỏ hơn khe hở hiện tại; cần kiểm tra phương án cắt ray.");
    }
  }
  const inputRows = visibleGroups.flatMap(g => g.fields.map(([key, label, unit]) => [label, String(input[key]), unit]));
  function exportCsv() {
    if (!result) return;
    const data = [["Giải toả ứng suất R2", modes[mode]], ...(segmentId ? [["Đoạn ray", segmentId]] : []),
      ...(!buffer ? [["Con lăn cạnh", rollers ? "Có" : "Không"]] : []), ...inputRows,
      ["KÉO (nhiệt độ giảm)"], ...tension.map(([label, value, unit]) => [label, String(value), unit]),
      ["NÉN (nhiệt độ tăng)"], ...compression.map(([label, value, unit]) => [label, String(value), unit]),
      ["Kết quả", "Giá trị", "Đơn vị"], ...rows.map(([label, value, unit]) => [label, value === null ? "Không áp dụng" : String(value), unit]),
      ...(buffer ? [
        ["Đối chiếu giãn dài", "KÉO (mm)", "NÉN (mm)"],
        ...result.extensionChecks.map(row => [row.label, String(row.tension), String(row.compression)]),
        ["Bố trí tham khảo trong file", "Khe hở"],
        ...gapRows.map(row => [row.label, row.suggested]),
        ["Ghi chú đối chiếu", "Dòng 1 và 2 có xét lực cản mối nối qua chiều dài thở; dòng 3 bỏ qua lực cản mối nối."],
        ["Ghi chú bố trí", "Khoảng 8–11 mm và 6–13 mm là kết luận ghi sẵn trong file, không tự thay đổi theo đầu vào. Chưa xác nhận bố trí khi chuyển vị âm."],
      ] : []),
      ...notices.map(note => ["Ghi chú", note])];
    const csv = "\uFEFF" + data.map(row => row.map(cell => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `giai-toa-${mode}${segmentId ? `-${segmentId}` : ""}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  function printReport() {
    flushSync(() => setPrintOpen(true));
    window.print();
    setPrintOpen(false);
  }
  const results = result && <>
    <div className="thermal-results grid gap-3 sm:grid-cols-2">
      <ResultTable title="KÉO (nhiệt độ giảm)" rows={tension} />
      <ResultTable title="NÉN (nhiệt độ tăng)" rows={compression} />
    </div>
    {!buffer && <p className="text-xs text-slate-500">Biến dạng tự do trên toàn chiều dài ray; phần KÉO hiển thị độ co ngắn, phần NÉN hiển thị độ giãn dài. Lực nhiệt xét theo dải khóa đường rộng 10°C.</p>}
    {buffer ? <>
      <section className="rounded-xl border bg-white p-4">
        <h3 className="mb-2 font-semibold text-blue-900">Bố trí khe hở ray vùng đệm 25 m</h3>
        <table className="w-full text-left text-xs sm:text-sm">
          <thead><tr><th className="py-2 pr-2">Vị trí</th><th className="p-2 text-right">Cận dưới (mm)</th><th className="p-2 text-right">Cận trên (mm)</th><th className="py-2 pl-2 text-right">Tham khảo trong file</th></tr></thead>
          <tbody>{gapRows.map(row => <tr key={row.label} className="border-t"><th className="py-2 pr-2 font-normal">{row.label}</th><td className="p-2 text-right">{format(row.lower)}</td><td className="p-2 text-right">{format(row.upper)}</td><td className="py-2 pl-2 text-right font-semibold">{row.suggested}</td></tr>)}</tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500">Cận dưới xét nhiệt độ ray cao nhất; cận trên xét nhiệt độ ray thấp nhất. Khe hở phải nằm giữa hai cận.</p>
        <p className="mt-1 text-xs text-slate-500">Khoảng 8–11 mm và 6–13 mm là kết luận ghi sẵn trong file, không tự thay đổi theo đầu vào. Chưa xác nhận bố trí khi chuyển vị âm.</p>
        <p className="mt-2 text-sm">Khe hở cần kiểm tra: <b>{format(result.gapCheck)} mm</b> · Khe hở cấu tạo: <b>{format(input.structuralGap)} mm</b>.</p>
      </section>
      <section className="rounded-xl border bg-white p-4">
        <h3 className="mb-2 font-semibold text-blue-900">Bảng đối chiếu giãn dài · mẫu 60R2</h3>
        <table className="w-full text-left text-xs sm:text-sm">
          <thead><tr><th className="py-2 pr-2">Phương pháp đối chiếu</th><th className="p-2 text-right">KÉO (mm)</th><th className="py-2 pl-2 text-right">NÉN (mm)</th></tr></thead>
          <tbody>{result.extensionChecks.map(row => <tr key={row.label} className="border-t"><th className="py-2 pr-2 font-normal">{row.label}</th><td className="p-2 text-right">{format(row.tension)}</td><td className="py-2 pl-2 text-right">{format(row.compression)}</td></tr>)}</tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500">Dòng 1 và 2 có xét lực cản mối nối qua chiều dài thở; dòng 3 bỏ qua lực cản mối nối. Các giá trị cập nhật theo thông số nhập.</p>
      </section>
    </> : <ResultTable title="Kết quả giải toả" rows={rows} />}
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">{notices.map(note => <p key={note}>{note}</p>)}</div>
  </>;
  return <div className="mx-auto max-w-7xl space-y-4 text-slate-800">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className={compact ? "text-base font-bold" : "text-2xl font-bold"}>Giải toả ứng suất R2</h2><p className="mt-1 text-sm font-medium text-emerald-700">Bảng tính mẫu 60R2</p>
        {segmentId && <p className="text-sm">Đoạn ray: {segmentId}</p>}</div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => { setFields(initialFields(initialInput)); setRollers(initialInput.sideRollers); }} className="rounded-lg border bg-white px-3 py-2 text-sm">Khôi phục mẫu</button>
        <button disabled={!result} onClick={exportCsv} className="rounded-lg border bg-white px-3 py-2 text-sm disabled:opacity-40">Xuất CSV</button>
        <button disabled={!result} onClick={printReport} className="rounded-lg bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-40">In A4</button>
      </div>
    </header>
    <label className="block text-sm font-semibold">Mục tính toán<select className={fieldClass} value={mode} onChange={e => setMode(e.target.value as Mode)}>{Object.entries(modes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <div className={compact ? "grid gap-4" : "grid items-start gap-5 xl:grid-cols-[400px_1fr]"}>
      <section className="space-y-4 rounded-xl border bg-white p-4">
        <h3 className="font-semibold">Thông số đầu vào</h3>
        {!buffer && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rollers} onChange={e => setRollers(e.target.checked)} />Sử dụng con lăn cạnh</label>}
        {visibleGroups.map(group => <fieldset key={group.title} className="border-t pt-3">
          <legend className="pr-2 text-sm font-semibold text-blue-800">{group.title}</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{group.fields.map(([key, label, unit]) => <label key={key} className="text-xs text-slate-600">{label} ({unit})<input inputMode="decimal" value={fields[key]} onChange={e => setFields({ ...fields, [key]: e.target.value })} className={fieldClass} /></label>)}</div>
        </fieldset>)}
        {mode === "FBW" && <p className="text-xs text-slate-500">Nhập số bù hàn có dấu; giá trị mẫu là −35,5 mm.</p>}
      </section>
      <div className="space-y-3">{errors.length > 0 && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{errors.map(error => <p key={error}>{error}</p>)}</div>}{results}</div>
    </div>
    {printOpen && createPortal(<article id="stress-print-report">
      <style>{`
        #stress-print-report { display: none; }
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body:has(#stress-print-report) { margin: 0 !important; background: white !important; }
          body:has(#stress-print-report) > :not(#stress-print-report) { display: none !important; }
          #stress-print-report { display: block !important; color: #111; font: 9pt Arial, sans-serif; }
          #stress-print-report h1 { font-size: 16pt; margin: 0 0 3mm; }
          #stress-print-report h2 { font-size: 12pt; margin: 0 0 3mm; }
          #stress-print-report h3 { font-size: 10pt; margin: 0 0 2mm; }
          #stress-print-report section { padding: 2mm; margin: 2mm 0; break-inside: avoid; border: 1px solid #aaa; border-radius: 0; }
          #stress-print-report table { width: 100%; font-size: 9pt; border-collapse: collapse; }
          #stress-print-report th, #stress-print-report td { padding: 1mm; }
          #stress-print-report p { margin: 1mm 0; font-size: 8pt; }
          #stress-print-report .thermal-results { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
          #stress-print-report .print-inputs { display: grid; grid-template-columns: 1fr 1fr; gap: 1mm 5mm; margin: 3mm 0; }
        }
      `}</style>
      <h1>PHIẾU TÍNH TOÁN RAY 60R2</h1><h2>{modes[mode]}</h2>
      {segmentId && <p>Đoạn ray: {segmentId}</p>}
      {!buffer && <p>Con lăn cạnh: {rollers ? "Có" : "Không"}</p>}
      <div className="print-inputs">{inputRows.map(([label, value, unit]) => <p key={label}>{label}: <b>{format(Number(value))} {unit}</b></p>)}</div>
      {results}
    </article>, document.body)}
  </div>;
}
