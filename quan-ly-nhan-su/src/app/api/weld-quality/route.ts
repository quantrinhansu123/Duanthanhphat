import { NextResponse } from "next/server";
import { authenticateWeldQuality, QualityApiError } from "@/lib/server/weldQualityAuth";
import { object, qualityUuid, parseQualityFilters, parseQualityInspection, loadQualityJournalPage,
  loadQualityJournalRows, loadQualityDetail, markQualityBatch, importQualityBatch, createQualityRuleForWeld, listQualityRules } from "@/lib/server/weldQualityJournal";
import { loadRfiOverview, deleteRfi, splitAcceptance, loadDiaryDefaults, loadRfiCandidates, nextRfiNumber, publishRfi, listRfis, loadRfiDetail, updateRfi, completeRfi, completeRfiGeometry, loadGeometryRecord, listSplitRecords, signSplitRecord, listRecords, reviseRecord, acceptedOnDate, loadRecordSet, setSignStatus } from "@/lib/server/weldAcceptanceServer";
import { listPayments, listPaymentIds, setPayments, clearPayments } from "@/lib/server/weldPayment";
import { saveWeldQualityInspection } from "@/lib/server/weldQualityDb";
import { formatSupabaseError } from "@/lib/supabase/env";
import { loadProjectWeather } from "@/lib/server/projectWeather";
import { applyQualityRule } from "@/lib/server/weldQualityRules";

function failure(error: unknown) {
  const message = formatSupabaseError(error);
  const status = error instanceof QualityApiError ? error.status :
    /Dữ liệu đã thay đổi|Mối đã nghiệm thu|unique constraint|Mã yêu cầu đã được dùng|RFI không còn hiệu lực/.test(message) ? 409 :
      /không hợp lệ|Hãy |Thiếu |Cần |check constraint|Tiêu chí không thuộc|Chỉ kiểm tra từng mối|chưa đủ điều kiện|Danh sách mối|Danh sách kết quả|Mối kết quả|Kết quả hoặc mối|Thiếu lý do/.test(message) ? 400 : 500;
  return NextResponse.json({ error: message }, { status, headers: status === 401 ? { "WWW-Authenticate": 'Basic realm="Thanh Phat", charset="UTF-8"' } : undefined });
}

