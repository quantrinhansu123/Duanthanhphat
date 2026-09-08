"use client";

import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlass } from "@/components/icons";
import {
  loadJournalProjectOptions,
  loadWeldJournalPage,
  type WeldReportRow,
} from "@/lib/weldReportData";
import { hasCertificate } from "@/lib/weldingCertificates";

const PAGE_SIZE = 100;

const weldTypeStyle: Record<WeldReportRow["loai_moi_han"], string> = {
  "Thử nghiệm": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
  "Đào tạo": "bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs",
  "Sản xuất": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
};

type WeldPersonnel = {
  id: string;
  name: string;
  code: string;
};

type WeldComboGroup = {
  key: string;
  cong_nghe_han: WeldReportRow["cong_nghe_han"];
  loai_ray: string;
  loai_moi_han: WeldReportRow["loai_moi_han"];
  personnel: WeldPersonnel[];
  certificates: { title: string; linked: boolean }[];
  projects: string[];
  rowCount: number;
};

function uniquePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase("vi");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function groupRowsByCombo(rows: WeldReportRow[]): WeldComboGroup[] {
  const map = new Map<string, WeldReportRow[]>();
  for (const row of rows) {
    const key = [row.cong_nghe_han, row.loai_ray, row.loai_moi_han].join("||");
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }

  return Array.from(map.entries())
    .map(([key, groupRows]) => {
      const first = groupRows[0];
      const personnelById = new Map<string, WeldPersonnel>();
      for (const row of groupRows) {
        const name = row.ten_tho_han?.trim() || "Chưa cập nhật";
        const code = row.ma_nhan_su?.trim() || "";
        const id = `${code.toLocaleLowerCase("vi")}::${name.toLocaleLowerCase("vi")}`;
        if (!personnelById.has(id)) personnelById.set(id, { id, name, code });
      }

      const certMap = new Map<string, { title: string; linked: boolean }>();
      for (const row of groupRows) {
        const title = row.chung_chi_su_dung?.trim() || "Chưa ghi chứng chỉ sử dụng";
        const keyCert = title.toLocaleLowerCase("vi");
        if (certMap.has(keyCert)) continue;
        const linked =
          Boolean(row.chung_chi_su_dung?.trim()) &&
          hasCertificate(row.chung_chi_nhan_su, row.chung_chi_su_dung ?? "");
        certMap.set(keyCert, { title, linked });
      }

      return {
        key,
        createdAt: groupRows.reduce(
          (latest, row) => row.created_at && row.created_at > latest ? row.created_at : latest,
          "",
        ),
        cong_nghe_han: first.cong_nghe_han,
        loai_ray: first.loai_ray,
        loai_moi_han: first.loai_moi_han,
        personnel: Array.from(personnelById.values()).sort((a, b) => a.name.localeCompare(b.name, "vi")),
        certificates: Array.from(certMap.values()),
        projects: uniquePreserveOrder(groupRows.map((row) => row.du_an || "")),
        rowCount: groupRows.length,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.key.localeCompare(a.key));
}

export default function WeldJointManagement() {
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [project, setProject] = useState("Tất cả dự án");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<WeldReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [projects, setProjects] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setAppliedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    loadJournalProjectOptions()
      .then((options) => {
        if (active) setProjects(options);
      })
      .catch(() => {
        if (active) setProjects([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    loadWeldJournalPage({ page, pageSize: PAGE_SIZE, query: appliedQuery, project })
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setTotal(result.total);
      })
      .catch((loadError) => {
        if (!active) return;
        setRows([]);
        setTotal(0);
        setError(loadError instanceof Error ? loadError.message : "Không tải được danh sách mối hàn");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, appliedQuery, project]);

  useEffect(() => setPage(1), [appliedQuery, project]);

  const comboGroups = useMemo(() => groupRowsByCombo(rows), [rows]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageFrom = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageTo = Math.min(currentPage * PAGE_SIZE, total);
  const allowedPersonnelCount = useMemo(
    () => comboGroups.reduce((sum, group) => sum + group.personnel.length, 0),
    [comboGroups],
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <main className="w-full px-4 sm:px-6 pb-8">
      <div
        className={`mb-4 rounded-lg border px-3 py-2 text-xs font-medium ${
          error
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-blue-200 bg-blue-50 text-[#0047AB]"
        }`}
      >
        {error
          ? `Không tải được dữ liệu: ${error}`
          : loading
            ? "Đang tải danh sách mối hàn…"
            : `Nhân sự hiển thị là người trực tiếp hàn trong nhật ký · ${comboGroups.length.toLocaleString("vi-VN")} tổ hợp trên trang`}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-slate-600">
        <span>
          <strong className="font-mono font-semibold text-slate-900">{total.toLocaleString("vi-VN")}</strong>{" "}
          mối hàn nguồn
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <strong className="font-mono text-[#0047AB]">{comboGroups.length}</strong> tổ hợp
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <strong className="font-mono text-emerald-700">{allowedPersonnelCount}</strong> lượt nhân sự trực tiếp hàn
        </span>
      </div>

      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row">
        <div className="relative min-w-[260px] flex-1">
          <MagnifyingGlass
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm nhân sự, công nghệ, loại ray, chứng chỉ, dự án…"
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:text-sm"
          />
        </div>
        <select
          value={project}
          onChange={(event) => setProject(event.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:text-sm"
        >
          <option>Tất cả dự án</option>
          {projects.map((item) => (
            <option key={item.id} value={item.label}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="min-w-[90px] px-3.5 py-3">Công nghệ</th>
                <th className="min-w-[120px] px-3.5 py-3">Loại ray</th>
                <th className="min-w-[120px] px-3.5 py-3">Loại mối</th>
                <th className="min-w-[260px] px-3.5 py-3">Người trực tiếp hàn (từ nhật ký)</th>
                <th className="min-w-[280px] px-3.5 py-3">Chứng chỉ sử dụng</th>
                <th className="min-w-[220px] px-3.5 py-3">Dự án</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comboGroups.map((group) => (
                <tr key={group.key} className="align-top transition-colors hover:bg-slate-50/80">
                  <td className="px-3.5 py-3">
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#0047AB]">
                      {group.cong_nghe_han}
                    </span>
                    <div className="mt-1.5 text-[11px] text-slate-400 font-mono">
                      {group.rowCount} dòng
                    </div>
                  </td>
                  <td className="px-3.5 py-3 font-mono font-semibold text-slate-800">{group.loai_ray}</td>
                  <td className="px-3.5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${weldTypeStyle[group.loai_moi_han]}`}
                    >
                      {group.loai_moi_han}
                    </span>
                  </td>
                  <td className="px-3.5 py-3">
                    {group.personnel.length === 0 ? (
                      <div className="text-xs text-amber-700">Chưa ghi nhận người trực tiếp hàn.</div>
                    ) : (
                      <div className="space-y-2">
                        {group.personnel.map((person) => (
                          <div key={person.id} className="leading-snug">
                            <div className="font-semibold text-slate-900">{person.name}</div>
                            {person.code ? (
                              <div className="mt-0.5 font-mono text-[11px] text-[#0047AB]">{person.code}</div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3.5 py-3">
                    <div className="space-y-1.5">
                      {group.certificates.map((cert) => (
                        <div
                          key={cert.title}
                          className={`text-xs font-medium leading-snug ${
                            cert.linked ? "text-emerald-700" : "text-amber-700"
                          }`}
                        >
                          {cert.title}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-3.5 py-3">
                    <div className="space-y-1.5">
                      {group.projects.map((projectName) => (
                        <div key={projectName} className="leading-snug text-slate-800" title={projectName}>
                          {projectName}
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && comboGroups.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                    Không có tổ hợp mối hàn phù hợp.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                    Đang tải dữ liệu…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <div className="text-xs text-slate-500">
            Nguồn <strong>{pageFrom}–{pageTo}</strong> / {total.toLocaleString("vi-VN")} ·{" "}
            <strong>{comboGroups.length}</strong> tổ hợp · Trang {currentPage}/{totalPages}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentPage <= 1 || loading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-40"
            >
              Trước
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages || loading}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
