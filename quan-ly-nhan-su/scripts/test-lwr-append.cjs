const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  let releaseSync;
  const syncGate = new Promise(resolve => { releaseSync = resolve; });
  try {
    const page = await browser.newPage();
    let syncPending = false;
    await page.route('**/rest/v1/**', async route => {
      if (route.request().url().includes('lwr_long_rails')) {
        syncPending = true;
        await syncGate;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto(`${process.env.LWR_TEST_URL || 'http://localhost:3010'}/lwr-track-map`);
    const plus = page.getByTestId('rail-grid-append').first();
    await plus.click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Lý trình đầu thanh ngắn').fill('0+300');
    await dialog.getByLabel('Lý trình cuối thanh ngắn').fill('1+400');
    await dialog.getByRole('button', { name: 'Thêm', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.ok(syncPending, 'Remote sync must still be pending during local save');
    const readPlaced = () => page.evaluate(() => JSON.parse(localStorage.getItem('tp-track-layout-v2')).rows[0].cells.filter(cell => cell.placed));
    const placed = await readPlaced();
    assert.ok(placed.some(cell => cell.from === '0+300' && cell.to === '1+400'));
    await plus.click();
    await dialog.getByLabel('Lý trình đầu thanh ngắn').fill('0+500');
    await dialog.getByLabel('Lý trình cuối thanh ngắn').fill('1+000');
    await dialog.getByRole('button', { name: 'Thêm', exact: true }).click();
    await dialog.getByRole('alert').waitFor();
    assert.match(await dialog.getByRole('alert').innerText(), /chồng lên/);
    assert.deepEqual(await readPlaced(), placed);
    releaseSync();
    await page.reload();
    await plus.waitFor();
    assert.deepEqual(await readPlaced(), placed);
    console.log('PASS: add 0+300–1+400 during pending sync, reject overlap, preserve after reload');
  } finally {
    releaseSync();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
