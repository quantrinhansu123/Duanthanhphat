import { maintenanceEvents, type MaintenanceEvent } from "@/data/maintenance";

export type MachineMaintenanceHistoryRow = {
  id: string;
  date: string;
  time: string;
  title: string;
  type: MaintenanceEvent["type"];
  status: MaintenanceEvent["status"];
  durationMin: number;
  assignees: string[];
  note?: string;
};

/** Lịch sử bảo trì lưu trữ (quá khứ) */
type ArchiveRow = MachineMaintenanceHistoryRow & { machineCode: string };

const machineArchiveHistory: ArchiveRow[] = [
  // --- KCM007-01: Tổ hợp máy hàn ray lưu động KCM-007 (K922-1) ---
  {
    id: "kcm007-01-h1",
    machineCode: "KCM007-01",
    date: "2026-03-15",
    time: "07:30",
    durationMin: 150,
    title: "Bảo dưỡng định kỳ 500h",
    type: "Bảo dưỡng",
    status: "Đã xong",
    assignees: ["Phạm Văn Minh", "Nguyễn Văn Hùng"],
    note: "Thay dầu thủy lực kẹp ray, kiểm tra điện cực hàn tiếp xúc và hệ thống van khí.",
  },
  {
    id: "kcm007-01-h2",
    machineCode: "KCM007-01",
    date: "2026-01-08",
    time: "09:00",
    durationMin: 90,
    title: "Thay khuôn kẹp định vị ray",
    type: "Thay phụ tùng",
    status: "Đã xong",
    assignees: ["Trần Quốc Bảo"],
    note: "Thay bộ khuôn kẹp UIC60 sau 1.200 mối hàn.",
  },
  {
    id: "kcm007-01-h3",
    machineCode: "KCM007-01",
    date: "2025-11-22",
    time: "08:00",
    durationMin: 60,
    title: "Kiểm định an toàn điện & tiếp địa xe tải",
    type: "Kiểm định",
    status: "Đã xong",
    assignees: ["Lê Thị Kim Anh", "Đỗ Thị Lan"],
  },
  {
    id: "kcm007-01-h4",
    machineCode: "KCM007-01",
    date: "2025-09-12",
    time: "07:00",
    durationMin: 180,
    title: "Bảo dưỡng định kỳ 500h",
    type: "Bảo dưỡng",
    status: "Đã xong",
    assignees: ["Phạm Văn Minh", "Nguyễn Văn Hùng"],
    note: "Vệ sinh buồng hàn, hiệu chuẩn cảm biến nhiệt độ mối hàn đối đầu.",
  },
  {
    id: "kcm007-01-h5",
    machineCode: "KCM007-01",
    date: "2025-06-03",
    time: "10:30",
    durationMin: 240,
    title: "Sửa hệ thống thủy lực nâng hạ bánh sắt",
    type: "Sửa chữa",
    status: "Đã xong",
    assignees: ["Nguyễn Văn Hùng", "Trần Quốc Bảo"],
    note: "Thay phớt xi lanh thủy lực dẫn hướng ray và kiểm tra rò rỉ áp suất.",
  },
  {
    id: "kcm007-01-h6",
    machineCode: "KCM007-01",
    date: "2025-03-18",
    time: "08:00",
    durationMin: 120,
    title: "Bảo dưỡng định kỳ 500h",
    type: "Bảo dưỡng",
    status: "Đã xong",
    assignees: ["Phạm Văn Minh"],
  },

  // --- KCM007-02: Tổ hợp KCM-007 (Tổ 2) ---
  {
    id: "kcm007-02-h1",
    machineCode: "KCM007-02",
    date: "2026-02-20",
    time: "08:30",
    durationMin: 120,
    title: "Bảo dưỡng trước khi điều chuyển công trường",
    type: "Bảo dưỡng",
    status: "Đã xong",
    assignees: ["Nguyễn Văn Minh"],
    note: "Kiểm tra hệ thống Road-Rail trước khi chuyển vào bãi máy Đà Nẵng.",
  },
  {
    id: "kcm007-02-h2",
    machineCode: "KCM007-02",
    date: "2025-10-05",
    time: "07:30",
    durationMin: 150,
    title: "Bảo dưỡng định kỳ 500h",
    type: "Bảo dưỡng",
    status: "Đã xong",
    assignees: ["Phạm Văn Minh", "Trần Quốc Bảo"],
  },
  {
    id: "kcm007-02-h3",
    machineCode: "KCM007-02",
    date: "2025-07-14",
    time: "09:00",
    durationMin: 75,
    title: "Kiểm tra sau sửa chữa mạch kích dòng",
    type: "Kiểm định",
    status: "Đã xong",
    assignees: ["Lê Thị Kim Anh"],
  },
  {
    id: "kcm007-02-h4",
    machineCode: "KCM007-02",
    date: "2025-04-22",
    time: "08:00",
    durationMin: 200,
    title: "Sửa bơm thủy lực kẹp ray",
    type: "Sửa chữa",
    status: "Đã xong",
    assignees: ["Trần Quốc Bảo", "Nguyễn Văn Hùng"],
  },

  // --- UN5-150ZC2-01: Máy hàn tiếp xúc đối đầu ray lưu động ---
  {
    id: "un5-01-h1",
    machineCode: "UN5-150ZC2-01",
    date: "2026-02-25",
    time: "08:00",
    durationMin: 120,
    title: "Hiệu chuẩn lực ép đối đầu (Upsetting Force)",
    type: "Kiểm định",
    status: "Đã xong",
    assignees: ["Trần Quốc Bảo", "Nguyễn Văn Hùng"],
    note: "Kiểm định lực ép 90 ~ 120 kN và lực kẹp 280 kN đạt tiêu chuẩn.",
  },
  {
    id: "un5-01-h2",
    machineCode: "UN5-150ZC2-01",
    date: "2025-12-10",
    time: "09:00",
    durationMin: 180,
    title: "Bảo dưỡng định kỳ 500h",
    type: "Bảo dưỡng",
    status: "Đã xong",
    assignees: ["Phạm Văn Minh", "Lê Thị Kim Anh"],
    note: "Thay dầu làm mát máy biến áp hàn và vệ sinh má kẹp đồng hợp kim.",
  },

  // --- UN5-150ZC2-02: Máy hàn dự phòng ---
  {
    id: "un5-02-h1",
    machineCode: "UN5-150ZC2-02",
    date: "2026-01-15",
    time: "08:30",
    durationMin: 150,
    title: "Bảo dưỡng trạng thái lưu kho & kiểm tra kẹp ray",
    type: "Bảo dưỡng",
    status: "Đã xong",
    assignees: ["Nguyễn Văn Hùng", "Đỗ Thị Lan"],
    note: "Bảo quản máy dự phòng tại bãi Giáp Bát.",
  },
];

