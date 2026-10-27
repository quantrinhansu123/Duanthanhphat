// Nhập Excel toạ độ theo tuyến (dự án): API giả lập, không ghi database thật.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const os = require('node:os');
const path = require('node:path');
const baseURL = process.env.LWR_TEST_URL || 'http://localhost:3010';

(async () => {
  const file = path.join(os.tmpdir(), `toa-do-test-${process.pid}.xlsx`);
  const sheet = XLSX.utils.aoa_to_sheet([
    ['ma_diem', 'kinh_do', 'vi_do', 'ly_trinh', 'ghi_chu'],
    ['TT0001', 103.96, 10.2, 'Km0+000', 'a'],
    ['TP0001', 103.961, 10.201, 'Km0+010', 'b'],
    ['HT0001', 103.962, 10.202, '', ''],
    ['XX0001', 103.9, 10.1, '', 'mã sai'],
    ['TT0002', 999, 10.1, '', 'kinh độ ngoài khoảng'],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1');
  XLSX.writeFile(wb, file);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = [];
    const posts = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => void d.accept());
    await page.route('**/rest/v1/**', async route => {
      const request = route.request();
      const url = request.url();
      if (request.method() !== 'GET') {
        if (url.includes('/toa_do')) {
          const body = JSON.parse(request.postData() || '[]');
          posts.push({ url, body });
          return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(body.map((_, i) => ({ id: `t${i}` }))) });
        }
        return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
      }
      let data = [];
      if (url.includes('/du_an?')) data = [{ id: 'route-1', ma_du_an: 'T1', du_an: 'Tuyến kiểm thử', vi_tri: '', nguoi_phu_trach: null, created_at: '2026-10-22', updated_at: '2026-10-22' }];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });

    await page.goto(`${baseURL}/ban-do`, { timeout: 120000 });
    const select = page.locator('select').filter({ has: page.locator('option', { hasText: 'Tuyến kiểm thử' }) }).first();
    await select.waitFor({ timeout: 60000 });
    await select.selectOption('route-1');
    await page.locator('input[type=file]').first().setInputFiles(file);
    await page.waitForFunction(() => /Đã import \d+ điểm/.test(document.body.innerText), null, { timeout: 30000 });

    assert.equal(posts.length, 1, 'Một lần upsert toạ độ');
    assert.match(posts[0].url, /on_conflict=du_an_id(%2C|,)ma_diem/, 'Khóa trùng theo (tuyến, mã điểm)');
    assert.deepEqual(posts[0].body.map(r => r.ma_diem), ['TT0001', 'TP0001', 'HT0001'], 'Chỉ nhận mã hợp lệ, bỏ dòng sai mã / sai toạ độ');
    assert.ok(posts[0].body.every(r => r.du_an_id === 'route-1'), 'Mọi điểm gắn đúng tuyến đã chọn');
    assert.equal(posts[0].body[0].ly_trinh, 'Km0+000');
    const text = await page.evaluate(() => document.body.innerText);
    assert.match(text, /2 dòng lỗi/, 'Báo số dòng lỗi bị bỏ qua');
    assert.deepEqual(errors, [], 'Không lỗi trang');
    console.log('PASS test-map-excel-import');
  } finally {
    await browser.close();
    require('node:fs').rmSync(file, { force: true });
  }
})().catch(e => { console.error(e); process.exit(1); });
