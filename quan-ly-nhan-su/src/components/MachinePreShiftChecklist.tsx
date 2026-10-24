"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import MachinePreShiftChecklistPrint from "@/components/MachinePreShiftChecklistPrint";
import SelectMenu from "@/components/SelectMenu";
import {
  CaretRight,
  Check,
  CheckCircle,
  ClipboardText,
  Drop,
  GearSix,
  IdentificationCard,
  Lightning,
  ListChecks,
  PencilSimple,
  Printer,
  Prohibit,
  SealCheck,
  ShieldCheck,
  Thermometer,
  TrashSimple,
  X,
  XCircle,
} from "@/components/icons";
import {
  CHECKLIST_CONCLUSIONS,
  CHECKLIST_SHIFTS,
  MFBW_PRE_SHIFT_ITEMS,
  MFBW_PRE_SHIFT_SECTIONS,
  conclusionShort,
  countChecklistProgress,
  missingSectionLetters,
  suggestChecklistConclusion,
  summarizeInspectors,
  type ChecklistConclusion,
  type ChecklistMark,
  type ChecklistShift,
} from "@/data/machinePreShiftChecklist";
import { getMachineCategory, type Machine } from "@/data/machines";
import { loadMachineCatalog } from "@/lib/machineCatalogDb";
import {
  deletePreShiftChecklist,
  emptyPreShiftForm,
  formatChecklistDate,
  formatChecklistTime,
  loadPreShiftChecklists,
  nowDatetimeLocal,
  recordToForm,
  todayIsoLocal,
  toDatetimeLocal,
  upsertPreShiftChecklist,
  type PreShiftChecklistFormValues,
  type PreShiftChecklistRecord,
} from "@/lib/machinePreShiftChecklistDb";
import { loadPersonnelPickerRows } from "@/lib/personnelCertificatesDb";
import { loadProjects } from "@/lib/projectsDb";
import { currentViewer } from "@/lib/viewerAccess";

const inputCls =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500";

type PersonOption = { id: string; name: string; chucVu: string };
type ProjectOption = { id: string; name: string; location: string };

const VIEWER_PERSON_ID = "current-viewer";

function samePersonName(left: string, right: string) {
  return left.trim().toLocaleLowerCase("vi") === right.trim().toLocaleLowerCase("vi");
}

function inspectorOptions(
  people: { value: string; label: string }[],
  assigned?: { id: string; name: string },
) {
  const name = assigned?.name.trim() || "";
  if (!name) return people;
  const id = assigned?.id.trim() || name;
  if (people.some((item) => item.value === id)) return people;
  const matched = people.find((item) => samePersonName(item.label.split(" — ")[0] || "", name));
  return matched ? people : [{ value: id, label: name }, ...people];
}

function loggedInInspector(people: PersonOption[]): PersonOption | undefined {
  const name = currentViewer.fullName.trim();
  if (!name) return undefined;
  return (
    people.find((person) => samePersonName(person.name, name)) || {
      id: VIEWER_PERSON_ID,
      name,
      chucVu: currentViewer.role,
    }
  );
}

function weldingMachines(machines: Machine[]) {
  return machines
    .filter((machine) => getMachineCategory(machine) !== "Phương tiện")
    .sort((a, b) => a.code.localeCompare(b.code, "vi"));
}

function progressTone(filled: number, total: number, fail: number) {
  if (fail > 0) return "text-rose-700";
  if (filled === total && total > 0) return "text-emerald-700";
  return "text-[#0047AB]";
}

const SECTION_THEMES: Record<
  string,
  {
    accent: string;
    header: string;
    badge: string;
    title: string;
    kicker: string;
    count: string;
    code: string;
    Icon: typeof Drop;
  }