export async function GET(request: Request) {
  try {
    await authenticateWeldQuality(request);
    return NextResponse.json(await loadQualityDetail(qualityUuid(new URL(request.url).searchParams.get("id"))), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await authenticateWeldQuality(request);
    const raw = await request.text();
    if (raw.length > 1_000_000) throw new QualityApiError("Yêu cầu quá lớn; tối đa 100 mối mỗi lượt.", 413);
    let value: unknown;
    try { value = JSON.parse(raw); } catch { throw new QualityApiError("JSON không hợp lệ."); }
    const body = object(value);
    if (body.action === "report-weather") return NextResponse.json(await loadProjectWeather(body));
    if (body.action === "diary-defaults") return NextResponse.json(await loadDiaryDefaults(body));
    if (body.action === "list") return NextResponse.json(await loadQualityJournalPage(parseQualityFilters(body.filters)));
    if (body.action === "export") return NextResponse.json({ rows: await loadQualityJournalRows(parseQualityFilters(body.filters)) });
    if (body.action === "selection") {
      const rows = await loadQualityJournalRows(parseQualityFilters(body.filters), true);
      return NextResponse.json({ entries: rows.map((r) => ({ id: r.id, ma_lich_su: r.ma_lich_su, phien_ban: r.phien_ban_chat_luong ?? 0 })) });
    }
    if (body.action === "save") return NextResponse.json({ inspection: await saveWeldQualityInspection(parseQualityInspection(body.inspection, actor)) });
    if (body.action === "mark-pass") return NextResponse.json({ results: await markQualityBatch(body, actor) });
    if (body.action === "import") return NextResponse.json({ results: await importQualityBatch(body, actor) });
    if (body.action === "rule") return NextResponse.json(await createQualityRuleForWeld(body, actor));
    if (body.action === "rule-sync") return NextResponse.json({ sync: await applyQualityRule(qualityUuid(body.id), actor) });
    if (body.action === "rules-list") return NextResponse.json(await listQualityRules(String(body.du_an_id ?? "")));
    if (body.action === "payment-list") return NextResponse.json({ payments: await listPayments(qualityUuid(body.du_an_id)) });
    if (body.action === "payment-set") return NextResponse.json(await setPayments(body, actor));
    if (body.action === "payment-clear") return NextResponse.json(await clearPayments(body));
    if (body.action === "dashboard-quality") {
      const base = object(body.filters ?? {});
      const [accepted, waiting, acceptance, signing, ground, ultrasound] = await Promise.all(["Đạt", "Chờ mài", "Chờ nghiệm thu", "Chờ ký biên bản", "Mài xong", "Chờ siêu âm"].map((qualityStatusFilter) =>
        loadQualityJournalRows(parseQualityFilters({ ...base, qualityStatusFilter, page: 1, pageSize: 1000 }))));
      // Đã thanh toán = mối đã nghiệm thu Đạt có ghi thanh toán.
      const paidIds = new Set((await listPaymentIds(accepted.map((r) => r.id))));
      return NextResponse.json({ accepted, waiting, acceptance, signing, ground, ultrasound, paid: accepted.filter((r) => paidIds.has(r.id)) });
    }
    // Giai đoạn 4–6: RFI, nghiệm thu, hồ sơ (cùng xác thực với kiểm tra chất lượng).
    if (["split-list", "split-detail", "split-publish", "split-complete", "split-update", "split-delete"].includes(String(body.action))) return NextResponse.json(await splitAcceptance(body, actor));
    if (body.action === "rfi-overview") return NextResponse.json(await loadRfiOverview(body));
    if (body.action === "rfi-candidates") return NextResponse.json(await loadRfiCandidates(body));
    if (body.action === "rfi-number") return NextResponse.json({ so_phieu: await nextRfiNumber(qualityUuid(body.du_an_id), body.loai === "hinh-hoc" || body.loai === "sieu-am" ? body.loai : undefined) });
    if (body.action === "rfi-publish") return NextResponse.json(await publishRfi(body, actor));
    if (body.action === "rfi-list") return NextResponse.json({ rfis: await listRfis(qualityUuid(body.du_an_id)) });
    if (body.action === "rfi-detail") return NextResponse.json(await loadRfiDetail(qualityUuid(body.id)));
    if (body.action === "rfi-update") return NextResponse.json(await updateRfi(body));
    if (body.action === "rfi-delete") return NextResponse.json(await deleteRfi(body));
    if (body.action === "accept-complete") return NextResponse.json(await completeRfi(body, actor));
    if (body.action === "accept-complete-geometry") return NextResponse.json(await completeRfiGeometry(body, actor));
    if (body.action === "geometry-record") return NextResponse.json(await loadGeometryRecord(qualityUuid(body.id)));
    if (body.action === "accepted-on-date") return NextResponse.json(await acceptedOnDate(body));
    if (body.action === "record-list") return NextResponse.json({ records: await listRecords(qualityUuid(body.du_an_id)) });
    if (body.action === "split-record-list") return NextResponse.json({ records: await listSplitRecords(qualityUuid(body.du_an_id), body.loai === "hinh-hoc" ? "hinh-hoc" : "sieu-am") });
    if (body.action === "split-record-sign") return NextResponse.json(await signSplitRecord(body, actor));
    if (body.action === "record-set") return NextResponse.json(await loadRecordSet(qualityUuid(body.id)));
    if (body.action === "record-revise") return NextResponse.json(await reviseRecord(body, actor));
    if (body.action === "record-sign") return NextResponse.json(await setSignStatus(body));
    throw new QualityApiError("Thao tác không hợp lệ.");
  } catch (error) { return failure(error); }
}
