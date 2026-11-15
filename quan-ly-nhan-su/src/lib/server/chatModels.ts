import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ChatModel } from "@/lib/chatModels";

const run = promisify(execFile);
let cached: { time: number; result: Promise<{ models: ChatModel[]; defaultId: string; antiError?: string }> } | null = null;

export function getChatModels() {
  if (cached && Date.now() - cached.time < 5 * 60_000) return cached.result;
  const result = (async () => {
    const model = process.env.CODEX_MODEL?.trim() || "gpt-6-luna";
    const models: ChatModel[] = [{ id: `codex:${model}`, provider: "codex", model, label: model }];
    try {
      const catalog = JSON.parse(await readFile(join(process.cwd(), ".codex-chat", "models_cache.json"), "utf8"));
      for (const item of catalog.models ?? []) {
        if (item.visibility !== "list" || typeof item.slug !== "string" || models.some((m) => m.model === item.slug)) continue;
        models.push({ id: `codex:${item.slug}`, provider: "codex", model: item.slug, label: item.display_name || item.slug });
      }
    } catch { /* máy mới vẫn có model Codex mặc định */ }
    let antiError: string | undefined;
    try {
      const { stdout } = await run("agy", ["models"], { timeout: 20_000, maxBuffer: 1024 * 1024, windowsHide: true });
      for (const line of stdout.split(/\r?\n/)) {
        const [id, label] = line.split("\t");
        if (!label || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(id)) continue;
        models.push({ id: `anti:${id}`, provider: "anti", model: id, label: label.trim() });
      }
      if (!models.some((m) => m.provider === "anti")) throw new Error("empty models");
    } catch {
      antiError = "Chưa lấy được model Anti CLI. Kiểm tra đăng nhập bằng lệnh agy models trên máy chủ.";
    }
    let defaultId = `codex:${model}`;
    if (process.env.CHAT_PROVIDER !== "codex" && process.env.CHAT_PROVIDER !== "anti") {
      const gemini = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
      models.push({ id: `gemini:${gemini}`, provider: "gemini", model: gemini, label: gemini });
      defaultId = `gemini:${gemini}`;
    } else if (process.env.CHAT_PROVIDER === "anti") {
      defaultId = models.find((m) => m.id === "anti:gemini-3.8-flash-medium")?.id ?? models.find((m) => m.provider === "anti")?.id ?? defaultId;
    }
    return { models, defaultId, antiError };
  })();
  cached = { time: Date.now(), result };
  return result;
}