> = {
  A: {
    accent: "border-l-amber-500",
    header: "bg-gradient-to-r from-amber-50 via-amber-50/70 to-white",
    badge: "bg-amber-500 text-white shadow-sm shadow-amber-500/30",
    title: "text-amber-950",
    kicker: "text-amber-700/80",
    count: "bg-white/80 text-amber-800 ring-1 ring-amber-200",
    code: "bg-amber-50 text-amber-800",
    Icon: Drop,
  },
  B: {
    accent: "border-l-sky-500",
    header: "bg-gradient-to-r from-sky-50 via-sky-50/70 to-white",
    badge: "bg-sky-500 text-white shadow-sm shadow-sky-500/30",
    title: "text-sky-950",
    kicker: "text-sky-700/80",
    count: "bg-white/80 text-sky-800 ring-1 ring-sky-200",
    code: "bg-sky-50 text-sky-800",
    Icon: Lightning,
  },
  C: {
    accent: "border-l-teal-500",
    header: "bg-gradient-to-r from-teal-50 via-teal-50/70 to-white",
    badge: "bg-teal-500 text-white shadow-sm shadow-teal-500/30",
    title: "text-teal-950",
    kicker: "text-teal-700/80",
    count: "bg-white/80 text-teal-800 ring-1 ring-teal-200",
    code: "bg-teal-50 text-teal-800",
    Icon: Thermometer,
  },
  D: {
    accent: "border-l-indigo-500",
    header: "bg-gradient-to-r from-indigo-50 via-indigo-50/70 to-white",
    badge: "bg-indigo-500 text-white shadow-sm shadow-indigo-500/30",
    title: "text-indigo-950",
    kicker: "text-indigo-700/80",
    count: "bg-white/80 text-indigo-800 ring-1 ring-indigo-200",
    code: "bg-indigo-50 text-indigo-800",
    Icon: GearSix,
  },
  E: {
    accent: "border-l-emerald-500",
    header: "bg-gradient-to-r from-emerald-50 via-emerald-50/70 to-white",
    badge: "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30",
    title: "text-emerald-950",
    kicker: "text-emerald-700/80",
    count: "bg-white/80 text-emerald-800 ring-1 ring-emerald-200",
    code: "bg-emerald-50 text-emerald-800",
    Icon: ShieldCheck,
  },
};

const DEFAULT_SECTION_THEME = SECTION_THEMES.D;

