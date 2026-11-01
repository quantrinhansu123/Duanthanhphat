"use client";

import { useEffect, useMemo, useState } from "react";
import { loadProjects } from "@/lib/projectsDb";
import type { Project } from "@/data/projects";
import { GEOMETRY_CRITERIA, GEOMETRY_LABELS, type QualityRuleSync, type SavedWeldQualityRule } from "@/lib/weldQuality";
import { notifyWeldQualityChanged, qualityRequest } from "@/lib/weldQualityClient";
import WeldQualityRuleForm from "@/components/WeldQualityRuleForm";

const WELD_TECHS = ["FBW", "ATW"] as const;
const WELD_TYPES = ["Đào tạo", "Thử nghiệm", "Chấp thuận", "Sản xuất", "Tần suất"] as const;

const selectCls = "mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
const primary = "min-h-11 rounded-lg border border-blue-700 bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50";

function formatLimit(rule: SavedWeldQualityRule, key: (typeof GEOMETRY_CRITERIA)[number]) {
  const limit = rule.dung_sai[key];
  if (!limit) return "—";
  const lo = limit.min == null ? "…" : `${limit.minInclusive ? "≥" : ">"} ${limit.min}`;
  const hi = limit.max == null ? "…" : `${limit.maxInclusive ? "≤" : "<"} ${limit.max}`;
  return `${lo} · ${hi} mm`;
}

