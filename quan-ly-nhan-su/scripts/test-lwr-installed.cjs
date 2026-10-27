const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const baseURL = process.env.LWR_TEST_URL || 'http://localhost:3010';
const KEY = 'tp-track-layout-v2';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => void d.accept());
    await page.route('**/rest/v1/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`${baseURL}/lwr-track-map`, { timeout: 120000 });
    await page.getByLabel('Chốt lý trình cuối tuyến').fill('5+000');
    await page.getByRole('button', { name: /^Rải \/ cập nhật/ }).click();
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || '{}').rows?.[0]?.cells?.length > 0, KEY);
    assert.equal(await page.getByTestId('rail-grid-installed').count(), 0, 'Bước 1: toàn bộ là nét đứt, chưa có nét đỏ');

    const form = page.getByRole('form', { name: 'Cập nhật lắp đặt ray' });
    await form.getByLabel('Lý trình đầu đã lắp').fill('0+000');
    await form.getByLabel('Lý trình cuối đã lắp').fill('1+500');
    await form.getByRole('button', { name: 'Cập nhật ray đã lắp' }).click();
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || '{}').installed, KEY);
    let layout = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
    assert.deepEqual(layout.installed['TUYẾN THƯỢNG'], [{ from: 0, to: 1500 }]);
    assert.deepEqual(layout.installed['TUYẾN HẠ'], [{ from: 0, to: 1500 }], 'Nhập 1 lần → cả 2 tuyến');
    // Rải mới chỉ có Thượng? Hạ chưa rải thì không vẽ đỏ trên dải Hạ nhưng dữ liệu vẫn lưu.
    const reds = await page.getByTestId('rail-grid-installed').count();
    assert.ok(reds >= 2, `Nét đỏ hiện trên dải ray đã rải (${reds})`);

    // Hôm sau lắp thêm: lý trình cuối 3+000 → nối dài, không tách đoạn.
    await form.getByLabel('Lý trình cuối đã lắp').fill('3+000');
    await form.getByRole('button', { name: 'Cập nhật ray đã lắp' }).click();
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).installed['TUYẾN THƯỢNG'][0].to === 3000, KEY);
    layout = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
    assert.equal(layout.installed['TUYẾN THƯỢNG'].length, 1, 'Cập nhật hằng ngày nối dài một đoạn');

    // Sửa tay một tuyến (bỏ tick cả 2 tuyến → chỉ Hạ rút ngắn bằng Xóa + nhập lại).
    await form.getByRole('button', { name: 'Xóa' }).last().click();
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).installed['TUYẾN HẠ'].length === 0, KEY);
    layout = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
    assert.equal(layout.installed['TUYẾN THƯỢNG'].length, 1, 'Xóa ở Hạ không ảnh hưởng Thượng');
    assert.deepEqual(errors, [], 'Không lỗi trang');
    console.log('PASS test-lwr-installed');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
