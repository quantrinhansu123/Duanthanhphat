"use client";

import { useState } from "react";
import { GEOMETRY_CRITERIA, GEOMETRY_LABELS, type QualityRuleSync, type SavedWeldQualityRule } from "@/lib/weldQuality";
import { notifyWeldQualityChanged, qualityRequest } from "@/lib/weldQualityClient";

const input = "mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 sm:text-sm";
const buttonBase = "min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50";
const button = `${buttonBase} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
const primary = `${buttonBase} border-blue-700 bg-blue-700 text-white hover:bg-blue-800`;

export type RuleFormTarget = {
  du_an_id: string;
  du_an: string;
  cong_nghe_han: "FBW" | "ATW";
  loai_moi_han: string;
  /** Giữ tương thích API cũ khi mở từ một mối cụ thể. */
  weldId?: string;
};

function seedBounds(seed?: SavedWeldQualityRule | null) {
  return Object.fromEntries(GEOMETRY_CRITERIA.map((k) => {
    const limit = seed?.dung_sai?.[k];
    return [k, {
      min: limit?.min == null ? "" : String(limit.min),
      max: limit?.max == null ? (k === "chieu_dai_mai" ? "800" : "") : String(limit.max),
      minInclusive: limit?.minInclusive ?? true,
      maxInclusive: limit?.maxInclusive ?? true,
    }];
  }));
}

export default function WeldQualityRuleForm({
  target,
  seed = null,
  onCreated,
  onCancel,
}: {
  target: RuleFormTarget;
  /** Prefill từ tiêu chí đang áp dụng khi tạo phiên bản mới. */
  seed?: SavedWeldQualityRule | null;
  onCreated: (rule: SavedWeldQualityRule, sync: QualityRuleSync) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(seed?.ten ?? "");
  const [bounds, setBounds] = useState(() => seedBounds(seed));
  const [ndt, setNdt] = useState(seed?.yeu_cau_ndt ?? true);
  const [ndtBeforeRfi, setNdtBeforeRfi] = useState(seed?.ndt_truoc_rfi ?? false);
  const [exemption, setExemption] = useState(seed?.can_cu_mien_ndt ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  return (
    <form
      className="rounded-xl border border-blue-200 bg-blue-50/40 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError("");
        try {
          const payload: Record<string, unknown> = {
            action: "rule",
            ten: name,
            dung_sai: bounds,
            yeu_cau_ndt: ndt,
            ndt_truoc_rfi: ndtBeforeRfi,
            can_cu_mien_ndt: exemption,
            confirmed,
          };
          if (target.weldId) payload.weldId = target.weldId;
          else {
            payload.du_an_id = target.du_an_id;
            payload.cong_nghe_han = target.cong_nghe_han;
            payload.loai_moi_han = target.loai_moi_han;
          }
          const { rule, sync } = await qualityRequest<{ rule: SavedWeldQualityRule; sync: QualityRuleSync }>(payload);
          notifyWeldQualityChanged();
          onCreated(rule, sync);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Không lưu được tiêu chí.");
        } finally {
          setSaving(false);
        }
      }}
    >
      <h3 className="text-base font-bold text-slate-900">
        {seed ? `Tạo phiên bản mới (v${seed.phien_ban + 1})` : "Xác nhận tiêu chí áp dụng"}
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        {target.du_an} · {target.cong_nghe_han} · {target.loai_moi_han}. Tiêu chí này áp dụng cho các mối cùng nhóm trong dự án.
        {" "}Khi lưu, các mối chưa chốt trong nhóm tự cập nhật sang tiêu chí này; số đo và kết quả NDT giữ nguyên. Hồ sơ đã nghiệm thu giữ phiên bản cũ để truy vết.
      </p>
      <fieldset disabled={saving} className="mt-4 space-y-3">
        <label className="block text-sm font-semibold">
          Tên tiêu chuẩn / căn cứ
          <input required maxLength={300} value={name} onChange={(e) => setName(e.target.value)} className={input} />
        </label>
        <p className="text-sm text-slate-600">
          Nhập giới hạn đã được xác nhận, đơn vị mm. Để trống phía không giới hạn; mỗi chỉ tiêu phải có ít nhất một giới hạn.
        </p>
        {GEOMETRY_CRITERIA.map((key) => (
          <div key={key} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-sm font-semibold text-slate-900">{GEOMETRY_LABELS[key]}</div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {(["min", "max"] as const).map((edge) => (
                <div key={edge}>
                  <label className="block text-sm">
                    {edge === "min" ? "Giới hạn dưới" : "Giới hạn trên"}
                    <input
                      inputMode="decimal"
                      className={input}
                      value={bounds[key][edge]}
                      onChange={(e) => setBounds({ ...bounds, [key]: { ...bounds[key], [edge]: e.target.value } })}
                    />
                  </label>
                  <label className="mt-2 flex min-h-9 items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={bounds[key][`${edge}Inclusive`]}
                      onChange={(e) => setBounds({ ...bounds, [key]: { ...bounds[key], [`${edge}Inclusive`]: e.target.checked } })}
                    />
                    Nhận giá trị bằng giới hạn
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={ndt} onChange={(e) => setNdt(e.target.checked)} />
          Yêu cầu thí nghiệm NDT
        </label>
        {!ndt && (
          <label className="block text-sm">
            Căn cứ miễn NDT
            <input required className={input} value={exemption} onChange={(e) => setExemption(e.target.value)} />
          </label>
        )}
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={ndtBeforeRfi} onChange={(e) => setNdtBeforeRfi(e.target.checked)} />
          Yêu cầu NDT đạt trước khi phát RFI
        </label>
        <label className="flex min-h-11 items-start gap-2 text-sm font-semibold">
          <input required type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          Tôi xác nhận giới hạn và quy tắc trên đã được chấp thuận cho nhóm mối này.
        </label>
      </fieldset>
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button className={primary} disabled={saving}>{saving ? "Đang lưu…" : "Lưu và áp dụng tiêu chí"}</button>
        <button type="button" className={button} disabled={saving} onClick={onCancel}>Hủy thiết lập</button>
      </div>
    </form>
  );
}
