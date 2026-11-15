import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  knowledgeOcrConfig,
  knowledgeOcrEnvironment,
} from "../src/lib/server/documentKnowledgeOcrConfig.ts";
import { knowledgePipelineVersion } from "../src/lib/server/documentKnowledgeAI.ts";
import { resolveOcrPage } from "./knowledge-worker.mjs";
let checks = 0;
const eq = (a, b, n) => {
  assert.deepEqual(a, b, n);
  checks++;
};
const rejects = async (fn, pattern) => {
  await assert.rejects(fn, pattern);
  checks++;
};
const previousEnv = { ...process.env },
  previousFetch = globalThis.fetch;
try {
  for (const key of Object.keys(process.env))
    if (key.startsWith("KNOWLEDGE_OCR") || key.startsWith("KNOWLEDGE_PADDLE"))
      delete process.env[key];
  eq(
    knowledgeOcrConfig().mode,
    "gemini",
    "Verified cloud engine is the default",
  );
  process.env.KNOWLEDGE_OCR = "paddle";
  const config = knowledgeOcrConfig();
  eq(config.mode, "paddle");
  eq(config.fallback, "gemini");
  eq(config.recognizer, "latin_PP-OCRv5_mobile_rec");
  const version = knowledgePipelineVersion();
  process.env.KNOWLEDGE_PADDLE_REC_MODEL = "other_model";
  eq(
    knowledgePipelineVersion() === version,
    false,
    "Model switch invalidates OCR caches",
  );
  delete process.env.KNOWLEDGE_PADDLE_REC_MODEL;
  process.env.KNOWLEDGE_OCR_DPI = "300";
  eq(
    knowledgePipelineVersion() === version,
    false,
    "DPI switch invalidates OCR caches",
  );
  delete process.env.KNOWLEDGE_OCR_DPI;
  process.env.KNOWLEDGE_OCR = "invalid";
  assert.throws(knowledgeOcrConfig, /DK_INVALID_OCR_CONFIG/);
  checks++;
  delete process.env.KNOWLEDGE_OCR;
  process.env.KNOWLEDGE_OCR_MIN_CONFIDENCE = "NaN";
  assert.throws(knowledgeOcrConfig, /DK_INVALID_OCR_CONFIG/);
  checks++;
  delete process.env.KNOWLEDGE_OCR_MIN_CONFIDENCE;
  process.env.GEMINI_API_KEY = "fixture";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-db";
  const env = knowledgeOcrEnvironment(config);
  eq(env.GEMINI_API_KEY, undefined, "Python never inherits Google key");
  eq(env.SUPABASE_SERVICE_ROLE_KEY, undefined);
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [
                {
                  text: JSON.stringify({ text: "Nghiệm thu: 1.000.000 đồng." }),
                },
              ],
            },
          },
        ],
      }),
    };
  };
  const primary = {
    page: 1,
    method: "paddle",
    text: "Nghiệm thu: 1.000.000 đồng.",
    ocr_meta: { warnings: [], mean_confidence: 0.98, lines: [] },
  };
  const direct = await resolveOcrPage(structuredClone(primary), config, {
    count: 0,
  });
  eq(direct.method, "paddle");
  eq(calls, 0, "Good Paddle page does not call Google");
  const fallback = {
    ...structuredClone(primary),
    image: "fixture",
    fallback_requested: true,
    ocr_meta: { warnings: ["DK_OCR_LOW_CONFIDENCE"] },
  };
  const count = { count: 0 };
  const resolved = await resolveOcrPage(
    structuredClone(fallback),
    config,
    count,
  );
  eq(resolved.method, "gemini");
  eq(resolved.ocr_meta.fallback_used, true);
  eq(resolved.ocr_meta.primary_text, primary.text);
  eq(count.count, 1);
  eq(calls, 1);
  await rejects(
    () =>
      resolveOcrPage(fallback, { ...config, fallback: "none" }, { count: 0 }),
    /DK_INVALID_PAGE/,
  );
  await rejects(
    () =>
      resolveOcrPage(
        fallback,
        { ...config, maxFallbackPages: 0 },
        { count: 0 },
      ),
    /DK_OCR_FALLBACK_LIMIT/,
  );
  const lowOnly = await resolveOcrPage(
    { ...primary, ocr_meta: { warnings: ["DK_OCR_LOW_CONFIDENCE"] } },
    { ...config, fallback: "none" },
    { count: 0 },
  );
  eq(lowOnly.method, "paddle");
  eq(calls, 1, "Local-only OCR never calls Google");
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [
        {
          finishReason: "STOP",
          content: { parts: [{ text: JSON.stringify({ text: "" }) }] },
        },
      ],
    }),
  });
  await rejects(
    () =>
      resolveOcrPage(
        {
          page: 1,
          method: "gemini",
          image: "fixture",
          ocr_meta: { warnings: [] },
        },
        { ...config, mode: "gemini" },
        { count: 0 },
      ),
    /DK_OCR_NO_TEXT/,
  );
  await rejects(
    () =>
      resolveOcrPage(
        { ...primary, text: "", ocr_meta: { warnings: ["DK_OCR_NO_TEXT"] } },
        config,
        { count: 0 },
      ),
    /DK_OCR_NO_TEXT/,
  );
  globalThis.fetch = async () => ({ ok: false, status: 403 });
  await rejects(
    () => resolveOcrPage(fallback, config, { count: 0 }),
    /DK_AI_AUTH/,
  );
  const python = spawnSync(
    process.env.KNOWLEDGE_PYTHON || "python",
    ["scripts/test-knowledge-ocr.py"],
    { windowsHide: true, encoding: "utf8" },
  );
  if (python.status !== 0)
    throw new Error(python.stderr || "Python OCR tests failed");
  console.log(python.stderr.trim());
  console.log(
    `PASS OCR routing/config: ${checks} checks; verified default, selectable Paddle, bounded fallback and cache version`,
  );
} finally {
  globalThis.fetch = previousFetch;
  for (const key of Object.keys(process.env))
    if (!(key in previousEnv)) delete process.env[key];
  Object.assign(process.env, previousEnv);
}
