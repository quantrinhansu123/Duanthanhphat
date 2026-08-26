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

/** Lịch sử bảo trì bổ sung (quá khứ) — máy K920 */
type ArchiveRow = MachineMaintenanceHistoryRow & { machineCode: string };

const k920Archive: ArchiveRow[] = [
  {
    id: "k920-01-h1",
    machineCode: "K920-01",
    date: "2026-03-15",
    time: "07:30",
    durationMin: 150,
    title: "Bảo dưỡng định kỳ 500h",
    type: "Bảo dưỡng",
    status: "Đã xong",
    assignees: ["Phạm Văn Minh", "Nguyễn Văn Hùng"],
    note: "Thay dầu thủy lực, kiểm tra đầu hàn và van khí.",
  },
  {
    id: "k920-01-h2",
    machineCode: "K920-01",
    date: "2026-01-08",
    time: "09:00",
    durationMin: 90,
    title: "Thay cụm đầu hàn / khuôn",
    type: "Thay phụ tùng",
    status: "Đã xong",
    assignees: ["Trần Quốc Bảo"],
    note: "Thay khuôn UIC60 sau 1.200 mối hàn.",
  },
  {
    id: "k920-01-h3",
    machineCode: "K920-01",
    date: "2025-11-22",
    time: "08:00",
    durationMin: 60,
    title: "Kiểm định an toàn điện & khí",
    type: "Kiểm định",
    status: "Đã xong",
    assignees: ["Lê Thị Kim Anh", "Đỗ Thị Lan"],
  },
  {
    id: "k920-01-h4",
    machineCode: "K920-01",
    date: "2025-09-12",
    time: "07:00",
    durationMin: 180,
    title: "Bảo dưỡng định kỳ 500h",
    type: "Bảo dưỡng",
    status: "Đã xong",
    assignees: ["Phạm Văn Minh", "Nguyễn Văn Hùng"],
    note: "Vệ sinh buồng hàn, hiệu chuẩn cảm biến nhiệt.",
  },
  {
    id: "k920-01-h5",
    machineCode: "K920-01",
    date: "2025-06-03",
    time: "10:30",
    durationMin: 240,
    title: "Sửa hệ thống cấp khí aluminothermic",
    type: "Sửa chữa",
    status: "Đã xong",
    assignees: ["Nguyễn Văn Hùng", "Trần Quốc Bảo"],
    note: "Thay van solenoid và kiểm tra rò rỉ.",
  },
  {
    id: "k920-01-h6",
    machineCode: "K920-01",
    date: "2025-03-18",
    time: "08:00",
    durationMin: 120,
    title: "Bảo dưỡng định kỳ 500h",
    type: "Bảo dưỡng",
    status: "Đã xong",
    assignees: ["Phạm Văn Minh"],
  },
  {
    id: "k920-02-h1",
    machineCode: "K920-02",
    date: "2026-02-20",
    time: "08:30",
    durationMin: 120,
    title: "Bảo dưỡng trước khi tạm ngừng",
    type: "Bảo dưỡng",
    status: "Đã xong",
    assignees: ["Nguyễn Văn Minh"],
    note: "Máy chuyển trạng thái dự phòng.",
  },
  {
    id: "k920-02-h2",
    machineCode: "K920-02",
    date: "2025-10-05",
    time: "07:30",
    durationMin: 150,
    title: "Bảo dưỡng định kỳ 500h",
    type: "Bảo dưỡng",
    status: "Đã xong",
    assignees: ["Phạm Văn Minh", "Trần Quốc Bảo"],
  },
  {
    id: "k920-02-h3",
    machineCode: "K920-02",
    date: "2025-07-14",
    time: "09:00",
    durationMin: 75,
    title: "Kiểm tra sau sửa chữa",
    type: "Kiểm định",
    status: "Đã xong",
    assignees: ["Lê Thị Kim Anh"],
  },
  {
    id: "k920-02-h4",
    machineCode: "K920-02",
    date: "2025-04-22",
    time: "08:00",
    durationMin: 200,
    title: "Sửa bơm thủy lực kẹp ray",
    type: "Sửa chữa",
    status: "Đã xong",
    assignees: ["Trần Quốc Bảo", "Nguyễn Văn Hùng"],
  },
];

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
  const calendar = maintenanceEvents
    .filter((e) => e.machine === machineCode)
    .map(fromCalendarEvent);

  const archive = k920Archive
    .filter((r) => r.machineCode === machineCode)
    .map(({ machineCode: _code, ...row }) => row);

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
