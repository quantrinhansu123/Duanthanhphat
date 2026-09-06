"use client";

import { useMemo, useState, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import {
  INITIAL_COMPLIANCE_STANDARDS,
  type ComplianceStandardItem,
  type ComplianceScope,
  type ComplianceStatus,
} from "@/data/complianceStandards";
import {
  loadQualityMetadata,
  mergeComplianceAssessments,
  saveComplianceAssessment,
} from "@/lib/qualityMetadataClient";

const STORAGE_KEY = "thanhphat_compliance_standards_v2";

export default function ComplianceStandardsList() {
  const { lang } = useLanguage();
  const isEn = lang === "en";

  const [items, setItems] = useState<ComplianceStandardItem[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore
        }
      }
    }
    return INITIAL_COMPLIANCE_STANDARDS;
  });

  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingItem, setEditingItem] = useState<ComplianceStandardItem | null>(null);
  const [persistenceError, setPersistenceError] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items]);

  useEffect(() => {
    let active = true;
    loadQualityMetadata()
      .then((result) => {
        if (!active) return;
        setItems(mergeComplianceAssessments(INITIAL_COMPLIANCE_STANDARDS, result.assessments));
        setPersistenceError("");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setPersistenceError(error instanceof Error ? error.message : "Không tải được đánh giá tiêu chuẩn từ Supabase.");
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (scopeFilter !== "all" && item.scope !== scopeFilter) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (q) {
        const text = `${item.standardCode} ${item.clause} ${item.title} ${item.requirement} ${item.relatedStandard} ${item.evidenceRequired} ${item.notes || ""}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, scopeFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = items.length;
    const passed = items.filter((i) => i.status === "Đạt").length;
    const partial = items.filter((i) => i.status === "Đáp ứng một phần").length;
    const missing = items.filter((i) => i.status === "Thiếu minh chứng" || i.status === "Chưa đánh giá").length;
    return { total, passed, partial, missing };
  }, [items]);

  async function handleSaveEdit(updated: ComplianceStandardItem) {
    if (
      updated.status === "Đạt" &&
      (!updated.evidenceDoc?.trim() || !updated.verifier?.trim() || !updated.verifiedAt)
    ) {
      window.alert(
        isEn
          ? "A passed assessment requires an evidence document, verifier, and verification date."
          : "Chỉ được đánh dấu Đạt khi đã nhập tài liệu minh chứng, người xác nhận và ngày xác nhận.",
      );
      return;
    }
    try {
      await saveComplianceAssessment(updated);
      setItems((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      setPersistenceError("");
      setEditingItem(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không lưu được đánh giá tiêu chuẩn.";
      setPersistenceError(message);
      window.alert(message);
    }
  }

  function statusBadge(status: ComplianceStatus) {
    switch (status) {
      case "Đạt":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {isEn ? "Compliant" : "Đạt"}
          </span>
        );
      case "Đáp ứng một phần":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-700 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {isEn ? "Partially Compliant" : "Đáp ứng một phần"}
          </span>
        );
      case "Thiếu minh chứng":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-xs font-bold text-rose-700 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            {isEn ? "Missing Evidence" : "Thiếu minh chứng"}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            {isEn ? "Not Assessed" : "Chưa đánh giá"}
          </span>
        );
    }
  }

  function scopeBadge(scope: ComplianceScope) {
    switch (scope) {
      case "Công ty":
        return (
          <span className="inline-flex items-center rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-bold text-[#0047AB]">
            🏢 {isEn ? "Company" : "Công ty"}
          </span>
        );
      case "Quy trình hàn":
        return (
          <span className="inline-flex items-center rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
            ⚡ {isEn ? "Welding Process" : "Quy trình hàn"}
          </span>
        );
      case "Thợ hàn":
        return (
          <span className="inline-flex items-center rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-bold text-purple-700">
            👷 {isEn ? "Welder Personnel" : "Thợ hàn"}
          </span>
        );
    }
  }

  return (
    <div className="mx-auto max-w-[1568px] px-4 sm:px-6 pb-12">
      {/* Header */}
      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
          {isEn ? "QUALITY & STANDARDS ASSURANCE" : "QUẢN LÝ CHẤT LƯỢNG & TIÊU CHUẨN"}
        </div>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900">
          {isEn ? "TCVN 13965 & ISO 9001 Compliance Tracking" : "Yêu cầu tiêu chuẩn & Minh chứng đáp ứng"}
        </h1>
        <p className="mt-1 text-sm text-slate-600 max-w-4xl">
          {isEn
            ? "Digitally track TCVN 13965-1/2:2024 and ISO 9001 quality criteria for contractor approval, welding procedure, welder qualification, and full traceability."
            : "Theo dõi đối chiếu các yêu cầu của TCVN 13965-1:2024, TCVN 13965-2:2024 và ISO 9001:2015 về phê duyệt nhà thầu, quy trình hàn, hồ sơ thợ hàn và truy xuất nguồn gốc mối hàn."}
        </p>
      </div>

      {persistenceError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Chưa đồng bộ được đánh giá tiêu chuẩn với Supabase: {persistenceError}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {isEn ? "Total Clauses" : "Tổng điều khoản"}
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold font-mono text-slate-900">
            {stats.total}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            TCVN 13965 & ISO 9001
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">
            {isEn ? "Compliant (Passed)" : "Đạt chuẩn"}
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold font-mono text-emerald-700">
            {stats.passed}
          </div>
          <div className="mt-1 text-xs text-emerald-600">
            {isEn ? "Full evidence verified" : "Đã có minh chứng & xác nhận"}
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-800">
            {isEn ? "Partially Compliant" : "Đáp ứng một phần"}
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold font-mono text-amber-700">
            {stats.partial}
          </div>
          <div className="mt-1 text-xs text-amber-600">
            {isEn ? "Ongoing completion" : "Đang bổ sung quy trình/minh chứng"}
          </div>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-rose-800">
            {isEn ? "Pending / Missing" : "Chưa đạt / Thiếu"}
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold font-mono text-rose-700">
            {stats.missing}
          </div>
          <div className="mt-1 text-xs text-rose-600">
            {isEn ? "Needs attention" : "Cần hoàn thiện hồ sơ"}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isEn ? "Search clause, standard code, title, requirements..." : "Tìm mã tiêu chuẩn, điều khoản, nội dung yêu cầu..."}
          className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
        />

        <select
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value)}
          aria-label={isEn ? "Filter by scope" : "Lọc theo phạm vi"}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] cursor-pointer"
        >
          <option value="all">{isEn ? "All Scopes" : "Tất cả phạm vi"}</option>
          <option value="Công ty">{isEn ? "Company" : "Công ty"}</option>
          <option value="Quy trình hàn">{isEn ? "Welding Process" : "Quy trình hàn"}</option>
          <option value="Thợ hàn">{isEn ? "Welder" : "Thợ hàn"}</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label={isEn ? "Filter by status" : "Lọc theo trạng thái"}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] cursor-pointer"
        >
          <option value="all">{isEn ? "All Statuses" : "Tất cả trạng thái"}</option>
          <option value="Đạt">{isEn ? "Compliant" : "Đạt"}</option>
          <option value="Đáp ứng một phần">{isEn ? "Partially Compliant" : "Đáp ứng một phần"}</option>
          <option value="Thiếu minh chứng">{isEn ? "Missing Evidence" : "Thiếu minh chứng"}</option>
          <option value="Chưa đánh giá">{isEn ? "Not Assessed" : "Chưa đánh giá"}</option>
        </select>
      </div>

      {/* Compliance Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
                <th className="p-3 whitespace-nowrap">{isEn ? "Standard & Clause" : "Tiêu chuẩn & Điều khoản"}</th>
                <th className="p-3 min-w-[220px]">{isEn ? "Requirement" : "Nội dung yêu cầu"}</th>
                <th className="p-3 whitespace-nowrap">{isEn ? "Scope" : "Phạm vi"}</th>
                <th className="p-3 min-w-[140px]">{isEn ? "Related ISO/Standard" : "Tiêu chuẩn đối chiếu"}</th>
                <th className="p-3 min-w-[200px]">{isEn ? "Evidence" : "Minh chứng đáp ứng"}</th>
                <th className="p-3 whitespace-nowrap">{isEn ? "Status" : "Trạng thái"}</th>
                <th className="p-3 min-w-[160px]">{isEn ? "Verification" : "Xác nhận"}</th>
                <th className="p-3 text-right whitespace-nowrap">{isEn ? "Action" : "Thao tác"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 align-top">
                    <div className="font-bold text-slate-900 font-mono text-xs">
                      {item.standardCode}
                    </div>
                    <div className="text-xs font-semibold text-[#0047AB] mt-0.5">
                      Điều {item.clause}
                    </div>
                  </td>

                  <td className="p-3 align-top">
                    <div className="font-bold text-slate-900 text-xs sm:text-sm">
                      {item.title}
                    </div>
                    <div className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {item.requirement}
                    </div>
                    {item.notes && (
                      <div className="mt-1.5 text-[11px] text-slate-500 italic bg-slate-50 p-1.5 rounded border border-slate-100">
                        💬 {item.notes}
                      </div>
                    )}
                  </td>

                  <td className="p-3 align-top whitespace-nowrap">
                    {scopeBadge(item.scope)}
                  </td>

                  <td className="p-3 align-top">
                    <span className="inline-block font-mono text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {item.relatedStandard}
                    </span>
                  </td>

                  <td className="p-3 align-top">
                    <div className="text-xs text-slate-800 leading-relaxed font-medium">
                      {item.evidenceRequired}
                    </div>
                    {item.evidenceDoc && (
                      <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#0047AB] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        📄 {item.evidenceDoc}
                      </div>
                    )}
                  </td>

                  <td className="p-3 align-top whitespace-nowrap">
                    {statusBadge(item.status)}
                  </td>

                  <td className="p-3 align-top text-xs text-slate-600">
                    {item.verifier ? (
                      <div>
                        <div className="font-semibold text-slate-900">{item.verifier}</div>
                        {item.verifiedAt && (
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {item.verifiedAt}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">{isEn ? "Not yet verified" : "Chưa có người ký duyệt"}</span>
                    )}
                  </td>

                  <td className="p-3 align-top text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setEditingItem(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] shadow-2xs transition-colors cursor-pointer"
                    >
                      ✏️ {isEn ? "Evaluate" : "Đánh giá"}
                    </button>
                  </td>
                </tr>
              ))}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-sm text-slate-500">
                    {isEn ? "No standard requirements match the criteria." : "Không có yêu cầu tiêu chuẩn nào phù hợp bộ lọc."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Evaluation Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
                  {editingItem.standardCode} — Điều {editingItem.clause}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {isEn ? "Update Compliance Evaluation" : "Cập nhật đánh giá tiêu chuẩn"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSaveEdit(editingItem);
              }}
              className="mt-4 space-y-4 text-xs sm:text-sm"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {isEn ? "Clause Title & Requirement" : "Tên & Nội dung yêu cầu"}
                </label>
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 text-xs text-slate-800">
                  <div className="font-bold text-slate-900">{editingItem.title}</div>
                  <div className="mt-1">{editingItem.requirement}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isEn ? "Compliance Status" : "Trạng thái đáp ứng"}
                  </label>
                  <select
                    value={editingItem.status}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        status: e.target.value as ComplianceStatus,
                      })
                    }
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-semibold text-slate-800 shadow-2xs outline-hidden focus:border-[#0047AB]"
                  >
                    <option value="Chưa đánh giá">{isEn ? "Not Assessed" : "Chưa đánh giá"}</option>
                    <option value="Thiếu minh chứng">{isEn ? "Missing Evidence" : "Thiếu minh chứng"}</option>
                    <option value="Đáp ứng một phần">{isEn ? "Partially Compliant" : "Đáp ứng một phần"}</option>
                    <option value="Đạt">{isEn ? "Compliant (Passed)" : "Đạt"}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isEn ? "Scope" : "Phạm vi áp dụng"}
                  </label>
                  <select
                    value={editingItem.scope}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        scope: e.target.value as ComplianceScope,
                      })
                    }
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-800 shadow-2xs outline-hidden focus:border-[#0047AB]"
                  >
                    <option value="Công ty">{isEn ? "Company" : "Công ty"}</option>
                    <option value="Quy trình hàn">{isEn ? "Welding Process" : "Quy trình hàn"}</option>
                    <option value="Thợ hàn">{isEn ? "Welder" : "Thợ hàn"}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {isEn ? "Evidence Document / Ref" : "Tài liệu minh chứng đính kèm"}
                </label>
                <input
                  type="text"
                  value={editingItem.evidenceDoc || ""}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, evidenceDoc: e.target.value })
                  }
                  placeholder="Tên file tài liệu minh chứng (PDF)..."
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isEn ? "Verifier Person / Role" : "Người xác nhận"}
                  </label>
                  <input
                    type="text"
                    value={editingItem.verifier || ""}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, verifier: e.target.value })
                    }
                    placeholder="Nguyễn Đắc Công (Admin)"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isEn ? "Verification Date" : "Ngày xác nhận"}
                  </label>
                  <input
                    type="date"
                    value={editingItem.verifiedAt || ""}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, verifiedAt: e.target.value })
                    }
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {isEn ? "Assessment Notes" : "Ghi chú đánh giá"}
                </label>
                <textarea
                  rows={2}
                  value={editingItem.notes || ""}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, notes: e.target.value })
                  }
                  placeholder="Ghi chú chi tiết kết quả đánh giá và điều kiện..."
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {isEn ? "Cancel" : "Hủy"}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#0047AB] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 shadow-xs cursor-pointer"
                >
                  {isEn ? "Save Evaluation" : "Lưu đánh giá"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
