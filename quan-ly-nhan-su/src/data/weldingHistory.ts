export type WeldingHistoryRecord = {
  id: string;
  date: string; // YYYY-MM-DD
  weldingId: string;
  welderName: string;
  rank: string;
  weldJoint: string;
  machine: string;
  railType: string;
  project: string;
  shift: "Ca 1" | "Ca 2" | "Ca 3";
  result: "Đạt" | "Không đạt" | "Sửa chữa";
};

export const weldingHistory: WeldingHistoryRecord[] = [
  {
    id: "1",
    date: "2026-03-12",
    weldingId: "WH001",
    welderName: "Lê Thị Kim Anh",
    rank: "Hạng 1",
    weldJoint: "MH-HN-2026-0312-01",
    machine: "K920-01",
    railType: "UIC60",
    project: "Dự án đường sắt Bắc Nam",
    shift: "Ca 1",
    result: "Đạt",
  },
  {
    id: "2",
    date: "2026-03-12",
    weldingId: "WH002",
    welderName: "Phạm Văn Minh",
    rank: "Hạng 2",
    weldJoint: "MH-DN-2026-0312-04",
    machine: "AMS60-03",
    railType: "UIC60",
    project: "Dự án ga Đà Nẵng",
    shift: "Ca 2",
    result: "Đạt",
  },
  {
    id: "3",
    date: "2026-03-11",
    weldingId: "WH003",
    welderName: "Nguyễn Văn Hùng",
    rank: "Hạng 1",
    weldJoint: "MH-HCM-2026-0311-02",
    machine: "GEO-01",
    railType: "P50",
    project: "Tuyến metro số 1",
    shift: "Ca 1",
    result: "Sửa chữa",
  },
  {
    id: "4",
    date: "2026-03-11",
    weldingId: "WH004",
    welderName: "Trần Quốc Bảo",
    rank: "Hạng 2",
    weldJoint: "MH-HN-2026-0311-07",
    machine: "K920-01",
    railType: "UIC60",
    project: "Dự án đường sắt Bắc Nam",
    shift: "Ca 3",
    result: "Đạt",
  },
  {
    id: "5",
    date: "2026-03-10",
    weldingId: "WH001",
    welderName: "Lê Thị Kim Anh",
    rank: "Hạng 1",
    weldJoint: "MH-HN-2026-0310-03",
    machine: "AMS60-01",
    railType: "P43",
    project: "Dự án đường sắt Bắc Nam",
    shift: "Ca 2",
    result: "Đạt",
  },
  {
    id: "6",
    date: "2026-03-10",
    weldingId: "WH005",
    welderName: "Đỗ Thị Lan",
    rank: "Hạng 3",
    weldJoint: "MH-HN-2026-0310-01",
    machine: "K355-02",
    railType: "P50",
    project: "Khu vực depot Hà Nội",
    shift: "Ca 1",
    result: "Không đạt",
  },
  {
    id: "7",
    date: "2026-03-09",
    weldingId: "WH002",
    welderName: "Phạm Văn Minh",
    rank: "Hạng 2",
    weldJoint: "MH-DN-2026-0309-05",
    machine: "AMS60-03",
    railType: "UIC60",
    project: "Dự án ga Đà Nẵng",
    shift: "Ca 3",
    result: "Đạt",
  },
  {
    id: "8",
    date: "2026-03-09",
    weldingId: "WH004",
    welderName: "Trần Quốc Bảo",
    rank: "Hạng 2",
    weldJoint: "MH-DN-2026-0309-02",
    machine: "K920-02",
    railType: "UIC60",
    project: "Dự án ga Đà Nẵng",
    shift: "Ca 1",
    result: "Đạt",
  },
  {
    id: "9",
    date: "2026-03-08",
    weldingId: "WH003",
    welderName: "Nguyễn Văn Hùng",
    rank: "Hạng 1",
    weldJoint: "MH-HCM-2026-0308-06",
    machine: "GEO-01",
    railType: "P50",
    project: "Tuyến metro số 1",
    shift: "Ca 2",
    result: "Đạt",
  },
  {
    id: "10",
    date: "2026-03-07",
    weldingId: "WH006",
    welderName: "Vũ Đức Thắng",
    rank: "Hạng 1",
    weldJoint: "MH-HN-2026-0307-04",
    machine: "K355-02",
    railType: "P43",
    project: "Khu vực depot Hà Nội",
    shift: "Ca 1",
    result: "Sửa chữa",
  },
];

export function formatWeldingDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
