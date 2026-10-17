import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
// Use an installed Playwright package, or provide its absolute path as argument 2.
const { chromium } = require(process.argv[2] || "playwright");
const baseUrl = process.argv[3] || "http://127.0.0.1:3100";
const output = "docs/research/stress-release/browser";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto(`${baseUrl}/giai-toa-ung-suat`);
  assert.equal(response.status(), 200);
  await page.getByRole("heading", { name: "Giải toả ứng suất R2", exact: true }).waitFor();
  const resultRow = (name) => page.getByRole("row").filter({ hasText: name });
  assert.match(await resultRow("Lực kéo P").innerText(), /276,81/);
  assert.match(await resultRow("Khe hở cắt mục tiêu").innerText(), /112,25/);
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  await page.getByLabel("Sử dụng con lăn cạnh").check();
  assert.match(await page.getByText(/^Chiều dài:/).innerText(), /Đạt/);
  await page.getByLabel("Phương pháp").selectOption("FBW");
  await page.getByLabel("Nhiệt độ neo trái Tt").fill("25");
  await page.getByLabel("Nhiệt độ neo phải Tp").fill("25");
  assert.match(await resultRow("Khe hở cắt mục tiêu").innerText(), /22 mm/);
  await page.getByLabel("Nhiệt độ neo trái Tt").fill("32");
  await page.getByLabel("Nhiệt độ neo phải Tp").fill("32");
  assert.match(await resultRow("Khe hở cắt mục tiêu").innerText(), /-18,25/);
  await page.getByLabel("Phương pháp").selectOption("SINGLE");
  assert.match(await resultRow("Khe hở cắt mục tiêu").innerText(), /Không áp dụng/);
  await page.getByLabel("Lực cản dọc r").fill("0");
  await page.getByRole("alert").filter({ hasText: "phải lớn hơn 0" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Xuất CSV" }).isDisabled(), true);
  await page.getByRole("button", { name: "Khôi phục mẫu" }).click();
  await page.getByLabel("Chuyển vị mốc trong Mt").fill("2,5");
  assert.match(await resultRow("Khoảng kéo Ld").innerText(), /88,75/);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất CSV" }).click();
  const download = await downloadPromise;
  const csv = await readFile(await download.path(), "utf8");
  assert.ok(csv.includes('"88.75"'));
  assert.ok(csv.includes('"ATW"'));
  await page.getByRole("button", { name: "Khôi phục mẫu" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Mobile viewport overflows horizontally");
  await page.getByRole("button", { name: "Mở menu" }).click();
  await page.getByRole("link", { name: "Giải toả ứng suất R2" }).click();
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true });
  await page.getByRole("heading", { name: "Kết quả và công thức đối chiếu" }).scrollIntoViewIfNeeded();
  assert.equal(await page.locator("main").evaluate((main) => main.scrollWidth <= main.clientWidth), true, "Mobile results overflow the content area");
  await page.screenshot({ path: `${output}/mobile-results.png` });
  assert.deepEqual(errors, [], "Browser runtime errors");
  console.log("PASS: desktop/mobile, ATW/FBW/single, invalid inputs, decimal comma, reset, CSV and navigation; no runtime errors.");
} finally {
  await browser.close();
}
