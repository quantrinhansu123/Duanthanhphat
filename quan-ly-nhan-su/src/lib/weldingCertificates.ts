export const WELDING_CERTIFICATES = {
  railClass1Uic60: "Chứng chỉ thợ hàn ray hạng 1 – UIC60",
  railClass2P50P43: "Chứng chỉ thợ hàn ray hạng 2 – P50/P43",
  iso9606: "Chứng chỉ ISO 9606 – Welding Qualification",
  ndt: "Chứng chỉ NDT – kiểm tra siêu âm mối hàn",
  machineK920: "Chứng chỉ vận hành máy hàn K920",
  safetyGroup3: "Chứng chỉ an toàn lao động nhóm 3",
} as const;

export const WELDING_CERTIFICATE_OPTIONS = Object.values(WELDING_CERTIFICATES);

export function parseCertificateList(value: string | string[] | null | undefined): string[] {
  const entries = Array.isArray(value) ? value : (value ?? "").split(",");
  return Array.from(new Set(entries.map((item) => item.trim()).filter(Boolean)));
}

export function formatCertificateList(value: string | string[] | null | undefined): string {
  return parseCertificateList(value).join(", ");
}

function normalizeCertificate(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi")
    .replace(/[^a-z0-9]+/g, "");
}

export function hasCertificate(
  certificates: string | string[] | null | undefined,
  requiredCertificate: string,
): boolean {
  const required = normalizeCertificate(requiredCertificate);
  return parseCertificateList(certificates).some(
    (certificate) => normalizeCertificate(certificate) === required,
  );
}

export function requiredCertificateForWeld(
  railType: string,
  method: "FBW" | "ATW",
): string {
  const normalizedRail = railType.toLocaleUpperCase("vi").replace(/\s+/g, "");
  if (normalizedRail.includes("UIC60")) return WELDING_CERTIFICATES.railClass1Uic60;
  if (normalizedRail.includes("P50") || normalizedRail.includes("P43")) {
    return WELDING_CERTIFICATES.railClass2P50P43;
  }
  return method === "ATW"
    ? WELDING_CERTIFICATES.railClass1Uic60
    : WELDING_CERTIFICATES.iso9606;
}

export function defaultCertificatesForPersonnelCode(code: string): string[] {
  if (/001$/i.test(code)) {
    return [WELDING_CERTIFICATES.railClass1Uic60, WELDING_CERTIFICATES.iso9606];
  }
  if (/002$/i.test(code)) {
    return [
      WELDING_CERTIFICATES.railClass1Uic60,
      WELDING_CERTIFICATES.railClass2P50P43,
      WELDING_CERTIFICATES.machineK920,
    ];
  }
  if (/003$/i.test(code)) {
    return [WELDING_CERTIFICATES.railClass1Uic60, WELDING_CERTIFICATES.safetyGroup3];
  }
  if (/004$/i.test(code)) {
    return [WELDING_CERTIFICATES.railClass2P50P43, WELDING_CERTIFICATES.ndt];
  }
  if (/005$/i.test(code)) {
    return [WELDING_CERTIFICATES.railClass2P50P43, WELDING_CERTIFICATES.iso9606];
  }
  if (/006$/i.test(code)) return [WELDING_CERTIFICATES.iso9606];
  return [];
}
