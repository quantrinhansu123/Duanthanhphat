export type ProjectWeldStatus = "Đạt" | "Lỗi" | "Chờ kiểm tra";

export type ProjectWeld = {
  id: string;
  projectId: string;
  weldId: string;
  performedAt: string;
  method: "FBW" | "ATW";
  machine: string;
  welderName: string;
  status: ProjectWeldStatus;
  errorReason: string;
};

export const projectWelds: ProjectWeld[] = [
  { id: "1", projectId: "1", weldId: "FBW-18520", performedAt: "2024-05-31T14:32:00", method: "FBW", machine: "K922-1", welderName: "Lê Thị Kim Anh", status: "Đạt", errorReason: "" },
  { id: "2", projectId: "1", weldId: "FBW-18519", performedAt: "2024-05-31T14:18:00", method: "FBW", machine: "K922-1", welderName: "Nguyễn Văn Hùng", status: "Đạt", errorReason: "" },
  { id: "3", projectId: "1", weldId: "FBW-18518", performedAt: "2024-05-31T14:05:00", method: "FBW", machine: "K922-2", welderName: "Trần Quốc Bảo", status: "Lỗi", errorReason: "Lệch mép ray sau hàn" },
  { id: "4", projectId: "1", weldId: "ATW-0421", performedAt: "2024-05-31T13:47:00", method: "ATW", machine: "ATW-03", welderName: "Lê Thị Kim Anh", status: "Chờ kiểm tra", errorReason: "" },
  { id: "5", projectId: "2", weldId: "FBW-18402", performedAt: "2024-05-31T11:20:00", method: "FBW", machine: "K920", welderName: "Phạm Văn Minh", status: "Lỗi", errorReason: "Lệch tim ray" },
  { id: "6", projectId: "2", weldId: "FBW-18401", performedAt: "2024-05-31T11:05:00", method: "FBW", machine: "K920", welderName: "Trần Thị Mai Anh", status: "Đạt", errorReason: "" },
  { id: "7", projectId: "2", weldId: "ATW-0418", performedAt: "2024-05-31T10:42:00", method: "ATW", machine: "ATW-01", welderName: "Phạm Văn Minh", status: "Đạt", errorReason: "" },
  { id: "8", projectId: "3", weldId: "FBW-18310", performedAt: "2024-05-30T16:15:00", method: "FBW", machine: "K922-1", welderName: "Nguyễn Văn Hùng", status: "Đạt", errorReason: "" },
  { id: "9", projectId: "3", weldId: "FBW-18309", performedAt: "2024-05-30T15:58:00", method: "FBW", machine: "K922-2", welderName: "Trần Quốc Bảo", status: "Lỗi", errorReason: "Khuyết khí trong mối hàn" },
  { id: "10", projectId: "3", weldId: "ATW-0415", performedAt: "2024-05-30T15:30:00", method: "ATW", machine: "ATW-02", welderName: "Nguyễn Văn Hùng", status: "Lỗi", errorReason: "Lỗi siêu âm" },
  { id: "11", projectId: "4", weldId: "FBW-18201", performedAt: "2024-05-29T09:10:00", method: "FBW", machine: "K918", welderName: "Nguyễn Văn Minh", status: "Đạt", errorReason: "" },
  { id: "12", projectId: "4", weldId: "FBW-18200", performedAt: "2024-05-29T08:55:00", method: "FBW", machine: "K918", welderName: "Trần Văn C", status: "Lỗi", errorReason: "Bavia quá mức" },
  { id: "13", projectId: "5", weldId: "FBW-18100", performedAt: "2024-04-12T10:00:00", method: "FBW", machine: "K915", welderName: "Trần Quốc Bảo", status: "Đạt", errorReason: "" },
  { id: "14", projectId: "5", weldId: "ATW-0401", performedAt: "2024-04-12T09:30:00", method: "ATW", machine: "ATW-01", welderName: "Đỗ Thị Lan", status: "Lỗi", errorReason: "Lỗi bề mặt" },
];

export function getProjectWelds(projectId: string): ProjectWeld[] {
  return projectWelds
    .filter((w) => w.projectId === projectId)
    .sort((a, b) => b.performedAt.localeCompare(a.performedAt));
}
