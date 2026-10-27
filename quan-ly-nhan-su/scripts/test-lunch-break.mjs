import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

/** Nạp 1 module .ts vào vm; module phụ (supabase, cache…) là hàm rỗng. */
function load(file, resolve) {
  const exports = {};
  const stub = (extra = {}) => new Proxy(extra, { get: (target, key) => (key in target ? target[key] : () => undefined) });
  const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (id) => resolve?.(id, stub) ?? stub({ createClient: () => ({}), isSupabaseConfigured: () => false, formatSupabaseError: (e) => e.message }),
  });
  return exports;
}

const weld = load("../src/lib/weldReportData.ts");
const machine = load("../src/lib/machineRunSchedulesDb.ts", (id, stub) =>
  id.includes("weldReportData") ? weld : stub({ createClient: () => ({}), isSupabaseConfigured: () => false, formatSupabaseError: (e) => e.message }),
);

const hours = (row) => machine.journalRowOperatingHours(row);
assert.equal(hours({ gio_bat_dau: "08:00", gio_ket_thuc: "17:00" }), 9, "Without lunch break: full span");
assert.equal(hours({ gio_bat_dau: "08:00", gio_ket_thuc: "17:00", gio_nghi_trua: 1.5 }), 7.5, "Lunch break is subtracted from machine hours");
assert.equal(hours({ gio_bat_dau: "08:00", gio_ket_thuc: "17:00", gio_nghi_trua: "1" }), 8, "Numeric strings from the DB are accepted");
assert.equal(hours({ gio_bat_dau: "22:00", gio_ket_thuc: "06:00", gio_nghi_trua: 1 }), 7, "Overnight shifts also subtract lunch");
assert.equal(hours({ gio_bat_dau: "08:00", gio_ket_thuc: "09:00", gio_nghi_trua: 3 }), machine.HOURS_PER_WELD_SHIFT, "Lunch longer than the span falls back to the 8h shift");
assert.equal(hours({ gio_nghi_trua: 1.5 }), machine.HOURS_PER_WELD_SHIFT, "No times recorded: default shift hours");
console.log("PASS: lunch break only affects machine operating hours");
