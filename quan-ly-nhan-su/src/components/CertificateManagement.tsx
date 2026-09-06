"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { CaretDown, MagnifyingGlass, Users } from "@/components/icons";
import {
  loadPersonnelCertificateRows,
  type PersonnelCertificateRow,
} from "@/lib/personnelCertificatesDb";
import {
  fetchCertificateGroups,
  type CertificateGroupOption,
} from "@/lib/trainingDb";
import { parseCertificateList } from "@/lib/weldingCertificates";

type CertHolder = {
  id: string;
  name: string;
  code: string;
  team: string;
  position: string;
};

type CertificateTypeRow = {
  key: string;
  title: string;
  holders: CertHolder[];
  fromCatalog: boolean;
};

function normalizeCertTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi")
    .replace(/\s+/g, " ")
    .trim();
}

function isWelderRow(row: PersonnelCertificateRow) {
  const position = row.chuc_vu?.toLocaleLowerCase("vi") ?? "";
  const team = row.to_han?.trim() ?? "";
  return position.includes("hàn") || (team !== "" && team !== "Chưa phân tổ");
}

export default function CertificateManagement() {
  const [personnelRows, setPersonnelRows] = useState<PersonnelCertificateRow[]>([]);
  const [catalogGroups, setCatalogGroups] = useState<CertificateGroupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    Promise.all([loadPersonnelCertificateRows(), fetchCertificateGroups().catch(() => [])])
      .then(([rows, groups]) => {
        if (!active) return;
        setPersonnelRows(rows);
        setCatalogGroups(groups);
      })
      .catch((error) => {
        if (!active) return;
        setPersonnelRows([]);
        setCatalogGroups([]);
        setLoadError(error instanceof Error ? error.message : "Không tải được dữ liệu chứng chỉ");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const welders = useMemo(() => personnelRows.filter(isWelderRow), [personnelRows]);

  const certificateTypes = useMemo((): CertificateTypeRow[] => {
    const map = new Map<string, CertificateTypeRow>();

    for (const group of catalogGroups) {
      const title = group.name.trim();
      if (!title) continue;
      const key = normalizeCertTitle(title);
      if (map.has(key)) continue;
      map.set(key, {
        key,
        title,
        holders: [],
        fromCatalog: true,
      });
    }

    for (const row of welders) {
      const certs = parseCertificateList(row.chung_chi);
      for (const titleRaw of certs) {
        const title = titleRaw.trim();
        if (!title) continue;
        const key = normalizeCertTitle(title);
        const holder: CertHolder = {
          id: row.employee_id,
          name: row.ho_ten,
          code: row.ma_nhan_su?.trim() || "Chưa có mã",
          team: row.to_han?.trim() || "Chưa phân tổ",
          position: row.chuc_vu?.trim() || "Thợ hàn",
        };
        const existing = map.get(key);
        if (existing) {
          if (!existing.holders.some((h) => h.id === holder.id)) {
            existing.holders.push(holder);
          }
          if (!existing.fromCatalog && title.length > existing.title.length) {
            existing.title = title;
          }
        } else {
          map.set(key, {
            key,
            title,
            holders: [holder],
            fromCatalog: false,
          });
        }
      }
    }

    return Array.from(map.values())
      .map((row) => ({
        ...row,
        holders: [...row.holders].sort((a, b) => a.name.localeCompare(b.name, "vi")),
      }))
      .sort(
        (a, b) =>
          b.holders.length - a.holders.length || a.title.localeCompare(b.title, "vi"),
      );
  }, [catalogGroups, welders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("vi");
    if (!q) return certificateTypes;
    return certificateTypes.filter((row) => {
      if (row.title.toLocaleLowerCase("vi").includes(q)) return true;
      return row.holders.some(
        (h) =>
          h.name.toLocaleLowerCase("vi").includes(q) ||
          h.code.toLocaleLowerCase("vi").includes(q),
      );
    });
  }, [certificateTypes, query]);

  const totalTypes = certificateTypes.length;
  const typesWithHolders = certificateTypes.filter((row) => row.holders.length > 0).length;
  const totalAssignments = certificateTypes.reduce((sum, row) => sum + row.holders.length, 0);
  const weldersWithCert = useMemo(() => {
    return welders.filter((row) => parseCertificateList(row.chung_chi).length > 0).length;
  }, [welders]);

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 pb-8">
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-[#0047AB]">
        Danh mục loại chứng chỉ · thống kê nhân sự từ{" "}
        <Link href="/ho-so-tho-han" className="font-bold underline underline-offset-2 hover:text-blue-800">
          Hồ sơ thợ hàn
        </Link>
        {" · "}không tạo ảnh mẫu
      </div>

      <div className="mb-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Loại chứng chỉ</div>
          <div className="mt-1.5 text-2xl font-bold font-mono text-slate-900">{totalTypes}</div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">Có nhân sự sở hữu</div>
          <div className="mt-1.5 text-2xl font-bold font-mono text-[#0047AB]">{typesWithHolders}</div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-600">Thợ hàn có chứng chỉ</div>
          <div className="mt-1.5 text-2xl font-bold font-mono text-emerald-700">
            {weldersWithCert}/{welders.length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Tổng lượt sở hữu</div>
          <div className="mt-1.5 text-2xl font-bold font-mono text-slate-900">{totalAssignments}</div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-xs">
        <div className="relative min-w-[220px] flex-1">
          <MagnifyingGlass
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm loại chứng chỉ hoặc tên / mã thợ hàn…"
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300/90 bg-white text-slate-900 placeholder:text-slate-400 shadow-xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <Link
          href="/ho-so-tho-han"
          className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Mở hồ sơ thợ hàn
        </Link>
      </div>

      {loadError && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">Đang tải loại chứng chỉ và nhân sự…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-400">
          Không tìm thấy loại chứng chỉ phù hợp.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
          <div className="table-scroll overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <th className="w-12 px-3.5 py-3">#</th>
                  <th className="min-w-[320px] px-3.5 py-3">Loại chứng chỉ</th>
                  <th className="px-3.5 py-3 text-right">Số nhân sự</th>
                  <th className="min-w-[280px] px-3.5 py-3">Nhân sự sở hữu</th>
                  <th className="w-12 px-2 py-3" aria-label="Mở rộng" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row, index) => {
                  const open = Boolean(expanded[row.key]);
                  const preview = row.holders.slice(0, 3);
                  const more = Math.max(0, row.holders.length - preview.length);
                  return (
                    <Fragment key={row.key}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-3.5 py-3 font-mono text-slate-400">{index + 1}</td>
                        <td className="px-3.5 py-3">
                          <div className="font-semibold text-slate-900 leading-snug">{row.title}</div>
                          {row.fromCatalog && row.holders.length === 0 ? (
                            <div className="mt-0.5 text-[11px] text-slate-400">Trong danh mục · chưa có thợ hàn</div>
                          ) : null}
                        </td>
                        <td className="px-3.5 py-3 text-right">
                          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-[#0047AB]">
                            <Users size={12} weight="bold" />
                            {row.holders.length}
                          </span>
                        </td>
                        <td className="px-3.5 py-3">
                          {row.holders.length === 0 ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <div className="text-slate-700">
                              {preview.map((h) => h.name).join(", ")}
                              {more > 0 ? (
                                <span className="text-slate-400"> +{more}</span>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-3">
                          {row.holders.length > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setExpanded((prev) => ({ ...prev, [row.key]: !prev[row.key] }))
                              }
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                              aria-label={open ? "Thu gọn" : "Xem nhân sự"}
                            >
                              <CaretDown
                                size={16}
                                weight="bold"
                                className={`transition-transform ${open ? "rotate-180" : ""}`}
                              />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={5} className="px-3.5 py-3">
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {row.holders.map((holder) => (
                                <Link
                                  key={holder.id}
                                  href={`/ho-so-tho-han?employeeId=${encodeURIComponent(holder.id)}`}
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 hover:border-[#0047AB]/40 hover:bg-blue-50/40 transition-colors"
                                >
                                  <div className="font-semibold text-slate-900">{holder.name}</div>
                                  <div className="mt-0.5 font-mono text-[11px] text-[#0047AB]">{holder.code}</div>
                                  <div className="mt-0.5 text-[11px] text-slate-500">
                                    {holder.position} · {holder.team}
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
