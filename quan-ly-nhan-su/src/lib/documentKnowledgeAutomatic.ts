/** Deterministic checks for provisional financial answers, never human approval. */
import { normalizeKnowledgeText, type ExtractedFact, type KnowledgePage } from "./documentKnowledge.ts";

export const AUTOMATIC_CHECK_VERSION = "dk-auto-v1";
export type AutomaticCheck = {
  version: string;
  eligible: boolean;
  identity: string | null;
  issues: string[];
  reference: string | null;
};
export const AUTOMATIC_ISSUE_LABELS: Record<string, string> = {
  amount_evidence: "Số tiền chưa khớp đoạn nguồn",
  currency: "Chưa xác định rõ tiền VND",
  contract: "Chưa tìm thấy mã hợp đồng trong trang nguồn",
  date: "Ngày chưa có căn cứ trên trang nguồn",
  classification: "Loại nghiệp vụ chưa đủ căn cứ",
  period: "Chưa xác định rõ đợt nghiệm thu",
  reference: "Thiếu mã giao dịch hoặc số chứng từ để chống trùng",
  adjustment: "Chưa phân biệt phần điều chỉnh với tổng giá trị mới",
  ocr: "Chất lượng OCR cần kiểm tra thêm",
  no_financial_facts: "Trang có số tiền nhưng chưa trích xuất được dữ kiện",
  not_assessed: "Chưa chạy bộ kiểm tra tự động phiên bản mới",
  missing_financial_kind: "Có loại số liệu tài chính trong trang nhưng chưa có dữ kiện tương ứng",
};