export default function WeldQualityCriteriaPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [tech, setTech] = useState<(typeof WELD_TECHS)[number]>("FBW");
  const [weldType, setWeldType] = useState<(typeof WELD_TYPES)[number]>("Sản xuất");
  const [rules, setRules] = useState<SavedWeldQualityRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [setup, setSetup] = useState(false);
  const [message, setMessage] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    void loadProjects({ includeProgress: false }).then((result) => {
      setProjects(result.projects);
      let target: { projectId?: string; tech?: string; weldType?: string } = {};
      try { target = JSON.parse(sessionStorage.getItem("weld-quality-rule-target") ?? "{}"); sessionStorage.removeItem("weld-quality-rule-target"); } catch { /* optional context */ }
      setProjectId((current) => current || (result.projects.some((p) => p.id === target.projectId) ? target.projectId! : result.projects[0]?.id) || "");
      if ((WELD_TECHS as readonly string[]).includes(target.tech ?? "")) setTech(target.tech as typeof tech);
      if ((WELD_TYPES as readonly string[]).includes(target.weldType ?? "")) setWeldType(target.weldType as typeof weldType);
    }).catch((err) => setError(err instanceof Error ? err.message : "Không tải được danh sách dự án."));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    setLoading(true);
    setError("");
    setSetup(false);
    qualityRequest<{ rules: SavedWeldQualityRule[] }>({ action: "rules-list", du_an_id: projectId })
      .then((data) => { if (active) setRules(data.rules); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Không tải được tiêu chí."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId]);

  const project = projects.find((p) => p.id === projectId);
  const groupRules = useMemo(
    () => rules.filter((r) => r.cong_nghe_han === tech && r.loai_moi_han === weldType),
    [rules, tech, weldType],
  );
  const active = groupRules.find((r) => r.dang_ap_dung) ?? null;
  const missingMai = Boolean(active && !active.dung_sai?.chieu_dai_mai);
  function syncMessage(sync: QualityRuleSync) {
    return `Đã cập nhật ${sync.cap_nhat} mối. ${sync.dang_dung_tieu_chi} mối đang dùng tiêu chí này; giữ phiên bản của ${sync.giu_nguyen_ho_so} mối đã chốt hồ sơ.`;
  }
  async function syncOpenWelds() {
    if (!active) return;
    setSyncing(true); setError(""); setMessage("");
    try {
      const result = await qualityRequest<{ sync: QualityRuleSync }>({ action: "rule-sync", id: active.id });
      setMessage(syncMessage(result.sync)); notifyWeldQualityChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "Không đồng bộ được tiêu chí."); }
    finally { setSyncing(false); }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-5">
      <header>
        <h1 className="text-xl font-bold text-slate-900">Tiêu chí nghiệm thu mối hàn</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cài đặt dung sai theo dự án · công nghệ · loại mối. Nhật ký hàn chỉ chọn tiêu chí đã thiết lập tại đây.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <label className="text-sm font-semibold">
          Dự án
          <select aria-label="Dự án" className={selectCls} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {!projects.length && <option value="">Chưa có dự án</option>}
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Công nghệ
          <select aria-label="Công nghệ" className={selectCls} value={tech} onChange={(e) => setTech(e.target.value as typeof tech)}>
            {WELD_TECHS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Loại mối
          <select aria-label="Loại mối" className={selectCls} value={weldType} onChange={(e) => setWeldType(e.target.value as typeof weldType)}>
            {WELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {loading && <p className="text-sm text-slate-600">Đang tải tiêu chí…</p>}

      {!loading && projectId && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900">{tech} · {weldType}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {active
                  ? `Đang áp dụng: ${active.ten} · v${active.phien_ban}`
                  : "Chưa có tiêu chí đang áp dụng cho nhóm này."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {active && !setup && <button type="button" disabled={syncing} onClick={() => void syncOpenWelds()} className="min-h-11 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50">{syncing ? "Đang đồng bộ…" : "Áp dụng cho mối chưa chốt"}</button>}
              {active && (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                  Đã cài đặt
                </span>
              )}
              {!setup && (
                <button type="button" className={primary} disabled={syncing} onClick={() => { setMessage(""); setSetup(true); }}>
                  {active ? "Tạo phiên bản mới" : "Thiết lập tiêu chí"}
                </button>
              )}
            </div>
          </div>

          {missingMai && !setup && (
            <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              Tiêu chí đang thiếu <b>Chiều dài mài hoàn thiện</b>. Nguyên nhân thường gặp: chưa chạy migration
              {" "}<code className="rounded bg-amber-100 px-1">migration_20261101_chieu_dai_mai.sql</code>
              {" "}trên Supabase, nên dữ liệu cũ chỉ có 4 chỉ tiêu. Bấm <b>Tạo phiên bản mới</b> sau khi đã chạy SQL
              (mặc định ≤ 800 mm).
            </p>
          )}

          {active && (
            <div className="mt-4 space-y-2">
              {GEOMETRY_CRITERIA.map((k) => {
                const missing = !active.dung_sai[k];
                return (
                  <div
                    key={k}
                    className={`flex flex-wrap items-baseline justify-between gap-2 rounded-lg px-3 py-2 text-sm ${missing ? "border border-amber-200 bg-amber-50" : "bg-slate-50"}`}
                  >
                    <span className="font-medium text-slate-800">{GEOMETRY_LABELS[k]}</span>
                    <span className={`font-mono ${missing ? "font-semibold text-amber-800" : "text-slate-600"}`}>
                      {missing ? "Chưa có trong tiêu chí" : formatLimit(active, k)}
                    </span>
                  </div>
                );
              })}
              <p className="pt-1 text-xs text-slate-500">
                NDT: {active.yeu_cau_ndt ? "Bắt buộc" : `Miễn — ${active.can_cu_mien_ndt ?? ""}`}
                {active.ndt_truoc_rfi ? " · NDT đạt trước RFI" : ""}
              </p>
            </div>
          )}

          {groupRules.length > 1 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-semibold text-slate-700">Lịch sử phiên bản ({groupRules.length})</summary>
              <ul className="mt-2 space-y-1 text-slate-600">
                {groupRules.map((r) => (
                  <li key={r.id}>
                    v{r.phien_ban} · {r.ten}{r.dang_ap_dung ? " · đang áp dụng" : ""}
                    {!r.dung_sai?.chieu_dai_mai ? " · thiếu chiều dài mài" : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {setup && project && (
            <div className="mt-4">
              <WeldQualityRuleForm
                target={{
                  du_an_id: project.id,
                  du_an: project.name,
                  cong_nghe_han: tech,
                  loai_moi_han: weldType,
                }}
                seed={active}
                onCancel={() => setSetup(false)}
                onCreated={(rule, sync) => {
                  setRules((current) => [
                    rule,
                    ...current.map((r) => (r.cong_nghe_han === rule.cong_nghe_han && r.loai_moi_han === rule.loai_moi_han && r.du_an_id === rule.du_an_id ? { ...r, dang_ap_dung: false } : r)),
                  ]);
                  setSetup(false);
                  setMessage(`Đã lưu ${rule.ten} · v${rule.phien_ban}. ${syncMessage(sync)}`);
                }}
              />
            </div>
          )}
        </section>
      )}

      {!setup && active && (
        <p className="text-xs text-slate-500">
          Mỗi nhóm chỉ một tiêu chí đang áp dụng. Mối chưa chốt tự chuyển sang bản mới khi lưu; hồ sơ đã nghiệm thu giữ nguyên phiên bản đã dùng.
        </p>
      )}
    </div>
  );
}
