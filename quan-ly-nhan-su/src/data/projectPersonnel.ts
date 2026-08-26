export type ProjectPersonnel = {
  id: string;
  projectId: string;
  name: string;
  position: string;
  role: string;
  onDuty: boolean;
  weldsToday: number;
};

export const projectPersonnel: ProjectPersonnel[] = [
  { id: "1", projectId: "1", name: "Lê Thị Kim Anh", position: "Thợ hàn", role: "Nhân viên", onDuty: true, weldsToday: 14 },
  { id: "2", projectId: "1", name: "Nguyễn Văn Hùng", position: "Thợ hàn", role: "Nhân viên", onDuty: true, weldsToday: 11 },
  { id: "3", projectId: "1", name: "Trần Quốc Bảo", position: "Thợ hàn", role: "Nhân viên", onDuty: false, weldsToday: 0 },
  { id: "4", projectId: "1", name: "Phạm Văn Minh", position: "Giám sát", role: "Tổ trưởng", onDuty: true, weldsToday: 0 },
  { id: "5", projectId: "2", name: "Phạm Văn Minh", position: "Thợ hàn", role: "Nhân viên", onDuty: true, weldsToday: 9 },
  { id: "6", projectId: "2", name: "Trần Thị Mai Anh", position: "Thợ hàn", role: "Nhân viên", onDuty: true, weldsToday: 8 },
  { id: "7", projectId: "2", name: "Đỗ Thị Lan", position: "Kỹ thuật viên", role: "Kiểm tra", onDuty: false, weldsToday: 0 },
  { id: "8", projectId: "3", name: "Nguyễn Văn Hùng", position: "Thợ hàn", role: "Nhân viên", onDuty: true, weldsToday: 12 },
  { id: "9", projectId: "3", name: "Trần Quốc Bảo", position: "Thợ hàn", role: "Nhân viên", onDuty: true, weldsToday: 10 },
  { id: "10", projectId: "3", name: "Lê Thị Kim Anh", position: "Giám sát", role: "Tổ trưởng", onDuty: false, weldsToday: 0 },
  { id: "11", projectId: "4", name: "Nguyễn Văn Minh", position: "Thợ hàn", role: "Nhân viên", onDuty: true, weldsToday: 7 },
  { id: "12", projectId: "4", name: "Trần Văn C", position: "Thợ hàn", role: "Nhân viên", onDuty: false, weldsToday: 0 },
  { id: "13", projectId: "5", name: "Trần Quốc Bảo", position: "Thợ hàn", role: "Nhân viên", onDuty: false, weldsToday: 0 },
  { id: "14", projectId: "5", name: "Đỗ Thị Lan", position: "Thợ hàn", role: "Nhân viên", onDuty: false, weldsToday: 0 },
];

export function getProjectPersonnel(projectId: string): ProjectPersonnel[] {
  return projectPersonnel.filter((p) => p.projectId === projectId);
}
