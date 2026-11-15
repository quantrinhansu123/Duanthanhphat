// Shared by web registration and the standalone worker. Changes invalidate OCR caches.
export function knowledgeOcrConfig() {
  const env = process.env;
  const mode = env.KNOWLEDGE_OCR?.trim() || "gemini";
  const fallback = env.KNOWLEDGE_OCR_FALLBACK?.trim() || "gemini";
  const profile = env.KNOWLEDGE_PADDLE_PROFILE?.trim() || "vl";
  if (!["vl", "classic"].includes(profile))
    throw new Error("DK_INVALID_OCR_CONFIG");
  if (
    !["paddle", "gemini"].includes(mode) ||
    !["gemini", "none"].includes(fallback)
  )
    throw new Error("DK_INVALID_OCR_CONFIG");
  const number = (
    key: string,
    defaultValue: number,
    min: number,
    max: number,
    integer = false,
  ) => {
    const value = env[key]?.trim() ? Number(env[key]) : defaultValue;
    if (
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (integer && !Number.isInteger(value))
    )
      throw new Error("DK_INVALID_OCR_CONFIG");
    return value;
  };
  const model = (key: string, value: string) => {
    const name = env[key]?.trim() || value;
    if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(name))
      throw new Error("DK_INVALID_OCR_CONFIG");
    return name;
  };
  const device = env.KNOWLEDGE_PADDLE_DEVICE?.trim() || "cpu";
  if (!/^(cpu|gpu(?::[0-9]+)?)$/.test(device))
    throw new Error("DK_INVALID_OCR_CONFIG");
  return {
    mode,
    fallback,
    device,
    profile,
    vlVersion: "v1.6",
    detector: model("KNOWLEDGE_PADDLE_DET_MODEL", "PP-OCRv6_small_det"),
    recognizer: model(
      "KNOWLEDGE_PADDLE_REC_MODEL",
      "latin_PP-OCRv5_mobile_rec",
    ),
    dpi: number("KNOWLEDGE_OCR_DPI", 220, 120, 300, true),
    minConfidence: number("KNOWLEDGE_OCR_MIN_CONFIDENCE", 0.85, 0, 1),
    threads: number("KNOWLEDGE_PADDLE_CPU_THREADS", 4, 1, 32, true),
    timeoutSeconds: number("KNOWLEDGE_OCR_TIMEOUT_SECONDS", 600, 10, 900, true),
    maxFallbackPages: number(
      "KNOWLEDGE_OCR_MAX_FALLBACK_PAGES",
      20,
      0,
      500,
      true,
    ),
    maxPages: number("KNOWLEDGE_MAX_PAGES", 250, 1, 500, true),
  };
}
export function knowledgeOcrEnvironment(
  config: ReturnType<typeof knowledgeOcrConfig>,
  skip: number[] = [],
) {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    PYTHONIOENCODING: "utf-8",
    PYTHONUNBUFFERED: "1",
    KNOWLEDGE_OCR_CONFIG: JSON.stringify(config),
    KNOWLEDGE_OCR_SKIP_PAGES: JSON.stringify(skip),
    PADDLE_PDX_MODEL_SOURCE: "BOS",
  };
  for (const [key, value] of Object.entries(process.env))
    if (
      /^(path|pathext|systemroot|windir|temp|tmp|home|userprofile|appdata|localappdata|https?_proxy|no_proxy|ld_library_path|cuda_visible_devices)$/i.test(
        key,
      )
    )
      env[key] = value;
  if (process.env.KNOWLEDGE_PADDLE_HOME)
    env.PADDLE_PDX_CACHE_HOME = process.env.KNOWLEDGE_PADDLE_HOME;
  return env;
}
