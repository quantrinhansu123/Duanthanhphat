const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const baseURL = process.env.LWR_TEST_URL || 'http://localhost:3010';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', dialog => void dialog.accept());
    // Bảng phu_tung_thay_the giả lập trong bộ nhớ: không chạm database thật.
    let tableExists = false;
    const rows = [];
    await page.route('**/rest/v1/**', async route => {
      const request = route.request();
      const url = request.url();
      if (!url.includes('phu_tung_thay_the')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      if (!tableExists) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: '42P01', message: 'relation "public.phu_tung_thay_the" does not exist' }) });
      const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (request.method() === 'GET') return json(200, rows);
      if (request.method() === 'POST') {
        const body = JSON.parse(request.postData());
        if (rows.some(row => row.ma_phu_tung === body.ma_phu_tung)) return json(409, { code: '23505', message: 'duplicate key value' });
        const row = { id: `id-${rows.length + 1}`, ...body };
        rows.unshift(row);
        return json(201, row);
      }
      if (request.method() === 'DELETE') {
        const id = new URL(url).searchParams.get('id')?.replace('in.(', '').replace(')', '').replace(/"/g, '');
        for (const target of String(id).split(',')) { const index = rows.findIndex(row => row.id === target); if (index >= 0) rows.splice(index, 1); }
        return route.fulfill({ status: 204, body: '' });
      }
      return json(200, rows);
    });

    // 1) Chưa chạy migration → báo rõ, không im lặng.
    await page.goto(`${baseURL}/phu-tung-thay-the`, { timeout: 120000 });
    await page.waitForFunction(() => document.body.innerText.includes('migration_20261027_phu_tung_thay_the.sql'));

    // 2) Có bảng: thêm → tải lại vẫn còn → trùng mã bị chặn → xóa.
    tableExists = true;
    await page.reload();
    await page.getByRole('button', { name: '+ Thêm phụ tùng' }).click();
    const fillForm = async code => {
      await page.getByRole('textbox').nth(0).fill(code);
      await page.getByRole('textbox').nth(1).fill('Phụ tùng kiểm thử');
      await page.getByRole('textbox').nth(2).fill('TCW');
      await page.getByRole('checkbox', { name: 'Goldschmidt' }).check();
      await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    };
    await fillForm('TEST-001');
    await page.getByText('TEST-001').first().waitFor();
    assert.equal(rows.length, 1);
    await page.reload();
    await page.getByText('TEST-001').first().waitFor();
    await page.getByRole('button', { name: '+ Thêm phụ tùng' }).click();
    await fillForm('TEST-001');
    await page.waitForFunction(() => document.body.innerText.includes('Mã phụ tùng đã tồn tại'));
    assert.equal(rows.length, 1, 'Duplicate code is rejected');
    await page.getByRole('button', { name: 'Hủy', exact: true }).click();
    await page.getByRole('button', { name: 'Xóa', exact: true }).first().click();
    await page.waitForFunction(() => document.body.innerText.includes('Chưa có phụ tùng phù hợp'));
    assert.equal(rows.length, 0);
    assert.deepEqual(errors, []);
    console.log('PASS: spare parts persist after reload, duplicate rejected, delete works, missing table reported.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
