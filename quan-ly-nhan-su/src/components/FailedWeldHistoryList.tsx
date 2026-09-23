"use client";

import WeldingJournalList from "@/components/WeldingJournalList";

/** Trang Lịch sử mối hàn lỗi — tái dùng nhật ký, khóa lọc «Không đạt». */
export default function FailedWeldHistoryList() {
  return (
    <WeldingJournalList
      lockedResultFilter="Không đạt"
      heading="LỊCH SỬ MỐI HÀN LỖI"
    />
  );
}
