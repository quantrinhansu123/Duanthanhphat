/**
 * Từ điển dịch Việt -> Anh cho phần giao diện (chrome, menu, nút, tiêu đề, nhãn lọc, trạng thái...).
 * Khóa là chuỗi tiếng Việt đã trim. Chuỗi nào không có ở đây sẽ được bỏ dấu tự động khi ở chế độ EN.
 */
export const PHRASES: Record<string, string> = {
  // ---- Thương hiệu / shell ----
  "THÀNH PHÁT": "THANH PHAT",
  "Thành Phát": "Thanh Phat",
  "Rail & Steel Operations": "Rail & Steel Operations",
  "Hệ thống Quản lý Vận hành & Nhân sự": "Operations & HR Management System",
  "Chức năng hệ thống": "System modules",
  "Quản trị viên": "Administrator",
  "Admin": "Admin",
  "Thu gọn": "Collapse",
  "Thông báo": "Notifications",
  "Về trang chủ Thành Phát": "Back to Thanh Phat home",
  "Đóng menu": "Close menu",
  "Mở menu điều hướng": "Open navigation menu",
  "Module đang được xây dựng": "Module under construction",
  "Các chức năng đã sẵn sàng: Hồ sơ thợ hàn, Danh sách khóa đào tạo, Quản lý chứng chỉ, Tra cứu lịch sử đào tạo.":
    "Available modules: Welder Profiles, Training Courses, Certificate Management, Training History Lookup.",

  // ---- Nhóm menu ----
  "Quản lý thợ hàn": "Welder Management",
  "Đào tạo & chứng chỉ": "Training & Certificates",
  "Quản lý máy móc": "Machine Management",
  "Quản lý dự án": "Project Management",
  "Quản lý kỹ thuật": "Technical Management",
  "Báo cáo & thống kê": "Reports & Statistics",
  "Dữ liệu lịch sử": "Historical Data",
  "Quản trị hệ thống": "System Administration",

  // ---- Mục menu con ----
  "Hồ sơ thợ hàn": "Welder Profiles",
  "Lịch sử hàn theo thợ": "Welding History by Welder",
  "Danh sách khóa đào tạo": "Training Courses",
  "Quản lý chứng chỉ": "Certificate Management",
  "Tra cứu lịch sử đào tạo": "Training History Lookup",
  "Danh sách máy hàn": "Welding Machines",
  "Lịch bảo trì": "Maintenance Schedule",
  "Thư viện lỗi": "Fault Library",
  "Thư viện lỗi máy": "Machine Fault Library",
  "Thư viện lỗi mối hàn": "Weld Fault Library",
  "Lịch chạy máy": "Machine Run Schedule",
  "Danh sách dự án": "Projects",
  "Quản lý mối hàn": "Weld Joint Management",
  "Nhật ký hàn": "Welding Journal",
  "Báo cáo mối hàn theo năm": "Yearly Weld Report",
  "Quản lý Máy Hàn": "Welding Machine Management",
  "Quản lý mối hàn theo GPS": "Weld Joints by GPS",
  "Quản lý Tài liệu": "Document Management",
  "Tổng quan": "Overview",
  "Báo cáo chất lượng": "Quality Report",
  "Báo cáo máy móc": "Machine Report",
  "Báo cáo nhân sự": "Personnel Report",
  "Nhập hàng loạt": "Bulk Import",
  "Cấu hình hệ thống": "System Configuration",
  "Triển khai & bàn giao": "Deployment & Handover",

  // ---- Mô tả menu con ----
  "Welding ID, tổ hàn, hạng, loại ray được phép hàn, máy đã đào tạo, kinh nghiệm":
    "Welding ID, team, rank, permitted rail types, trained machines, experience",
  "Lịch sử hàn theo từng thợ, tổng số thợ phục vụ thống kê":
    "Welding history per welder, total welders for statistics",
  "Ngày đào tạo, nội dung, người đào tạo, học viên, kết quả":
    "Training date, content, trainer, trainees, result",
  "Ngày cấp, ngày hết hạn, file đính kèm chứng chỉ":
    "Issue date, expiry date, certificate attachments",
  "Tra cứu lịch sử đào tạo theo thợ hàn": "Look up training history by welder",
  "Mã máy, model, vị trí hiện tại, trạng thái và số mối hàn":
    "Machine code, model, current location, status and weld count",
  "Kế hoạch bảo dưỡng, lịch sử sửa chữa, phụ tùng thay thế":
    "Maintenance plans, repair history, replacement parts",
  "Danh mục mã lỗi máy móc, mối hàn, cách xử lý và mức độ nghiêm trọng":
    "Catalogue of machine and weld fault codes, remedies and severity",
  "Ngày, máy, lý trình, số giờ hoạt động, dự án và người phụ trách":
    "Date, machine, chainage, operating hours, project and person in charge",
  "Danh sách dự án, người phụ trách, nhân sự và máy gắn với từng dự án":
    "Projects with owners, personnel and machines assigned to each",
  "Danh sách mối hàn theo ray hàn và chứng chỉ liên quan":
    "Weld joints by rail and related certificates",
  "Theo dõi nhật ký hàn theo thời gian, nhân sự, vị trí GPS và tình trạng":
    "Track welding journal by time, personnel, GPS location and status",
  "Bảng tổng hợp mối hàn, đạt/lỗi, FBW/ATW và loại mối theo từng năm":
    "Summary of welds, pass/fail, FBW/ATW and joint type by year",
  "Bản đồ đánh dấu mối hàn theo tọa độ GPS / lý trình Km":
    "Map of weld joints by GPS coordinates / Km chainage",
  "Tải lên, xem và tải về tài liệu PDF": "Upload, view and download PDF documents",
  "Tổng mối hàn, hôm nay, tháng này, tỷ lệ đạt, máy & thợ đang hoạt động":
    "Total welds, today, this month, pass rate, active machines & welders",
  "Tổng mối hàn, Đạt, Không đạt, Sửa chữa, Hàn lại, tỷ lệ đạt, phân loại lỗi":
    "Total welds, Pass, Fail, Repair, Re-weld, pass rate, fault classification",
  "Giờ vận hành, số mối hàn/máy, thời gian dừng, bảo trì":
    "Operating hours, welds per machine, downtime, maintenance",
  "Năng suất theo thợ, theo tổ đội, lịch sử dự án, trạng thái chứng chỉ":
    "Productivity by welder and team, project history, certificate status",
  "Nhập số lượng lớn theo mẫu và cấu trúc thống nhất":
    "Import large volumes using a standard template and structure",
  "Danh mục dùng chung, cấu hình hệ thống, tài khoản khởi tạo":
    "Shared catalogues, system configuration, seed accounts",
  "UAT, triển khai server, hướng dẫn sử dụng, bàn giao phiên bản 1.0":
    "UAT, server deployment, user guide, version 1.0 handover",

  // ---- Nút / hành động chung ----
  "Thêm mới": "Add new",
  "Thêm khóa đào tạo": "Add training course",
  "Chỉnh sửa khóa đào tạo": "Edit training course",
  "Chỉnh sửa": "Edit",
  "Thêm chứng chỉ mới": "Add certificate",
  "Lưu": "Save",
  "Lưu thay đổi": "Save changes",
  "Lưu khóa đào tạo": "Save training course",
  "Lưu chứng chỉ": "Save certificate",
  "Hủy": "Cancel",
  "Đóng": "Close",
  "Xóa": "Delete",
  "Xoá": "Clear",
  "Xóa lọc": "Clear filters",
  "Bỏ chọn": "Clear",
  "Xem": "View",
  "Sửa": "Edit",
  "Sửa chứng chỉ": "Edit certificate",
  "Khóa": "Lock",
  "Mở khóa": "Unlock",
  "Hôm nay": "Today",
  "Đang lưu…": "Saving…",
  "Tùy chọn": "Options",
  "Thao tác": "Actions",
  "Xuất báo cáo": "Export report",
  "Danh sách học viên": "Trainee list",

  // ---- Nhãn form / bộ lọc / cột ----
  "Tất cả trạng thái": "All statuses",
  "Tất cả phòng": "All departments",
  "Tất cả chức vụ": "All positions",
  "Tất cả vai trò": "All roles",
  "Tất cả tổ hàn": "All welding teams",
  "Tất cả đối tượng": "All types",
  "Tất cả khóa đào tạo": "All training courses",
  "Tất cả kết quả": "All results",
  "Hạng": "Rank",
  "Tổ hàn": "Welding team",
  "Loại ray": "Rail type",
  "Máy đã đào tạo": "Trained machines",
  "Trạng thái": "Status",
  "Kết quả": "Result",
  "Địa điểm": "Location",
  "Mô tả": "Description",
  "Người đào tạo": "Trainer",
  "Ngày đào tạo": "Training date",
  "Ngày đào tạo *": "Training date *",
  "Thời lượng": "Duration",
  "Học viên": "Trainees",
  "Tên khóa đào tạo *": "Training course name *",
  "Người đào tạo *": "Trainer *",
  "Nội dung đào tạo (mỗi dòng hoặc cách nhau bằng dấu phẩy)":
    "Training content (one per line or comma-separated)",
  "Chọn học viên...": "Select trainees...",
  "Chọn người sở hữu...": "Select holders...",
  "Chọn thợ hàn...": "Select welders...",
  "Tìm thợ hàn...": "Search welders...",
  "Tên chứng chỉ *": "Certificate name *",
  "Người sở hữu *": "Holder *",
  "Ngày cấp *": "Issue date *",
  "Ngày hết hạn *": "Expiry date *",
  "Mẫu ảnh chứng chỉ": "Certificate image template",
  "Hoặc tải ảnh chứng chỉ": "Or upload a certificate image",
  "Mẫu chung": "Generic template",
  "Còn hiệu lực": "Valid",
  "Sắp hết hạn": "Expiring soon",
  "Hết hạn": "Expired",
  "Đạt": "Pass",
  "Không đạt": "Fail",
  "Đang học": "In progress",
  "Hoàn thành": "Completed",
  "Không hoàn thành": "Not completed",
  "Hoạt động": "Active",
  "Thợ hàn": "Welder",
  "Nhân sự": "Personnel",
  "Welding ID": "Welding ID",
  "Chứng chỉ": "Certificates",
  "Kinh nghiệm": "Experience",
  "Họ tên": "Full name",
  "Mã": "Code",
  "Đối tượng": "Type",
  "Phòng ban": "Department",
  "Ngày": "Date",
  "Chưa có": "None",
  "Chưa cập nhật": "Not set",
  "Chưa cấp": "Not issued",
  "Chưa có dữ liệu": "No data",
  "Chưa phân hạng": "Unranked",
  "Chưa phân tổ": "No team",

  // ---- Tiêu đề khối / thẻ ----
  "Tổng thợ hàn": "Total welders",
  "Phân hạng": "Ranking",
  "Toàn bộ hồ sơ trong hệ thống": "All profiles in the system",
  "Nội dung đào tạo": "Training content",
  "Khóa đào tạo": "Training course",

  // ---- Rỗng / thông báo ----
  "Không tìm thấy thợ hàn phù hợp": "No matching welders found",
  "Không tìm thấy khóa đào tạo.": "No training courses found.",
  "Không tìm thấy lịch sử đào tạo": "No training history found",
  "Không tìm thấy thợ hàn": "No welders found",
  "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm": "Try adjusting the filters or search terms",
  "Chưa có danh sách học viên cho khóa này.": "No trainees for this course yet.",

  // ---- Ngôn ngữ ----
  "Tiếng Việt": "Vietnamese",
  "English (US)": "English (US)",
  "Ngôn ngữ": "Language",
  "Chọn ngôn ngữ": "Select language",

  // ---- Từ đếm sau số ("6 khóa học" -> "6 courses") ----
  "khóa học": "courses",
  "khóa đào tạo": "training courses",
  "học viên": "trainees",
  "kết quả": "results",
  "bản ghi": "records",
  "nhân viên": "employees",
  "thợ hàn": "welders",
  "chứng chỉ": "certificates",
  "dự án": "projects",
  "mối hàn": "welds",
  "máy": "machines",
  "người": "people",
  "điểm": "points",
  "lỗi": "faults",
  "hoạt động": "active",
  "đang khóa": "locked",
  "đang hoạt động": "active",
  "tài liệu": "documents",
  "hạng mục": "items",
  "mục": "items",
  "quản trị": "admins",
  "hôm nay": "today",
  "tháng này": "this month",

  // ---- Ô tìm kiếm ----
  "Tìm khóa đào tạo, người đào tạo...": "Search courses, trainers...",
  "Tìm tên đăng nhập, họ tên, email...": "Search username, full name, email...",
  "Tìm theo tên, mã NV, email...": "Search by name, employee ID, email...",
  "Tìm theo tên, Welding ID, loại ray, máy...": "Search by name, Welding ID, rail type, machine...",
  "Tìm theo mã, họ tên, khóa đào tạo, người đào tạo...":
    "Search by code, name, course, trainer...",
  "Tìm theo tên chứng chỉ, nhân viên...": "Search by certificate name, employee...",
  "Tìm dự án...": "Search projects...",
  "Tìm hạng mục, nội dung...": "Search items, content...",
  "Tìm ID, thợ hàn, máy, dự án…": "Search ID, welder, machine, project…",
  "Tìm mã điểm, lý trình, tọa độ...": "Search point code, chainage, coordinates...",
  "Tìm mã lỗi, tên, mô tả, cách xử lý...": "Search fault code, name, description, remedy...",
  "Tìm mã máy, tên máy, model...": "Search machine code, name, model...",
  "Tìm mã ray, tên, máy, vị trí...": "Search rail code, name, machine, location...",
  "Tìm mã, dự án, loại ray, thợ hàn...": "Search code, project, rail type, welder...",
  "Tìm mã, tên danh mục...": "Search code, category name...",
  "Tìm máy, lý trình, dự án…": "Search machine, chainage, project…",
  "Tìm phương pháp, loại mối, chứng chỉ...": "Search method, joint type, certificate...",
  "Tìm tên dự án, người phụ trách, lý trình...": "Search project name, owner, chainage...",
  "Tìm tên tài liệu, mô tả...": "Search document name, description...",
  "Tìm theo mã, họ tên, khóa đào tạo, người đào tạo…": "Search by code, name, course, trainer…",
  "Tìm theo mối hàn, thợ hàn, máy, dự án, mã hạch toán...":
    "Search by weld, welder, machine, project, account code...",
  "Họ tên thợ hàn": "Welder full name",
  "Nhập nhiều chứng chỉ, cách nhau bằng dấu phẩy": "Enter multiple certificates, comma-separated",
  "Phiên bản, dự án, ghi chú...": "Version, project, notes...",
  "Nhập nhiều hoặc nhập thủ công; danh sách được lưu cách nhau bằng dấu phẩy.":
    "Select several or type manually; the list is saved comma-separated.",
  "Có thể chọn nhiều hoặc nhập thủ công; danh sách được lưu cách nhau bằng dấu phẩy.":
    "You may select several or enter manually; the list is saved comma-separated.",

  // ---- Cột / nhãn hồ sơ nhân sự - thợ hàn ----
  "Mã NV": "Employee ID",
  "Nhân viên": "Employee",
  "Tên đăng nhập": "Username",
  "Vai trò": "Role",
  "Chức vụ": "Position",
  "Hành động hàng loạt": "Bulk actions",
  "Đã chọn": "Selected",
  "Tất cả phòng ban": "All departments",

  // ---- Thẻ thống kê hồ sơ thợ hàn ----
  "hạng 1": "rank 1",
  "hạng khác": "other ranks",

  // ---- Nút thêm ----
  "Form thêm thợ hàn sẽ bổ sung sau": "Welder add form coming soon",
  "Thêm thợ hàn": "Add welder",

  // ---- Modal chứng chỉ ----
  "Thợ hàn hạng 1 (UIC60)": "Welder rank 1 (UIC60)",
  "Thợ hàn hạng 2 (P50/P43)": "Welder rank 2 (P50/P43)",
  "Vận hành máy hàn": "Welding machine operation",
  "NDT – Siêu âm": "NDT – Ultrasonic",
  "An toàn lao động": "Occupational safety",
  "Chọn ít nhất một người sở hữu.": "Select at least one holder.",
  "Nhập tên chứng chỉ.": "Enter a certificate name.",
  "Nhập ngày cấp và ngày hết hạn.": "Enter the issue and expiry dates.",
  "Vui lòng chọn file ảnh (JPG, PNG, SVG).": "Please choose an image file (JPG, PNG, SVG).",
  "Vui lòng nhập tên khóa, người đào tạo và ngày đào tạo.":
    "Please enter the course name, trainer and training date.",

  // ---- Trang Quản lý chứng chỉ ----
  "Không tìm thấy chứng chỉ phù hợp.": "No matching certificates found.",
  "hiệu lực ·": "valid ·",
  "sắp hết hạn ·": "expiring ·",
  "hết hạn": "expired",
  "· Cấp": "· Issued",
  "· Hết hạn": "· Expires",
  "Chứng chỉ · Hạn": "Certificate · Expires",
  "Xem ảnh gốc": "View original image",
  "Gia hạn": "Renew",
  "Người sở hữu": "Holder",
  "Tên chứng chỉ": "Certificate name",
  "Ngày cấp": "Issue date",
  "Ngày hết hạn": "Expiry date",

  // ---- Tên chứng chỉ (dữ liệu) ----
  "Chứng chỉ thợ hàn ray hạng 1 – UIC60": "Rail Welder Certificate Rank 1 – UIC60",
  "Chứng chỉ thợ hàn ray hạng 2 – P50/P43": "Rail Welder Certificate Rank 2 – P50/P43",
  "Chứng chỉ vận hành máy hàn K920": "Welding Machine Operation Certificate – K920",
  "Chứng chỉ vận hành máy hàn AMS60": "Welding Machine Operation Certificate – AMS60",
  "Chứng chỉ NDT – kiểm tra siêu âm mối hàn": "NDT Certificate – Weld Ultrasonic Testing",
  "Chứng chỉ an toàn lao động nhóm 3": "Occupational Safety Certificate – Group 3",
  "Chứng chỉ ISO 9606 – Welding Qualification": "ISO 9606 Certificate – Welding Qualification",
  "Chứng chỉ sơ cấp cứu công trường": "Site First Aid Certificate",
};
