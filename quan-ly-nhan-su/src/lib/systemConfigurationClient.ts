import type { StoredSystemConfiguration } from "@/data/systemConfig";

async function parseResponse(response: Response) {
  const payload = await response.json().catch(() => ({})) as StoredSystemConfiguration & { error?: string };
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

export async function loadSystemConfiguration() {
  return parseResponse(await fetch("/api/system-configuration", { cache: "no-store" }));
}

export async function saveSystemConfiguration(configuration: StoredSystemConfiguration) {
  const saved = await parseResponse(await fetch("/api/system-configuration", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(configuration),
  }));
  if (typeof window !== "undefined") window.dispatchEvent(new Event("system-configuration-updated"));
  return saved;
}