export default function MachinePreShiftChecklist() {
  const [date, setDate] = useState(todayIsoLocal);
  const [shift, setShift] = useState<ChecklistShift>("Ca 1");
  const [rows, setRows] = useState<PreShiftChecklistRecord[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<PreShiftChecklistFormValues | null>(null);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [printRecord, setPrintRecord] = useState<PreShiftChecklistRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [pageTab, setPageTab] = useState<"machines" | "list">("machines");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      loadPreShiftChecklists(),
      loadMachineCatalog(),
      loadPersonnelPickerRows().catch(() => []),
      loadProjects({ includeProgress: false }).catch(() => ({ projects: [] })),
    ]).then(([checklists, catalog, personnel, projectResult]) => {
      if (cancelled) return;
      setRows(checklists.rows);
      setLoadError(checklists.error ?? "");
      setMachines(weldingMachines(catalog.machines));
      setPeople(
        personnel
          .filter((row) => (row.trang_thai || "Hoạt động") !== "Khóa")
          .map((row) => ({
            id: row.employee_id,
            name: row.ho_ten,
            chucVu: row.chuc_vu?.trim() || "",
          })),
      );
      setProjects(
        projectResult.projects.map((project) => ({
          id: project.id,
          name: project.name,
          location: project.location || "",
        })),
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const todayRows = useMemo(
    () => rows.filter((row) => row.date === date && row.shift === shift),
    [rows, date, shift],
  );
  const listedRows = useMemo(
    () =>
      [...rows].sort((left, right) => (right.updatedAt || right.date).localeCompare(left.updatedAt || left.date)),
    [rows],
  );
  const byMachine = useMemo(() => new Map(todayRows.map((row) => [row.machineId, row])), [todayRows]);
  const stats = useMemo(() => {
    const fail = todayRows.filter((row) => row.conclusion === "dung_van_hanh" || row.conclusion === "cho_khac_phuc").length;
    return { total: machines.length, done: todayRows.length, fail };
  }, [machines.length, todayRows]);

  const peopleForForm = useMemo(() => {
    const inspector = loggedInInspector(people);
    if (!inspector || people.some((person) => person.id === inspector.id)) return people;
    return [inspector, ...people];
  }, [people]);
  const personOptions = useMemo(
    () =>
      peopleForForm.map((person) => ({
        value: person.id,
        label: person.chucVu ? `${person.name} — ${person.chucVu}` : person.name,
      })),
    [peopleForForm],
  );
  const projectOptions = useMemo(
    () => projects.map((project) => ({ value: project.id, label: project.name })),
    [projects],
  );
  const machineOptions = useMemo(
    () => machines.map((machine) => ({ value: machine.id, label: `${machine.code} — ${machine.name}` })),
    [machines],
  );

  function openNew(machine?: Machine) {
    const existing = machine ? byMachine.get(machine.id) : undefined;
    if (existing) {
      setEditingId(existing.id);
      setForm(recordToForm(existing));
      setFormError("");
      return;
    }
    const project =
      projects.find((item) => item.name === machine?.currentProject) ||
      projects.find((item) => item.id === machine?.currentProject) ||
      projects[0];
    const inspector = loggedInInspector(peopleForForm);
    setEditingId(undefined);
    setForm(
      emptyPreShiftForm({
        date,
        shift,
        machineId: machine?.id || "",
        machineCode: machine?.code || "",
        machineName: machine?.name || "",
        projectId: project?.id || "",
        projectName: project?.name || machine?.currentProject || "",
        location: project?.location || machine?.location || "",
        inspectorId: inspector?.id || "",
        inspectorName: inspector?.name || "",
      }),
    );
    setFormError("");
  }

  function openRow(row: PreShiftChecklistRecord) {
    setEditingId(row.id);
    setForm(recordToForm(row));
    setFormError("");
  }

  async function handleSave() {
    if (!form) return;
    const progress = countChecklistProgress(form.results);
    if (!form.machineId) {
      setFormError("Chọn máy trước khi lưu.");
      return;
    }
    const missingInspectors = missingSectionLetters(form.sectionInspectors);
    if (missingInspectors.length) {
      setFormError(`Phân công người kiểm tra cho nhóm ${missingInspectors.join(", ")}.`);
      return;
    }
    if (progress.filled < progress.total) {
      setFormError(`Còn ${progress.total - progress.filled} mục chưa đánh dấu.`);
      return;
    }
    if (progress.na > 0 && !form.naReason.trim()) {
      setFormError("Có mục NA — hãy ghi lý do không áp dụng.");
      return;
    }
    if (progress.fail > 0 && !form.failDescription.trim()) {
      setFormError("Có mục không đạt — hãy mô tả lỗi trước khi lưu.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const conclusion = form.conclusion || suggestChecklistConclusion(form.results) || "du_dieu_kien";
      const saved = await upsertPreShiftChecklist({ ...form, conclusion }, editingId);
      setRows((current) => [saved, ...current.filter((row) => row.id !== saved.id)]);
      setDate(saved.date);
      setShift(saved.shift);
      setPageTab("list");
      setEditingId(undefined);
      setForm(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Không lưu được checklist.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Xóa phiếu checklist này?")) return;
    setBusyId(id);
    try {
      await deletePreShiftChecklist(id);
      setRows((current) => current.filter((row) => row.id !== id));
      if (editingId === id) {
        setForm(null);
        setEditingId(undefined);
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Không xóa được phiếu.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="w-full px-3 pb-24 sm:px-6">
      <section className="mb-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs sm:p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[9.5rem] flex-1 sm:flex-none">
            <span className={labelCls}>Ngày</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={`${inputCls} font-mono`}
            />
          </label>
          <div className="min-w-[16rem] flex-1">
            <span className={labelCls}>Ca</span>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              {CHECKLIST_SHIFTS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setShift(item)}
                  className={`h-10 rounded-lg text-sm font-bold transition-colors ${
                    shift === item ? "bg-white text-[#0047AB] shadow-xs" : "text-slate-500"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mb-3 grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard label="Máy cần KT" value={stats.total} />
        <StatCard label="Đã kiểm tra" value={stats.done} tone="text-emerald-700" />
        <StatCard label="Không đạt" value={stats.fail} tone="text-rose-700" />
      </div>

      {loadError && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {loadError}
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setPageTab("machines")}
          className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-bold ${
            pageTab === "machines" ? "bg-white text-[#0047AB] shadow-xs" : "text-slate-500"
          }`}
        >
          Máy ca này
        </button>
        <button
          type="button"
          onClick={() => setPageTab("list")}
          className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-bold ${
            pageTab === "list" ? "bg-white text-[#0047AB] shadow-xs" : "text-slate-500"
          }`}
        >
          Danh sách phiếu
          <span className="font-mono text-[11px] tabular-nums">{listedRows.length}</span>
        </button>
      </div>

      {pageTab === "list" ? (
        <section className="mb-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-800">Phiếu đã lưu</h2>
            <button
              type="button"
              onClick={() => openNew()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0047AB] px-3 text-xs font-bold text-white"
            >
              <ClipboardText size={14} weight="bold" aria-hidden />
              Phiếu khác
            </button>
          </div>
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              Đang tải...
            </div>
          ) : listedRows.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              Chưa có phiếu checklist.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {listedRows.map((row) => {
                const progress = countChecklistProgress(row.results);
                return (
                  <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-base font-bold text-[#0047AB]">{row.machineCode}</div>
                        <div className="truncate text-xs text-slate-500">{row.machineName || "—"}</div>
                      </div>
                      <StatusBadge conclusion={row.conclusion || ""} done />
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {formatChecklistDate(row.date)} · {row.shift} · {summarizeInspectors(row.sectionInspectors, row.inspectorName) || "—"} · {progress.pass}/{progress.total} đạt
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openRow(row)}
                        className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0047AB] px-3 text-sm font-bold text-white"
                      >
                        <PencilSimple size={15} weight="bold" aria-hidden />
                        Sửa phiếu
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintRecord(row)}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"
                      >
                        <Printer size={15} weight="bold" aria-hidden />
                        In
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(row.id)}
                        disabled={busyId === row.id}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-700 disabled:opacity-60"
                      >
                        <TrashSimple size={15} weight="bold" aria-hidden />
                        Xóa
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : (
      <section className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-800">Máy ca này</h2>
          <button
            type="button"
            onClick={() => openNew()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0047AB] px-3 text-xs font-bold text-white"
          >
            <ClipboardText size={14} weight="bold" aria-hidden />
            Phiếu khác
          </button>
        </div>
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
            Đang tải...
          </div>
        ) : machines.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
            Chưa có máy hàn trong danh mục.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {machines.map((machine) => {
              const row = byMachine.get(machine.id);
              const progress = row ? countChecklistProgress(row.results) : null;
              return (
                <article key={machine.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-base font-bold text-[#0047AB]">{machine.code}</div>
                      <div className="truncate text-xs text-slate-500">{machine.name}</div>
                    </div>
                    <StatusBadge conclusion={row?.conclusion || ""} done={Boolean(row)} />
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {row
                      ? `${summarizeInspectors(row.sectionInspectors, row.inspectorName) || "—"} · ${formatChecklistTime(row.updatedAt) || formatChecklistDate(row.date)} · ${progress?.pass}/${progress?.total} đạt`
                      : "Chưa kiểm tra trước ca"}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => (row ? openRow(row) : openNew(machine))}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0047AB] px-3 text-sm font-bold text-white"
                    >
                      {row ? <PencilSimple size={15} weight="bold" aria-hidden /> : <CheckCircle size={15} weight="bold" aria-hidden />}
                      {row ? "Sửa phiếu" : "Kiểm tra"}
                    </button>
                    {row && (
                      <button
                        type="button"
                        onClick={() => setPrintRecord(row)}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"
                      >
                        <Printer size={15} weight="bold" aria-hidden />
                        In
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      )}

      {form && (
        <ChecklistFormSheet
          form={form}
          setForm={setForm}
          people={personOptions}
          projects={projectOptions}
          machines={machineOptions}
          machineList={machines}
          projectList={projects}
          personList={peopleForForm}
          error={formError}
          saving={saving}
          canDelete={Boolean(editingId)}
          deleting={Boolean(editingId && busyId === editingId)}
          onClose={() => {
            setForm(null);
            setEditingId(undefined);
            setFormError("");
          }}
          onSave={() => void handleSave()}
          onPrint={() => {
            if (!form) return;
            setPrintRecord({
              ...form,
              id: editingId || "preview",
              results: form.results,
            });
          }}
          onDelete={() => editingId && void handleDelete(editingId)}
        />
      )}

      <MachinePreShiftChecklistPrint
        open={Boolean(printRecord)}
        record={printRecord}
        onClose={() => setPrintRecord(null)}
        onPrint={() => window.print()}
      />
    </main>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs sm:p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-[11px]">{label}</div>
      <div className={`mt-0.5 font-mono text-2xl font-bold tabular-nums ${tone || "text-slate-900"}`}>
        {value.toLocaleString("vi-VN")}
      </div>
    </div>
  );
}

function StatusBadge({ conclusion, done }: { conclusion: string; done: boolean }) {
  if (!done) {
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        Chưa KT
      </span>
    );
  }
  const tone =
    conclusion === "du_dieu_kien"
      ? "bg-emerald-50 text-emerald-700"
      : conclusion === "dung_van_hanh"
        ? "bg-rose-50 text-rose-700"
        : "bg-amber-50 text-amber-800";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone}`}>
      {conclusionShort(conclusion as ChecklistConclusion)}
    </span>
  );
}

function ChecklistFormSheet({
  form,
  setForm,
  people,
  projects,
  machines,
  machineList,
  projectList,
  personList,
  error,
  saving,
  canDelete,
  deleting,
  onClose,
  onSave,
  onPrint,
  onDelete,
}: {
  form: PreShiftChecklistFormValues;
  setForm: (next: PreShiftChecklistFormValues) => void;
  people: { value: string; label: string }[];
  projects: { value: string; label: string }[];
  machines: { value: string; label: string }[];
  machineList: Machine[];
  projectList: ProjectOption[];
  personList: PersonOption[];
  error: string;
  saving: boolean;
  canDelete: boolean;
  deleting: boolean;
  onClose: () => void;
  onSave: () => void;
  onPrint: () => void;
  onDelete: () => void;
}) {
  const progress = countChecklistProgress(form.results);
  const remaining = progress.total - progress.filled;
  const suggested = suggestChecklistConclusion(form.results);
  const [sheetTab, setSheetTab] = useState<"info" | "checklist">(canDelete ? "checklist" : "info");

  function patch(partial: Partial<PreShiftChecklistFormValues>) {
    setForm({ ...form, ...partial });
  }

  useEffect(() => {
    if (progress.fail === 0) return;
    if (toDatetimeLocal(form.recheckAt)) return;
    patch({ recheckAt: nowDatetimeLocal() });
  }, [progress.fail, form.recheckAt]);

  function setMark(ma: string, result: ChecklistMark) {
    const current = form.results[ma] || { result: "", note: "" };
    const nextResult = current.result === result ? ("" as const) : result;
    const results = {
      ...form.results,
      [ma]: { ...current, result: nextResult },
    };
    const failCodes = MFBW_PRE_SHIFT_ITEMS.filter((item) => results[item.ma]?.result === "K").map((item) => item.ma);
    patch({
      results,
      failItemCode: failCodes.join(", "),
      conclusion: suggestChecklistConclusion(results) || form.conclusion,
      recheckAt:
        failCodes.length > 0 && !toDatetimeLocal(form.recheckAt) ? nowDatetimeLocal() : form.recheckAt,
    });
  }

  function markRemainingPass() {
    const results = { ...form.results };
    for (const item of MFBW_PRE_SHIFT_ITEMS) {
      if (!results[item.ma]?.result) results[item.ma] = { ...(results[item.ma] || { note: "" }), result: "D" };
    }
    patch({ results, conclusion: suggestChecklistConclusion(results) || "du_dieu_kien" });
  }

  function onMachine(id: string) {
    const machine = machineList.find((item) => item.id === id);
    const project =
      projectList.find((item) => item.name === machine?.currentProject) ||
      projectList.find((item) => item.id === machine?.currentProject);
    patch({
      machineId: id,
      machineCode: machine?.code || "",
      machineName: machine?.name || "",
      projectId: project?.id || form.projectId,
      projectName: project?.name || form.projectName,
      location: project?.location || machine?.location || form.location,
    });
  }

  function onProject(id: string) {
    const project = projectList.find((item) => item.id === id);
    patch({
      projectId: id,
      projectName: project?.name || "",
      location: project?.location || form.location,
    });
  }

  function onPerson(field: "shiftLead", id: string) {
    const person = personList.find((item) => item.id === id);
    patch({ shiftLeadId: id, shiftLeadName: person?.name || "" });
  }

  function onSectionInspector(sectionId: string, id: string) {
    const person = personList.find((item) => item.id === id);
    const sectionInspectors = {
      ...form.sectionInspectors,
      [sectionId]: { id, name: person?.name || "" },
    };
    patch({
      sectionInspectors,
      inspectorId: id || form.inspectorId,
      inspectorName: summarizeInspectors(sectionInspectors, person?.name || form.inspectorName),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 sm:items-center sm:p-4">
      <div className="flex max-h-[96dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-slate-900">Checklist MFBW trước ca</div>
            <div className="text-xs text-slate-500">
              {form.machineCode || "Chưa chọn máy"} · {form.shift} · {formatChecklistDate(form.date)}
            </div>
          </div>
          <div className={`text-right font-mono text-lg font-bold tabular-nums ${progressTone(progress.filled, progress.total, progress.fail)}`}>
            {progress.filled}/{progress.total}
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">hạng mục</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500"
            aria-label="Đóng"
          >
            <X size={16} weight="bold" aria-hidden />
          </button>
        </div>

        <div className="h-1.5 bg-slate-100">
          <div
            className={`h-full ${progress.fail > 0 ? "bg-rose-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.round((progress.filled / progress.total) * 100)}%` }}
          />
        </div>

        <div className="px-4 pt-3">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setSheetTab("info")}
              className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-bold transition-colors ${
                sheetTab === "info" ? "bg-white text-[#0047AB] shadow-xs" : "text-slate-500"
              }`}
            >
              <IdentificationCard size={16} weight="bold" aria-hidden />
              Thông tin
            </button>
            <button
              type="button"
              onClick={() => setSheetTab("checklist")}
              className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-bold transition-colors ${
                sheetTab === "checklist" ? "bg-white text-[#0047AB] shadow-xs" : "text-slate-500"
              }`}
            >
              <ListChecks size={16} weight="bold" aria-hidden />
              Checklist
              <span className={`font-mono text-[11px] tabular-nums ${progress.fail > 0 ? "text-rose-600" : ""}`}>
                {progress.filled}/{progress.total}
              </span>
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {sheetTab === "info" && (
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={labelCls}>Ngày</span>
              <input type="date" value={form.date} onChange={(event) => patch({ date: event.target.value })} className={`${inputCls} font-mono`} />
            </label>
            <div>
              <span className={labelCls}>Ca</span>
              <SelectMenu
                value={form.shift}
                onChange={(value) => patch({ shift: value as ChecklistShift })}
                options={CHECKLIST_SHIFTS.map((item) => ({ value: item, label: item }))}
                buttonClassName="h-11"
              />
            </div>
            <div className="col-span-2">
              <span className={labelCls}>Máy</span>
              <SelectMenu
                searchable
                value={form.machineId}
                onChange={onMachine}
                options={machines}
                placeholder="Chọn mã máy"
                searchPlaceholder="Tìm mã hoặc tên máy"
                buttonClassName="h-11"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className={labelCls}>Dự án</span>
              <SelectMenu
                searchable
                value={form.projectId}
                onChange={onProject}
                options={projects}
                placeholder="Chọn dự án"
                buttonClassName="h-11"
              />
            </div>
            <label className="col-span-2 sm:col-span-1">
              <span className={labelCls}>Địa điểm</span>
              <input value={form.location} onChange={(event) => patch({ location: event.target.value })} className={inputCls} />
            </label>
            <label className="col-span-2">
              <span className={labelCls}>Lý trình vị trí</span>
              <input
                value={form.chainage}
                onChange={(event) => patch({ chainage: event.target.value })}
                placeholder="Km ...+..."
                className={inputCls}
              />
            </label>
            <div className="col-span-2">
              <span className={labelCls}>Trưởng ca</span>
              <SelectMenu
                searchable
                value={form.shiftLeadId}
                onChange={(id) => onPerson("shiftLead", id)}
                options={people}
                placeholder="Chọn trưởng ca"
                buttonClassName="h-11"
              />
            </div>
            <p className="col-span-2 text-xs leading-snug text-slate-500">
              Người kiểm tra chọn riêng trên từng nhóm A–E ở tab Checklist.
            </p>
          </div>
          )}

          {sheetTab === "checklist" && (
          <>
          {MFBW_PRE_SHIFT_SECTIONS.map((section) => {
            const sectionItems = section.items.map((item) => form.results[item.ma]);
            const sectionFilled = sectionItems.filter((item) => item?.result).length;
            const sectionFail = sectionItems.some((item) => item?.result === "K");
            const sectionDone = sectionFilled === section.items.length && !sectionFail;
            const theme = SECTION_THEMES[section.id] || DEFAULT_SECTION_THEME;
            const SectionIcon = theme.Icon;
            return (
              <section
                key={section.id}
                className={`overflow-hidden rounded-2xl border border-slate-200/90 border-l-[5px] shadow-xs ${
                  sectionFail ? "border-l-rose-500" : theme.accent
                }`}
              >
                <div
                  className={`flex items-center gap-3 px-3.5 py-3 ${
                    sectionFail ? "bg-gradient-to-r from-rose-50 via-rose-50/80 to-white" : theme.header
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                      sectionFail ? "bg-rose-500 text-white shadow-sm shadow-rose-500/30" : theme.badge
                    }`}
                  >
                    {section.letter}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] ${sectionFail ? "text-rose-700/80" : theme.kicker}`}>
                      <SectionIcon size={12} weight="bold" aria-hidden />
                      Nhóm {section.letter}
                    </div>
                    <div className={`text-[13px] font-extrabold uppercase tracking-wide sm:text-sm ${sectionFail ? "text-rose-950" : theme.title}`}>
                      {section.title}
                    </div>
                  </div>
                  <div
                    className={`rounded-full px-2.5 py-1 font-mono text-xs font-bold tabular-nums ${
                      sectionFail
                        ? "bg-white/90 text-rose-700 ring-1 ring-rose-200"
                        : sectionDone
                          ? "bg-white/90 text-emerald-700 ring-1 ring-emerald-200"
                          : theme.count
                    }`}
                  >
                    {sectionFilled}/{section.items.length}
                  </div>
                </div>
                <div className="border-b border-slate-100 bg-white/80 px-3.5 py-2.5">
                  <span className={labelCls}>Người kiểm tra nhóm {section.letter}</span>
                  <SelectMenu
                    searchable
                    value={form.sectionInspectors[section.id]?.id || form.sectionInspectors[section.id]?.name || ""}
                    onChange={(id) => onSectionInspector(section.id, id)}
                    options={inspectorOptions(people, form.sectionInspectors[section.id])}
                    placeholder="Phân công người kiểm tra"
                    searchPlaceholder="Tìm người kiểm tra"
                    buttonClassName="h-11"
                  />
                </div>
                <div className="divide-y divide-slate-100">
                  {section.items.map((item) => {
                    const value = form.results[item.ma] || { result: "", note: "" };
                    const rowTone =
                      value.result === "D"
                        ? "bg-emerald-50/40"
                        : value.result === "K"
                          ? "bg-rose-50/50"
                          : value.result === "NA"
                            ? "bg-slate-50/80"
                            : "bg-white";
                    return (
                      <div key={item.ma} className={`px-3.5 py-3.5 ${rowTone}`}>
                        <div className="mb-1 flex items-start gap-2">
                          <span className={`mt-0.5 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold ${theme.code}`}>
                            {item.ma}
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-900">{item.ten}</div>
                            <div className="text-xs leading-snug text-slate-500">{item.tieuChi}</div>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-1.5">
                          <MarkButton active={value.result === "D"} tone="pass" onClick={() => setMark(item.ma, "D")}>
                            Đạt
                          </MarkButton>
                          <MarkButton active={value.result === "K"} tone="fail" onClick={() => setMark(item.ma, "K")}>
                            Không đạt
                          </MarkButton>
                          <MarkButton active={value.result === "NA"} tone="na" onClick={() => setMark(item.ma, "NA")}>
                            NA
                          </MarkButton>
                        </div>
                        {item.extra === "nhietDo" && (
                          <label className="mt-2 block">
                            <span className="mb-1 block text-[11px] font-semibold text-slate-500">Nhiệt độ nước làm mát (°C)</span>
                            <input
                              inputMode="decimal"
                              value={value.nhietDo || ""}
                              onChange={(event) =>
                                patch({
                                  results: {
                                    ...form.results,
                                    [item.ma]: { ...value, nhietDo: event.target.value },
                                  },
                                })
                              }
                              className={inputCls}
                              placeholder="°C"
                            />
                          </label>
                        )}
                        {(value.result === "K" || value.result === "NA") && (
                          <input
                            value={value.note}
                            onChange={(event) =>
                              patch({
                                results: {
                                  ...form.results,
                                  [item.ma]: { ...value, note: event.target.value },
                                },
                              })
                            }
                            placeholder={value.result === "NA" ? "Lý do không áp dụng" : "Mô tả nhanh"}
                            className={`${inputCls} mt-2`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <section className="space-y-3 overflow-hidden rounded-2xl border border-slate-200/90 border-l-[5px] border-l-slate-700 shadow-xs">
            <div className="flex items-center gap-3 bg-gradient-to-r from-slate-800 to-slate-700 px-3.5 py-3 text-white">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <SealCheck size={20} weight="fill" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">Kết thúc phiếu</div>
                <div className="text-[13px] font-extrabold uppercase tracking-wide sm:text-sm">Kết luận ca</div>
              </div>
            </div>
            <div className="space-y-3 px-3.5 pb-3.5">
            {progress.na > 0 && (
              <label>
                <span className={labelCls}>Lý do không áp dụng (NA)</span>
                <textarea
                  value={form.naReason}
                  onChange={(event) => patch({ naReason: event.target.value })}
                  rows={2}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
                />
              </label>
            )}
            {progress.fail > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label>
                  <span className={labelCls}>Mã mục không đạt</span>
                  <input value={form.failItemCode} onChange={(event) => patch({ failItemCode: event.target.value })} className={inputCls} />
                </label>
                <label>
                  <span className={labelCls}>Kiểm tra lại lúc</span>
                  <input
                    type="datetime-local"
                    value={toDatetimeLocal(form.recheckAt) || nowDatetimeLocal()}
                    onChange={(event) => patch({ recheckAt: event.target.value })}
                    className={`${inputCls} font-mono`}
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className={labelCls}>Mô tả lỗi</span>
                  <textarea
                    value={form.failDescription}
                    onChange={(event) => patch({ failDescription: event.target.value })}
                    rows={2}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className={labelCls}>Biện pháp khắc phục</span>
                  <textarea
                    value={form.remedy}
                    onChange={(event) => patch({ remedy: event.target.value })}
                    rows={2}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
                  />
                </label>
              </div>
            )}
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              {CHECKLIST_CONCLUSIONS.map((item) => {
                const active = (form.conclusion || suggested) === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => patch({ conclusion: item.id })}
                    className={`h-11 rounded-xl border text-xs font-bold ${
                      active
                        ? item.id === "du_dieu_kien"
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : item.id === "dung_van_hanh"
                            ? "border-rose-600 bg-rose-600 text-white"
                            : "border-amber-500 bg-amber-500 text-white"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            </div>
          </section>
          </>
          )}
        </div>

        {error && (
          <div className="mx-4 mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        <div className="space-y-2 border-t border-slate-200 bg-white px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {sheetTab === "checklist" && remaining > 0 && (
            <button
              type="button"
              onClick={markRemainingPass}
              className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-bold text-emerald-800"
            >
              <Check size={15} weight="bold" aria-hidden />
              Đạt {remaining} mục còn lại
            </button>
          )}
          <div className="flex gap-2">
            {canDelete && (
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-rose-200 px-3 text-sm font-semibold text-rose-700"
              >
                <TrashSimple size={15} weight="bold" aria-hidden />
                Xóa
              </button>
            )}
            <button
              type="button"
              onClick={onPrint}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-3.5 text-sm font-semibold text-slate-700"
            >
              <Printer size={15} weight="bold" aria-hidden />
              In
            </button>
            {sheetTab === "info" ? (
              <button
                type="button"
                onClick={() => setSheetTab("checklist")}
                className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0047AB] px-4 text-sm font-bold text-white"
              >
                Checklist
                <CaretRight size={16} weight="bold" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (!form.machineId) setSheetTab("info");
                  onSave();
                }}
                disabled={saving}
                className="inline-flex h-11 min-w-0 flex-1 items-center justify-center rounded-xl bg-[#0047AB] px-4 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? "Đang lưu..." : "Lưu phiếu"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MarkButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: "pass" | "fail" | "na";
  onClick: () => void;
  children: ReactNode;
}) {
  const Icon = tone === "pass" ? CheckCircle : tone === "fail" ? XCircle : Prohibit;
  const activeCls =
    tone === "pass"
      ? "border-emerald-600 bg-emerald-600 text-white"
      : tone === "fail"
        ? "border-rose-600 bg-rose-600 text-white"
        : "border-slate-600 bg-slate-600 text-white";
  const idleCls =
    tone === "pass"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "fail"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-slate-200 bg-slate-50 text-slate-600";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 items-center justify-center gap-1 rounded-xl border text-sm font-bold ${active ? activeCls : idleCls}`}
    >
      <Icon size={15} weight="bold" aria-hidden />
      {children}
    </button>
  );
}
