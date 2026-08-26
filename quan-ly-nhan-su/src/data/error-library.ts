export type ErrorSeverity = "Nghiêm trọng" | "Trung bình" | "Nhẹ";
export type ErrorCategory = "Máy móc" | "Mối hàn" | "Vận hành" | "An toàn";

export type ErrorItem = {
  id: string;
  code: string;
  name: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  description: string;
  solution: string;
  image: string;
  occurrenceCount: number;
};

export const errorLibrary: ErrorItem[] = [
  {
    id: "1",
    code: "E-M01",
    name: "Áp suất thủy lực thấp",
    category: "Máy móc",
    severity: "Nghiêm trọng",
    description: "Hệ thống thủy lực không đạt áp suất làm việc, máy dừng giữa chu kỳ hàn.",
    solution: "Kiểm tra bơm, van xả, mức dầu thủy lực; thay phớt nếu rò rỉ.",
    image:
      "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=480&h=270&q=80",
    occurrenceCount: 12,
  },
  {
    id: "2",
    code: "E-M02",
    name: "Quá nhiệt đầu hàn",
    category: "Máy móc",
    severity: "Trung bình",
    description: "Cảm biến nhiệt báo vượt ngưỡng 850°C trong quá trình preheat.",
    solution: "Giảm thời gian preheat, kiểm tra cảm biến và hệ thống làm mát.",
    image:
      "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=480&h=270&q=80",
    occurrenceCount: 8,
  },
  {
    id: "3",
    code: "E-W01",
    name: "Khuyết khí trong mối hàn",
    category: "Mối hàn",
    severity: "Nghiêm trọng",
    description: "Phát hiện bọt khí / khuyết khí sau khi đúc, mối hàn không đạt NDT.",
    solution: "Làm sạch khe hàn, kiểm tra lượng cốc luyện, hàn lại theo quy trình.",
    image:
      "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=480&h=270&q=80",
    occurrenceCount: 24,
  },
  {
    id: "4",
    code: "E-W02",
    name: "Lệch mép ray sau hàn",
    category: "Mối hàn",
    severity: "Trung bình",
    description: "Độ lệch mép ray vượt dung sai ±0.3mm so với tiêu chuẩn.",
    solution: "Căn chỉnh lại kẹp, kiểm tra khay hàn và lực siết.",
    image:
      "https://images.unsplash.com/photo-1537462715879-360eeb61a0ad?auto=format&fit=crop&w=480&h=270&q=80",
    occurrenceCount: 15,
  },
  {
    id: "9",
    code: "E-W04",
    name: "Lệch tim ray",
    category: "Mối hàn",
    severity: "Trung bình",
    description: "Tim ray lệch so với vị trí thiết kế sau hàn, vượt dung sai cho phép.",
    solution: "Kiểm tra căn chỉnh ray trước hàn, điều chỉnh kẹp và khay hàn; hàn lại nếu cần.",
    image:
      "https://images.unsplash.com/photo-1537462715879-360eeb61a0ad?auto=format&fit=crop&w=480&h=270&q=80",
    occurrenceCount: 19,
  },
  {
    id: "5",
    code: "E-W03",
    name: "Nứt lạnh trên đầu ray",
    category: "Mối hàn",
    severity: "Nghiêm trọng",
    description: "Vết nứt dọc theo đầu ray, thường do làm nguội quá nhanh.",
    solution: "Điều chỉnh thời gian làm nguội, hàn lại và kiểm tra NDT.",
    image:
      "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=480&h=270&q=80",
    occurrenceCount: 6,
  },
  {
    id: "6",
    code: "E-O01",
    name: "Dừng máy giữa chu kỳ",
    category: "Vận hành",
    severity: "Trung bình",
    description: "Máy dừng đột ngột do lỗi PLC hoặc mất tín hiệu cảm biến.",
    solution: "Reset PLC, kiểm tra dây tín hiệu và cảm biến vị trí.",
    image:
      "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?auto=format&fit=crop&w=480&h=270&q=80",
    occurrenceCount: 18,
  },
  {
    id: "7",
    code: "E-S01",
    name: "Không kích hoạt van an toàn",
    category: "An toàn",
    severity: "Nghiêm trọng",
    description: "Van an toàn khí / nhiệt không phản hồi khi thử nghiệm định kỳ.",
    solution: "Dừng vận hành, thay van, kiểm tra lại trước khi đưa máy vào ca.",
    image:
      "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=480&h=270&q=80",
    occurrenceCount: 3,
  },
  {
    id: "8",
    code: "E-O02",
    name: "Hết cốc luyện giữa ca",
    category: "Vận hành",
    severity: "Nhẹ",
    description: "Cảnh báo tồn kho cốc luyện dưới mức tối thiểu.",
    solution: "Bổ sung cốc luyện, cập nhật kế hoạch cung ứng vật tư.",
    image:
      "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=480&h=270&q=80",
    occurrenceCount: 31,
  },
];
