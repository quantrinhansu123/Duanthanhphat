"use client";

import { useMemo, useState } from "react";
import { Plus, Printer, TrashSimple } from "@/components/icons";

type Participant = { name: string; title: string };

type WeldAcceptanceRow = {
  id: string;
  weldName: string;
  railType: string;
  weldTime: string;
  weather: string;
  tempAir: string;
  tempRail: string;
  tankBefore: string;
  tankAfter: string;
  pressureO2: string;
  pressureLpg: string;
  deflection: string;
  leadHeight: string;
  preheatMin: string;
  reactionSec: string;
  demouldMin: string;
  cutMin: string;
  roughGrindMin: string;
  flatCenter: string;
  flatCamber: string;
  flatSurface: string;
  grindLength: string;
  acceptPass: boolean;
  acceptFail: boolean;
  note: string;
};

function emptyRow(): WeldAcceptanceRow {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    weldName: "",
    railType: "",
    weldTime: "",
    weather: "",
    tempAir: "",
    tempRail: "",
    tankBefore: "",
    tankAfter: "",
    pressureO2: "",
    pressureLpg: "",
    deflection: "",
    leadHeight: "",
    preheatMin: "",
    reactionSec: "",
    demouldMin: "",
    cutMin: "",
    roughGrindMin: "",
    flatCenter: "",
    flatCamber: "",
    flatSurface: "",
    grindLength: "",
    acceptPass: false,
    acceptFail: false,
    note: "",
  };
}

const cellInput =
  "w-full min-w-0 border-0 bg-transparent px-0.5 py-0.5 text-center text-[10px] text-slate-900 outline-hidden focus:bg-blue-50 print:bg-transparent print:focus:bg-transparent";

