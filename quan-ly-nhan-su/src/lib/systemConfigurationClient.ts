import type { StoredSystemConfiguration } from "@/data/systemConfig";

async function parseResponse(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as StoredSystemConfiguration & {
    error?: string;
  };
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

let inflight: Promise<StoredSystemConfiguration> | null = null;
let cached: StoredSystemConfiguration | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

export function invalidateSystemConfigurationCache() {
  inflight = null;
  cached = null;
  cachedAt = 0;
}

/** Một request dùng chung — tránh nhiều hook gọi song song cùng lúc. */
export async function loadSystemConfiguration() {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    const result = await parseResponse(
      await fetch("/api/system-configuration", { cache: "no-store" }),
    );
    cached = result;
    cachedAt = Date.now();
    return result;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

export async function saveSystemConfiguration(configuration: StoredSystemConfiguration) {
  const saved = await parseResponse(
    await fetch("/api/system-configuration", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(configuration),
    }),
  );
  invalidateSystemConfigurationCache();
  cached = saved;
  cachedAt = Date.now();
  if (typeof window !== "undefined") window.dispatchEvent(new Event("system-configuration-updated"));
  return saved;
}
