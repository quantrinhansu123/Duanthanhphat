export type WeldMethod = "FBW" | "ATW";
export type WeldPurpose = "Thử nghiệm" | "Đào tạo" | "Sản xuất";
export type HistoricalWeldStatus = "Đạt" | "Lỗi";

export type HistoricalWeldRecord = {
  id: string;
  weldId: string;
  year: number;
  method: WeldMethod;
  weldType: WeldPurpose;
  welderName: string;
  project: string;
  status: HistoricalWeldStatus;
  errorReason: string;
};

/** Cột mẫu khi import Excel/CSV – dữ liệu lịch sử trước triển khai hệ thống */
export const historicalWeldColumns = [
  "ID mối hàn",
  "Thời gian thực hiện",
  "Phương pháp hàn",
  "Loại mối hàn",
  "Tên thợ hàn",
  "Dự án",
  "Trạng thái",
  "Nguyên nhân lỗi",
] as const;

export const historicalWelds: HistoricalWeldRecord[] = [
  {
    id: "1",
    weldId: "W00001",
    year: 2018,
    method: "FBW",
    weldType: "Thử nghiệm",
    welderName: "Lê Thị Kim Anh",
    project: "ĐSCT Bắc – Nam",
    status: "Đạt",
    errorReason: "",
  },
  {
    id: "2",
    weldId: "W00002",
    year: 2019,
    method: "ATW",
    weldType: "Đào tạo",
    welderName: "Phạm Văn Minh",
    project: "Dự án ga Đà Nẵng",
    status: "Lỗi",
    errorReason: "Lệch tim ray",
  },
  {
    id: "3",
    weldId: "W00003",
    year: 2020,
    method: "FBW",
    weldType: "Sản xuất",
    welderName: "Nguyễn Văn Hùng",
    project: "Dự án đường sắt Bắc Nam",
    status: "Đạt",
    errorReason: "",
  },
  {
    id: "4",
    weldId: "W00004",
    year: 2020,
    method: "FBW",
    weldType: "Sản xuất",
    welderName: "Trần Quốc Bảo",
    project: "Khu vực depot Hà Nội",
    status: "Lỗi",
    errorReason: "Lệch mép ray sau hàn",
  },
  {
    id: "5",
    weldId: "W00005",
    year: 2021,
    method: "FBW",
    weldType: "Sản xuất",
    welderName: "Lê Thị Kim Anh",
    project: "ĐSCT Bắc – Nam",
    status: "Đạt",
    errorReason: "",
  },
  {
    id: "6",
    weldId: "W00006",
    year: 2021,
    method: "ATW",
    weldType: "Sản xuất",
    welderName: "Phạm Văn Minh",
    project: "Dự án ga Đà Nẵng",
    status: "Lỗi",
    errorReason: "Khuyết khí trong mối hàn",
  },
  {
    id: "7",
    weldId: "W00007",
    year: 2022,
    method: "FBW",
    weldType: "Sản xuất",
    welderName: "Đỗ Thị Lan",
    project: "Tuyến metro số 1",
    status: "Đạt",
    errorReason: "",
  },
  {
    id: "8",
    weldId: "W00008",
    year: 2022,
    method: "ATW",
    weldType: "Thử nghiệm",
    welderName: "Nguyễn Văn Minh",
    project: "Khu vực depot Hà Nội",
    status: "Đạt",
    errorReason: "",
  },
  {
    id: "9",
    weldId: "W00009",
    year: 2023,
    method: "FBW",
    weldType: "Đào tạo",
    welderName: "Trần Thị Mai Anh",
    project: "Dự án đường sắt Bắc Nam",
    status: "Lỗi",
    errorReason: "Lệch tim ray",
  },
  {
    id: "10",
    weldId: "W00010",
    year: 2023,
    method: "FBW",
    weldType: "Sản xuất",
    welderName: "Nguyễn Văn Hùng",
    project: "ĐSCT Bắc – Nam",
    status: "Đạt",
    errorReason: "",
  },
];
