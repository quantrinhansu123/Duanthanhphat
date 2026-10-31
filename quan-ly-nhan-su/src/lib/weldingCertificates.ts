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
 * Danh mục thực tế dùng tên dạng “Hàn ray chảy giáp mép - UN5/K922-1”,
 * “Hàn ray nhiệt nhôm - Railtech/Goldschmidt”, không chỉ nhãn “vận hành máy hàn”
 * hay Flash-Butt. Với FBW, khi đã chọn máy thì chứng chỉ phải khớp họ máy;
 * với ATW chấp nhận các chứng chỉ hàn nhôm nhiệt.
 */
export function isCertificateEligibleForWeld(
  certificate: string,
  context: WeldingQualificationContext,
): boolean {
  const normalized = normalizeCertificate(certificate);
  const certFamily = certificateEquipmentFamily(certificate);
  const machineFamily = machineEquipmentFamily({
    code: context.machineCode,
    name: context.machineName,
  });
  const rail = normalizeCertificate(context.railType);

  if (context.method === "ATW") {
    if (certFamily === "atw") return true;
    if (
      normalized.includes("aluminothermic") ||
      normalized.includes("thermit") ||
      normalized.includes("nhomnhiet") ||
      normalized.includes("nhietnhom") ||
      normalized.includes("railtech") ||
      normalized.includes("goldschmidt") ||
      normalized.includes("shangdong") ||
      normalized.includes("shandong")
    ) {
      return true;
    }

    if (rail.includes("p50") || rail.includes("p43")) {
      return normalized === normalizeCertificate(WELDING_CERTIFICATES.railClass2P50P43);
    }
    return normalized === normalizeCertificate(WELDING_CERTIFICATES.railClass1Uic60);
  }

  // FBW: chấp nhận chứng chỉ đã gắn họ máy KCM/UN5, hoặc nhãn FBW phổ biến.
  const isFlashButt =
    certFamily === "kcm" ||
    certFamily === "un5" ||
    normalized.includes("flashbutt") ||
    normalized.includes("vanhanhmayhan") ||
    normalized.includes("chaygiapmep") ||
    normalized.includes("doimau") ||
    normalized === normalizeCertificate(WELDING_CERTIFICATES.iso9606);
  if (!isFlashButt) return false;

  if (machineFamily === "kcm") {
    return (
      certFamily === "kcm" ||
      normalized.includes("k922") ||
      normalized.includes("k920") ||
      normalized.includes("kcm")
    );
  }
  if (machineFamily === "un5") {
    return certFamily === "un5" || normalized.includes("un5");
  }
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

/** Họ thiết bị dùng để ghép chứng chỉ ↔ máy. `null` = chung, khớp mọi máy. */
export type WeldEquipmentFamily = "kcm" | "un5" | "atw";

function familyFromText(normalized: string): WeldEquipmentFamily | null {
  if (normalized.includes("kcm") || normalized.includes("k922") || normalized.includes("k920")) return "kcm";
  if (normalized.includes("un5")) return "un5";
  if (
    normalized.includes("atw") ||
    normalized.includes("aluminothermic") ||
    normalized.includes("thermit") ||
    normalized.includes("railtech") ||
    normalized.includes("nhomnhiet") ||
    normalized.includes("nhietnhom") ||
    normalized.includes("goldschmidt") ||
    normalized.includes("shangdong") ||
    normalized.includes("shandong")
  ) {
    return "atw";
  }
  return null;
}

export function certificateEquipmentFamily(certificate: string): WeldEquipmentFamily | null {
  return familyFromText(normalizeCertificate(certificate));
}

export function machineEquipmentFamily(
  machine: { code?: string | null; name?: string | null } | null | undefined,
): WeldEquipmentFamily | null {
  if (!machine) return null;
  return familyFromText(normalizeCertificate(`${machine.code ?? ""} ${machine.name ?? ""}`));
}

export function isCertificateCompatibleWithMachine(
  certificate: string,
  machine: { code?: string | null; name?: string | null } | null | undefined,
): boolean {
  const certFamily = certificateEquipmentFamily(certificate);
  const machineFamily = machineEquipmentFamily(machine);
  return !certFamily || !machineFamily || certFamily === machineFamily;
}

export function weldMethodForFamily(family: WeldEquipmentFamily | null): "FBW" | "ATW" | null {
  if (family === "atw") return "ATW";
  if (family === "kcm" || family === "un5") return "FBW";
  return null;
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
