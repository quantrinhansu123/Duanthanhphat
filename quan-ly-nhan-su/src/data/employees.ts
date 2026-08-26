export type Employee = {
  id: string;
  code: string;
  name: string;
  email: string;
  username: string;
  department: string;
  position: string;
  role: string;
  status: "Hoạt động" | "Khóa";
  photo: string;
};

export const employees: Employee[] = [
  {
    id: "1",
    code: "NV002",
    name: "Vũ Thị Thảo",
    email: "thaovt@thanhphat.vn",
    username: "thao",
    department: "Phòng Công nghệ thông tin",
    position: "Kiểm thử viên",
    role: "Nhân viên",
    status: "Hoạt động",
    photo: "https://randomuser.me/api/portraits/women/44.jpg",
  },
  {
    id: "2",
    code: "NV001",
    name: "Đặng Ngọc Tiếp",
    email: "tiepdn@thanhphat.vn",
    username: "tiep",
    department: "Phòng Công nghệ thông tin",
    position: "Lập trình viên",
    role: "Nhân viên",
    status: "Hoạt động",
    photo: "https://randomuser.me/api/portraits/men/32.jpg",
  },
  {
    id: "3",
    code: "VN0014",
    name: "Trần Văn Tài",
    email: "taitv@thanhphat.vn",
    username: "tai",
    department: "Phòng Công nghệ thông tin",
    position: "Lập trình viên",
    role: "Nhân viên",
    status: "Hoạt động",
    photo: "https://randomuser.me/api/portraits/men/75.jpg",
  },
  {
    id: "4",
    code: "NV003",
    name: "Nguyễn Đắc Công",
    email: "congnd@thanhphat.vn",
    username: "cong",
    department: "Phòng Công nghệ thông tin",
    position: "Lập trình viên",
    role: "Quản trị",
    status: "Hoạt động",
    photo: "https://randomuser.me/api/portraits/men/11.jpg",
  },
  {
    id: "5",
    code: "NV004",
    name: "Lê Thị Kim Anh",
    email: "anhltk@thanhphat.vn",
    username: "kimanh",
    department: "Phòng Sản xuất",
    position: "Thợ hàn",
    role: "Nhân viên",
    status: "Hoạt động",
    photo: "https://randomuser.me/api/portraits/women/65.jpg",
  },
  {
    id: "6",
    code: "NV005",
    name: "Phạm Văn Minh",
    email: "minhpv@thanhphat.vn",
    username: "minh",
    department: "Phòng Sản xuất",
    position: "Tổ trưởng",
    role: "Quản trị",
    status: "Hoạt động",
    photo: "https://randomuser.me/api/portraits/men/52.jpg",
  },
  {
    id: "7",
    code: "NV006",
    name: "Hoàng Thị Mai",
    email: "maiht@thanhphat.vn",
    username: "mai",
    department: "Phòng Nhân sự",
    position: "Chuyên viên nhân sự",
    role: "Nhân viên",
    status: "Hoạt động",
    photo: "https://randomuser.me/api/portraits/women/68.jpg",
  },
];
