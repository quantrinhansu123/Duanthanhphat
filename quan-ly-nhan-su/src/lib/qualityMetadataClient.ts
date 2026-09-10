import type { CompanyCertificate } from "@/data/companyCertificates";
import type { ComplianceStandardItem } from "@/data/complianceStandards";

type CertificateRow = {
  id: string;
  title: string;
  standard_code: string;
  organization: string;
  certificate_number: string;
  scope: string;
  issued_at: string;
  expires_at: string;
  status: CompanyCertificate["status"];
  document_name?: string | null;
  document_url?: string | null;
  drive_file_id?: string | null;
  notes?: string | null;
};

type AssessmentRow = {
  item_id: string;
  status: ComplianceStandardItem["status"];
  scope: ComplianceStandardItem["scope"];
  evidence_doc?: string | null;
  evidence_url?: string | null;
  verifier?: string | null;
  verified_at?: string | null;
  notes?: string | null;
};

type ComplianceStandardRow = {
  id: string;
  standard_code: string;
  clause: string;
  title: string;
  requirement: string;
  scope: ComplianceStandardItem["scope"];
  related_standard: string;
  evidence_required: string;
  notes?: string | null;
};

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(payload.error || "HTTP " + response.status);
  return payload as T;
}

function certificateFromRow(row: CertificateRow): CompanyCertificate {
  return {
    id: row.id,
    title: row.title,
    standardCode: row.standard_code,
    organization: row.organization,
    certificateNumber: row.certificate_number,
    scope: row.scope,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    status: row.status,
    documentName: row.document_name || undefined,
    documentUrl: row.document_url || undefined,
    driveFileId: row.drive_file_id || undefined,
    notes: row.notes || undefined,
  };
}

function standardFromRow(row: ComplianceStandardRow): ComplianceStandardItem {
  return {
    id: row.id,
    standardCode: row.standard_code,
    clause: row.clause,
    title: row.title,
    requirement: row.requirement,
    scope: row.scope,
    relatedStandard: row.related_standard,
    evidenceRequired: row.evidence_required,
    notes: row.notes || undefined,
    status: "Chưa đánh giá",
  };
}

export async function loadQualityMetadata() {
  const response = await fetch("/api/quality-metadata", { cache: "no-store" });
  const payload = await parseResponse<{
    certificates: CertificateRow[];
    assessments: AssessmentRow[];
    standards: ComplianceStandardRow[];
  }>(response);
  return {
    certificates: payload.certificates.map(certificateFromRow),
    assessments: payload.assessments,
    standards: payload.standards.map(standardFromRow),
  };
}

export async function saveCompanyCertificate(item: CompanyCertificate) {
  const response = await fetch("/api/quality-metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "certificate", item }),
  });
  const payload = await parseResponse<{ item: CertificateRow }>(response);
  return certificateFromRow(payload.item);
}

export async function deleteCompanyCertificate(id: string) {
  const params = new URLSearchParams({ kind: "certificate", id });
  const response = await fetch("/api/quality-metadata?" + params.toString(), { method: "DELETE" });
  await parseResponse<{ success: true }>(response);
}

export async function saveComplianceAssessment(item: ComplianceStandardItem) {
  const response = await fetch("/api/quality-metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "compliance", item }),
  });
  const payload = await parseResponse<{ item: AssessmentRow }>(response);
  return payload.item;
}

export async function saveComplianceStandard(item: ComplianceStandardItem) {
  const response = await fetch("/api/quality-metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "standard", item }),
  });
  const payload = await parseResponse<{ item: ComplianceStandardRow }>(response);
  return standardFromRow(payload.item);
}

export function mergeComplianceAssessments(
  definitions: ComplianceStandardItem[],
  assessments: AssessmentRow[],
) {
  const byId = new Map(assessments.map((item) => [item.item_id, item]));
  return definitions.map((definition) => {
    const assessment = byId.get(definition.id);
    if (!assessment) return definition;
    return {
      ...definition,
      status: assessment.status,
      scope: assessment.scope,
      evidenceDoc: assessment.evidence_doc || undefined,
      evidenceUrl: assessment.evidence_url || undefined,
      verifier: assessment.verifier || undefined,
      verifiedAt: assessment.verified_at || undefined,
      notes: assessment.notes || definition.notes,
    };
  });
}
