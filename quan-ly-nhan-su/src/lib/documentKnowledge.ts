/** Shared domain rules. No framework or credentials; also used by the Node background worker. */
export const KNOWLEDGE_BUCKET = "document-knowledge";
export const KNOWLEDGE_PIPELINE = "dk-v1";
export const EMBEDDING_DIMENSIONS = 768;
export const KNOWLEDGE_METRICS = {
  contract_total: "Giá trị hợp đồng và phần tăng/giảm theo phụ lục",
  accepted_total: "Giá trị nghiệm thu, không cộng trùng các đợt lũy kế",
  paid_total: "Tiền thực chuyển đã có chứng từ xác minh",
  payment_requested_total: "Giá trị đề nghị thanh toán",
  advance_total: "Giá trị tạm ứng",
} as const;
export type KnowledgeMetric = keyof typeof KNOWLEDGE_METRICS;
export const FACT_KINDS = [
  "contract_base",
  "contract_adjustment",
  "accepted_increment",
  "accepted_cumulative",
  "payment",
  "payment_request",
  "advance",
] as const;
export type FactKind = (typeof FACT_KINDS)[number];
export const FACT_LABELS: Record<FactKind, string> = {
  contract_base: "Hợp đồng gốc",
  contract_adjustment: "Phụ lục tăng/giảm",
  accepted_increment: "Nghiệm thu riêng đợt",
  accepted_cumulative: "Nghiệm thu lũy kế",
  payment: "Thực chuyển",
  payment_request: "Đề nghị thanh toán",
  advance: "Tạm ứng",
};
export type KnowledgePage = { page: number; text: string; method: string };
export type ExtractedFact = {
  contract_code: string;
  kind: FactKind;
  amount: string | null;
  event_date: string | null;
  period_index: number | null;
  source_page: number;
  quote: string;
};
export type KnowledgeChunk = {
  page: number;
  ordinal: number;
  content: string;
  embedding: number[] | null;
};
export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      value,
    )
  );
}
export function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function normalizeKnowledgeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
}
/** Exact common intents only. Filters/dates/contract names still require the planner. */
export function knownKnowledgeMetricQuestion(
  value: string,
): KnowledgeMetric | "clarify" | null {
  const question = normalizeKnowledgeText(value)
    .replace(/[?!.]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const intents: Record<KnowledgeMetric, string[]> = {
    contract_total: [
      "tong gia tri hop dong",
      "tong tien hop dong",
      "gia tri hop dong bao nhieu",
    ],
    accepted_total: [
      "tong nghiem thu",
      "tong gia tri nghiem thu",
      "tong tien nghiem thu",
      "da nghiem thu bao nhieu",
    ],
    paid_total: [
      "tong tien thuc chuyen",
      "tong tien da chuyen",
      "da chuyen khoan bao nhieu",
    ],
    payment_requested_total: [
      "tong de nghi thanh toan",
      "tong gia tri de nghi thanh toan",
    ],
    advance_total: ["tong tam ung", "tong gia tri tam ung"],
  };
  for (const [metric, phrases] of Object.entries(intents))
    if (phrases.includes(question)) return metric as KnowledgeMetric;
  if (
    [
      "tong tien",
      "tong bao nhieu tien",
      "tong 83 file bao nhieu tien",
      "83 tep tong bao nhieu tien",
    ].includes(question)
  )
    return "clarify";
  return null;
}
export function splitKnowledgePages(pages: KnowledgePage[]): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  for (const page of pages) {
    // Small enough for the 2048-token embedding input limit, including Vietnamese.
    const text = page.text.replace(/\r\n/g, "\n").trim();
    for (let start = 0; start < text.length;) {
      let end = Math.min(text.length, start + 1300);
      while (new TextEncoder().encode(text.slice(start, end)).length > 1800)
        end -= 100;
      if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) end--;
      chunks.push({
        page: page.page,
        ordinal: chunks.length,
        content: text.slice(start, end),
        embedding: null,
      });
      if (chunks.length > 3000) throw new Error("DK_CHUNK_LIMIT");
      if (end >= text.length) break;
      start = Math.max(start + 1, end - 200);
      if (/[\uDC00-\uDFFF]/.test(text[start])) start++;
    }
  }
  return chunks;
}
export function validateExtractedFacts(
  value: unknown,
  pages: KnowledgePage[],
): ExtractedFact[] {
  if (!Array.isArray(value) || value.length > 500)
    throw new Error("DK_INVALID_EXTRACTION");
  return value.map((raw: unknown) => {
    if (!raw || typeof raw !== "object") throw new Error("DK_INVALID_FACT");
    const f = raw as Record<string, unknown>;
    const source = pages.find((p) => p.page === f.source_page);
    if (
      !FACT_KINDS.includes(f.kind as FactKind) ||
      typeof f.contract_code !== "string" ||
      f.contract_code.length > 200 ||
      !source ||
      typeof f.quote !== "string" ||
      !f.quote.trim() ||
      f.quote.length > 2000 ||
      !source.text.includes(f.quote)
    )
      throw new Error("DK_EVIDENCE_NOT_FOUND");
    if (
      f.amount !== null &&
      (typeof f.amount !== "string" || !/^-?\d{1,24}$/.test(f.amount))
    )
      throw new Error("DK_INVALID_AMOUNT");
    if (f.event_date !== null && !isIsoDate(f.event_date))
      throw new Error("DK_INVALID_DATE");
    if (
      f.period_index !== null &&
      (!Number.isInteger(f.period_index) || Number(f.period_index) < 1)
    )
      throw new Error("DK_INVALID_PERIOD");
    return f as ExtractedFact;
  });
}
export function formatVnd(value: unknown): string {
  if (typeof value !== "string" || !/^-?\d+$/.test(value))
    return "Chưa có số liệu xác minh";
  return BigInt(value).toLocaleString("vi-VN") + " đồng";
}
