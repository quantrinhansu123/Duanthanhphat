import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import { isValidTab } from "@/data/navigation";

type PageProps = {
  params: Promise<{ tab: string }>;
};

export default async function TabPage({ params }: PageProps) {
  const { tab } = await params;
  if (!isValidTab(tab)) notFound();
  return <AppShell tab={tab} />;
}
