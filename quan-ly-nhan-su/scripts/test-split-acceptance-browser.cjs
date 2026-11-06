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
  '@/lib/weldQualityClient': `    const splitTickets = new Map();
    export async function qualityRequest(b) {
      const candidate = {moi_han_id:'split1',ma_lich_su:'QA-SPLIT',ngay_mai:'2026-10-30'};
      const evidence = {co_the_dat:true,truc_quan:'Đạt',gia_tri_do:{doc_mat_lan:0.1},phuong_phap_ndt:'Siêu âm',ket_qua_ndt:'Đạt',ngay_ndt:'2026-10-31'};
      const ticket = splitTickets.get(b.loai);
      if(b.action==='split-list')return {candidates:ticket?[]:[candidate],tickets:ticket?[ticket]:[]};
      if(b.action==='split-publish'){splitTickets.set(b.loai,{id:b.id,so_phieu:b.so_phieu,ngay_moi:b.ngay_moi,nguoi_lap:'QA'});return {id:b.id}}
      if(b.action==='split-complete'){ticket.ngay_nghiem_thu=b.ngay_nghiem_thu;ticket.nguoi_nghiem_thu='QA';return {id:b.id}}
      if(b.action==='split-detail')return {ticket,items:[{...candidate,current:evidence,du_lieu_chot:evidence,version:2,ket_qua:ticket.ngay_nghiem_thu?'Đạt':null}]};
      throw Error('Unexpected action '+b.action);
    }

    const limits = Object.fromEntries(['doc_mat_lan','ngang_nam_ray','ngang_chan_ray','phang_mat_lan','chieu_dai_mai'].map(key => [key,{min:-1,max:key==='chieu_dai_mai'?800:0.2,minInclusive:true,maxInclusive:key!=='phang_mat_lan'}]));
    export const loadQualityInspection=async()=>({inspection:{moi_han_id:'w',phien_ban:1,tieu_chuan_id:'rule',gia_tri_do:{doc_mat_lan:0}},rules:[{id:'rule',ten:'QA',dang_ap_dung:true,dung_sai:limits}],summary:{tinh_trang:'Chờ mài'}});
    export const saveQualityInspection=async draft=>{window.saved=draft;return draft};
  `,
};
(async () => {
  const bundle = await build({
    stdin: {contents: `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import Split from './src/components/SplitWeldAcceptance';import Quality from './src/components/WeldQualityDialog';function App(){const [mode,set]=useState("hinh-hoc");return <><label>Phương án nghiệm thu<select value={mode} onChange={e=>set(e.target.value)}><option>hinh-hoc</option><option>sieu-am</option><option>quality</option></select></label>{mode==='quality'?<Quality row={{id:'w',so_luong_thuc_hien:1,ma_lich_su:'QA-1'}} onSaved={()=>{}} onClose={()=>set('hinh-hoc')}/>:<Split key={mode} kind={mode} project="qa" projectName="Dự án kiểm thử"/>}</>}createRoot(document.getElementById('root')).render(<App/>);`, resolveDir: root, loader:'tsx'},
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
    const page = await browser.newPage({viewport:{width:375,height:812}});
    await page.goto(base);
    for (const [mode, prefix] of [['hinh-hoc','RIF'],['sieu-am','RFI']]) {
      await page.getByLabel('Phương án nghiệm thu').selectOption(mode);
      await page.getByLabel('Số phiếu '+prefix).fill(prefix+'-QA');
      await page.getByRole('checkbox',{name:/QA-SPLIT/}).check();
      await page.getByRole('button',{name:'Phát '+prefix+' (1 mối)'}).click();
      await page.getByLabel('Kết quả QA-SPLIT').selectOption({label:'Đạt'});
      await page.getByRole('button',{name:'Chốt nghiệm thu và lập biên bản'}).click();
      await page.getByRole('dialog',{name:'Biên bản nghiệm thu'}).waitFor();
      assert.match(await page.getByRole('dialog').innerText(),/QA-SPLIT/);
      await page.getByRole('button',{name:'Đóng',exact:true}).click();
    }
    await page.getByLabel('Phương án nghiệm thu').selectOption('quality');
    await page.getByLabel('Ngày hoàn thành mài').fill('2026-11-06');
    await page.getByLabel('Kiểm tra trực quan').selectOption('Đạt');
    assert.equal(await page.locator('#measure-doc_mat_lan').inputValue(),'0');
    assert.equal(await page.locator('#measure-ngang_nam_ray').inputValue(),'0.2');
    assert.equal(await page.locator('#measure-phang_mat_lan').inputValue(),'');
    assert.equal(await page.locator('#measure-chieu_dai_mai').inputValue(),'');
    await page.locator('#measure-ngang_nam_ray').fill('0,1');
    await page.getByRole('button',{name:'Lưu kiểm tra'}).click();
    await page.waitForFunction(()=>window.saved?.gia_tri_do.ngang_nam_ray===0.1);
    console.log('PASS: both split workflows, printable records and visual-pass autofill at mobile width');

  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => {console.error(error);process.exitCode=1});
