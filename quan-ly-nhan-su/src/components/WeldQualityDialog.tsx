"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "@/components/icons";
import WeldQualityBadge from "@/components/WeldQualityBadge";
import { GEOMETRY_CRITERIA, GEOMETRY_LABELS, emptyWeldInspection, evaluateGeometryCriterion, evaluateWeldQuality, isOptionalUntilMeasured, parseWeldMeasurement,
  type GeometryCriterion, type SavedWeldInspection, type SavedWeldQualityRule } from "@/lib/weldQuality";
import { loadQualityInspection, saveQualityInspection } from "@/lib/weldQualityClient";
import type { WeldReportRow } from "@/lib/weldReportData";

const input = "mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 sm:text-sm";
const buttonBase = "min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50";
const button = `${buttonBase} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
const primary = `${buttonBase} border-blue-700 bg-blue-700 text-white hover:bg-blue-800`;

export default function WeldQualityDialog({ row, onClose, onSaved }: { row: WeldReportRow; onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<SavedWeldInspection | null>(null);
  const [numbers, setNumbers] = useState<Partial<Record<GeometryCriterion, string>>>({});
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
      // Nhớ tiêu chí đã chọn lần trước trên cùng dự án khi mối chưa gắn tiêu chí.
      if (!inspection.tieu_chuan_id) {
        try {
          const remembered = window.localStorage.getItem(`weld-quality-last-rule:${row.du_an_id}`);
          if (remembered && data.rules.some((r) => r.id === remembered && r.dang_ap_dung)) {
            next = { ...inspection, tieu_chuan_id: remembered };
          }
        } catch { /* ignore */ }
      }
      setDraft(next);
      setNumbers(Object.fromEntries(GEOMETRY_CRITERIA.map((k) => [k, inspection.gia_tri_do[k] == null ? "" : String(inspection.gia_tri_do[k])])));
      setRules(data.rules);
      setAccepted(data.summary.tinh_trang === "Đạt");
      setPendingSignature(data.summary.tinh_trang === "Chờ ký biên bản");
    }).catch((e) => { if (active) setError(e instanceof Error ? e.message : "Không tải được kiểm tra."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [row.id, row.du_an_id, reload]);
  const rule = rules.find((r) => r.id === draft?.tieu_chuan_id) ?? null;
  const parseErrors: Partial<Record<GeometryCriterion, string>> = {};
  const measurements = Object.fromEntries(GEOMETRY_CRITERIA.map((k) => {
    try { return [k, parseWeldMeasurement(numbers[k])]; }
    catch { parseErrors[k] = "Nhập số đo mm hợp lệ, ví dụ -0,10 hoặc 0,20."; return [k, null]; }
  }));
  const assessment = draft ? evaluateWeldQuality({ ...draft, gia_tri_do: measurements }, rule, row.loai_moi_han, accepted, pendingSignature) : null;
  const blocked = accepted || row.so_luong_thuc_hien !== 1;
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
            setDraft(saved); setMessage("Đã lưu kiểm tra. Tình trạng được tính từ kết quả thực tế."); onSaved();
          } catch (err) { setError(err instanceof Error ? err.message : "Không lưu được kiểm tra."); }
          finally { setSaving(false); }
        }}>
          <fieldset disabled={saving || blocked} className="space-y-5">
            <label className="block text-sm font-semibold">Tiêu chí áp dụng<select className={input} value={draft.tieu_chuan_id ?? ""} onChange={(e) => {
              const id = e.target.value || null;
              setDraft({ ...draft, tieu_chuan_id: id });
              if (id) {
                try { window.localStorage.setItem(`weld-quality-last-rule:${row.du_an_id}`, id); } catch { /* ignore */ }
              }
            }}>
              <option value="">Chưa chọn tiêu chí</option>{rules.filter((r) => r.dang_ap_dung || r.id === draft.tieu_chuan_id).map((r) => <option key={r.id} value={r.id}>{r.ten} · v{r.phien_ban}{r.dang_ap_dung ? "" : " · Lưu theo bản cũ"}</option>)}
            </select></label>
            {!rule && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Chưa có tiêu chí áp dụng cho nhóm {row.cong_nghe_han} · {row.loai_moi_han}. Cài đặt tại{" "}
                <button
                  type="button"
                  className="font-semibold underline"
                  onClick={() => {
                    onClose();
                    window.dispatchEvent(new CustomEvent("app-navigate", { detail: { tab: "tieu-chi-nghiem-thu" } }));
                  }}
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
                <label className="text-sm font-semibold">Kiểm tra trực quan<select className={input} value={draft.truc_quan ?? ""} onChange={(e) => setDraft({ ...draft, truc_quan: (e.target.value as SavedWeldInspection["truc_quan"]) || null, xu_ly_truc_quan: e.target.value === "Không đạt" ? (draft.xu_ly_truc_quan ?? "sua_chua") : null })}><option value="">Chưa kiểm tra</option><option value="Đạt">Đạt</option><option value="Không đạt">Không đạt</option></select></label></div>
              {draft.truc_quan === "Không đạt" || assessment?.geometry === "Không đạt" ? (
                <fieldset className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                  <legend className="px-1 text-sm font-semibold text-amber-950">Xử lý khi trực quan / độ lệch không đạt</legend>
                  <div className="mt-1 flex flex-col gap-2 text-sm">
                    <label className="flex min-h-11 items-center gap-2"><input type="radio" name="xu-ly-tq" checked={(draft.xu_ly_truc_quan ?? "sua_chua") === "sua_chua"} onChange={() => setDraft({ ...draft, xu_ly_truc_quan: "sua_chua", ly_do_loai_nghiem_thu: null })} />Sửa chữa / khắc phục</label>
                    <label className="flex min-h-11 items-center gap-2"><input type="radio" name="xu-ly-tq" checked={draft.xu_ly_truc_quan === "khong_dat"} onChange={() => setDraft({ ...draft, xu_ly_truc_quan: "khong_dat" })} />Không đạt (chủ sở hữu quyết định)</label>
                  </div>
                </fieldset>
              ) : null}
              <div className="mt-4 space-y-3">{GEOMETRY_CRITERIA.map((k) => {
                const limit = rule?.dung_sai[k] ?? null;
                const outcome = evaluateGeometryCriterion(measurements[k], limit);
                return <div key={k} className="rounded-lg bg-slate-50 p-3"><label htmlFor={`measure-${k}`} className="block text-sm font-semibold">{GEOMETRY_LABELS[k]} (mm)</label>
                  <div className="mt-1 flex flex-wrap items-center gap-3"><input id={`measure-${k}`} inputMode="decimal" className={`${input} sm:max-w-40`} value={numbers[k] ?? ""} aria-invalid={Boolean(parseErrors[k])} aria-describedby={`measure-help-${k}`} onChange={(e) => setNumbers({ ...numbers, [k]: e.target.value })} />
                    <span className={`text-sm font-semibold ${outcome === "Không đạt" ? "text-rose-700" : outcome === "Đạt" ? "text-emerald-800" : "text-slate-600"}`}>{parseErrors[k] ? "Số đo không hợp lệ" : outcome ?? "Chưa đủ căn cứ"}</span></div>
                  <p id={`measure-help-${k}`} className={`mt-1 text-xs ${parseErrors[k] ? "text-rose-700" : "text-slate-600"}`}>{parseErrors[k] ?? (limit ? `Giới hạn: ${limit.min === null ? "không giới hạn dưới" : `${limit.minInclusive ? "≥" : ">"} ${limit.min}`} ; ${limit.max === null ? "không giới hạn trên" : `${limit.maxInclusive ? "≤" : "<"} ${limit.max}`} mm${isOptionalUntilMeasured(k) && measurements[k] == null ? ". Chưa nhập: chưa chặn RFI; bắt buộc trước khi nghiệm thu Đạt." : ""}` : "Chưa chọn giới hạn. Ô trống khác với số 0.")}</p>
                </div>;
              })}</div>
            </section>
            <section className="rounded-xl border border-slate-200 p-4"><h3 className="font-bold">2. Kiểm tra không phá huỷ (NDT)</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"><label className="text-sm font-semibold">Phương pháp<select className={input} value={draft.phuong_phap_ndt} onChange={(e) => setDraft({ ...draft, phuong_phap_ndt: e.target.value as SavedWeldInspection["phuong_phap_ndt"] })}><option value="Siêu âm">Siêu âm</option><option value="Từ tính">Từ tính</option><option value="Thẩm thấu">Thẩm thấu</option></select></label>
                <label className="text-sm font-semibold">Ngày thí nghiệm<input type="date" className={input} value={draft.ngay_ndt ?? ""} onChange={(e) => setDraft({ ...draft, ngay_ndt: e.target.value || null })} /></label>
                <label className="text-sm font-semibold">Kết quả NDT<select className={input} value={draft.ket_qua_ndt ?? ""} onChange={(e) => setDraft({ ...draft, ket_qua_ndt: e.target.value as SavedWeldInspection["ket_qua_ndt"] || null })}><option value="">Chưa kiểm tra</option><option value="Đạt">Đạt</option><option value="Không đạt">Không đạt</option></select></label></div>
              <p className="mt-3 text-xs text-slate-600">NDT đạt chưa phải nghiệm thu đạt. {rule && !rule.yeu_cau_ndt ? `Miễn NDT theo: ${rule.can_cu_mien_ndt}` : "Chỉ kết luận nghiệm thu khi đủ tiêu chí và hoàn thành đợt nghiệm thu."}</p>
            </section>
            {draft.ly_do_loai_nghiem_thu && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><p>Lỗi tại nghiệm thu: {draft.ly_do_loai_nghiem_thu}</p><label className="mt-2 flex min-h-11 items-center gap-2"><input type="checkbox" onChange={(e) => { if (e.target.checked) setDraft({ ...draft, ly_do_loai_nghiem_thu: null }); }} />Đã khắc phục và kiểm tra lại; xóa cờ lỗi hiện tại khi lưu</label></div>}
            <label className="block text-sm font-semibold">Ghi chú kiểm tra<textarea className={input} rows={3} maxLength={4000} value={draft.ghi_chu ?? ""} onChange={(e) => setDraft({ ...draft, ghi_chu: e.target.value })} /></label>
          </fieldset>
          <p className="mt-4 text-sm text-slate-600" role="status">{accepted ? "Mối đã nghiệm thu đạt; không lập yêu cầu nghiệm thu trùng." : assessment?.rfiEligible ? "Đủ điều kiện phát RFI theo tiêu chí đang chọn." : `Chưa đủ điều kiện phát RFI: ${!rule ? "chưa chọn tiêu chí" : assessment?.status === "Không đạt" ? "còn chỉ tiêu không đạt" : !draft.ngay_mai ? "chưa ghi ngày mài" : draft.truc_quan !== "Đạt" ? "trực quan chưa đạt" : assessment?.geometry !== "Đạt" ? "thiếu số đo hoặc hình học chưa đạt" : "chưa có NDT đạt theo yêu cầu"}.`}</p>
          {message && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
          <div className="mt-5 flex flex-wrap gap-2"><button disabled={saving || blocked} className={primary}>{saving ? "Đang lưu…" : "Lưu kiểm tra"}</button><button type="button" disabled={saving} className={button} onClick={onClose}>Đóng</button></div>
        </form>
      </>}
    </div>
  </dialog>;
}
