// Kiểm chứng điền báo cáo ngày từ Nhật ký hàn trên DỮ LIỆU THẬT — chỉ ĐỌC (mọi POST/PATCH/DELETE bị chặn).
// Số mong đợi tính độc lập qua REST: FBW 26/10/2026 = 25 mối, trước đó 104, 11 mối gắn mã TT, 14 chưa có mã tọa độ.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const baseURL = process.env.LWR_TEST_URL || 'http://localhost:3010';
const EXPECT = { homNay: '25', denHomQua: '104', tichLuy: '129', unclassified: 14 };

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    const errors = [];
    let blocked = 0;
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => void d.accept());
    await page.route('**/rest/v1/**', route => {
      if (route.request().method() === 'GET' || route.request().method() === 'HEAD') return route.continue();
      blocked += 1;
      return route.abort();
    });
    await page.goto(`${baseURL}/bc-bao-cao-ngay`, { timeout: 120000 });
    await page.locator('input[type=date]').first().fill('2026-10-26');
    await page.getByText('Đang tải danh sách...').waitFor({ state: 'hidden', timeout: 60000 });
    await page.getByRole('button', { name: /Thêm phiếu mới/ }).click();
    await page.getByRole('button', { name: 'Công việc', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    const combo = dialog.getByPlaceholder('Chọn việc đã có hoặc nhập mới').first();
    await combo.fill('Hàn cháy giáp mép trên tuyến');
    await combo.press('Enter');
    const val = async label => dialog.getByLabel(label, { exact: true }).inputValue();
    await page.waitForFunction(() => /Đã điền \d+ mối/.test(document.body.innerText), null, { timeout: 60000 });
    await page.waitForTimeout(1500); // chờ tổng "đến hôm qua" + phân loại tuyến
    assert.equal(await val('Số mối hàn hôm nay'), EXPECT.homNay, 'Hôm nay = số mối trong nhật ký ngày đó');
    assert.equal(await val('Số mối hàn đến hôm qua'), EXPECT.denHomQua, 'Đến hôm qua = tổng FBW trước ngày');
    assert.equal(await dialog.getByLabel('Số mối hàn tích lũy = hôm qua + hôm nay').inputValue(), EXPECT.tichLuy);
    const ghiChu = await dialog.getByLabel('Ghi chú', { exact: true }).inputValue();
    assert.ok(ghiChu.includes(`${EXPECT.unclassified} mối chưa gắn mã tọa độ`), `Ghi chú báo mối chưa phân loại: ${ghiChu}`);
    assert.equal(await dialog.getByLabel('Tuyến thượng').isChecked(), true, 'Có mối TT → tuyến thượng được tích');
    assert.equal(await dialog.getByLabel('Tuyến hạ').isChecked(), false, 'Không có mối HT/HP → tuyến hạ không tích');
    assert.equal(blocked, 0, 'Chưa có lệnh ghi nào (bấm Lưu mới ghi)');
    assert.deepEqual(errors, [], 'Không lỗi trang');
    console.log('PASS test-daily-fill-realdata (read-only)');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
