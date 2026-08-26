"use client";

import HtmlReportEmbed from "@/components/HtmlReportEmbed";

/** Map tab id → file HTML báo cáo đã có sẵn trong /public/reports */
export const HTML_REPORTS: Record<string, { src: string; title: string }> = {
  "bc-tong-quan": {
    src: "/reports/tong-quan.dc.html",
    title: "Báo cáo tổng quan",
  },
  // Chưa có file HTML riêng; dùng dashboard tổng quan (KPI / sản lượng ngày)
  "bc-san-luong": {
    src: "/reports/tong-quan.dc.html",
    title: "Báo cáo sản lượng",
  },
  "bc-may-moc": {
    src: "/reports/Bao%20cao%20May%20moc.dc.html",
    title: "Báo cáo máy móc",
  },
  "bc-nhan-su": {
    src: "/reports/Bao%20cao%20Nhan%20su.dc.html",
    title: "Báo cáo nhân sự",
  },
};

export function isHtmlReportTab(tabId: string) {
  return tabId in HTML_REPORTS;
}

type HtmlReportViewProps = {
  tabId: string;
};

export default function HtmlReportView({ tabId }: HtmlReportViewProps) {
  const report = HTML_REPORTS[tabId];
  if (!report) return null;
  return <HtmlReportEmbed src={report.src} title={report.title} />;
}
