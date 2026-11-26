import { notFound, redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { allTabIds, isValidTab } from "@/data/navigation";

type PageProps = {
  params: Promise<{ tab: string }>;
};

export function generateStaticParams() {
  return allTabIds().map((tab) => ({ tab }));
}

export default async function TabPage({ params }: PageProps) {
  const { tab } = await params;
  if (tab === "kiem-toan-cwr" || tab.startsWith("kiem-toan-cwr-")) redirect("/lwr-cong-thuc-tb10015");
  if (!isValidTab(tab)) notFound();
  return <AppShell tab={tab} />;
}
