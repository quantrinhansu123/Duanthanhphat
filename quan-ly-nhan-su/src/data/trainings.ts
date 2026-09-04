export type TrainingAttendee = {
  id: string;
  name: string;
  weldingId: string;
  weldingTeam: string;
};

export type TrainingCourse = {
  id: string;
  title: string;
  trainer: string;
  date: string;
  duration: string;
  participants: number;
  result: string;
  thumbnail: string;
  location: string;
  description: string;
  topics: string[];
  attendees?: TrainingAttendee[];
};

export const trainingCourses: TrainingCourse[] = [
  {
    id: "1",
    title: "An toàn lao động & PCCC trên công trường hàn ray",
    trainer: "Phạm Văn Minh",
    date: "12/03/2026",
    duration: "4:00",
    participants: 24,
    result: "Đạt",
    thumbnail:
      "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=480&h=270&q=80",
    location: "Phòng đào tạo – Nhà máy Hà Nội",
    description:
      "Khóa huấn luyện an toàn lao động và phòng cháy chữa cháy bắt buộc cho nhân sự, thợ hàn trước khi vào ca hiện trường.",
    topics: ["Quy định ATLĐ ngành đường sắt", "PCCC & thoát hiểm", "Ứng phó sự cố nhiệt luyện", "Thực hành sơ cấp cứu"],
  },
  {
    id: "2",
    title: "Kỹ thuật hàn aluminothermic UIC60 – thực hành máy K920",
    trainer: "Đỗ Thị Lan",
    date: "28/02/2026",
    duration: "6:30",
    participants: 16,
    result: "Đạt",
    thumbnail:
      "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=480&h=270&q=80",
    location: "Xưởng thực hành K920 – Nhà máy Hà Nội",
    description:
      "Đào tạo quy trình hàn aluminothermic ray UIC60 trên máy K920, gồm lý thuyết, thao tác chuẩn và thực hành có giám sát.",
    topics: ["Chuẩn bị khuôn & khay hàn", "Quy trình đúc aluminothermic", "Kiểm tra ngoại quan", "Thực hành trên máy K920"],
  },
  {
    id: "3",
    title: "Kiểm tra chất lượng mối hàn NDT – siêu âm & mắt thường",
    trainer: "Trần Quốc Bảo",
    date: "15/02/2026",
    duration: "5:15",
    participants: 12,
    result: "Đạt",
    thumbnail:
      "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=480&h=270&q=80",
    location: "Phòng kiểm định – Nhà máy Đà Nẵng",
    description:
      "Khóa nâng cao kỹ năng kiểm tra chất lượng mối hàn bằng siêu âm (UT) và đánh giá ngoại quan theo tiêu chuẩn đường sắt.",
    topics: ["Nguyên lý siêu âm UT", "Đánh giá ngoại quan mối hàn", "Ghi nhận & phân loại lỗi", "Thực hành trên mẫu mối hàn"],
  },
  {
    id: "4",
    title: "Vận hành & bảo dưỡng máy hàn AMS60 / GEO",
    trainer: "Nguyễn Văn Hùng",
    date: "05/02/2026",
    duration: "3:45",
    participants: 18,
    result: "Đạt",
    thumbnail:
      "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=480&h=270&q=80",
    location: "Khu vực máy AMS60 – Nhà máy TP.HCM",
    description:
      "Hướng dẫn vận hành an toàn, bảo dưỡng định kỳ và xử lý sự cố thường gặp trên máy hàn AMS60 và GEO.",
    topics: ["Vận hành trước ca", "Bảo dưỡng 500h", "Thay phụ tùng tiêu chuẩn", "Nhật ký bảo trì"],
  },
  {
    id: "5",
    title: "Quy trình hàn ray P50 / P43 theo tiêu chuẩn đường sắt",
    trainer: "Lê Thị Kim Anh",
    date: "20/01/2026",
    duration: "4:20",
    participants: 20,
    result: "Đạt",
    thumbnail:
      "https://images.unsplash.com/photo-1537462715879-360eeb61a0ad?auto=format&fit=crop&w=480&h=270&q=80",
    location: "Phòng đào tạo – Nhà máy Hà Nội",
    description:
      "Cập nhật quy trình hàn ray P50/P43, thông số kỹ thuật và yêu cầu chất lượng theo tiêu chuẩn TCVN đường sắt.",
    topics: ["Thông số ray P50/P43", "Chuẩn bị mối hàn", "Kiểm tra sau hàn", "Ghi nhận hồ sơ chất lượng"],
  },
  {
    id: "6",
    title: "Huấn luyện sơ cấp cứu & ứng phó sự cố nhiệt luyện",
    trainer: "Phạm Văn Minh",
    date: "10/01/2026",
    duration: "2:50",
    participants: 30,
    result: "Đạt",
    thumbnail:
      "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=480&h=270&q=80",
    location: "Hội trường A – Trụ sở Thành Phát",
    description:
      "Huấn luyện kỹ năng sơ cấp cứu và quy trình ứng phó khi xảy ra sự cố bỏng/nhiệt luyện trên công trường hàn ray.",
    topics: ["Sơ cấp cứu cơ bản", "Ứng phó bỏng nhiệt", "Báo cáo sự cố", "Diễn tập tình huống"],
  },
];
