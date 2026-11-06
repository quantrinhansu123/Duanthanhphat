// Run against isolated fixtures; never writes to Supabase or production accounts.
// QA_TOOLS points to an external npm prefix containing esbuild and playwright.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const qaTools = process.env.QA_TOOLS;
if (!qaTools) throw new Error('Set QA_TOOLS to an external node_modules containing esbuild and playwright.');
const { build } = require(path.join(qaTools, 'esbuild'));
const { chromium } = require(path.join(qaTools, 'playwright'));
const output = path.join(require('node:os').tmpdir(), 'thanhphat-rfi-qa');
fs.mkdirSync(output, { recursive: true });
const mocks = {
  '@/lib/projectsDb': `export async function loadProjects(){return {projects:[{id:'project',name:'Dự án kiểm thử'}]}}`,
  '@/i18n/LanguageProvider': `export const useLanguage=()=>({lang:'vi'});`,
  'next/image': `import React from 'react';export default function Image({fill,priority,...p}){return <img {...p}/>}`,
  'next/link': `import React from 'react';export default function Link(p){return <a {...p}/>} `,
  '@/lib/machineRunSchedulesDb': `export const MACHINE_RUN_SYNC_EVENT='qa';export async function loadMachineRunScheduleBundle(){return {schedules:[],machines:[{id:'m1',code:'FBW-01'}],projects:[],personnel:[]}};export async function loadScheduleJournalDetails(){return []};export async function importMachineRunReport(){return {}};`,
  '@/lib/dailyFuelDb': `export const OIL_LEVEL_UNITS=['lít'];export const formatFuelDate=x=>x;export async function loadDailyFuelRows(){return {rows:[]}};export async function deleteDailyFuel(){};export async function upsertDailyFuel(x){window.__fuel=x;};`,
  '@/lib/notificationsDb': `export async function notifyCommanderOilLow(){}`,
  '@/lib/weldQualityClient': `
    export const qualityRequest=async()=>({candidates:[],tickets:[]});
    const w={moi_han_id:'w1',ma_lich_su:'PQ-001',ma_diem:'TT0001',ly_trinh:'Km1+005',con_hieu_luc:true,phien_ban:3,tinh_trang:'Chờ siêu âm và nghiệm thu',du_dieu_kien_nghiem_thu:false,thieu_chieu_dai_mai:true,ly_do_chua_du_dieu_kien:'Thiếu chiều dài mài hoàn thiện (mm).'};
    const rfi={id:'rfi',so_phieu:'RFI-009',ngay_moi:'2026-11-01',trang_thai:'Đã phát hành',thong_tin:{tuyen_thuong:'1'},tong_moi:1,con_lai:1,tracking:{da_nghiem_thu:0,khong_dat:0,chua_nghiem_thu:1,cho_ky:0,da_ky:0,km_nghiem_thu:'—',thieu_ly_trinh:0,moi:[{...w,ket_qua:'Chưa nghiệm thu',da_ky:false}]}};
    let completed=false,signed=false;
    const kinds=['Phụ lục công việc','Giai đoạn xây dựng','Hoàn thành công việc'];
    const docs=()=>kinds.map((loai,i)=>({id:'doc'+i,loai,tinh_trang_ky:signed?'Đã ký':'Chờ ký'}));
    export const loadRfis=async()=>({rfis:completed?[]:[rfi]});
    export const loadRfiNumber=async()=>({so_phieu:'RFI-010'});
    export const loadRfiCandidates=async()=>({rows:[{id:'unassigned',ma_lich_su:'PQ-002',ly_trinh:'Km1+025',tinh_trang:'Chờ siêu âm và nghiệm thu'}],missingChainage:[],excluded:{},total:1});
    export const loadRfiDetail=async()=>({rfi,welds:[{...w}]});
    export const loadQualityInspection=async()=>({inspection:{moi_han_id:'w1',phien_ban:w.phien_ban,gia_tri_do:{doc_mat_lan:0.1}}});
    export async function saveQualityInspection(x){window.__saved=x;w.phien_ban++;w.thieu_chieu_dai_mai=false;w.du_dieu_kien_nghiem_thu=x.gia_tri_do.chieu_dai_mai<=800;w.ly_do_chua_du_dieu_kien=w.du_dieu_kien_nghiem_thu?'':'Ngoài dung sai';}
    export const completeAcceptance=async(x)=>{if(!w.du_dieu_kien_nghiem_thu)throw Error('Blocked');window.__completed=x;completed=true;return {id:'batch'}};
    export const loadRecords=async()=>({records:[{id:'batch',phieu_yeu_cau_nghiem_thu:rfi,thong_tin:{draft:!completed},ho_so_nghiem_thu:docs(),tong_moi:1,da_nghiem_thu:completed?1:0,chua_nghiem_thu:completed?0:1}]});
    export const loadRecordSet=async()=>({dot:{id:'batch',phieu_yeu_cau_nghiem_thu:{...rfi,du_an:{du_an:'Dự án kiểm thử'}}},ho_so:docs(),moi:[]});
    export const setRecordSetSign=async()=>{if(!completed)throw Error('Draft');signed=true;window.__signed=true;};
    export const publishRfi=async(x)=>{window.__published=x;return {id:'monitor'}};
    export const updateRfi=async()=>({id:'rfi'});export const reviseRecord=async()=>({});
  `,
};
(async () => {
  const bundle = await build({
    stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import Workflow from './src/components/WeldAcceptanceWorkflow';import Home from './src/components/HomeDashboard';import Fuel from './src/components/MachineAssignmentList';const mode=new URLSearchParams(location.search).get('mode');createRoot(document.getElementById('root')).render(mode==='home'?<Home onNavigate={(id,search)=>window.__nav={id,search}}/>:mode==='fuel'?<Fuel/>:<Workflow/>);`, resolveDir: root, loader: 'tsx' },
    bundle: true, write: false, format: 'iife', jsx: 'automatic', platform: 'browser',
    nodePaths: [path.join(root, 'node_modules')], alias: { '@': path.join(root, 'src') },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'qa-fixtures', setup(b) {
      b.onResolve({ filter: /^(?:@\/|next\/)/ }, args => args.path in mocks ? { path: args.path, namespace: 'qa' } : undefined);
      b.onLoad({ filter: /.*/, namespace: 'qa' }, args => ({ contents: mocks[args.path], loader: 'jsx', resolveDir: root }));
    } }],
  });
  const appRequire = require('node:module').createRequire(path.join(root, 'package.json'));
  const postcss = appRequire('postcss');
  const tailwind = appRequire('@tailwindcss/postcss');
  const css = await postcss([tailwind({ base: root })]).process(fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8'), { from: path.join(root, 'src/app/globals.css') });
  const server = http.createServer((req, res) => {
    if (req.url === '/app.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(bundle.outputFiles[0].text); }
    else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(`<html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.css}</style><body style="margin:0;background:#f8fafc"><div id="root"></div><script src="/app.js"></script></body></html>`); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, channel: process.env.QA_BROWSER_CHANNEL || 'chrome' }).catch(async error => {
    await new Promise(resolve => server.close(resolve)); throw error;
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base);
    await page.getByRole('button', { name: 'Nghiệm thu', exact: true }).click();
    await page.getByRole('button', { name: 'Nghiệm thu', exact: true }).last().click();
    const result = page.getByLabel('Kết quả PQ-001');
    assert.equal(await result.locator('option[value="Đạt"]').isDisabled(), true);
    await page.getByLabel('Chiều dài mài PQ-001').fill('900');
    await page.getByRole('button', { name: 'Lưu số đo', exact: true }).click();
    await page.waitForFunction(() => window.__saved?.gia_tri_do.chieu_dai_mai === 900);
    assert.equal(await result.locator('option[value="Đạt"]').isDisabled(), true);
    await page.getByLabel('Chiều dài mài PQ-001').fill('500');
    await page.getByRole('button', { name: 'Lưu số đo', exact: true }).click();
    await page.waitForFunction(() => window.__saved?.gia_tri_do.chieu_dai_mai === 500);
    await page.waitForFunction(() => document.querySelector('select[aria-label="Kết quả PQ-001"]')?.value === 'Đạt');
    assert.equal(await page.evaluate(() => window.__saved.gia_tri_do.doc_mat_lan), 0.1, 'Preserve other inspection measurements');
    await page.screenshot({ path: path.join(output, 'acceptance-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, 'acceptance-375.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Hoàn thành nghiệm thu', exact: true }).click();
    await page.getByRole('button', { name: 'Thoát', exact: true }).click();
    await page.getByRole('button', { name: 'Đánh dấu cả bộ: Đã ký', exact: true }).click();
    await page.waitForFunction(() => window.__signed === true);
    await page.getByText('Đã ký bộ hồ sơ', { exact: false }).waitFor();
    // New page resets fixtures to check draft signing and the monitoring branch.
    await page.reload();
    await page.getByRole('button', { name: 'Hồ sơ nghiệm thu', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Đánh dấu cả bộ: Đã ký', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Phát phiếu YCNT', exact: true }).click();
    await page.getByRole('button', { name: '2. Phiếu theo dõi công việc hàn', exact: true }).click();
    const publish = page.getByRole('button', { name: 'Phát phiếu theo dõi mới', exact: true });
    await page.getByLabel('Tuyến thượng', { exact: true }).uncheck();
    await page.getByLabel('Tuyến hạ', { exact: true }).uncheck();
    assert.equal(await publish.isDisabled(), true);
    await page.getByLabel('Tuyến hạ', { exact: true }).check();
    await page.getByPlaceholder('Từ Km0+000').fill('Km1+000');
    await page.getByPlaceholder('Đến Km2+000').fill('Km2+000');
    await publish.click();
    await page.waitForFunction(() => window.__published?.thong_tin.tuyen_ha === '1');
    await page.getByRole('button', { name: 'Xem / In danh sách', exact: true }).click();
    await page.getByRole('button', { name: 'Chi tiết từng mối / KM', exact: true }).click();
    await page.locator('#rfi-issued-list-print').getByText('PQ-001', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, 'rfi-control-desktop.png'), fullPage: true });
    await page.pdf({ path: path.join(output, 'rfi-control.pdf'), preferCSSPageSize: true, printBackground: true });
    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, 'rfi-control-375.png'), fullPage: true });
    await page.goto(`${base}/?mode=home`);
    const menu = page.getByRole('list', { name: 'Menu nhập liệu nhanh' });
    assert.deepEqual(await menu.locator('button').allTextContents(), ['Check List', 'Nhiên liệu', 'Nhật ký hàn', 'Báo cáo ngày', 'Biên bản hàn', 'Giải toả ứng suất']);
    await page.getByText('Nhóm 2 · Quản lý & tra cứu', { exact: true }).waitFor();
    await page.getByText('Nhóm 3 · Báo cáo & quản trị', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, 'home-375.png'), fullPage: true });
    await menu.getByRole('button', { name: 'Nhiên liệu', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.__nav), { id: 'phan-cong-may', search: '?fuel=1' });
    await page.goto(`${base}/?mode=fuel&fuel=1`);
    await page.getByLabel('Máy cấp nhiên liệu').selectOption('m1');
    await page.getByRole('heading', { name: 'Điền cấp phát dầu', exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, 'fuel-375.png'), fullPage: true });
    await page.locator('input[type="number"]').fill('50');
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await page.waitForFunction(() => window.__fuel?.liters === 50 && window.__fuel?.machineId === 'm1');
    assert.deepEqual(errors, []);
    console.log(`PASS browser: missing measurement → save → acceptance → sign, draft guard, required monitoring route, RFI detail/PDF, 375px field menu and direct fuel form. Artifacts: ${output}`);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
