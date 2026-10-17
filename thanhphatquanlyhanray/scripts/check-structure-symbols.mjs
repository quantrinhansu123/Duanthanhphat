import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:3000/cong-trinh');
  await page.getByText('9 công trình', { exact: true }).waitFor();
  const images = page.locator('tbody img');
  assert.equal(await images.count(), 9);
  await page.waitForFunction(() => [...document.querySelectorAll('tbody img')].every((img) => img.complete && img.naturalWidth > 0));
  await mkdir('docs/design-references/structure', { recursive: true });
  await page.screenshot({ path: 'docs/design-references/structure/symbols.png', fullPage: true });
  await page.reload();
  await page.getByText('9 công trình', { exact: true }).waitFor();
  await page.getByPlaceholder('Tìm mã, tên, tên tiếng Anh…').fill('Cầu');
  assert.equal(await images.count(), 3);
  await page.getByPlaceholder('Tìm mã, tên, tên tiếng Anh…').fill('');
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByTitle('Xóa', { exact: true }).first().click();
  await page.getByText('8 công trình', { exact: true }).waitFor();
  await page.reload();
  await page.getByText('8 công trình', { exact: true }).waitFor();
  // Exercise first-run merge using a pre-existing edited symbol in this isolated browser.
  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('structure-symbols-v1'));
    const bridge = rows.find((row) => row.code === 'CAU');
    bridge.note = 'Ghi chú đã nhập';
    localStorage.setItem('structure-symbols-v1', JSON.stringify([bridge]));
    localStorage.removeItem('structure-symbols-presets-v1');
  });
  await page.reload();
  await page.getByText('9 công trình', { exact: true }).waitFor();
  assert.equal(await page.getByText('Ghi chú đã nhập', { exact: true }).count(), 1);
  assert.deepEqual(errors, []);
  console.log('PASS: 9 images loaded, reload without duplication, search, deletion persists, existing data preserved.');
} finally { await browser.close(); }
