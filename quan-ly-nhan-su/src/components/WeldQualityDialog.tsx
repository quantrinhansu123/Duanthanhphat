"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "@/components/icons";
import WeldQualityBadge from "@/components/WeldQualityBadge";
import { GEOMETRY_CRITERIA, GEOMETRY_LABELS, emptyWeldInspection, evaluateGeometryCriterion, evaluateWeldQuality, parseWeldMeasurement,
  type GeometryCriterion, type SavedWeldInspection, type SavedWeldQualityRule } from "@/lib/weldQuality";
import { loadQualityInspection, qualityRequest, saveQualityInspection } from "@/lib/weldQualityClient";
import type { WeldReportRow } from "@/lib/weldReportData";

const input = "mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 sm:text-sm";
const buttonBase = "min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50";
const button = `${buttonBase} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
const primary = `${buttonBase} border-blue-700 bg-blue-700 text-white hover:bg-blue-800`;

function RuleForm({ row, onCreated, onCancel }: { row: WeldReportRow; onCreated: (rule: SavedWeldQualityRule) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [bounds, setBounds] = useState(() => Object.fromEntries(GEOMETRY_CRITERIA.map((k) => [k, { min: "", max: "", minInclusive: true, maxInclusive: true }])));
  const [ndt, setNdt] = useState(true);
  const [ndtBeforeRfi, setNdtBeforeRfi] = useState(false);
  const [exemption, setExemption] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return <form className="mt-5 rounded-xl border border-blue-200 bg-blue-50/40 p-4" onSubmit={async (e) => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const { rule } = await qualityRequest<{ rule: SavedWeldQualityRule }>({ action: "rule", weldId: row.id, ten: name, dung_sai: bounds,
        yeu_cau_ndt: ndt, ndt_truoc_rfi: ndtBeforeRfi, can_cu_mien_ndt: exemption, confirmed });
      onCreated(rule);
    } catch (err) { setError(err instanceof Error ? err.message : "Không lưu được tiêu chí."); }
    finally { setSaving(false); }
  }}>
    <h3 className="text-base font-bold text-slate-900">Xác nhận tiêu chí áp dụng</h3>
    <p className="mt-1 text-sm text-slate-600">{row.du_an} · {row.cong_nghe_han} · {row.loai_moi_han}. Tiêu chí này áp dụng cho các mối cùng nhóm trong dự án.</p>
    <fieldset disabled={saving} className="mt-4 space-y-3">
      <label className="block text-sm font-semibold">Tên tiêu chuẩn / căn cứ<input required maxLength={300} value={name} onChange={(e) => setName(e.target.value)} className={input} /></label>
      <p className="text-sm text-slate-600">Nhập giới hạn đã được xác nhận, đơn vị mm. Để trống phía không giới hạn; mỗi chỉ tiêu phải có ít nhất một giới hạn. Không tự áp ví dụ PQ cho dự án.</p>
      {GEOMETRY_CRITERIA.map((key) => <div key={key} className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="text-sm font-semibold text-slate-900">{GEOMETRY_LABELS[key]}</div>
        <div className="mt-2 grid grid-cols-2 gap-3">{(["min", "max"] as const).map((edge) => <div key={edge}>
          <label className="block text-sm">{edge === "min" ? "Giới hạn dưới" : "Giới hạn trên"}<input inputMode="decimal" className={input} value={bounds[key][edge]} onChange={(e) => setBounds({ ...bounds, [key]: { ...bounds[key], [edge]: e.target.value } })} /></label>
          <label className="mt-2 flex min-h-9 items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={bounds[key][`${edge}Inclusive`]} onChange={(e) => setBounds({ ...bounds, [key]: { ...bounds[key], [`${edge}Inclusive`]: e.target.checked } })} />Nhận giá trị bằng giới hạn</label>
        </div>)}</div>
      </div>)}
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={ndt} onChange={(e) => setNdt(e.target.checked)} />Yêu cầu thí nghiệm NDT</label>
      {!ndt && <label className="block text-sm">Căn cứ miễn NDT<input required className={input} value={exemption} onChange={(e) => setExemption(e.target.value)} /></label>}
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={ndtBeforeRfi} onChange={(e) => setNdtBeforeRfi(e.target.checked)} />Yêu cầu NDT đạt trước khi phát RFI</label>
      <label className="flex min-h-11 items-start gap-2 text-sm font-semibold"><input required type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />Tôi xác nhận giới hạn và quy tắc trên đã được chấp thuận cho nhóm mối này.</label>
    </fieldset>
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    <div className="mt-4 flex flex-wrap gap-2"><button className={primary} disabled={saving}>{saving ? "Đang lưu…" : "Lưu và áp dụng tiêu chí"}</button><button type="button" className={button} disabled={saving} onClick={onCancel}>Hủy thiết lập</button></div>
  </form>;
}

export default function WeldQualityDialog({ row, onClose, onSaved }: { row: WeldReportRow; onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<SavedWeldInspection | null>(null);
  const [numbers, setNumbers] = useState<Partial<Record<GeometryCriterion, string>>>({});
  const [rules, setRules] = useState<SavedWeldQualityRule[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const [setupRule, setSetupRule] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    loadQualityInspection(row.id).then((data) => {
      if (!active) return;
      const inspection = data.inspection ?? emptyWeldInspection(row.id);
      setDraft(inspection);
      setNumbers(Object.fromEntries(GEOMETRY_CRITERIA.map((k) => [k, inspection.gia_tri_do[k] == null ? "" : String(inspection.gia_tri_do[k])])));
      setRules(data.rules); setAccepted(data.summary.tinh_trang === "Nghiệm thu đạt");
    }).catch((e) => { if (active) setError(e instanceof Error ? e.message : "Không tải được kiểm tra."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [row.id, reload]);
  const rule = rules.find((r) => r.id === draft?.tieu_chuan_id) ?? null;
  const parseErrors: Partial<Record<GeometryCriterion, string>> = {};
  const measurements = Object.fromEntries(GEOMETRY_CRITERIA.map((k) => {
    try { return [k, parseWeldMeasurement(numbers[k])]; }
    catch { parseErrors[k] = "Nhập số đo mm hợp lệ, ví dụ -0,10 hoặc 0,20."; return [k, null]; }
  }));
  const assessment = draft ? evaluateWeldQuality({ ...draft, gia_tri_do: measurements }, rule, row.loai_moi_han, accepted) : null;
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
            setDraft(saved); setMessage("Đã lưu kiểm tra. Tình trạng được tính từ kết quả thực tế."); onSaved();
          } catch (err) { setError(err instanceof Error ? err.message : "Không lưu được kiểm tra."); }
          finally { setSaving(false); }
        }}>
          <fieldset disabled={saving || blocked || setupRule} className="space-y-5">
            <label className="block text-sm font-semibold">Tiêu chí áp dụng<select className={input} value={draft.tieu_chuan_id ?? ""} onChange={(e) => setDraft({ ...draft, tieu_chuan_id: e.target.value || null })}>
              <option value="">Chưa chọn tiêu chí</option>{rules.filter((r) => r.dang_ap_dung || r.id === draft.tieu_chuan_id).map((r) => <option key={r.id} value={r.id}>{r.ten} · v{r.phien_ban}{r.dang_ap_dung ? "" : " · Lưu theo bản cũ"}</option>)}
            </select></label>
            {!rule && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Chưa có tiêu chí áp dụng. Có thể lưu kết quả đo; chưa đủ căn cứ để kết luận hình học đạt hoặc phát RFI.</p>}
            <section className="rounded-xl border border-slate-200 p-4"><h3 className="font-bold">1. Kiểm tra sau mài</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Ngày hoàn thành mài<input type="date" className={input} value={draft.ngay_mai ?? ""} onChange={(e) => setDraft({ ...draft, ngay_mai: e.target.value || null })} /></label>
                <label className="text-sm font-semibold">Kiểm tra trực quan<select className={input} value={draft.truc_quan ?? ""} onChange={(e) => setDraft({ ...draft, truc_quan: e.target.value as SavedWeldInspection["truc_quan"] || null })}><option value="">Chưa kiểm tra</option><option value="Đạt">Đạt</option><option value="Không đạt">Không đạt</option></select></label></div>
              <div className="mt-4 space-y-3">{GEOMETRY_CRITERIA.map((k) => {
                const limit = rule?.dung_sai[k] ?? null;
                const outcome = evaluateGeometryCriterion(measurements[k], limit);
                return <div key={k} className="rounded-lg bg-slate-50 p-3"><label htmlFor={`measure-${k}`} className="block text-sm font-semibold">{GEOMETRY_LABELS[k]} (mm)</label>
                  <div className="mt-1 flex flex-wrap items-center gap-3"><input id={`measure-${k}`} inputMode="decimal" className={`${input} sm:max-w-40`} value={numbers[k] ?? ""} aria-invalid={Boolean(parseErrors[k])} aria-describedby={`measure-help-${k}`} onChange={(e) => setNumbers({ ...numbers, [k]: e.target.value })} />
                    <span className={`text-sm font-semibold ${outcome === "Không đạt" ? "text-rose-700" : outcome === "Đạt" ? "text-emerald-800" : "text-slate-600"}`}>{parseErrors[k] ? "Số đo không hợp lệ" : outcome ?? "Chưa đủ căn cứ"}</span></div>
                  <p id={`measure-help-${k}`} className={`mt-1 text-xs ${parseErrors[k] ? "text-rose-700" : "text-slate-600"}`}>{parseErrors[k] ?? (limit ? `Giới hạn: ${limit.min === null ? "không giới hạn dưới" : `${limit.minInclusive ? "≥" : ">"} ${limit.min}`} ; ${limit.max === null ? "không giới hạn trên" : `${limit.maxInclusive ? "≤" : "<"} ${limit.max}`} mm` : "Chưa chọn giới hạn. Ô trống khác với số 0.")}</p>
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
          <div className="mt-5 flex flex-wrap gap-2"><button disabled={saving || blocked || setupRule} className={primary}>{saving ? "Đang lưu…" : "Lưu kiểm tra"}</button><button type="button" disabled={saving} className={button} onClick={onClose}>Đóng</button>
            {!blocked && !rules.some((r) => r.dang_ap_dung) && <button type="button" className={button} disabled={saving} onClick={() => setSetupRule(!setupRule)}>Thiết lập dung sai dự án</button>}</div>
        </form>
        {setupRule && <RuleForm row={row} onCancel={() => setSetupRule(false)} onCreated={(newRule) => { setRules([newRule, ...rules]); setDraft({ ...draft, tieu_chuan_id: newRule.id }); setSetupRule(false); setMessage("Đã lưu tiêu chí. Bấm Lưu kiểm tra để gắn tiêu chí vào mối này."); }} />}
      </>}
    </div>
  </dialog>;
}
