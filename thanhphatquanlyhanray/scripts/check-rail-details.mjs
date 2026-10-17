import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || "playwright");
const browser = await chromium.launch({ headless: true });

async function openInputs(panel) {
  const summary = panel.getByText("Thông số đầu vào", { exact: true });
  if (!(await summary.evaluate((el) => el.parentElement.open))) await summary.click();
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.argv[3] || "http://127.0.0.1:3000");
  const cells = page.getByRole("button", { name: /^(UT|UP|DT|DP)-\d+: / });
  const panel = page.getByRole("complementary", { name: /^Chi tiết đoạn ray / });
  assert.equal(await cells.count(), 28);
  for (let index = 0; index < 28; index++) {
    const button = cells.nth(index);
    const label = await button.getAttribute("aria-label");
    const [id, temperature] = label.split(": ");
    await button.click();
    await panel.getByRole("heading", { name: `Chi tiết đoạn ray ${id}`, exact: true }).waitFor();
    assert.equal(await page.getByRole("dialog").count(), 0, "Details do not create a dialog");
    assert.equal(await button.getAttribute("aria-pressed"), "true");
    await openInputs(panel);
    assert.equal(await panel.getByLabel("Nhiệt độ khóa đường T").inputValue(), String(parseInt(temperature)));
    assert.equal(await panel.getByLabel("Chiều dài trái Lt").inputValue(), "500");
    const force = Math.round(210840000 * 0.007611 * 0.0000115 * (parseInt(temperature) - 20) * 100) / 100;
    assert.ok((await panel.getByRole("row").filter({ hasText: "Lực kéo P" }).innerText()).includes(force.toLocaleString("vi-VN")));
  }
  await cells.first().click();
  await openInputs(panel);
  await panel.getByLabel("Nhiệt độ neo trái Tt").fill("28");
  await panel.getByRole("button", { name: "Đoạn tiếp", exact: true }).click();
  await panel.getByRole("heading", { name: "Chi tiết đoạn ray UT-02", exact: true }).waitFor();
  await openInputs(panel);
  assert.equal(await panel.getByLabel("Nhiệt độ neo trái Tt").inputValue(), "20");
  assert.equal(await panel.getByLabel("Nhiệt độ khóa đường T").inputValue(), "36");
  await panel.getByRole("button", { name: "Đoạn trước", exact: true }).click();
  await panel.getByRole("heading", { name: "Chi tiết đoạn ray UT-01", exact: true }).waitFor();

  const downloadReady = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Xuất CSV", exact: true }).click();
  const download = await downloadReady;
  assert.equal(download.suggestedFilename(), "giai-toa-UT-01.csv");
  const csv = await readFile(await download.path(), "utf8");
  assert.match(csv, /"Đoạn ray","UT-01"/);
  assert.match(csv, /"Nhiệt độ khóa đường T","35","°C"/);

  const mainBounds = await page.getByTestId("track-main").boundingBox();
  const panelBounds = await panel.boundingBox();
  assert.ok(panelBounds.x >= mainBounds.x + mainBounds.width, "Desktop details appear to the right of the schematic");
  assert.ok(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth), "Desktop panel has no horizontal overflow");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), "Desktop page stays within the viewport");
  await page.getByTestId("track-scroll").evaluate((el) => { el.scrollLeft = 0; });
  await mkdir("docs/research/stress-release/browser", { recursive: true });
  await page.screenshot({ path: "docs/research/stress-release/browser/rail-detail-desktop.png" });

  await panel.getByRole("button", { name: "Đóng chi tiết", exact: true }).click();
  assert.equal(await panel.count(), 0);
  await cells.first().click();
  await panel.waitFor();
  await openInputs(panel);
  assert.equal(await panel.getByLabel("Nhiệt độ neo trái Tt").inputValue(), "20", "Reopening restores the segment inputs");
  await panel.getByRole("button", { name: "Đóng chi tiết", exact: true }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await cells.first().click();
  await panel.waitFor();
  await page.waitForFunction(() => {
    const bounds = document.querySelector('[aria-labelledby="rail-detail-title"]').getBoundingClientRect();
    return bounds.top >= 0 && bounds.top < window.innerHeight / 2;
  });
  const mobileMain = await page.getByTestId("track-main").boundingBox();
  const mobilePanel = await panel.boundingBox();
  assert.ok(mobilePanel.y >= mobileMain.y + mobileMain.height, "Mobile details stack beneath the schematic");
  assert.ok(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth), "Mobile panel has no horizontal overflow");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), "Mobile page stays within the viewport");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.screenshot({ path: "docs/research/stress-release/browser/rail-detail-mobile.png" });
  await panel.getByRole("button", { name: "Đóng chi tiết", exact: true }).click();
  assert.equal(await panel.count(), 0);
  assert.deepEqual(errors, []);
  console.log("PASS: all 28 rail cells, direct selection while panel is open, segment values/results, previous/next input reset, CSV, close/reopen, desktop right panel, mobile stacked panel, no dialogs or page overflow, screenshots, no JavaScript errors.");
} finally { await browser.close(); }
