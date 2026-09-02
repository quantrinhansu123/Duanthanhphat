export type Welder = {
  id: string;
  weldingId: string;
  name: string;
  email: string;
  department: string;
  position: string;
  weldingTeam: string;
  rank: string;
  railTypes: string;
  trainedMachines: string;
  experience: string;
  status: "Hoạt động" | "Khóa";
  photo: string;
};

export const welders: Welder[] = [
  {
    id: "1",
    weldingId: "WH001",
    name: "Lê Thị Kim Anh",
    email: "anhltk@thanhphat.vn",
    department: "Phòng Sản xuất",
    position: "Thợ hàn",
    weldingTeam: "Tổ hàn 1",
    rank: "Hạng 1",
    railTypes: "UIC60, P50",
    trainedMachines: "K920, AMS60",
    experience: "5 năm",
    status: "Hoạt động",
    photo: "https://randomuser.me/api/portraits/women/65.jpg",
  },
  {
    id: "2",
    weldingId: "WH002",
    name: "Phạm Văn Minh",
    email: "minhpv@thanhphat.vn",
    department: "Phòng Sản xuất",
    position: "Tổ trưởng",
    weldingTeam: "Tổ hàn 1",
    rank: "Hạng 2",
    railTypes: "UIC60, P43, P50",
    trainedMachines: "K920, K355, AMS60",
    experience: "12 năm",
    status: "Hoạt động",
    photo: "https://randomuser.me/api/portraits/men/52.jpg",
  },
  {
    id: "3",
    weldingId: "WH003",
    name: "Nguyễn Văn Hùng",
    email: "hungnv@thanhphat.vn",
    department: "Phòng Sản xuất",
    position: "Thợ hàn",
    weldingTeam: "Tổ hàn 2",
    rank: "Hạng 1",
    railTypes: "UIC60",
    trainedMachines: "AMS60",
    experience: "3 năm",
    status: "Hoạt động",
    photo: "https://randomuser.me/api/portraits/men/36.jpg",
  },
  {
    id: "4",
    weldingId: "WH004",
    name: "Trần Quốc Bảo",
    email: "baotq@thanhphat.vn",
    department: "Phòng Sản xuất",
    position: "Thợ hàn",
    weldingTeam: "Tổ hàn 2",
    rank: "Hạng 2",
    railTypes: "P50, P43",
    trainedMachines: "K920, K355",
    experience: "8 năm",
    status: "Hoạt động",
    photo: "https://randomuser.me/api/portraits/men/22.jpg",
  },
  {
    id: "5",
    weldingId: "WH005",
    name: "Đỗ Thị Lan",
    email: "landt@thanhphat.vn",
    department: "Phòng Sản xuất",
    position: "Thợ hàn",
    weldingTeam: "Tổ hàn 3",
    rank: "Hạng 3",
    railTypes: "UIC60, P50, P43",
    trainedMachines: "K920, K355, AMS60, GEO",
    experience: "15 năm",
    status: "Hoạt động",
    photo: "https://randomuser.me/api/portraits/women/48.jpg",
  },
  {
    id: "6",
    weldingId: "WH006",
    name: "Vũ Đức Thắng",
    email: "thangvd@thanhphat.vn",
    department: "Phòng Sản xuất",
    position: "Thợ hàn",
    weldingTeam: "Tổ hàn 3",
    rank: "Hạng 1",
    railTypes: "P43",
    trainedMachines: "K355",
    experience: "2 năm",
    status: "Khóa",
    photo: "https://randomuser.me/api/portraits/men/67.jpg",
  },
];