function integerMoney(token: string, unit: string): bigint | null {
  let value = token.replace(/\s/g, "");
  const multiplier = /ty|ti/.test(unit) ? BigInt(1_000_000_000) : /trieu/.test(unit) ? BigInt(1_000_000) : /nghin|ngan/.test(unit) ? BigInt(1000) : BigInt(1);
  if (/^-?\d{1,3}(?:[.,]\d{3})+$/.test(value)) value = value.replace(/[.,]/g, "");
  else if (/^-?\d+$/.test(value)) { /* Unseparated integer. */ }
  else {
    // Decimal notation only with an explicit multiplier, or zero decimal VND.
    const match = /^(-?\d+)[.,](\d{1,3})$/.exec(value);
    if (!match || (multiplier === BigInt(1) && !/^0+$/.test(match[2]))) return null;
    const scale = BigInt(10) ** BigInt(match[2].length);
    const sign = match[1].startsWith("-") ? BigInt(-1) : BigInt(1);
    const numerator = (BigInt(match[1].replace("-", "")) * scale + BigInt(match[2])) * multiplier;
    return numerator % scale === BigInt(0) ? sign * numerator / scale : null;
  }
  return BigInt(value) * multiplier;
}
function moneyInQuote(quote: string, amount: string | null) {
  if (amount === null) return false;
  const text = normalizeKnowledgeText(quote);
  // Currency/multiplier must follow the full numeric token. No digit concatenation.
  const pattern = /(?<![\d.,])(-?\d+(?:[.,]\d+)*)(?:\s*(ty|ti|trieu|nghin|ngan))?\s*(?:dong|vnd|vnd\b)(?!\w)/g;
  for (const match of text.matchAll(pattern)) {
    const found = integerMoney(match[1], match[2] || "");
    if (found !== null && (found === BigInt(amount) || (BigInt(amount) < BigInt(0) && /\bgiam\b/.test(text) && found === -BigInt(amount)))) return true;
  }
  return false;
}
function dateOnPage(date: string | null, page: string) {
  if (!date) return false;
  const [year, month, day] = date.split("-").map(Number);
  const text = normalizeKnowledgeText(page);
  return new RegExp(`(?:^|\\D)(?:0?${day}[/.\\-]0?${month}[/.\\-]${year}|${year}-0?${month}-0?${day})(?:\\D|$)`).test(text)
    || new RegExp(`ngay\\s+0?${day}\\s+thang\\s+0?${month}\\s+nam\\s+${year}(?:\\D|$)`).test(text);
}
function eventReference(fact: ExtractedFact) {
  const folded = normalizeKnowledgeText(fact.quote);
  const pattern = /(?:ma giao dich|so giao dich|ma tham chieu|so tham chieu|so chung tu|so de nghi|so phu luc|phu luc so)\s*[:#]?\s*([a-z0-9][a-z0-9/_.-]{2,99})/gi;
  const refs = [...folded.matchAll(pattern)].map(m => m[1].replace(/[./_-]+$/g, "").toUpperCase()).filter(r => /\d/.test(r));
  const reference = fact.event_ref?.trim();
  if (reference) return refs.find(r => r === normalizeKnowledgeText(reference).toUpperCase()) || null;
  return refs.length === 1 ? refs[0] : null;
}
export function assessAutomaticFact(fact: ExtractedFact, pages: KnowledgePage[]): AutomaticCheck {
  const source = pages.find(p => p.page === fact.source_page);
  const issues: string[] = [];
  const quote = normalizeKnowledgeText(fact.quote);
  const pageText = normalizeKnowledgeText(source?.text || "");
  const code = fact.contract_code.trim().toUpperCase();
  if (!code || !pageText.includes(normalizeKnowledgeText(code))) issues.push("contract");
  if (!moneyInQuote(fact.quote, fact.amount)) issues.push("amount_evidence");
  if (!/\b(dong|vnd)\b/.test(quote) || /\b(usd|eur|cny|jpy|dollar)\b/.test(quote)) issues.push("currency");
  if (!dateOnPage(fact.event_date, source?.text || "")) issues.push("date");
  if (source?.method === "paddle" && Array.isArray(source.ocr_meta?.warnings) && source.ocr_meta.warnings.length) issues.push("ocr");
  const patterns: Record<ExtractedFact["kind"], RegExp> = {
    contract_base: /\b(gia tri hop dong|tong gia tri hop dong)\b/,
    contract_adjustment: /\b(phu luc|dieu chinh)\b/,
    accepted_increment: /\bnghiem thu\b/,
    accepted_cumulative: /\bnghiem thu\b/,
    payment: /\b(chuyen khoan|chuyen tien|giao dich|thuc chuyen)\b/,
    payment_request: /\b(de nghi thanh toan|yeu cau thanh toan)\b/,
    advance: /\btam ung\b/,
  };
  if (!patterns[fact.kind].test(quote)) issues.push("classification");
  if (fact.kind === "payment" && (!/\b(thanh cong|da chuyen|da thanh toan|hoan tat|thuc chuyen)\b/.test(quote) || /\b(de nghi|yeu cau|du kien|chua|that bai|cho xu ly)\b/.test(quote))) issues.push("classification");
  if (fact.kind === "contract_base" && /\b(phu luc|dieu chinh|con lai|thanh toan|tam ung|nghiem thu)\b/.test(quote)) issues.push("classification");
  if (fact.kind === "accepted_cumulative" && !/\bluy ke\b/.test(quote)) issues.push("classification");
  if (fact.kind === "accepted_increment" && /\bluy ke\b/.test(quote)) issues.push("classification");
  if (fact.kind.startsWith("accepted_")) {
    if (!fact.period_index || !new RegExp(`\\b(?:dot|lan|ky)\\s*(?:so\\s*)?0?${fact.period_index}(?:\\D|$)`).test(quote)) issues.push("period");
  }
  const reference = eventReference(fact);
  if (["payment", "payment_request", "advance", "contract_adjustment"].includes(fact.kind) && !reference) issues.push("reference");
  if (fact.kind === "contract_adjustment") {
    if (!/\b(tang|giam)\b/.test(quote) || /\b(tong moi|gia tri moi|gia tri sau|tong gia tri)\b/.test(quote)) issues.push("adjustment");
    if (fact.amount && ((BigInt(fact.amount) < BigInt(0) && !/\bgiam\b/.test(quote)) || (BigInt(fact.amount) >= BigInt(0) && !/\btang\b/.test(quote)))) issues.push("adjustment");
  } else if (fact.amount && BigInt(fact.amount) < BigInt(0)) issues.push("amount_evidence");
  const identity = fact.kind === "contract_base" ? `CONTRACT:${code}`
    : fact.kind.startsWith("accepted_") ? `${fact.kind.toUpperCase()}:${code}:${fact.period_index}`
    : `${["payment", "advance"].includes(fact.kind) ? "TRANSFER" : fact.kind.toUpperCase()}:${code}:${reference || ""}`;
  return { version: AUTOMATIC_CHECK_VERSION, eligible: issues.length === 0, identity: issues.length ? null : identity, issues: [...new Set(issues)], reference };
}
export function assessAutomaticDocument(pages: KnowledgePage[], facts: ExtractedFact[]) {
  const issues = new Set<string>();
  for (const page of pages) {
    if (page.method === "paddle" && Array.isArray(page.ocr_meta?.warnings) && page.ocr_meta.warnings.length) issues.add("ocr");
    if (/\d[\d.,]*\s*(?:đồng|VNĐ|VND)\b/iu.test(page.text) && !facts.some(f => f.source_page === page.page)) issues.add("no_financial_facts");
    const current = facts.filter(f => f.source_page === page.page);
    const families: { pattern: RegExp; kinds: string[] }[] = [
      { pattern: /\b(?:gia tri hop dong)\b/, kinds: ["contract_base", "contract_adjustment"] },
      { pattern: /\bnghiem thu\b/, kinds: ["accepted_increment", "accepted_cumulative"] },
      { pattern: /\b(?:thuc chuyen|da chuyen khoan|giao dich thanh cong)\b/, kinds: ["payment", "advance"] },
      { pattern: /\b(?:de nghi thanh toan|yeu cau thanh toan)\b/, kinds: ["payment_request"] },
      { pattern: /\btam ung\b/, kinds: ["advance", "payment"] },
    ];
    for (const line of normalizeKnowledgeText(page.text).split(/[\n;]/)) {
      if (!/\d[\d.,]*\s*(?:(?:ty|ti|trieu|nghin|ngan)\s*)?(?:dong|vnd)\b/.test(line)) continue;
      for (const family of families)
        if (family.pattern.test(line) && !current.some(f => family.kinds.includes(f.kind))) issues.add("missing_financial_kind");
    }
  }
  return { version: AUTOMATIC_CHECK_VERSION, issues: [...issues] };
}
