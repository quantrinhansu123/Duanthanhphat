import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || "playwright");
const baseUrl = process.argv[3] || "http://127.0.0.1:3000";
const output = "docs/research/stress-release/browser";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];

async function openInputs(panel) {
  const summary = panel.getByText("Thông số đầu vào", { exact: true });
  if (!(await summary.evaluate((element) => element.parentElement.open))) await summary.click();
}

async function checkChart(page, panel, length, force, extension) {
  const label = `Biểu đồ từ 0 đến ${length} m; lực kéo ${force} kN; giãn dài cuối đoạn ${extension} mm`;
  const chart = panel.getByTestId("stress-chart");
  await chart.getByRole("img", { name: label, exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="stress-chart"] .recharts-line-curve').length === 2);
  assert.equal(await chart.locator(".recharts-line-curve").count(), 2, "Force and extension curves both render");
  assert.match(await chart.locator("figcaption").innerText(), /P từ K40; ΔL\(x\) = ΔL × x\/L từ K43/);
  assert.match(await chart.locator("figcaption").innerText(), /Chưa mô phỏng chuyển vị tại vùng neo/);
  const bounds = await chart.locator("svg.recharts-surface").evaluate((svg) => {
    const width = svg.viewBox.baseVal.width;
    const height = svg.viewBox.baseVal.height;
    return Array.from(svg.querySelectorAll(".recharts-line-curve"), (path) => {
      const box = path.getBBox();
      return { x: box.x, y: box.y, right: box.x + box.width, bottom: box.y + box.height, width, height };
    });
  });
  assert.ok(bounds.every((box) => box.x >= 0 && box.y >= 0 && box.right <= box.width && box.bottom <= box.height), "Both curves stay within the chart viewport");
  const tickRanges = await chart.locator("svg.recharts-surface").evaluate((svg) => ["left", "right"].map((orientation) => {
    const values = Array.from(svg.querySelectorAll(`.recharts-cartesian-axis-tick-value[orientation="${orientation}"]`), (tick) => Number(tick.textContent.replaceAll(".", "").replace(",", ".")));
    return [Math.min(...values), Math.max(...values)];
  }));
  const numericForce = Number(force.replaceAll(".", "").replace(",", "."));
  const numericExtension = Number(extension.replaceAll(".", "").replace(",", "."));
  assert.equal(tickRanges.length, 2);
  assert.ok(tickRanges[0][0] <= Math.min(0, numericForce) && tickRanges[0][1] >= Math.max(0, numericForce), `Force axis covers current signed force and zero: ${JSON.stringify(tickRanges)}`);
  assert.ok(tickRanges[1][0] <= Math.min(0, numericExtension) && tickRanges[1][1] >= Math.max(0, numericExtension), `Extension axis covers current signed extension and zero: ${JSON.stringify(tickRanges)}`);
  return chart;
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  assert.equal((await page.goto(baseUrl)).status(), 200);
  await page.getByRole("button", { name: /^UT-01: / }).click();
  const panel = page.getByRole("complementary", { name: /^Chi tiết đoạn ray / });
  assert.equal(await page.getByRole("dialog").count(), 0);
  let chart = await checkChart(page, panel, "500", "276,81", "86,25");
  await chart.scrollIntoViewIfNeeded();
  const svgBox = await chart.locator("svg.recharts-surface").boundingBox();
  await page.mouse.move(svgBox.x + svgBox.width / 2, svgBox.y + svgBox.height / 2);
  await chart.locator(".recharts-tooltip-wrapper").filter({ hasText: "P = 276,81 kN" }).waitFor({ state: "visible" });
  assert.match(await chart.locator(".recharts-tooltip-wrapper").innerText(), /ΔL =/);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `${output}/rail-detail-chart-desktop.png` });

  await page.getByRole("button", { name: /^UT-02: / }).click();
  await checkChart(page, panel, "500", "295,27", "92");
  await page.getByRole("button", { name: /^UT-01: / }).click();
  await openInputs(panel);
  await panel.getByLabel("Chiều dài trái Lt").fill("1000");
  await checkChart(page, panel, "1.000", "276,81", "172,5");
  await panel.getByRole("button", { name: "Khôi phục mẫu", exact: true }).click();
  await panel.getByLabel("Nhiệt độ neo trái Tt").fill("40");
  await panel.getByLabel("Nhiệt độ neo phải Tp").fill("40");
  await checkChart(page, panel, "500", "-92,27", "-28,75");
  await panel.getByLabel("Nhiệt độ neo trái Tt").fill("35");
  await panel.getByLabel("Nhiệt độ neo phải Tp").fill("35");
  await checkChart(page, panel, "500", "0", "0");
  await panel.getByLabel("Lực cản dọc r").fill("0");
  await panel.getByRole("alert").waitFor();
  assert.equal(await panel.getByTestId("stress-chart").count(), 0, "Invalid inputs remove the chart");
  await panel.getByRole("button", { name: "Khôi phục mẫu", exact: true }).click();
  await checkChart(page, panel, "500", "276,81", "86,25");
  assert.ok(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth), "Desktop panel does not overflow horizontally");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Desktop page does not overflow horizontally");

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobile = await mobileContext.newPage();
  mobile.on("pageerror", (error) => errors.push(error.message));
  await mobile.goto(baseUrl);
  await mobile.getByRole("button", { name: /^UT-01: / }).click();
  const mobilePanel = mobile.getByRole("complementary", { name: /^Chi tiết đoạn ray / });
  chart = await checkChart(mobile, mobilePanel, "500", "276,81", "86,25");
  await chart.scrollIntoViewIfNeeded();
  assert.ok(await chart.evaluate((element) => element.scrollWidth <= element.clientWidth), "Mobile chart does not overflow horizontally");
  assert.ok(await mobilePanel.evaluate((element) => element.scrollWidth <= element.clientWidth), "Mobile panel does not overflow horizontally");
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Mobile page does not overflow horizontally");
  await mobile.screenshot({ path: `${output}/rail-detail-chart-mobile.png` });
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log("PASS: right-panel chart, force and extension curves, tooltip, selection updates, variable length, positive/negative/zero values, adaptive axes, invalid inputs, desktop/mobile overflow, screenshots and no JavaScript errors.");
} finally {
  await browser.close();
}
