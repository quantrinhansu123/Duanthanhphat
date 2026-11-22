"use client";

import { useEffect, useState } from "react";
import { calculateCwr, cwrInputs, type CwrRail } from "@lwr/lib/cwr-rail";

type OpenCell = (sheet: string, address: string) => void;
const api = "/api/lwr/tb10015";
const select = "mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900";
const link = "rounded text-left text-sm font-medium text-[#0047AB] underline decoration-blue-200 underline-offset-4 hover:decoration-current";
const panel = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";

function useDbList<T>(url: string) {
  const [data, setData] = useState<T[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function read() {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`);
      if (!controller.signal.aborted) setData(body);
    }
    void read().catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => controller.abort();
  }, [url, attempt]);
  return { data, error, retry: () => { setError(""); setData(null); setAttempt((n) => n + 1); } };
}

function LoadStatus({ error, retry, en }: { error: string; retry: () => void; en: boolean }) {
  return <div role="status" className="py-3 text-sm text-slate-700">
    {error || (en ? "Loading database records…" : "Đang đọc hồ sơ từ cơ sở dữ liệu…")}
    {error && <button type="button" className={link + " ml-3"} onClick={retry}>{en ? "Retry" : "Thử lại"}</button>}
  </div>;
}

export function CwrGuide({ en }: { en: boolean }) {
  return <article className={panel + " max-w-4xl space-y-5 text-sm leading-relaxed text-slate-700"}>
    <section>
      <h2 className="mb-1 text-lg font-bold text-slate-900">{en ? "Purpose" : "Mục đích"}</h2>
      <p>{en ? "Use the saved parameters of a specific long welded rail to check thermal loads, rail break gap and breathing length. Each result links to the original workbook formula."
        : "Dùng thông số đã lưu của từng thanh ray hàn dài để kiểm tra tác động nhiệt, khe đứt ray và chiều dài vùng co giãn. Mỗi kết quả có thể truy về ô công thức trong Excel."}</p>
    </section>
    <section>
      <h2 className="mb-1 text-lg font-bold text-slate-900">{en ? "Instructions" : "Hướng dẫn sử dụng"}</h2>
      <ol className="list-decimal space-y-1 pl-5">
        <li>{en ? "Open Project rails, select the project, then the rail code. For legacy unassigned rails, choose Unassigned diagram."
          : "Mở mục Thanh ray dự án, chọn dự án rồi chọn mã thanh. Với thanh cũ chưa gán dự án, chọn Sơ đồ chưa gán dự án."}</li>
        <li>{en ? "Use Summary for key results or Full calculation to see all inputs, formulas and original Excel cells."
          : "Chọn Bản rút gọn để xem kết quả chính, hoặc Bản đầy đủ để xem đầu vào, công thức và ô Excel nguồn."}</li>
        <li>{en ? "Expand Saved inputs and check the profile, temperatures, resistance and gap limit against the field record. To correct a value, update the rail in Track Map and reload this page."
          : "Mở Thông số đã lưu để đối chiếu mặt cắt, nhiệt độ ray, lực cản và ngưỡng khe với hồ sơ. Khi cần sửa, cập nhật thanh tại Tổng quan (Track Map) rồi tải lại tab này."}</li>
        <li>{en ? "Read the result and its unit. Select an Excel cell to see the formula and worked example, or use Source workbook to search any of the 11 sheets."
          : "Đọc kết quả cùng đơn vị. Bấm địa chỉ ô Excel để xem công thức và ví dụ gốc. Mục Excel gốc cho phép tra toàn bộ 11 bảng."}</li>
      </ol>
    </section>
    <section>
      <h2 className="mb-1 text-lg font-bold text-slate-900">{en ? "Method" : "Phương pháp"}</h2>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>{en ? "The database identifies rails by project and code. Input!D13 in the workbook specifies a 50, 60 or 75 kg/m rail. Appendix C also needs vertical wear (0, 3, 6 or 9 mm) to select section properties."
          : "DB nhận diện thanh theo dự án và mã thanh. Ô Nhập liệu!D13 của Excel chọn loại 50, 60 hoặc 75 kg/m. Bảng tra Phụ lục C còn dùng độ mòn đứng 0, 3, 6 hoặc 9 mm để chọn đặc trưng mặt cắt."}</li>
        <li>{en ? "Use the stored area and modulus. Convert m² to mm² (× 1,000,000) and kN/m² to MPa (÷ 1,000). Longitudinal resistance in kN/(m·rail) has the same numeric value in N/mm per rail."
          : "Dùng F và E đã lưu. Đổi F từ m² sang mm² bằng cách nhân 1.000.000, đổi E từ kN/m² sang MPa bằng cách chia 1.000. Lực cản dọc r tính bằng kN/(m·ray) có cùng trị số với N/mm cho một ray."}</li>
        <li>{en ? "Use the saved neutral temperature and its tolerance to obtain the upper and lower locking temperatures. Use rail temperature extremes to calculate the rise and fall, then thermal force, stress, gap and breathing length."
          : "Lấy nhiệt độ khóa trong hồ sơ cộng và trừ biên độ khóa để xác định hai đầu dải. Từ hai đầu dải và nhiệt độ ray cao nhất, thấp nhất, tính biên độ tăng và giảm nhiệt, lực nhiệt, ứng suất, khe đứt và chiều dài vùng co giãn."}</li>
        <li>{en ? "The gap comparison uses the limit saved for this rail. A full strength and stability check also requires section properties at the measured wear, steel grade, wheel loads, speed, support and track resistance. Bridges and turnouts need their own inputs."
          : "Khe đứt được so với ngưỡng đã lưu của thanh. Để kết luận độ bền, ổn định và xác định nhiệt độ khóa thiết kế, cần thêm đặc trưng mặt cắt theo độ mòn, mác thép, tải bánh, tốc độ, thông số gối đỡ và sức cản của đường. Cầu và ghi cần bộ thông số riêng."}</li>
        <li>{en ? "Clause 1.0.2 covers standard-gauge track (1,435 mm). For a long-span bridge, clause 4.3.2 also requires rail–bridge interaction analysis when checking a rail break."
          : "Điều 1.0.2 quy định phạm vi đường khổ tiêu chuẩn 1.435 mm. Khi kiểm toán khe đứt trên cầu nhịp lớn, điều 4.3.2 còn yêu cầu xét tương tác cầu–ray."}</li>
      </ul>
    </section>
  </article>;
}

type ResultKey = Exclude<keyof ReturnType<typeof calculateCwr>, "withinGap" | "invalidRange">;
const results: ReadonlyArray<[ResultKey, string, string, string, string, string, string]> = [
  ["upper", "Giới hạn khóa trên", "Upper locking temperature", "T + δ", "°C", "4_Nhiệt độ khóa", "D15"],
  ["lower", "Giới hạn khóa dưới", "Lower locking temperature", "T − δ", "°C", "4_Nhiệt độ khóa", "D16"],
  ["rise", "Biên độ tăng nhiệt lớn nhất", "Maximum temperature rise", "Tmax − Td", "°C", "4_Nhiệt độ khóa", "D18"],
  ["drop", "Biên độ giảm nhiệt lớn nhất", "Maximum temperature drop", "Tu − Tmin", "°C", "4_Nhiệt độ khóa", "D19"],
  ["compression", "Lực nén nhiệt", "Thermal compression force", "E·F·α·ΔTu / 1000", "kN", "5_Co giãn-Đệm", "D6"],
  ["tension", "Lực kéo nhiệt", "Thermal tension force", "E·F·α·ΔTd / 1000", "kN", "5_Co giãn-Đệm", "D7"],
  ["stress", "Ứng suất nhiệt kéo", "Thermal tensile stress", "E·α·ΔTd", "MPa", "1_Độ bền ray", "D45"],
  ["gap", "Khe đứt ray λ", "Rail break gap λ", "E·F·(α·ΔTd)² / r", "mm", "3_Khe đứt ray", "D10"],
  ["dropLimit", "Độ giảm nhiệt cho phép theo khe", "Maximum drop for the gap limit", "√([λ]·r / (E·F)) / α", "°C", "3_Khe đứt ray", "D14"],
  ["length", "Chiều dài vùng co giãn", "Breathing length", "max(0, (max(Pnén, Pkéo) − Pⱼ) / r)", "m", "5_Co giãn-Đệm", "D11"],
];
const inputNames = ["Section area F", "Modulus E", "Expansion coefficient α", "Minimum rail temperature", "Maximum rail temperature", "Saved locking temperature", "Locking tolerance ±", "Longitudinal resistance r", "Joint resistance Pⱼ", "Saved gap limit"];
const summaryKeys = new Set<ResultKey>(["upper", "lower", "compression", "tension", "gap", "length"]);

function RailResults({ rail, en, openCell, sectionAreas, full }: ViewProps & { rail: CwrRail; full: boolean }) {
  const v = calculateCwr(rail.params);
  const format = (n: number, digits = 2) => n.toLocaleString(en ? "en-US" : "vi-VN", { maximumFractionDigits: digits });
  const profile = rail.railType || (en ? "Unspecified" : "Chưa ghi loại ray");
  const excelClass = ({ P50: 50, P60: 60, "50": 50, "60": 60, "75": 75 } as Record<string, number>)[rail.railType];
  const area = rail.params.area;
  const workbookArea = sectionAreas.get(excelClass);
  const matches = area !== undefined && workbookArea !== undefined && Math.abs(area * 1e6 - workbookArea) < 0.01;
  return <div className="mt-4 space-y-4">
    <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
      <p className="font-semibold text-slate-900">{rail.code} · {profile}{area === undefined ? "" : ` · F = ${format(area * 1e6)} mm²`}</p>
      <p>{matches
        ? (en ? `Name and area correspond to the ${excelClass} kg/m row. Wear is needed for W and Ix.` : `Tên và diện tích tương ứng dòng ${excelClass} kg/m. Cần độ mòn để tra W và Iₓ.`)
        : (en ? `The workbook has no verified section match for ${profile}. Thermal calculations use this rail’s saved area.` : `Chưa đối chiếu được mặt cắt ${profile} với một dòng trong Excel. Các phép tính nhiệt dùng diện tích đã lưu của thanh.`)}</p>
      {full && <button type="button" onClick={() => openCell("Nhập liệu", "D13")} className={link + " mt-1"}>{en ? "Rail types in Excel" : "Xem loại ray trong Excel"} · D13</button>}
    </div>
    {full && <section className="rounded-lg border border-slate-200">
      <h3 className="px-4 py-3 text-sm font-semibold text-slate-800">{en ? "Saved inputs" : "Thông số đã lưu"}</h3>
      <dl className="grid gap-x-6 px-4 pb-3 text-sm sm:grid-cols-2">
        {cwrInputs.map(([key, name, unit, scale], i) => <div key={key} className="flex justify-between gap-3 border-t border-slate-100 py-2">
          <dt className="text-slate-600">{en ? inputNames[i] : name}</dt>
          <dd className="text-right font-medium">{rail.params[key] === undefined ? "—" : `${format(rail.params[key]! * scale, 9)} ${unit}`}</dd>
        </div>)}
      </dl>
    </section>}
    <h3 className="font-semibold text-slate-900">{en ? "Results for" : "Kết quả theo hồ sơ"} {rail.code}</h3>
    {v.invalidRange && <p role="status" className="text-sm text-amber-800">{en ? "Check the rail temperature range and locking band in the record." : "Cần kiểm tra lại nhiệt độ thấp nhất, cao nhất và dải khóa trong hồ sơ."}</p>}
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-600"><tr>
          <th scope="col" className="px-3 py-2">{en ? "Quantity" : "Đại lượng"}</th>
          <th scope="col" className="px-3 py-2 text-right">{en ? "Value" : "Giá trị"}</th>
          {full && <th scope="col" className="px-3 py-2">Excel</th>}
        </tr></thead>
        <tbody>{results.filter(([key]) => full || summaryKeys.has(key)).map(([key, vi, english, formula, unit, sheet, address]) => <tr key={key} className="border-t border-slate-100">
          <th scope="row" className="px-3 py-2 font-medium">{en ? english : vi}{full && <span className="block text-xs font-normal text-slate-600">{formula}</span>}</th>
          <td className="px-3 py-2 text-right font-semibold tabular-nums">{v[key] === null ? <span className="text-xs font-normal text-slate-600">{en ? "Insufficient data" : "Thiếu dữ liệu hợp lệ"}</span> : `${format(v[key])} ${unit}`}</td>
          {full && <td className="px-3 py-2"><button type="button" className={link} aria-label={sheet + "!" + address} onClick={() => openCell(sheet, address)}><span className="hidden md:inline">{sheet}!</span>{address}</button></td>}
        </tr>)}</tbody>
      </table>
    </div>
    {v.withinGap !== null && <p className="text-sm font-semibold text-slate-800">
      {en ? "Rail break gap" : "Khe đứt ray"} {v.withinGap ? (en ? "within the saved limit" : "trong ngưỡng hồ sơ") : (en ? "exceeds the saved limit" : "vượt ngưỡng hồ sơ")} ({format(rail.params.allowedGap!)} mm).
    </p>}
    <p className="text-sm text-slate-600">{en ? "Strength and stability still require wheel loads, section and track data. The locking temperature used here comes from the selected record." : "Kiểm toán độ bền và ổn định còn thiếu tải bánh, đặc trưng mặt cắt và thông số đường. Nhiệt độ khóa dùng ở đây là giá trị trong hồ sơ thanh đã chọn."}</p>
  </div>;
}

type ViewProps = { en: boolean; openCell: OpenCell; sectionAreas: Map<number, number> };
function ProjectRails({ project, ...props }: ViewProps & { project: string; full: boolean }) {
  const { en } = props;
  const { data, error, retry } = useDbList<CwrRail>(api + "?project=" + encodeURIComponent(project));
  const [id, setId] = useState("");
  if (!data) return <LoadStatus error={error} retry={retry} en={en} />;
  const rail = data.find((item) => item.id === id) ?? data[0];
  if (!rail) return <p role="status" className="mt-4 text-sm text-slate-600">{en ? "No rails saved in this diagram." : "Sơ đồ này chưa có thanh ray đã lưu."}</p>;
  return <>
    <label className="mt-3 block text-sm font-semibold text-slate-700">{en ? "Rail" : "Thanh ray"} ({data.length})
      <select className={select} value={rail.id} onChange={(e) => setId(e.target.value)}>
        {data.map((r) => <option key={r.id} value={r.id}>{[r.code, r.label !== r.code && r.label, r.railType].filter(Boolean).join(" · ")}</option>)}
      </select>
    </label>
    <RailResults rail={rail} {...props} />
  </>;
}

export default function CwrProjectRails(props: ViewProps) {
  const { en } = props;
  const { data, error, retry } = useDbList<{ id: string; name: string }>(api);
  const [selected, setSelected] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const project = selected ?? data?.find((p) => /phú quốc/i.test(p.name))?.id ?? "";
  return <section className={panel}>
    <h2 className="mb-3 text-lg font-bold text-slate-900">{en ? "Project rails" : "Thanh ray dự án"}</h2>
    {data ? <>
      <label className="block text-sm font-semibold text-slate-700">{en ? "Project" : "Dự án"}
        <select className={select} value={project} onChange={(e) => setSelected(e.target.value)}>
          <option value="">{en ? "Unassigned diagram" : "Sơ đồ chưa gán dự án"}</option>
          {data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <div role="group" aria-label={en ? "Calculation display" : "Chế độ xem bảng tính"} className="mt-3 inline-flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {([false, true] as const).map((view) => (
          <button key={String(view)} type="button" aria-pressed={full === view} onClick={() => setFull(view)}
            className={`min-h-10 rounded-md px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${full === view ? "bg-[#0047AB] text-white" : "text-slate-700 hover:bg-slate-200"}`}>
            {view ? (en ? "Full calculation" : "Bản đầy đủ") : (en ? "Summary" : "Bản rút gọn")}
          </button>
        ))}
      </div>
      <ProjectRails key={project} project={project} full={full} {...props} />
    </> : <LoadStatus error={error} retry={retry} en={en} />}
  </section>;
}
