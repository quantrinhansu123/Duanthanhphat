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

export type WeldingQualificationContext = {
  railType: string;
  method: "FBW" | "ATW";
  machineCode?: string | null;
  machineName?: string | null;
};

/**
 * Kiểm tra chứng chỉ theo công nghệ/máy thật.
 *
 * Dữ liệu R4 dùng chứng chỉ K922-1, UN5-150ZB, Thermit và Railtech thay vì
 * các nhãn hạng thợ mẫu cũ. Với FBW, khi đã chọn máy thì chứng chỉ vận hành
 * phải khớp họ máy; với ATW chấp nhận các chứng chỉ hàn nhôm nhiệt.
 */
export function isCertificateEligibleForWeld(
  certificate: string,
  context: WeldingQualificationContext,
): boolean {
  const normalized = normalizeCertificate(certificate);
  const machine = normalizeCertificate(`${context.machineCode ?? ""} ${context.machineName ?? ""}`);
  const rail = normalizeCertificate(context.railType);

  if (context.method === "ATW") {
    if (
      normalized.includes("aluminothermic") ||
      normalized.includes("thermit") ||
      normalized.includes("nhomnhiet")
    ) {
      return true;
    }

    if (rail.includes("p50") || rail.includes("p43")) {
      return normalized === normalizeCertificate(WELDING_CERTIFICATES.railClass2P50P43);
    }
    return normalized === normalizeCertificate(WELDING_CERTIFICATES.railClass1Uic60);
  }

  const isFlashButt =
    normalized.includes("flashbutt") ||
    normalized.includes("vanhanhmayhan") ||
    normalized === normalizeCertificate(WELDING_CERTIFICATES.iso9606);
  if (!isFlashButt) return false;

  if (machine.includes("kcm") || machine.includes("k922") || machine.includes("k920")) {
    return normalized.includes("k922") || normalized.includes("k920") || normalized.includes("kcm");
  }
  if (machine.includes("un5")) return normalized.includes("un5");
  return true;
}

export function eligibleCertificatesForWeld(
  certificates: string | string[] | null | undefined,
  context: WeldingQualificationContext,
): string[] {
  return parseCertificateList(certificates).filter((certificate) =>
    isCertificateEligibleForWeld(certificate, context),
  );
}

export function describeCertificateRequirement(context: WeldingQualificationContext): string {
  if (context.method === "ATW") return "Chứng chỉ hàn nhôm nhiệt (Thermit/Railtech)";

  const machine = normalizeCertificate(`${context.machineCode ?? ""} ${context.machineName ?? ""}`);
  if (machine.includes("kcm") || machine.includes("k922") || machine.includes("k920")) {
    return "Chứng chỉ vận hành máy hàn K922-1/KCM";
  }
  if (machine.includes("un5")) return "Chứng chỉ vận hành máy hàn UN5";
  return "Chứng chỉ vận hành hàn đối đầu (FBW)";
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
