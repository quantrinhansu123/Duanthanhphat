"use client";

import { useMemo, useState } from "react";
import { CaretDown, CaretLeft, CaretRight, MagnifyingGlass } from "@/components/icons";
import { useLanguage } from "@/i18n/LanguageProvider";
import { deaccent } from "@/i18n/deaccent";
import source from "@lwr/data/tb10015.json";
import CwrProjectRails, { CwrGuide } from "./CwrProjectRails";
import CwrInputParams from "./CwrInputParams";
import Tb15GroundCheck from "./Tb15GroundCheck";

type Value = string | number | null;
type Cell = string | number | { formula: string; result: Value };
type Row = { number: number; cells: Record<string, Cell>; kind?: string };
type Sheet = { name: string; formulaCount: number; rows: Row[] };
const sheets: Sheet[] = source.sheets as Sheet[];
const sectionAreas = new Map<number, number>();
for (const { number, cells } of sheets.find((s) => s.name === "Tra cứu")?.rows ?? []) {
  if (number >= 6 && number <= 17 && cells.B === 0 && typeof cells.A === "number" && typeof cells.C === "number") {
    sectionAreas.set(cells.A, cells.C);
  }
}
const total = sheets.reduce((count, sheet) => count + sheet.formulaCount, 0);
const pageSize = 12;
const control = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-[#0047AB]";
const pageButton = "grid size-10 place-items-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-35";

function valueOf(cell: Cell | undefined) {
  return typeof cell === "object" ? cell.result : cell;
}

function normalized(text: string) {
  return deaccent(text).toLowerCase();
}

function indexRows(sheet: Sheet) {
  const primaryHeader = sheet.rows.find((row) => row.number === 4 && row.kind === "header")?.cells ?? {};
  let header = primaryHeader;
  let section = "";
  let tableNote = "";
  return sheet.rows.map((row) => {
    const { cells, number, kind } = row;
    const entries = Object.entries(cells);
    if (kind === "section") {
      section = String(cells.A);
      header = primaryHeader;
      tableNote = "";
    } else if (kind === "header") {
      header = cells;
    }
    // These merged notes introduce the wheel and wavelength tables that follow them.
    if ((sheet.name === "1_Độ bền ray" && number === 17) || (sheet.name === "2_Ổn định" && number === 56)) {
      tableNote = String(cells.B);
    }
    const formulas = entries.filter(([, cell]) => typeof cell === "object");
    let label = String(valueOf(cells.B) ?? valueOf(cells.A) ?? "");
    if (kind === "header") label = entries.map(([, cell]) => valueOf(cell)).join(" · ");
    else if (header.A === "Bánh" && cells.A !== undefined) label = `Bánh ${cells.A}`;
    else if (header.A === "l (cm)" && typeof cells.A === "number") label = `l = ${cells.A} cm`;
    else if (sheet.name === "Tra cứu" && cells.A !== undefined && !kind) {
      label = [cells.A, cells.B].filter((v) => v !== undefined).join(" · ");
    }
    const fields = entries.map(([col, cell]) => ({
      address: col + number,
      name: kind || number <= 2 ? "" : String(header[col] ?? ""),
      value: valueOf(cell),
      formula: typeof cell === "object" ? cell.formula : undefined,
    }));
    const text = normalized([label, section, ...fields.flatMap((f) => [f.address, f.name, f.value, f.formula])].join(" "));
    return { number, kind, section, label, fields, formulaCount: formulas.length, text, tableNote };
  });
}

function SheetView({ sheet, en, address = "" }: { sheet: Sheet; en: boolean; address?: string }) {
  const rows = useMemo(() => indexRows(sheet), [sheet]);
  const sections = rows.filter((r) => r.kind === "section");
  const [section, setSection] = useState("");
  const [query, setQuery] = useState(address);
  const [formulasOnly, setFormulasOnly] = useState(sheet.formulaCount > 0 && !address);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<number | "first" | null>("first");
  const term = normalized(query.trim());
  const cellAddress = term.replaceAll("$", "").toUpperCase();
  const byAddress = /^[A-Z]+[1-9]\d*$/.test(cellAddress);
  const filtered = rows.filter((r) => {
    if (section && r.section !== section) return false;
    if (formulasOnly && !r.formulaCount) return false;
    return byAddress ? r.fields.some((field) => field.address === cellAddress) : r.text.includes(term);
  });
  const pages = Math.ceil(filtered.length / pageSize);
  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const selected = expanded === "first" ? visible[0]?.number : expanded;

  function showPage(index: number) {
    setPage(index);
    setExpanded("first");
  }

  return (
    <section aria-label={sheet.name} className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
        <h2 className="text-lg font-bold text-slate-900">{String(sheet.rows[0].cells.A)}</h2>
        {typeof sheet.rows[1]?.cells.A === "string" && (
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-600">{sheet.rows[1].cells.A}</p>
        )}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-0 grow basis-56 text-xs font-semibold text-slate-700">
            {en ? "Search this sheet" : "Tìm trong bảng"}
            <span className="relative mt-1 block">
              <MagnifyingGlass aria-hidden size={17} className="absolute top-3.5 left-3 text-slate-500" />
              <input type="search" value={query} placeholder={en ? "Cell, symbol, clause…" : "Ô Excel, ký hiệu, điều khoản…"}
                onChange={(event) => { setQuery(event.target.value); showPage(0); }}
                className={control + " pl-9 font-normal"} />
            </span>
          </label>
          {sections.length > 0 && (
            <label className="min-w-0 grow basis-56 text-xs font-semibold text-slate-700">
              {en ? "Section" : "Phần trong bảng"}
              <select value={section} onChange={(event) => { setSection(event.target.value); showPage(0); }}
                className={control + " mt-1 block font-normal"}>
                <option value="">{en ? "All sections" : "Tất cả các phần"}</option>
                {sections.map((r) => <option key={r.number} value={r.section}>{r.section}</option>)}
              </select>
            </label>
          )}
          {sheet.formulaCount > 0 && (
            <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={formulasOnly} className="size-4 accent-[#0047AB]"
                onChange={(event) => { setFormulasOnly(event.target.checked); showPage(0); }} />
              {en ? "Formula rows only" : "Chỉ dòng có công thức"}
            </label>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 sm:px-5">
        <span role="status" className="text-sm text-slate-600">
          {filtered.length > 0 ? `${page * pageSize + 1}–${page * pageSize + visible.length} / ` : ""}{filtered.length} {en ? "rows" : "dòng"}
        </span>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <button type="button" className={pageButton} aria-label={en ? "Previous page" : "Trang trước"}
              disabled={page === 0} onClick={() => showPage(page - 1)}><CaretLeft size={16} aria-hidden /></button>
            <select aria-label={en ? "Results page" : "Trang kết quả"} value={page} onChange={(e) => showPage(Number(e.target.value))}
              className="h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm">
              {Array.from({ length: pages }, (_, i) => <option key={i} value={i}>{en ? "Page" : "Trang"} {i + 1} / {pages}</option>)}
            </select>
            <button type="button" className={pageButton} aria-label={en ? "Next page" : "Trang sau"}
              disabled={page + 1 === pages} onClick={() => showPage(page + 1)}><CaretRight size={16} aria-hidden /></button>
          </div>
        )}
      </div>
      {visible.map((row) => {
        const open = row.number === selected;
        const singleFormula = row.formulaCount === 1 ? row.fields.find((field) => field.formula) : undefined;
        const id = `tb10015-row-${row.number}`;
        return (
          <article key={row.number} className="border-b border-slate-200 last:border-0">
            <button type="button" aria-expanded={open} aria-controls={open ? id : undefined}
              onClick={() => setExpanded(open ? null : row.number)}
              className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-700 sm:px-5">
              <span className="min-w-9 shrink-0 font-mono text-xs text-slate-600">{singleFormula?.address ?? `#${row.number}`}</span>
              <span className="min-w-0 grow wrap-break-word font-semibold text-slate-800">{row.label}</span>
              {row.formulaCount > 1 && <span className="shrink-0 text-xs text-slate-600">{row.formulaCount} ƒx</span>}
              <CaretDown size={16} aria-hidden className={`shrink-0 ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div id={id} className="border-t border-blue-100 bg-blue-50/40 px-4 py-3 sm:px-5">
                {row.tableNote && row.formulaCount > 0 && <p className="mb-3 text-sm leading-relaxed text-slate-700">{row.tableNote}</p>}
                <dl className="space-y-2">
                  {row.fields.map((field) => (
                    <div key={field.address} className="grid min-w-0 gap-x-4 gap-y-1 sm:grid-cols-[12rem_minmax(0,1fr)]">
                      <dt className="text-xs leading-6 text-slate-600">
                        <span className="mr-2 font-mono font-semibold text-[#0047AB]">{field.address}</span>{field.name}
                      </dt>
                      <dd className="min-w-0 text-sm leading-relaxed text-slate-800">
                        {field.formula && <code className="mb-1 block whitespace-pre-wrap rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed [overflow-wrap:anywhere]">{field.formula}</code>}
                        {field.formula && <span className="mr-1.5 text-xs font-medium text-slate-600">{en ? "Saved sample" : "Giá trị mẫu"}</span>}
                        <span className="whitespace-pre-line [overflow-wrap:anywhere]">{field.value ?? (en ? "(blank)" : "(trống)")}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </article>
        );
      })}
      {!visible.length && <p className="px-4 py-8 text-center text-sm text-slate-600">{en ? "No rows match the current filters." : "Không có dòng nào khớp với bộ lọc hiện tại."}</p>}
    </section>
  );
}

export default function CwrFormulaReference() {
  const [sheetName, setSheetName] = useState("1_Độ bền ray");
  const [address, setAddress] = useState("");
  const [view, setView] = useState<"rails" | "inputs" | "ground" | "excel" | "guide">("rails");
  const { lang } = useLanguage();
  const en = lang === "en";
  const sheet = sheets.find((item) => item.name === sheetName) ?? sheets[0];
  const count = total.toLocaleString(en ? "en-US" : "vi-VN");
  const wide = view === "inputs";
  return (
    <div className={wide ? "w-full max-w-none space-y-4 px-3 py-4 sm:px-4 sm:py-5" : "mx-auto max-w-6xl space-y-4 px-4 py-5 sm:px-6"} data-no-i18n="true">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{en ? "CWR track verification (TB 10015)" : "Kiểm toán đường ray không mối nối"}</h1>
          <p className="mt-1 text-sm text-slate-600">{source.source}</p>
          <p className="mt-1 text-xs font-semibold text-[#0047AB]">{sheets.length} {en ? "sheets" : "bảng tính"} · {count} {en ? "formula cells" : "ô công thức"}</p>
        </div>
      </header>
      <nav aria-label={en ? "TB 10015 views" : "Nội dung TB 10015"} className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {([["rails", en ? "Project rails" : "Thanh ray dự án"], ["inputs", en ? "Input parameters" : "Thông số đầu vào"], ["ground", en ? "Ballasted track check (VI)" : "Kiểm toán nền đường"], ["excel", en ? "Source workbook" : "Excel gốc"], ["guide", en ? "Guide" : "Hướng dẫn"]] as const).map(([key, label]) =>
          <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}
            className={`min-h-10 rounded-md px-4 text-sm font-semibold ${view === key ? "bg-[#0047AB] text-white" : "text-slate-700 hover:bg-slate-100"}`}>{label}</button>)}
      </nav>
      <div hidden={view !== "rails"}>
        <CwrProjectRails en={en} sectionAreas={sectionAreas} openCell={(name, cell) => { setSheetName(name); setAddress(cell); setView("excel"); }} />
      </div>
      {view === "inputs" && <CwrInputParams en={en} />}
      {view === "ground" && <Tb15GroundCheck />}
      {view === "guide" && <CwrGuide en={en} />}
      {view === "excel" && <>
        <label className="block min-w-0 w-full text-xs font-semibold text-slate-700 sm:w-72">
          {en ? "Worksheet" : "Bảng tính Excel"}
          <select className={control + " mt-1 block"} value={sheet.name} onChange={(e) => { setSheetName(e.target.value); setAddress(""); }}>
            {sheets.map((item) => <option key={item.name}>{item.name}</option>)}
          </select>
        </label>
        <SheetView key={sheet.name + address} sheet={sheet} en={en} address={address} />
      </>}
    </div>
  );
}
