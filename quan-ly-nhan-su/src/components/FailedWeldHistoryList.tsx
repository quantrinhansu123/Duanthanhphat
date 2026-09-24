"use client";

import WeldingJournalList from "@/components/WeldingJournalList";

/** Tab Danh sách mối hàn lỗi — nhật ký hàn khóa lọc Không đạt. */
export default function FailedWeldHistoryList() {
  return (
    <WeldingJournalList
      lockedResultFilter="Không đạt"
      heading="LỊCH SỬ MỐI HÀN LỖI"
    />
  );
}