export default function WeldAcceptanceReport() {
  const [hour, setHour] = useState("16");
  const [minute, setMinute] = useState("00");
  const [day, setDay] = useState("26");
  const [month, setMonth] = useState("08");
  const [year, setYear] = useState("2026");
  const [location, setLocation] = useState(
    "Xưởng sản xuất Vinalift, Nhà máy Vinalift 2, phường Bạch Đằng, thành phố Hải Phòng",
  );
  const [partyAName, setPartyAName] = useState("Công ty VINALIFT");
  const [partyBName, setPartyBName] = useState("Công ty Cổ phần Công trình Thành Phát");
  const [partyA, setPartyA] = useState<Participant[]>([
    { name: "Ngô Văn Định", title: "Kiểm soát chất lượng" },
    { name: "", title: "" },
    { name: "", title: "" },
  ]);
  const [partyB, setPartyB] = useState<Participant[]>([
    { name: "Trần Công Tiến", title: "Cán bộ kỹ thuật" },
    { name: "", title: "" },
    { name: "", title: "" },
  ]);
  const [rows, setRows] = useState<WeldAcceptanceRow[]>([emptyRow(), emptyRow(), emptyRow()]);

  const rowCount = useMemo(() => rows.length, [rows]);

  function updateRow(id: string, patch: Partial<WeldAcceptanceRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function updateParticipant(
    side: "A" | "B",
    index: number,
    patch: Partial<Participant>,
  ) {
    const setter = side === "A" ? setPartyA : setPartyB;
    setter((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function handlePrintPdf() {
    window.print();
  }

  return (
    <main className="w-full px-4 sm:px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 no-print">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900">
            Biên bản nghiệm thu chất lượng mối hàn
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Biểu mẫu nghiệm thu mối hàn nhiệt nhôm. Nhập liệu trên bảng và xuất bản in.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRows((current) => [...current, emptyRow()])}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Plus size={14} weight="bold" aria-hidden />
            Thêm dòng
          </button>
          <button
            type="button"
            onClick={handlePrintPdf}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs cursor-pointer"
          >
            <Printer size={16} weight="bold" aria-hidden />
            In tệp PDF
          </button>
        </div>
      </div>

      <div className="weld-acceptance-print rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs print:rounded-none print:border-0 print:shadow-none print:p-0">
        <header className="text-center">
          <div className="text-[11px] sm:text-xs font-bold uppercase tracking-wide text-slate-900">
            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
          </div>
          <div className="mx-auto mt-0.5 inline-block border-b border-slate-800 pb-0.5 text-[11px] sm:text-xs font-semibold text-slate-800">
            Độc lập - Tự do - Hạnh phúc
          </div>
          <h2 className="mt-4 text-sm sm:text-base font-extrabold uppercase tracking-wide text-slate-900">
            BIÊN BẢN NGHIỆM THU CHẤT LƯỢNG MỐI HÀN
          </h2>
        </header>

        <section className="mt-5 space-y-2 text-xs sm:text-sm text-slate-800">
          <div className="font-bold">1. Thời gian và địa điểm</div>
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
            <span>Thời điểm lập biên bản:</span>
            <input value={hour} onChange={(e) => setHour(e.target.value)} className="w-10 border-b border-slate-400 bg-transparent px-1 text-center outline-hidden" />
            <span>giờ</span>
            <input value={minute} onChange={(e) => setMinute(e.target.value)} className="w-10 border-b border-slate-400 bg-transparent px-1 text-center outline-hidden" />
            <span>phút, ngày</span>
            <input value={day} onChange={(e) => setDay(e.target.value)} className="w-10 border-b border-slate-400 bg-transparent px-1 text-center outline-hidden" />
            <span>tháng</span>
            <input value={month} onChange={(e) => setMonth(e.target.value)} className="w-10 border-b border-slate-400 bg-transparent px-1 text-center outline-hidden" />
            <span>năm</span>
            <input value={year} onChange={(e) => setYear(e.target.value)} className="w-14 border-b border-slate-400 bg-transparent px-1 text-center outline-hidden" />
          </div>
          <div className="flex items-start gap-2">
            <span className="shrink-0 pt-1">Địa điểm:</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="min-w-0 flex-1 border-b border-slate-400 bg-transparent px-1 py-0.5 outline-hidden"
            />
          </div>
        </section>

        <section className="mt-4 text-xs sm:text-sm text-slate-800">
          <div className="font-bold">2. Thành phần tham dự</div>
          <div className="mt-2 grid gap-4 md:grid-cols-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold shrink-0">Bên A:</span>
                <input
                  value={partyAName}
                  onChange={(e) => setPartyAName(e.target.value)}
                  className="min-w-0 flex-1 border-b border-slate-400 bg-transparent px-1 outline-hidden font-semibold"
                />
              </div>
              {partyA.map((person, index) => (
                <div key={`a-${index}`} className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="shrink-0">Ông/Bà:</span>
                    <input
                      value={person.name}
                      onChange={(e) => updateParticipant("A", index, { name: e.target.value })}
                      className="min-w-0 flex-1 border-b border-dotted border-slate-400 bg-transparent px-1 outline-hidden"
                    />
                  </div>
                  <span className="text-slate-400">·</span>
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="shrink-0">Chức vụ:</span>
                    <input
                      value={person.title}
                      onChange={(e) => updateParticipant("A", index, { title: e.target.value })}
                      className="min-w-0 flex-1 border-b border-dotted border-slate-400 bg-transparent px-1 outline-hidden"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold shrink-0">Bên B:</span>
                <input
                  value={partyBName}
                  onChange={(e) => setPartyBName(e.target.value)}
                  className="min-w-0 flex-1 border-b border-slate-400 bg-transparent px-1 outline-hidden font-semibold"
                />
              </div>
              {partyB.map((person, index) => (
                <div key={`b-${index}`} className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="shrink-0">Ông/Bà:</span>
                    <input
                      value={person.name}
                      onChange={(e) => updateParticipant("B", index, { name: e.target.value })}
                      className="min-w-0 flex-1 border-b border-dotted border-slate-400 bg-transparent px-1 outline-hidden"
                    />
                  </div>
                  <span className="text-slate-400">·</span>
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="shrink-0">Chức vụ:</span>
                    <input
                      value={person.title}
                      onChange={(e) => updateParticipant("B", index, { title: e.target.value })}
                      className="min-w-0 flex-1 border-b border-dotted border-slate-400 bg-transparent px-1 outline-hidden"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5">
          <div className="mb-2 text-xs sm:text-sm font-bold text-slate-800">3. Nội dung nghiệm thu</div>
          <div className="table-scroll overflow-x-auto rounded-lg border border-slate-300 print:overflow-visible print:rounded-none">
            <table className="w-full min-w-[2100px] border-collapse text-[10px] text-slate-900">
              <thead>
                <tr className="bg-slate-50">
                  <th rowSpan={2} className="border border-slate-400 px-1 py-1.5 w-8">STT</th>
                  <th rowSpan={2} className="border border-slate-400 px-1 py-1.5 min-w-[110px]">Tên mối hàn</th>
                  <th rowSpan={2} className="border border-slate-400 px-1 py-1.5 min-w-[70px]">Loại ray</th>
                  <th rowSpan={2} className="border border-slate-400 px-1 py-1.5 min-w-[80px]">Thời gian hàn</th>
                  <th rowSpan={2} className="border border-slate-400 px-1 py-1.5 min-w-[70px]">Thời tiết</th>
                  <th colSpan={2} className="border border-slate-400 px-1 py-1.5">Nhiệt độ (°C)</th>
                  <th colSpan={2} className="border border-slate-400 px-1 py-1.5">Áp suất bình khí (MPa)</th>
                  <th colSpan={2} className="border border-slate-400 px-1 py-1.5">
                    Áp suất làm việc (MPa)
                    <div className="font-normal text-[9px] leading-tight">Oxy (&gt;0,4) · Khí dầu (&gt;0,07)</div>
                  </th>
                  <th rowSpan={2} className="border border-slate-400 px-1 py-1.5 min-w-[60px]">Độ võng (mm)</th>
                  <th rowSpan={2} className="border border-slate-400 px-1 py-1.5 min-w-[70px]">Chiều cao đầu dắt (mm)</th>
                  <th rowSpan={2} className="border border-slate-400 px-1 py-1.5 min-w-[70px]">Thời gian gia nhiệt (phút)</th>
                  <th rowSpan={2} className="border border-slate-400 px-1 py-1.5 min-w-[70px]">Thời gian phản ứng (giây)</th>
                  <th rowSpan={2} className="border border-slate-400 px-1 py-1.5 min-w-[70px]">Thời gian tháo khuôn (phút)</th>
                  <th rowSpan={2} className="border border-slate-400 px-1 py-1.5 min-w-[70px]">Thời gian cắt phôi (phút)</th>
                  <th rowSpan={2} className="border border-slate-400 px-1 py-1.5 min-w-[70px]">Thời gian mài thô (phút)</th>
                  <th colSpan={3} className="border border-slate-400 px-1 py-1.5">Độ phẳng mối hàn sau khi mài</th>
                  <th rowSpan={2} className="border border-slate-400 px-1 py-1.5 min-w-[70px]">Chiều dài mài (mm)</th>
                  <th colSpan={2} className="border border-slate-400 px-1 py-1.5">Kết quả nghiệm thu</th>
                  <th rowSpan={2} className="border border-slate-400 px-1 py-1.5 min-w-[90px]">Ghi chú</th>
                  <th rowSpan={2} className="border border-slate-400 px-1 py-1.5 w-8 no-print">Xóa</th>
                </tr>
                <tr className="bg-slate-50">
                  <th className="border border-slate-400 px-1 py-1 min-w-[55px]">Không khí</th>
                  <th className="border border-slate-400 px-1 py-1 min-w-[45px]">Ray</th>
                  <th className="border border-slate-400 px-1 py-1 min-w-[70px]">Trước khi hàn</th>
                  <th className="border border-slate-400 px-1 py-1 min-w-[70px]">Sau khi hàn</th>
                  <th className="border border-slate-400 px-1 py-1 min-w-[50px]">Oxy</th>
                  <th className="border border-slate-400 px-1 py-1 min-w-[55px]">Khí dầu</th>
                  <th className="border border-slate-400 px-1 py-1 min-w-[80px]">Độ lõm giữa mối hàn</th>
                  <th className="border border-slate-400 px-1 py-1 min-w-[70px]">Độ vồng mối hàn</th>
                  <th className="border border-slate-400 px-1 py-1 min-w-[80px]">Độ phẳng mặt lăn</th>
                  <th className="border border-slate-400 px-1 py-1 min-w-[55px]">Đồng ý</th>
                  <th className="border border-slate-400 px-1 py-1 min-w-[70px]">Không đồng ý</th>
                </tr>
                <tr className="bg-amber-50/80 font-semibold">
                  <td className="border border-slate-400 px-1 py-1 text-center">—</td>
                  <td className="border border-slate-400 px-1 py-1 text-center">Yêu cầu kỹ thuật</td>
                  <td className="border border-slate-400 px-1 py-1 text-center bg-slate-200/70" />
                  <td className="border border-slate-400 px-1 py-1 text-center bg-slate-200/70" />
                  <td className="border border-slate-400 px-1 py-1 text-center bg-slate-200/70" />
                  <td className="border border-slate-400 px-1 py-1 text-center bg-slate-200/70" />
                  <td className="border border-slate-400 px-1 py-1 text-center bg-slate-200/70" />
                  <td className="border border-slate-400 px-1 py-1 text-center bg-slate-200/70" />
                  <td className="border border-slate-400 px-1 py-1 text-center bg-slate-200/70" />
                  <td className="border border-slate-400 px-1 py-1 text-center">&gt;0,4</td>
                  <td className="border border-slate-400 px-1 py-1 text-center">&gt;0,07</td>
                  <td className="border border-slate-400 px-1 py-1 text-center bg-slate-200/70" />
                  <td className="border border-slate-400 px-1 py-1 text-center bg-slate-200/70" />
                  <td className="border border-slate-400 px-1 py-1 text-center bg-slate-200/70" />
                  <td className="border border-slate-400 px-1 py-1 text-center bg-slate-200/70" />
                  <td className="border border-slate-400 px-1 py-1 text-center bg-slate-200/70" />
                  <td className="border border-slate-400 px-1 py-1 text-center bg-slate-200/70" />
                  <td className="border border-slate-400 px-1 py-1 text-center bg-slate-200/70" />
                  <td className="border border-slate-400 px-1 py-1 text-center bg-slate-200/70" />
                  <td className="border border-slate-400 px-1 py-1 text-center bg-slate-200/70" />
                  <td className="border border-slate-400 px-1 py-1 text-center bg-slate-200/70" />
                  <td className="border border-slate-400 px-1 py-1 text-center bg-slate-200/70" />
                  <td className="border border-slate-400 px-1 py-1 text-center bg-slate-200/70" />
                  <td className="border border-slate-400 px-1 py-1 text-center bg-slate-200/70" />
                  <td className="border border-slate-400 px-1 py-1 text-center bg-slate-200/70" />
                  <td className="border border-slate-400 px-1 py-1 text-center no-print" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id} className="hover:bg-slate-50/60">
                    <td className="border border-slate-400 px-1 py-1 text-center font-mono">{index + 1}</td>
                    <td className="border border-slate-400 px-0.5 py-0.5">
                      <input className={cellInput} value={row.weldName} onChange={(e) => updateRow(row.id, { weldName: e.target.value })} />
                    </td>
                    <td className="border border-slate-400 px-0.5 py-0.5">
                      <input className={cellInput} value={row.railType} onChange={(e) => updateRow(row.id, { railType: e.target.value })} />
                    </td>
                    <td className="border border-slate-400 px-0.5 py-0.5">
                      <input className={cellInput} value={row.weldTime} onChange={(e) => updateRow(row.id, { weldTime: e.target.value })} />
                    </td>
                    <td className="border border-slate-400 px-0.5 py-0.5">
                      <input className={cellInput} value={row.weather} onChange={(e) => updateRow(row.id, { weather: e.target.value })} />
                    </td>
                    <td className="border border-slate-400 px-0.5 py-0.5">
                      <input className={cellInput} value={row.tempAir} onChange={(e) => updateRow(row.id, { tempAir: e.target.value })} />
                    </td>
                    <td className="border border-slate-400 px-0.5 py-0.5">
                      <input className={cellInput} value={row.tempRail} onChange={(e) => updateRow(row.id, { tempRail: e.target.value })} />
                    </td>
                    <td className="border border-slate-400 px-0.5 py-0.5">
                      <input className={cellInput} value={row.tankBefore} onChange={(e) => updateRow(row.id, { tankBefore: e.target.value })} />
                    </td>
                    <td className="border border-slate-400 px-0.5 py-0.5">
                      <input className={cellInput} value={row.tankAfter} onChange={(e) => updateRow(row.id, { tankAfter: e.target.value })} />
                    </td>
                    <td className="border border-slate-400 px-0.5 py-0.5">
                      <input className={cellInput} value={row.pressureO2} onChange={(e) => updateRow(row.id, { pressureO2: e.target.value })} />
                    </td>
                    <td className="border border-slate-400 px-0.5 py-0.5">
                      <input className={cellInput} value={row.pressureLpg} onChange={(e) => updateRow(row.id, { pressureLpg: e.target.value })} />
                    </td>
                    <td className="border border-slate-400 px-0.5 py-0.5">
                      <input className={cellInput} value={row.deflection} onChange={(e) => updateRow(row.id, { deflection: e.target.value })} />
                    </td>
                    <td className="border border-slate-400 px-0.5 py-0.5">
                      <input className={cellInput} value={row.leadHeight} onChange={(e) => updateRow(row.id, { leadHeight: e.target.value })} />
                    </td>
                    <td className="border border-slate-400 px-0.5 py-0.5">
                      <input className={cellInput} value={row.preheatMin} onChange={(e) => updateRow(row.id, { preheatMin: e.target.value })} />
                    </td>
                    <td className="border border-slate-400 px-0.5 py-0.5">
                      <input className={cellInput} value={row.reactionSec} onChange={(e) => updateRow(row.id, { reactionSec: e.target.value })} />
                    </td>
                    <td className="border border-slate-400 px-0.5 py-0.5">
                      <input className={cellInput} value={row.demouldMin} onChange={(e) => updateRow(row.id, { demouldMin: e.target.value })} />
                    </td>
                    <td className="border border-slate-400 px-0.5 py-0.5">
                      <input className={cellInput} value={row.cutMin} onChange={(e) => updateRow(row.id, { cutMin: e.target.value })} />
                    </td>
                    <td className="border border-slate-400 px-0.5 py-0.5">
                      <input className={cellInput} value={row.roughGrindMin} onChange={(e) => updateRow(row.id, { roughGrindMin: e.target.value })} />
                    </td>
                    <td className="border border-slate-400 px-0.5 py-0.5">
                      <input className={cellInput} value={row.flatCenter} onChange={(e) => updateRow(row.id, { flatCenter: e.target.value })} />
                    </td>
                    <td className="border border-slate-400 px-0.5 py-0.5">
                      <input className={cellInput} value={row.flatCamber} onChange={(e) => updateRow(row.id, { flatCamber: e.target.value })} />
                    </td>
                    <td className="border border-slate-400 px-0.5 py-0.5">
                      <input className={cellInput} value={row.flatSurface} onChange={(e) => updateRow(row.id, { flatSurface: e.target.value })} />
                    </td>
                    <td className="border border-slate-400 px-0.5 py-0.5">
                      <input className={cellInput} value={row.grindLength} onChange={(e) => updateRow(row.id, { grindLength: e.target.value })} />
                    </td>
                    <td className="border border-slate-400 px-0.5 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={row.acceptPass}
                        onChange={(e) =>
                          updateRow(row.id, {
                            acceptPass: e.target.checked,
                            acceptFail: e.target.checked ? false : row.acceptFail,
                          })
                        }
                        className="h-3.5 w-3.5 accent-[#0047AB]"
                        aria-label="Đồng ý nghiệm thu"
                      />
                    </td>
                    <td className="border border-slate-400 px-0.5 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={row.acceptFail}
                        onChange={(e) =>
                          updateRow(row.id, {
                            acceptFail: e.target.checked,
                            acceptPass: e.target.checked ? false : row.acceptPass,
                          })
                        }
                        className="h-3.5 w-3.5 accent-rose-600"
                        aria-label="Không đồng ý nghiệm thu"
                      />
                    </td>
                    <td className="border border-slate-400 px-0.5 py-0.5">
                      <input className={cellInput} value={row.note} onChange={(e) => updateRow(row.id, { note: e.target.value })} />
                    </td>
                    <td className="border border-slate-400 px-0.5 py-0.5 text-center no-print">
                      <button
                        type="button"
                        disabled={rowCount <= 1}
                        onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                        aria-label="Xóa dòng"
                      >
                        <TrashSimple size={14} weight="bold" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          /* Chỉ ẩn chrome app khi in — không đụng visibility toàn trang (dễ làm màn hình trắng). */
          header,
          aside,
          .no-print {
            display: none !important;
          }
          .weld-acceptance-print {
            box-shadow: none !important;
            border: 0 !important;
            border-radius: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .table-scroll {
            overflow: visible !important;
          }
        }
      `}</style>
    </main>
  );
}
