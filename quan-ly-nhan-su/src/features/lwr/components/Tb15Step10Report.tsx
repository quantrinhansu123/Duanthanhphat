"use client";

import { Fragment, useState } from "react";
import type { FormulaLine, FormulaPiece, Step10Sheet, WorkedItem } from "../lib/tb15-step10";

function SourcedValue({ text, source }: { text: string; source: string }) {
  return (
    <span tabIndex={0} className="group/src relative z-0 inline-block cursor-help border-b border-dotted border-[#0047AB] font-semibold text-[#0047AB] hover:z-30 focus:z-30 focus:outline-none">
      {text}
      <span role="tooltip" className="invisible absolute left-0 top-full z-30 mt-1 w-64 rounded-md bg-slate-900 px-2 py-1.5 text-left text-xs font-normal leading-5 text-white opacity-0 shadow-lg group-hover/src:visible group-hover/src:opacity-100 group-focus/src:visible group-focus/src:opacity-100">
        {source}
      </span>
    </span>
  );
}

function Piece({ piece }: { piece: FormulaPiece }) {
  if (!piece.text) return null;
  return piece.source ? <SourcedValue text={piece.text} source={piece.source} /> : <span>{piece.text}</span>;
}

function FormulaSteps({ steps }: { steps: FormulaLine[] }) {
  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <div key={index} className="border-t border-slate-200 pt-3 first:border-t-0 first:pt-0">
          {step.note ? <p>{step.note}</p> : null}
          <p className="mt-1 break-words tabular-nums">
            <span className="font-bold text-[#0047AB]">{step.symbols}</span>
            <span> = </span>
            {step.values.map((value, valueIndex) => <Piece key={valueIndex} piece={value} />)}
            <span> = </span>
            <span className="font-semibold text-slate-950">{step.result}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

function ForceTable({ table }: { table: NonNullable<Step10Sheet["table"]> }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const columnCount = table.headers.length;
  return (
    <div className="overflow-x-auto border-t border-slate-200">
      <table className="w-full text-left text-sm">
        <caption className="px-3 py-2 text-left text-base font-bold text-[#0047AB]">
          {table.caption}
          {table.details?.length ? <span className="mt-1 block text-xs font-normal text-slate-600">Bấm một dòng để xem Pn và Pμ của mặt cắt đó. Một dòng mở tại một thời điểm.</span> : null}
        </caption>
        <thead>
          <tr>{table.headers.map((label) => <th key={label} scope="col" className="p-2">{label}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => {
            const steps = table.details?.[rowIndex];
            const open = openIndex === rowIndex && !!steps?.length;
            const position = row[0] ?? "";
            return (
              <Fragment key={position}>
                <tr className={open ? "border-t border-slate-200 bg-slate-50" : "border-t border-slate-200"}>
                  <th scope="row" className="p-0 font-normal">
                    {steps?.length ? (
                      <button
                        type="button"
                        className="w-full px-2 py-2 text-left tabular-nums text-[#0047AB] underline decoration-dotted underline-offset-2 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0047AB]"
                        aria-expanded={open}
                        aria-controls={`mat-cat-${position}`}
                        onClick={() => setOpenIndex(open ? null : rowIndex)}
                      >
                        {position}
                      </button>
                    ) : <span className="block px-2 py-2 tabular-nums">{position}</span>}
                  </th>
                  {row.slice(1).map((value, index) => <td key={index} className="p-2 tabular-nums">{value}</td>)}
                </tr>
                {open && steps ? (
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td id={`mat-cat-${position}`} colSpan={columnCount} className="px-3 py-3 text-sm leading-7 text-slate-800">
                      <p className="mb-2 text-xs text-slate-600">Mặt cắt tại x = {position} m. Pn = Y·η, Pμ = Y·μ. Dòng Σ là tổng dùng cho độ lún, mô men và phản lực gối.</p>
                      {table.forces?.[rowIndex]?.length ? (
                        <table className="mb-4 w-full max-w-xl border-collapse text-left text-sm">
                          <caption className="mb-1 text-left text-base font-bold text-[#0047AB]">Pn và Pμ tại mặt cắt này</caption>
                          <thead>
                            <tr className="border-b border-slate-300">
                              <th className="py-1 pr-3 font-semibold">Trục lấy lực (m)</th>
                              <th className="py-1 pr-3 text-right font-semibold">Pn (N)</th>
                              <th className="py-1 text-right font-semibold">Pμ (N)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {table.forces[rowIndex].map((force) => (
                              <tr key={force.axle} className="border-b border-slate-200">
                                <td className="py-1 pr-3 tabular-nums">{force.axle}</td>
                                <td className="py-1 pr-3 text-right tabular-nums">{force.pn}</td>
                                <td className="py-1 text-right tabular-nums">{force.pmu}</td>
                              </tr>
                            ))}
                            <tr className="font-semibold">
                              <td className="py-1 pr-3">Σ</td>
                              <td className="py-1 pr-3 text-right tabular-nums">{table.forces[rowIndex][0].sumPn}</td>
                              <td className="py-1 text-right tabular-nums">{table.forces[rowIndex][0].sumPmu}</td>
                            </tr>
                          </tbody>
                        </table>
                      ) : null}
                      <FormulaSteps steps={steps} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ResultRow({ item }: { item: WorkedItem }) {
  const [open, setOpen] = useState(false);
  const panelId = `${item.id}-cach-tinh`;
  const hasWork = Boolean(item.steps?.length || item.formula || item.lines?.length);
  return (
    <li className="border-t border-slate-200 px-3 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-lg font-bold text-[#0047AB]">{item.label}</h4>
          <p className={item.unavailable ? "mt-2 text-sm font-semibold text-red-700" : "mt-2 text-sm font-semibold tabular-nums text-slate-950"}>{item.display}</p>
        </div>
        {hasWork && (
          <button
            type="button"
            className="tb15-no-print mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-bold text-[#0047AB] hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0047AB]"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`Cách tính ${item.label}`}
            onClick={() => setOpen((value) => !value)}
          >
            i
          </button>
        )}
      </div>
      {open && hasWork && (
        <div id={panelId} className="mt-3 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-7 text-slate-800">
          {item.steps?.length ? <p className="text-xs text-slate-600">Đưa chuột vào số màu xanh để xem số đó lấy từ đâu.</p> : null}
          {item.formula && !item.steps?.length ? <p>{item.formula}</p> : null}
          {item.steps?.length ? <FormulaSteps steps={item.steps} /> : null}
          {item.lines?.map((line, index) => <p key={index}>{line}</p>)}
        </div>
      )}
    </li>
  );
}

export function Tb15Step10Report({ sheets }: { sheets: Step10Sheet[] }) {
  return (
    <div className="space-y-4" aria-live="polite">
      <p className="text-sm text-slate-600">Tính lần lượt từ Bước 1 đến Bước 10. Bấm chữ i để xem bài giải. Mỗi phép là một dòng: công thức = dữ liệu = kết quả. Bấm một vị trí trong bảng nội lực để xem vòng tính của mặt cắt đó.</p>
      {sheets.map((sheet) => (
        <section key={sheet.id} className="rounded-lg border border-slate-200" aria-labelledby={`step10-${sheet.id}`}>
          <header className="bg-slate-50 px-3 py-3">
            <h3 id={`step10-${sheet.id}`} className="text-xl font-bold text-[#0047AB]">{sheet.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{sheet.scope}</p>
          </header>
          <ul>{sheet.items.map((entry) => <ResultRow key={`${sheet.id}-${entry.id}`} item={{ ...entry, id: `${sheet.id}-${entry.id}` }} />)}</ul>
          {sheet.table && <ForceTable table={sheet.table} />}
        </section>
      ))}
    </div>
  );
}
