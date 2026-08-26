export type MachineAssignment = {
  id: string;
  date: string; // YYYY-MM-DD
  machineCode: string;
  machineName: string;
  plant: string;
  shift: "Ca 1" | "Ca 2" | "Ca 3";
  personsInCharge: string[];
  weldJoint: string;
  railType: string;
  status: "Đang thực hiện" | "Hoàn thành" | "Tạm dừng";
};

export const machineAssignments: MachineAssignment[] = [
  {
    id: "1",
    date: "2026-03-12",
    machineCode: "K920-01",
    machineName: "Máy hàn aluminothermic K920",
    plant: "Nhà máy Hà Nội",
    shift: "Ca 1",
    personsInCharge: ["Lê Thị Kim Anh", "Phạm Văn Minh"],
    weldJoint: "MH-HN-2026-0312-01",
    railType: "UIC60",
    status: "Hoàn thành",
  },
  {
    id: "2",
    date: "2026-03-12",
    machineCode: "AMS60-03",
    machineName: "Máy hàn đường ray AMS60",
    plant: "Nhà máy Đà Nẵng",
    shift: "Ca 2",
    personsInCharge: ["Phạm Văn Minh"],
    weldJoint: "MH-DN-2026-0312-04",
    railType: "UIC60",
    status: "Đang thực hiện",
  },
  {
    id: "3",
    date: "2026-03-11",
    machineCode: "GEO-01",
    machineName: "Máy định vị & hàn GEO",
    plant: "Nhà máy TP.HCM",
    shift: "Ca 1",
    personsInCharge: ["Nguyễn Văn Hùng", "Trần Quốc Bảo"],
    weldJoint: "MH-HCM-2026-0311-02",
    railType: "P50",
    status: "Hoàn thành",
  },
  {
    id: "4",
    date: "2026-03-11",
    machineCode: "K920-01",
    machineName: "Máy hàn aluminothermic K920",
    plant: "Nhà máy Hà Nội",
    shift: "Ca 3",
    personsInCharge: ["Trần Quốc Bảo"],
    weldJoint: "MH-HN-2026-0311-07",
    railType: "UIC60",
    status: "Hoàn thành",
  },
  {
    id: "5",
    date: "2026-03-10",
    machineCode: "AMS60-01",
    machineName: "Máy hàn đường ray AMS60 – tổ 1",
    plant: "Nhà máy Hà Nội",
    shift: "Ca 2",
    personsInCharge: ["Lê Thị Kim Anh", "Nguyễn Văn Hùng"],
    weldJoint: "MH-HN-2026-0310-03",
    railType: "P43",
    status: "Tạm dừng",
  },
  {
    id: "6",
    date: "2026-03-10",
    machineCode: "K355-02",
    machineName: "Máy hàn di động K355",
    plant: "Nhà máy Hà Nội",
    shift: "Ca 1",
    personsInCharge: ["Phạm Văn Minh"],
    weldJoint: "MH-HN-2026-0310-01",
    railType: "P50",
    status: "Hoàn thành",
  },
  {
    id: "7",
    date: "2026-03-09",
    machineCode: "AMS60-03",
    machineName: "Máy hàn đường ray AMS60",
    plant: "Nhà máy Đà Nẵng",
    shift: "Ca 3",
    personsInCharge: ["Nguyễn Văn Hùng"],
    weldJoint: "MH-DN-2026-0309-05",
    railType: "UIC60",
    status: "Hoàn thành",
  },
  {
    id: "8",
    date: "2026-03-09",
    machineCode: "K920-02",
    machineName: "Máy hàn aluminothermic K920 (dự phòng)",
    plant: "Nhà máy Đà Nẵng",
    shift: "Ca 1",
    personsInCharge: ["Trần Quốc Bảo", "Phạm Văn Minh"],
    weldJoint: "MH-DN-2026-0309-02",
    railType: "UIC60",
    status: "Đang thực hiện",
  },
  {
    id: "9",
    date: "2026-03-08",
    machineCode: "GEO-01",
    machineName: "Máy định vị & hàn GEO",
    plant: "Nhà máy TP.HCM",
    shift: "Ca 2",
    personsInCharge: ["Lê Thị Kim Anh"],
    weldJoint: "MH-HCM-2026-0308-06",
    railType: "P50",
    status: "Hoàn thành",
  },
  {
    id: "10",
    date: "2026-03-07",
    machineCode: "K920-01",
    machineName: "Máy hàn aluminothermic K920",
    plant: "Nhà máy Hà Nội",
    shift: "Ca 1",
    personsInCharge: ["Phạm Văn Minh", "Lê Thị Kim Anh", "Trần Quốc Bảo"],
    weldJoint: "MH-HN-2026-0307-04",
    railType: "UIC60",
    status: "Hoàn thành",
  },
];

export function formatAssignmentDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatPersons(persons: string[]) {
  return persons.join(", ");
}
