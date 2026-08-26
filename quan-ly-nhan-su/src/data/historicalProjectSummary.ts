export type ProjectWeldCategory = "PD" | "SX";
export type ProjectWeldTech = "FBW" | "ATW";

export type HistoricalProjectSummary = {
  id: string;
  no: number;
  project: string;
  year: number;
  weldCategory: ProjectWeldCategory;
  technology: ProjectWeldTech;
  weldCount: number;
  errorCount: number;
  welderName: string;
  errorReason: string;
};

export const projectSummaryColumns = [
  { key: "no", label: "TT", hint: "" },
  { key: "project", label: "Dự án", hint: "Nhập tên Dự án" },
  { key: "year", label: "Ngày thực hiện", hint: "Nhập năm thực hiện" },
  { key: "weldCategory", label: "Loại mối hàn", hint: 'Nhập "PD" or "SX"' },
  { key: "technology", label: "Công nghệ hàn", hint: "Nhập FBW or ATW" },
  { key: "weldCount", label: "Thành phẩm", hint: "Nhập số mối thành phẩm / thực hiện" },
  { key: "errorCount", label: "Hàng lỗi", hint: "Nhập số mối bị lỗi" },
  { key: "welderName", label: "Tên thợ hàn", hint: "Nhập tên thợ hàn" },
  { key: "errorReason", label: "Nguyên nhân lỗi", hint: "Nhập nguyên nhân lỗi" },
] as const;

/** PD = Phát triển / thử nghiệm · SX = Sản xuất */
export const weldCategoryLabel: Record<ProjectWeldCategory, string> = {
  PD: "Phát triển",
  SX: "Sản xuất",
};

export const historicalProjectSummary: HistoricalProjectSummary[] = [
  {
    id: "1",
    no: 1,
    project: "Yangon–Mandalay",
    year: 2020,
    weldCategory: "PD",
    technology: "FBW",
    weldCount: 30,
    errorCount: 0,
    welderName: "Lê Thị Kim Anh",
    errorReason: "",
  },
  {
    id: "2",
    no: 2,
    project: "Yangon–Mandalay",
    year: 2020,
    weldCategory: "SX",
    technology: "FBW",
    weldCount: 500,
    errorCount: 1,
    welderName: "Lê Thị Kim Anh",
    errorReason: "Lệch tim ray",
  },
  {
    id: "3",
    no: 3,
    project: "Yangon–Mandalay",
    year: 2020,
    weldCategory: "SX",
    technology: "FBW",
    weldCount: 700,
    errorCount: 0,
    welderName: "Phạm Văn Minh",
    errorReason: "",
  },
  {
    id: "4",
    no: 4,
    project: "Yangon–Mandalay",
    year: 2021,
    weldCategory: "SX",
    technology: "FBW",
    weldCount: 1000,
    errorCount: 1,
    welderName: "Nguyễn Văn Hùng",
    errorReason: "Lệch mép ray sau hàn",
  },
  {
    id: "5",
    no: 5,
    project: "Yangon–Mandalay",
    year: 2021,
    weldCategory: "PD",
    technology: "ATW",
    weldCount: 20,
    errorCount: 0,
    welderName: "Lê Thị Kim Anh",
    errorReason: "",
  },
  {
    id: "6",
    no: 6,
    project: "Yangon–Mandalay",
    year: 2021,
    weldCategory: "SX",
    technology: "ATW",
    weldCount: 60,
    errorCount: 0,
    welderName: "Lê Thị Kim Anh",
    errorReason: "",
  },
  {
    id: "7",
    no: 7,
    project: "ĐSCT Bắc – Nam",
    year: 2020,
    weldCategory: "SX",
    technology: "FBW",
    weldCount: 820,
    errorCount: 2,
    welderName: "Trần Quốc Bảo",
    errorReason: "Khuyết khí trong mối hàn",
  },
  {
    id: "8",
    no: 8,
    project: "ĐSCT Bắc – Nam",
    year: 2021,
    weldCategory: "SX",
    technology: "ATW",
    weldCount: 145,
    errorCount: 0,
    welderName: "Đỗ Thị Lan",
    errorReason: "",
  },
  {
    id: "9",
    no: 9,
    project: "Dự án ga Đà Nẵng",
    year: 2021,
    weldCategory: "PD",
    technology: "FBW",
    weldCount: 45,
    errorCount: 0,
    welderName: "Trần Thị Mai Anh",
    errorReason: "",
  },
  {
    id: "10",
    no: 10,
    project: "Dự án ga Đà Nẵng",
    year: 2022,
    weldCategory: "SX",
    technology: "FBW",
    weldCount: 630,
    errorCount: 3,
    welderName: "Phạm Văn Minh",
    errorReason: "Lệch tim ray",
  },
];
