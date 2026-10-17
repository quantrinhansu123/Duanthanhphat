import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || "playwright");
const baseUrl = process.argv[3] || "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1320 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

const startSelect = () => page.getByRole("combobox", { name: /^Bắt đầu thanh/ });
const endSelect = () => page.getByRole("combobox", { name: /^Kết thúc thanh/ });
const symbolSelect = () => page.getByRole("combobox", { name: /^Ký hiệu công trình/ });
const viewport = () => page.getByTestId("track-scroll");
const placements = () => page.locator("[data-placement]");
const lanes = () => page.getByTestId("symbol-lane");
const waitReady = () => page.getByRole("button", { name: "Thêm lên sơ đồ", exact: true }).waitFor();
const storedLayout = () => page.evaluate(() => JSON.parse(localStorage.getItem("tp-track-layout-v1")));
const scrollMetrics = () => viewport().evaluate((el) => ({ width: el.clientWidth, content: el.scrollWidth, left: el.scrollLeft }));

try {
  await page.goto(baseUrl);
  await waitReady();
  await page.waitForFunction(() => document.querySelectorAll("select")[3]?.options.length === 10);
  assert.equal(await symbolSelect().locator("option:not([disabled])").count(), 9, "All nine catalog symbols are offered");
  assert.equal(await page.getByRole("button", { name: /^(UT|UP|DT|DP)-\d+: / }).count(), 28);

  await page.getByRole("combobox", { name: /^Dải ray/ }).selectOption("UT");
  await startSelect().selectOption("UT-02");
  await endSelect().selectOption("UT-04");
  await symbolSelect().selectOption({ label: "Cầu (CAU)" });
  await page.getByLabel("Tên hiển thị (tùy chọn)", { exact: true }).fill("Cầu QA");
  await page.getByRole("button", { name: "Thêm lên sơ đồ", exact: true }).click();
  await placements().filter({ hasText: "Cầu QA" }).waitFor();
  assert.match(await placements().innerText(), /UT-02 → UT-04/);
  assert.match(await placements().innerText(), /Km 0\+500 – 2\+000/);
  assert.equal((await storedLayout()).placements.length, 1);
  assert.equal(await lanes().count(), 1, "A symbol is plotted on one shared timeline");
  const singleLaneHeight = (await lanes().first().boundingBox()).height;

  await page.getByRole("button", { name: "Chọn Cầu QA để sửa", exact: true }).click();
  assert.equal(await startSelect().inputValue(), "UT-02");
  assert.equal(await endSelect().inputValue(), "UT-04");
  await endSelect().selectOption("UT-05");
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  assert.equal(await placements().count(), 1, "Editing updates the existing span");
  assert.match(await placements().innerText(), /Km 0\+500 – 2\+500/);

  await page.getByLabel("Số thanh ghép thêm / dải", { exact: true }).fill("14");
  await page.getByRole("button", { name: "Ghép thêm thanh", exact: true }).click();
  await page.getByRole("heading", { name: "Sơ đồ tuyến và dải ray · 21 thanh / dải", exact: true }).waitFor();
  assert.equal(await startSelect().locator("option").count(), 21);
  assert.equal(await startSelect().locator('option[value="UT-21"]').count(), 1);
  const extended = await storedLayout();
  assert.deepEqual(extended.rows.map((row) => row.cells.length), [21, 21, 21, 21]);
  assert.equal(extended.rows[0].cells.at(-1).to, "10+500");
  assert.equal(await page.getByRole("button", { name: /^(UT|UP|DT|DP)-\d+: / }).count(), 84);
  await startSelect().selectOption("UT-21");
  await endSelect().selectOption("UT-21");
  await symbolSelect().selectOption({ label: "Hầm (HAM)" });
  await page.getByLabel("Tên hiển thị (tùy chọn)", { exact: true }).fill("Hầm cuối tuyến QA");
  await page.getByRole("button", { name: "Thêm lên sơ đồ", exact: true }).click();
  assert.equal(await placements().count(), 2);
  assert.equal(await lanes().count(), 1, "A distant structure is overlaid on the same timeline");
  assert.equal((await lanes().first().boundingBox()).height, singleLaneHeight, "Adding a distant symbol does not add a card or increase the lane height");
  assert.ok((await scrollMetrics()).content > (await scrollMetrics()).width, "The common viewport can scroll");
  await viewport().evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  const lastCell = page.getByRole("button", { name: /^UT-21: / });
  const lastRect = await lastCell.boundingBox();
  const viewRect = await viewport().boundingBox();
  assert.ok(lastRect.x >= viewRect.x && lastRect.x + lastRect.width <= viewRect.x + viewRect.width + 1, "The last segment is reachable by horizontal scroll");
  const lastIcon = placements().filter({ hasText: "Hầm cuối tuyến QA" }).locator("[data-placement-icon]");
  const lastIconRect = await lastIcon.boundingBox();
  assert.ok(lastIconRect.x >= viewRect.x && lastIconRect.x + lastIconRect.width <= viewRect.x + viewRect.width + 1, "The last symbol is reachable by the shared horizontal scroll");
  await lastCell.click();
  const panel = page.getByRole("complementary", { name: "Chi tiết đoạn ray UT-21", exact: true });
  await panel.waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(await panel.getByRole("heading", { name: "Chi tiết đoạn ray UT-21", exact: true }).count(), 1);
  assert.equal(await panel.getByText("Km 10+000", { exact: true }).count(), 1);
  assert.equal(await panel.getByText("Km 10+500", { exact: true }).count(), 1);
  await panel.getByText("Thông số đầu vào", { exact: true }).click();
  assert.equal(await panel.getByLabel("Chiều dài trái Lt").inputValue(), "500");
  assert.equal(await panel.getByLabel("Nhiệt độ khóa đường T").inputValue(), "35");
  await panel.getByRole("button", { name: "Đóng chi tiết", exact: true }).click();

  await page.reload();
  await page.getByRole("heading", { name: "Sơ đồ tuyến và dải ray · 21 thanh / dải", exact: true }).waitFor();
  assert.match(await placements().filter({ hasText: "Cầu QA" }).innerText(), /UT-02 → UT-05/);
  assert.equal(await placements().count(), 2, "Both overlay symbols persist after reload");
  assert.deepEqual((await storedLayout()).rows.map((row) => row.cells.length), [21, 21, 21, 21]);

  // The test browser has isolated storage; catalog creation never touches the user's browser.
  await page.getByRole("link", { name: "Danh mục ký hiệu", exact: true }).click();
  await page.getByRole("button", { name: "Thêm mới", exact: true }).click();
  await page.getByLabel("Tên ký hiệu *", { exact: true }).fill("Ký hiệu QA tự tạo");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await page.getByText("10 công trình", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Tổng quan (Track Map)", exact: true }).click();
  await symbolSelect().locator("option").filter({ hasText: "Ký hiệu QA tự tạo" }).waitFor({ state: "attached" });
  assert.equal(await symbolSelect().locator("option:not([disabled])").count(), 10);
  assert.equal(await placements().count(), 2);
  await symbolSelect().selectOption({ label: await symbolSelect().locator("option").filter({ hasText: "Ký hiệu QA tự tạo" }).innerText() });
  await page.getByLabel("Tên hiển thị (tùy chọn)", { exact: true }).fill("Mốc QA tự tạo");
  await page.getByRole("button", { name: "Thêm lên sơ đồ", exact: true }).click();
  assert.equal(await placements().count(), 3);
  assert.equal(await lanes().count(), 1, "Separated symbol labels share a single line");
  assert.equal((await lanes().first().boundingBox()).height, singleLaneHeight);

  // Check that the placement geometry and the rail row use the same column coordinates.
  const bridge = placements().filter({ hasText: "Cầu QA" });
  const geometry = await bridge.boundingBox();
  const first = await page.getByRole("button", { name: /^UT-02: / }).boundingBox();
  const last = await page.getByRole("button", { name: /^UT-05: / }).boundingBox();
  assert.ok(Math.abs(geometry.x - first.x) <= 1, "Placement begins at the selected rail column");
  assert.ok(Math.abs(geometry.x + geometry.width - last.x - last.width) <= 1, "Placement ends at the selected rail column");
  const baseline = await lanes().first().getByTestId("track-line").boundingBox();
  const symbolGeometry = await placements().evaluateAll((elements) => elements.map((element) => {
    const icon = element.querySelector("[data-placement-icon]").getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return { top: icon.top, bottom: icon.bottom, border: style.borderTopWidth, background: style.backgroundColor };
  }));
  for (const symbol of symbolGeometry) {
    assert.ok(symbol.top < baseline.y && symbol.bottom > baseline.y + baseline.height, "The symbol crosses the timeline instead of sitting in a separate card");
    assert.equal(symbol.top, symbolGeometry[0].top, "Separated icons share the same vertical anchor");
    assert.equal(symbol.border, "0px", "The placement has no card border");
    assert.equal(symbol.background, "rgba(0, 0, 0, 0)", "The placement has no card background");
  }
  await mkdir("docs/design-references", { recursive: true });
  await viewport().evaluate((el) => { el.scrollLeft = 0; });
  await page.screenshot({ path: "docs/design-references/track-editor.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), "Mobile page stays within the viewport");
  const mobile = await scrollMetrics();
  assert.ok(mobile.content > mobile.width, "The diagram still scrolls horizontally on mobile");
  await viewport().evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await viewport().scrollIntoViewIfNeeded();
  await page.screenshot({ path: "docs/design-references/track-editor-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1320 });
  await viewport().evaluate((el) => { el.scrollLeft = 0; });
  await bridge.hover();
  await page.getByRole("button", { name: "Xóa Cầu QA", exact: true }).click();
  assert.equal(await placements().count(), 2);
  const tunnel = placements().filter({ hasText: "Hầm cuối tuyến QA" });
  await tunnel.hover();
  await page.getByRole("button", { name: "Xóa Hầm cuối tuyến QA", exact: true }).click();
  assert.equal(await placements().count(), 1);
  assert.equal((await storedLayout()).placements[0].label, "Mốc QA tự tạo");
  await page.reload();
  await placements().filter({ hasText: "Mốc QA tự tạo" }).waitFor();
  assert.equal(await placements().count(), 1);
  assert.deepEqual(errors, [], "No browser JavaScript errors");
  console.log("PASS: nine catalog symbols, icons overlaid across one shared timeline without cards, stable lane height, inclusive aligned spans, icon editing, 14 appended segments per rail, final segment and symbol reachable, R2 side panel, persisted layout, custom catalog symbol, deletion, desktop/mobile horizontal scrolling, screenshots, no JavaScript errors.");
} finally {
  await browser.close();
}