const legacyCodeMap: Record<string, string> = {
  "K920-01": "KCM007-01",
  "K920-02": "KCM007-02",
  "AMS60-01": "UN5-150ZC2-01",
  "AMS60-03": "UN5-150ZC2-01",
  "K355-02": "UN5-150ZC2-02",
  "GEO-01": "UN5-150ZC2-02",
};

function fromCalendarEvent(e: MaintenanceEvent): MachineMaintenanceHistoryRow {
  return {
    id: e.id,
    date: e.date,
    time: e.time,
    title: e.title,
    type: e.type,
    status: e.status,
    durationMin: e.durationMin,
    assignees: e.assignees.map((a) => a.name),
  };
}

export function getMachineMaintenanceHistory(machineCode: string): MachineMaintenanceHistoryRow[] {
  // Map legacy machine codes if requested
  const resolvedCode = legacyCodeMap[machineCode] || machineCode;

  const calendar = maintenanceEvents
    .filter((e) => e.machine === machineCode || e.machine === resolvedCode)
    .map(fromCalendarEvent);

  const archive = machineArchiveHistory
    .filter((r) => r.machineCode === machineCode || r.machineCode === resolvedCode)
    .map(({ machineCode: _, ...row }) => row);

  const merged = new Map<string, MachineMaintenanceHistoryRow>();
  for (const row of [...calendar, ...archive]) {
    merged.set(row.id, row);
  }

  return Array.from(merged.values()).sort((a, b) => {
    const d = b.date.localeCompare(a.date);
    if (d !== 0) return d;
    return b.time.localeCompare(a.time);
  });
}

export function formatMaintenanceDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("vi-VN");
}
