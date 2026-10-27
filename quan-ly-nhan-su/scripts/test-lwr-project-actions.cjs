const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const baseURL = process.env.LWR_TEST_URL || 'http://localhost:3010';
const KEY = 'tp-track-layout-v2';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = [];
    const dialogs = [];
    const writes = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', dialog => { dialogs.push(dialog.message()); void dialog.accept(); });
    // API giả lập: không chạm database thật. Ghi (POST/PATCH) lwr_long_rails được ghi lại để kiểm tra.
    await page.route('**/rest/v1/**', async route => {
      const request = route.request();
      const url = request.url();
      if (url.includes('lwr_long_rails')) {
        if (request.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        writes.push(JSON.parse(request.postData() || 'null'));
        return route.fulfill({ status: 201, contentType: 'application/json', body: '' });
      }
      let data = [];
      if (url.includes('/du_an?')) data = [{ id: 'project-test', ma_du_an: 'TEST', du_an: 'Dự án kiểm thử', vi_tri: '', nguoi_phu_trach: null, created_at: '2026-10-22', updated_at: '2026-10-22' }];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });

    await page.goto(`${baseURL}/lwr-track-map`, { timeout: 120000 });
    await page.getByLabel('Chốt lý trình cuối tuyến').fill('2+000');
    await page.getByRole('button', { name: /^Rải \/ cập nhật/ }).click();
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || '{}').rows?.[0]?.cells?.length > 0, KEY);

    // Hai đoạn LWR liền nhau trên dải TT: 0+000–0+500 và 0+500–1+000 (tạo bằng nút "+" rồi Lưu thông số).
    const detail = page.locator('aside[aria-labelledby="rail-detail-title"]');
    const dialog = page.getByRole('dialog');
    for (const [from, to] of [['0+000', '0+500'], ['0+500', '1+000']]) {
      await page.getByTestId('rail-grid-append').first().click();
      await dialog.getByLabel('Lý trình đầu thanh ngắn').fill(from);
      await dialog.getByLabel('Lý trình cuối thanh ngắn').fill(to);
      await dialog.getByRole('button', { name: 'Thêm', exact: true }).click();
      await detail.waitFor();
      await detail.getByRole('button', { name: 'Lưu thông số', exact: true }).click();
      await page.waitForFunction(count => (JSON.parse(localStorage.getItem('tp-track-layout-v2') || '{}').longRails || []).length >= count, from === '0+000' ? 1 : 2);
      await page.getByRole('button', { name: /^Đóng chi tiết/ }).first().click();
    }
    let layout = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
    assert.deepEqual(layout.longRails.map(rail => rail.code).sort(), ['TT0001', 'TT0002'], 'New long rails get TT0001, TT0002 per row');
    assert.ok(dialogs.some(message => message.includes('Bạn đã chọn/gán dự án chưa?')), 'Unassigned map asks about the project');

    // Mã cũ (LWR09, LWR03) → "Đánh số lại" đưa về TT0001, TT0002 theo lý trình thi công.
    await page.evaluate(key => {
      const data = JSON.parse(localStorage.getItem(key));
      const byStart = [...data.longRails].sort((a, b) => a.startMetres - b.startMetres);
      byStart[0].code = byStart[0].label = 'LWR09';
      byStart[1].code = byStart[1].label = 'LWR03';
      localStorage.setItem(key, JSON.stringify(data));
    }, KEY);
    await page.reload();
    await page.getByTestId('rail-grid-short').first().waitFor();
    writes.length = 0;
    await page.getByRole('button', { name: 'Đánh số lại TT/TP/HT/HP' }).click();
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).longRails.every(rail => /^TT000\d$/.test(rail.code)), KEY);
    layout = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
    const ordered = [...layout.longRails].sort((a, b) => a.startMetres - b.startMetres).map(rail => rail.code);
    assert.deepEqual(ordered, ['TT0001', 'TT0002'], 'Renumber follows construction order (chainage)');
    assert.ok(dialogs.some(message => message.startsWith('Đánh số lại 2 đoạn LWR')), 'Renumber asks for confirmation');
    await page.waitForFunction(() => document.body.innerText.includes('Đã đánh số lại 2 đoạn LWR'));
    assert.equal(writes.length, 2, 'Both renumbered rails are sent to the server');

    // Gán sơ đồ chưa gán dự án vào dự án: chuyển bố cục + đoạn LWR sang khóa dự án, kèm projectId lên server.
    writes.length = 0;
    await page.getByLabel('Chọn dự án để gán').selectOption('project-test');
    await page.getByRole('button', { name: 'Gán dự án', exact: true }).click();
    await page.waitForFunction(() => document.body.innerText.includes('Đang gán dự án: Dự án kiểm thử'));
    const stored = await page.evaluate(() => ({
      base: localStorage.getItem('tp-track-layout-v2'),
      project: JSON.parse(localStorage.getItem('tp-track-layout-v2:project-test') || 'null'),
    }));
    assert.equal(stored.base, null, 'Unassigned layout is moved, not copied');
    assert.deepEqual(stored.project.longRails.map(rail => rail.projectId), ['project-test', 'project-test']);
    assert.ok(writes.length >= 2 && writes.every(body => String(body.code).startsWith('project-test:')), 'Server rows are re-keyed to the project');
    // Đã có dự án → Lưu sơ đồ không hỏi lại.
    const before = dialogs.length;
    await page.getByRole('button', { name: 'Lưu sơ đồ', exact: true }).click();
    await page.waitForFunction(() => document.body.innerText.includes('Đã lưu sơ đồ lúc'));
    assert.equal(dialogs.length, before, 'No project prompt once a project is assigned');
    assert.deepEqual(errors, []);
    console.log('PASS: TT/TP/HT/HP codes, project prompt, renumber by chainage, assign project, save without prompt.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
