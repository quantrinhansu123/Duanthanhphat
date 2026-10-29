import { NextResponse } from "next/server";
import { authenticateWeldQuality, QualityApiError } from "@/lib/server/weldQualityAuth";
import { object, qualityUuid, parseQualityFilters, parseQualityInspection, loadQualityJournalPage,
  loadQualityJournalRows, loadQualityDetail, markQualityBatch, importQualityBatch, createQualityRuleForWeld } from "@/lib/server/weldQualityJournal";
import { loadRfiCandidates, nextRfiNumber, publishRfi, listRfis, loadRfiDetail, completeRfi, listRecords, reviseRecord, acceptedOnDate, loadRecordSet, setSignStatus } from "@/lib/server/weldAcceptanceServer";
import { saveWeldQualityInspection } from "@/lib/server/weldQualityDb";
import { formatSupabaseError } from "@/lib/supabase/env";

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
    if (body.action === "list") return NextResponse.json(await loadQualityJournalPage(parseQualityFilters(body.filters)));
    if (body.action === "export") return NextResponse.json({ rows: await loadQualityJournalRows(parseQualityFilters(body.filters)) });
    if (body.action === "selection") {
      const rows = await loadQualityJournalRows(parseQualityFilters(body.filters), true);
      return NextResponse.json({ entries: rows.map((r) => ({ id: r.id, ma_lich_su: r.ma_lich_su, phien_ban: r.phien_ban_chat_luong ?? 0 })) });
    }
    if (body.action === "save") return NextResponse.json({ inspection: await saveWeldQualityInspection(parseQualityInspection(body.inspection, actor)) });
    if (body.action === "mark-pass") return NextResponse.json({ results: await markQualityBatch(body, actor) });
    if (body.action === "import") return NextResponse.json({ results: await importQualityBatch(body, actor) });
    if (body.action === "rule") return NextResponse.json({ rule: await createQualityRuleForWeld(body, actor) });
    if (body.action === "dashboard-quality") {
      const base = object(body.filters ?? {});
      const [accepted, waiting] = await Promise.all(["Đạt", "Chờ mài"].map((qualityStatusFilter) =>
        loadQualityJournalRows(parseQualityFilters({ ...base, qualityStatusFilter, page: 1, pageSize: 1000 }))));
      return NextResponse.json({ accepted, waiting });
    }
    // Giai đoạn 4–6: RFI, nghiệm thu, hồ sơ (cùng xác thực với kiểm tra chất lượng).
    if (body.action === "rfi-candidates") return NextResponse.json(await loadRfiCandidates(body));
    if (body.action === "rfi-number") return NextResponse.json({ so_phieu: await nextRfiNumber(qualityUuid(body.du_an_id)) });
    if (body.action === "rfi-publish") return NextResponse.json(await publishRfi(body, actor));
    if (body.action === "rfi-list") return NextResponse.json({ rfis: await listRfis(qualityUuid(body.du_an_id)) });
    if (body.action === "rfi-detail") return NextResponse.json(await loadRfiDetail(qualityUuid(body.id)));
    if (body.action === "accept-complete") return NextResponse.json(await completeRfi(body, actor));
    if (body.action === "accepted-on-date") return NextResponse.json(await acceptedOnDate(body));
    if (body.action === "record-list") return NextResponse.json({ records: await listRecords(qualityUuid(body.du_an_id)) });
    if (body.action === "record-set") return NextResponse.json(await loadRecordSet(qualityUuid(body.id)));
    if (body.action === "record-revise") return NextResponse.json(await reviseRecord(body, actor));
    if (body.action === "record-sign") return NextResponse.json(await setSignStatus(body));
    throw new QualityApiError("Thao tác không hợp lệ.");
  } catch (error) { return failure(error); }
}
