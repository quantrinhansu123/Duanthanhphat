"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "@/components/icons";
import WeldQualityBadge from "@/components/WeldQualityBadge";
import WeldQualityRuleSelect from "@/components/WeldQualityRuleSelect";
import { GEOMETRY_CRITERIA, GEOMETRY_LABELS, deviationMaximum, emptyWeldInspection, evaluateGeometryCriterion, evaluateWeldQuality, isOptionalUntilMeasured, parseWeldMeasurement,
  type GeometryCriterion, type SavedWeldInspection, type SavedWeldQualityRule } from "@/lib/weldQuality";
import { loadQualityInspection, saveQualityInspection } from "@/lib/weldQualityClient";
import type { WeldReportRow } from "@/lib/weldReportData";

const input = "mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 sm:text-sm";
const buttonBase = "min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50";
const button = `${buttonBase} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
const primary = `${buttonBase} border-blue-700 bg-blue-700 text-white hover:bg-blue-800`;

/** Chỉ giữ số đo thật; ô trống phải là undefined để gợi ý mức tối đa hoạt động. */
function numbersFromMeasurements(values: Partial<Record<GeometryCriterion, number | null>>): Partial<Record<GeometryCriterion, string>> {
  const next: Partial<Record<GeometryCriterion, string>> = {};
  for (const key of GEOMETRY_CRITERIA) {
    const value = values[key];
    if (value != null) next[key] = String(value);
  }
  return next;
}

export default function WeldQualityDialog({ row, onClose, onSaved }: { row: WeldReportRow; onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<SavedWeldInspection | null>(null);
  const [numbers, setNumbers] = useState<Partial<Record<GeometryCriterion, string>>>({});
  const [suggestMax, setSuggestMax] = useState(false);
  const [rules, setRules] = useState<SavedWeldQualityRule[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [pendingSignature, setPendingSignature] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    loadQualityInspection(row.id).then((data) => {
      if (!active) return;
      const inspection = data.inspection ?? emptyWeldInspection(row.id);
      let next = inspection;
      // Mối chưa có tiêu chí tự chọn bản hiện hành trong đúng nhóm, không phụ thuộc máy người dùng.
      if (!inspection.tieu_chuan_id) {
        const current = data.rules.find((r) => r.dang_ap_dung);
        if (current) next = { ...inspection, tieu_chuan_id: current.id };
      }
      setDraft(next);
      setSuggestMax(false);
      setNumbers(numbersFromMeasurements(inspection.gia_tri_do));
      setRules(data.rules);
      setAccepted(data.summary.tinh_trang === "Đạt");
      setPendingSignature(data.summary.tinh_trang === "Chờ ký biên bản");
    }).catch((e) => { if (active) setError(e instanceof Error ? e.message : "Không tải được kiểm tra."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [row.id, row.du_an_id, reload]);
  const rule = rules.find((r) => r.id === draft?.tieu_chuan_id) ?? null;
  const suggested = (key: GeometryCriterion) => suggestMax && draft?.ngay_mai && draft.truc_quan === "Đạt" && numbers[key] === undefined
    ? deviationMaximum(key, rule?.dung_sai) : null;
  function confirmVisual(value: SavedWeldInspection["truc_quan"]) {
    if (!draft) return;
    setSuggestMax(value === "Đạt");
    if (value === "Đạt") setNumbers((old) => Object.fromEntries(Object.entries(old).filter(([, v]) => v?.trim())));
    setDraft({ ...draft, truc_quan: value, xu_ly_truc_quan: value === "Không đạt" ? draft.xu_ly_truc_quan ?? "sua_chua" : null });
  }
  const parseErrors: Partial<Record<GeometryCriterion, string>> = {};
  const measurements = Object.fromEntries(GEOMETRY_CRITERIA.map((k) => {
    try { return [k, parseWeldMeasurement(numbers[k] ?? suggested(k))]; }
    catch { parseErrors[k] = "Nhập số đo mm hợp lệ, ví dụ -0,10 hoặc 0,20."; return [k, null]; }
  }));
  const assessment = draft ? evaluateWeldQuality({ ...draft, gia_tri_do: measurements }, rule, row.loai_moi_han, accepted, pendingSignature) : null;
  const blocked = accepted || row.so_luong_thuc_hien !== 1;
  const currentRule = rules.find((r) => r.dang_ap_dung);
  function configureRules() {
    onClose();
    try { sessionStorage.setItem("weld-quality-rule-target", JSON.stringify({ projectId: row.du_an_id, tech: row.cong_nghe_han, weldType: row.loai_moi_han })); } catch { /* storage optional */ }
    window.dispatchEvent(new CustomEvent("app-navigate", { detail: { tab: "tieu-chi-nghiem-thu" } }));
  }
  return <dialog ref={dialog} aria-labelledby="weld-quality-title" onClose={onClose} onCancel={(e) => { if (saving) e.preventDefault(); }}
    className="m-auto max-h-[92dvh] w-[calc(100%_-_1.5rem)] max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50">
    <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 sm:p-5">
      <div><h2 id="weld-quality-title" className="text-lg font-bold">Kiểm tra chất lượng mối hàn</h2><p className="mt-1 break-words text-sm text-slate-600">{row.ma_lich_su} · {row.du_an}</p></div>
      <button type="button" onClick={onClose} disabled={saving} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600" aria-label="Đóng kiểm tra chất lượng"><X size={20} aria-hidden /></button>
    </header>
    <div className="p-4 sm:p-5">
      {loading && <p role="status" className="py-8 text-center text-sm text-slate-600">Đang tải dữ liệu kiểm tra…</p>}
      {error && <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}<button type="button" className="ml-2 font-semibold underline" disabled={saving} onClick={() => setReload((n) => n + 1)}>Tải lại dữ liệu</button></div>}
      {draft && !loading && <>
        <div className="mb-4 flex flex-wrap items-center gap-3"><WeldQualityBadge status={assessment?.status} /><span className="text-xs text-slate-500">Phiên bản kiểm tra: {draft.phien_ban || "Chưa ghi nhận"}</span></div>
        {blocked && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{accepted ? "Mối đã nghiệm thu. Cần lập bản sửa đổi trước khi thay đổi kiểm tra." : "Đây là bản ghi khối lượng tổng hợp. Cần tách và xác minh từng mối trước khi kiểm tra."}</p>}
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (Object.keys(parseErrors).length) { setError("Hãy sửa các số đo không hợp lệ."); return; }
          setSaving(true); setError(""); setMessage("");
          try {
            const saved = await saveQualityInspection({ ...draft, gia_tri_do: measurements });
            if (saved.tieu_chuan_id) {
              try { window.localStorage.setItem(`weld-quality-last-rule:${row.du_an_id}`, saved.tieu_chuan_id); } catch { /* ignore */ }
            }
            setNumbers(numbersFromMeasurements(saved.gia_tri_do));
            setSuggestMax(false); setDraft(saved); setMessage("Đã lưu kiểm tra. Tình trạng được tính từ kết quả thực tế."); onSaved();
          } catch (err) { setError(err instanceof Error ? err.message : "Không lưu được kiểm tra."); }
          finally { setSaving(false); }
        }}>
          <fieldset disabled={saving || blocked} className="space-y-5">
            <WeldQualityRuleSelect value={draft.tieu_chuan_id} rules={rules} group={`${row.cong_nghe_han} · ${row.loai_moi_han}`} disabled={saving || blocked}
              onChange={(id) => setDraft({ ...draft, tieu_chuan_id: id })} onConfigure={configureRules} />
            {!blocked && currentRule && rule && currentRule.id !== rule.id && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
              Nhóm này đang áp dụng <b>{currentRule.ten} · v{currentRule.phien_ban}</b>. Mối đang lưu theo <b>{rule.ten} · v{rule.phien_ban}</b>.
              <button type="button" onClick={() => setDraft({ ...draft, tieu_chuan_id: currentRule.id })} className="mt-2 block min-h-11 rounded-lg border border-blue-200 bg-white px-3 font-semibold text-blue-700">Dùng tiêu chí hiện hành</button>
            </div>}
            {!rule && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Chưa có tiêu chí áp dụng cho nhóm {row.cong_nghe_han} · {row.loai_moi_han}. Cài đặt tại{" "}
                <button
                  type="button"
                  className="font-semibold underline"
                  onClick={configureRules}
                >
                  Quản lý chất lượng → Tiêu chí nghiệm thu
                </button>
                . Có thể lưu kết quả đo; chưa đủ căn cứ để kết luận hình học đạt hoặc phát RFI.
              </p>
            )}
            {rule && !rule.dung_sai.chieu_dai_mai && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Tiêu chí đang chọn thiếu <b>Chiều dài mài hoàn thiện</b> (dữ liệu cũ / chưa backfill). Cập nhật tại{" "}
                <button
                  type="button"
                  className="font-semibold underline"
                  onClick={() => {
                    onClose();
                    window.dispatchEvent(new CustomEvent("app-navigate", { detail: { tab: "tieu-chi-nghiem-thu" } }));
                  }}
                >
                  Tiêu chí nghiệm thu
                </button>
                {" "}(Tạo phiên bản mới sau khi chạy migration).
              </p>
            )}
            <section className="rounded-xl border border-slate-200 p-4"><h3 className="font-bold">1. Kiểm tra sau mài</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Ngày hoàn thành mài<input type="date" className={input} value={draft.ngay_mai ?? ""} onChange={(e) => setDraft({ ...draft, ngay_mai: e.target.value || null })} /></label>
                <label className="text-sm font-semibold">Kiểm tra trực quan<select className={input} value={draft.truc_quan ?? ""} onChange={(e) => confirmVisual((e.target.value as SavedWeldInspection["truc_quan"]) || null)}><option value="">Chưa kiểm tra</option><option value="Đạt">Đạt</option><option value="Không đạt">Không đạt</option></select></label></div>
              {draft.truc_quan === "Không đạt" || assessment?.geometry === "Không đạt" ? (
                <fieldset className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                  <legend className="px-1 text-sm font-semibold text-amber-950">Xử lý khi trực quan / độ lệch không đạt</legend>
                  <div className="mt-1 flex flex-col gap-2 text-sm">
                    <label className="flex min-h-11 items-center gap-2"><input type="radio" name="xu-ly-tq" checked={(draft.xu_ly_truc_quan ?? "sua_chua") === "sua_chua"} onChange={() => setDraft({ ...draft, xu_ly_truc_quan: "sua_chua", ly_do_loai_nghiem_thu: null })} />Sửa chữa / khắc phục</label>
                    <label className="flex min-h-11 items-center gap-2"><input type="radio" name="xu-ly-tq" checked={draft.xu_ly_truc_quan === "khong_dat"} onChange={() => setDraft({ ...draft, xu_ly_truc_quan: "khong_dat" })} />Không đạt (chủ sở hữu quyết định)</label>
                  </div>
                </fieldset>
              ) : null}
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {GEOMETRY_CRITERIA.map((k) => {
                  const limit = rule?.dung_sai[k] ?? null;
                  const outcome = evaluateGeometryCriterion(measurements[k], limit);
                  return (
                    <div key={k} className="min-w-0 rounded-lg border border-slate-200/80 bg-slate-50 p-3">
                      <label htmlFor={`measure-${k}`} className="block text-sm font-semibold leading-snug text-slate-900">
                        {GEOMETRY_LABELS[k]} <span className="font-medium text-slate-500">(mm)</span>
                      </label>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          id={`measure-${k}`}
                          inputMode="decimal"
                          className={`${input} min-w-0 flex-1`}
                          value={numbers[k] ?? suggested(k) ?? ""}
                          aria-invalid={Boolean(parseErrors[k])}
                          aria-describedby={`measure-help-${k}`}
                          onChange={(e) => setNumbers({ ...numbers, [k]: e.target.value })}
                        />
                        <span
                          className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${
                            outcome === "Không đạt" ? "bg-rose-100 text-rose-800"
                              : outcome === "Đạt" ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-200/70 text-slate-600"
                          }`}
                        >
                          {parseErrors[k] ? "Không hợp lệ" : outcome ?? "Chưa đủ"}
                        </span>
                      </div>
                      <p id={`measure-help-${k}`} className={`mt-1.5 text-[11px] leading-snug ${parseErrors[k] ? "text-rose-700" : "text-slate-500"}`}>
                        {suggested(k) != null && "Tự điền mức tối đa · đối chiếu số đo trước khi lưu. "}{parseErrors[k] ?? (limit
                          ? `Giới hạn: ${limit.min === null ? "…" : `${limit.minInclusive ? "≥" : ">"} ${limit.min}`} ; ${limit.max === null ? "…" : `${limit.maxInclusive ? "≤" : "<"} ${limit.max}`} mm${isOptionalUntilMeasured(k) && measurements[k] == null ? " · chưa nhập: chưa chặn RFI; bắt buộc trước Đạt" : ""}`
                          : "Chưa chọn giới hạn. Ô trống khác số 0.")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 p-4">
              <h3 className="font-bold">2. Kiểm tra không phá huỷ (NDT)</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-sm font-semibold">Phương pháp
                  <select className={input} value={draft.phuong_phap_ndt} onChange={(e) => setDraft({ ...draft, phuong_phap_ndt: e.target.value as SavedWeldInspection["phuong_phap_ndt"] })}>
                    <option value="Siêu âm">Siêu âm</option>
                    <option value="Từ tính">Từ tính</option>
                    <option value="Thẩm thấu">Thẩm thấu</option>
                  </select>
                </label>
                <label className="text-sm font-semibold">Ngày thí nghiệm
                  <input type="date" className={input} value={draft.ngay_ndt ?? ""} onChange={(e) => setDraft({ ...draft, ngay_ndt: e.target.value || null })} />
                </label>
                <label className="text-sm font-semibold sm:col-span-2 lg:col-span-1">Kết quả NDT
                  <select className={input} value={draft.ket_qua_ndt ?? ""} onChange={(e) => setDraft({ ...draft, ket_qua_ndt: e.target.value as SavedWeldInspection["ket_qua_ndt"] || null })}>
                    <option value="">Chưa kiểm tra</option>
                    <option value="Đạt">Đạt</option>
                    <option value="Không đạt">Không đạt</option>
                  </select>
                </label>
              </div>
              <p className="mt-3 text-xs text-slate-600">NDT/siêu âm thực hiện tại hiện trường khi nghiệm thu, có TVGS chứng kiến — sau khi phát RFI, không cần có trước. NDT đạt chưa phải nghiệm thu đạt. {rule && !rule.yeu_cau_ndt ? `Miễn NDT theo: ${rule.can_cu_mien_ndt}` : "Chỉ kết luận nghiệm thu khi đủ tiêu chí và hoàn thành đợt nghiệm thu."}</p>
            </section>
            {draft.ly_do_loai_nghiem_thu && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><p>Lỗi tại nghiệm thu: {draft.ly_do_loai_nghiem_thu}</p><label className="mt-2 flex min-h-11 items-center gap-2"><input type="checkbox" onChange={(e) => { if (e.target.checked) setDraft({ ...draft, ly_do_loai_nghiem_thu: null }); }} />Đã khắc phục và kiểm tra lại; xóa cờ lỗi hiện tại khi lưu</label></div>}
            <label className="block text-sm font-semibold">Ghi chú kiểm tra<textarea className={input} rows={2} maxLength={4000} value={draft.ghi_chu ?? ""} onChange={(e) => setDraft({ ...draft, ghi_chu: e.target.value })} /></label>
          </fieldset>
          <p className="mt-4 text-sm text-slate-600" role="status">{accepted ? "Mối đã nghiệm thu đạt; không lập yêu cầu nghiệm thu trùng." : assessment?.rfiEligible ? "Đủ điều kiện phát RFI theo tiêu chí đang chọn." : `Chưa đủ điều kiện phát RFI: ${!rule ? "chưa chọn tiêu chí" : assessment?.status === "Không đạt" ? "còn chỉ tiêu không đạt" : !draft.ngay_mai ? "chưa ghi ngày mài" : draft.truc_quan !== "Đạt" ? "trực quan chưa đạt" : assessment?.geometry !== "Đạt" ? "thiếu số đo hoặc hình học chưa đạt" : "chưa đủ tiêu chí kiểm tra"}.`}</p>
          {message && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
          <div className="mt-5 flex flex-wrap gap-2"><button disabled={saving || blocked} className={primary}>{saving ? "Đang lưu…" : "Lưu kiểm tra"}</button><button type="button" disabled={saving} className={button} onClick={onClose}>Đóng</button></div>
        </form>
      </>}
    </div>
  </dialog>;
}
