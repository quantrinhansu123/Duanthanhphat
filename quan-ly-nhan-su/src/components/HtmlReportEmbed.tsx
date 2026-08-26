"use client";

type HtmlReportEmbedProps = {
  src: string;
  title: string;
};

export default function HtmlReportEmbed({ src, title }: HtmlReportEmbedProps) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col px-3 pb-3 pt-1">
      <iframe
        title={title}
        src={src}
        className="h-full min-h-[calc(100vh-7.5rem)] w-full flex-1 rounded-xl border border-[#d9e2f1] bg-[#f5f7fa]"
      />
    </div>
  );
}
