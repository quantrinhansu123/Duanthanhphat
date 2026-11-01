// QA_TOOLS points to external esbuild/playwright. Screenshots stay outside the repository.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
if (!process.env.QA_TOOLS) throw Error('Set QA_TOOLS to an external node_modules directory.');
const { build } = require(path.join(process.env.QA_TOOLS, 'esbuild'));
const { chromium } = require(path.join(process.env.QA_TOOLS, 'playwright'));
const appRequire = require('node:module').createRequire(path.join(root, 'package.json'));
const out = process.env.QA_OUTPUT || path.join(require('node:os').tmpdir(), 'thanhphat-quality-rules');
fs.mkdirSync(out, { recursive: true });
const fixtures = `
  const bounds={min:-1,max:1,minInclusive:true,maxInclusive:true};
  const limits=Object.fromEntries(['doc_mat_lan','ngang_nam_ray','ngang_chan_ray','phang_mat_lan','chieu_dai_mai'].map(k=>[k,k==='chieu_dai_mai'?{...bounds,min:0,max:800}:bounds]));
  const base={du_an_id:'project',cong_nghe_han:'FBW',loai_moi_han:'Sản xuất',dung_sai:limits,yeu_cau_ndt:true,ndt_truoc_rfi:true,can_cu_mien_ndt:null,nguoi_xac_nhan:'qc'};
  const active={...base,id:'r2',ten:'TCVN_R2',phien_ban:2,dang_ap_dung:true};
  const old={...base,id:'r1',ten:'TCVN',phien_ban:1,dang_ap_dung:false};
  const trial={...base,id:'trial',ten:'Tiêu chí Chấp thuận',loai_moi_han:'Chấp thuận',phien_ban:1,dang_ap_dung:true};
  const mode=new URLSearchParams(location.search).get('case');
  let rules=[active,old,trial];
  export async function loadQualityInspection(){return {inspection:{moi_han_id:'weld',tieu_chuan_id:mode==='old'?'r1':null,phien_ban:3,ngay_mai:'2026-11-01',truc_quan:'Đạt',gia_tri_do:{doc_mat_lan:0.1,ngang_nam_ray:0.1,ngang_chan_ray:0.1,phang_mat_lan:0.1,chieu_dai_mai:700},ket_qua_ndt:'Đạt',ngay_ndt:'2026-11-01',phuong_phap_ndt:'Siêu âm'},summary:{tinh_trang:'Chờ siêu âm và nghiệm thu'},rules:mode==='training'?[]:[active,old]};}
  export async function saveQualityInspection(x){window.__saved=x;return {...x,phien_ban:x.phien_ban+1};}
  export function notifyWeldQualityChanged(){}
  export async function qualityRequest(x){
    if(x.action==='rules-list')return {rules};
    if(x.action==='rule-sync'){window.__sync=x;return {sync:{cap_nhat:5,giu_nguyen_ho_so:11,dang_dung_tieu_chi:20}};}
    if(x.action==='rule'){window.__created=x;const rule={...active,id:'r3',phien_ban:3,ten:x.ten};rules=[rule,...rules.map(r=>r.loai_moi_han===rule.loai_moi_han?{...r,dang_ap_dung:false}:r)];return {rule,sync:{cap_nhat:20,giu_nguyen_ho_so:11,dang_dung_tieu_chi:20}};}
    throw Error('Unexpected action '+x.action);
  }
`;
const mocks = {
  '@/lib/weldQualityClient': fixtures,
  '@/lib/projectsDb': `export async function loadProjects(){return {projects:[{id:'project',name:'Tuyến tàu điện đô thị đoạn 1 – đặc khu Phú Quốc, tỉnh An Giang'}]}};`,
  '@/i18n/LanguageProvider': `export const useLanguage=()=>({lang:'vi',t:x=>x});`,
};
(async () => {
  const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Dialog from './src/components/WeldQualityDialog';import Criteria from './src/components/WeldQualityCriteriaPage';const p=new URLSearchParams(location.search);const row={id:'weld',ma_lich_su:'PQ-FBW-29-10-26-0038',du_an_id:'project',du_an:'Tuyến tàu điện đô thị đoạn 1 – đặc khu Phú Quốc, tỉnh An Giang',cong_nghe_han:'FBW',loai_moi_han:p.get('case')==='training'?'Đào tạo':'Sản xuất',so_luong_thuc_hien:1};window.addEventListener('app-navigate',e=>window.__target=e.detail);createRoot(document.getElementById('root')).render(p.get('case')==='criteria'?<Criteria/>:<Dialog row={row} onClose={()=>window.__closed=true} onSaved={()=>{}}/>);`,resolveDir:root,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',alias:{'@':path.join(root,'src')},nodePaths:[path.join(root,'node_modules')],define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'qa',setup(b){b.onResolve({filter:/^@\//},a=>a.path in mocks?{path:a.path,namespace:'qa'}:undefined);b.onLoad({filter:/.*/,namespace:'qa'},a=>({contents:mocks[a.path],loader:'jsx',resolveDir:root}));}}]});
  const css=await appRequire('postcss')([appRequire('@tailwindcss/postcss')({base:root})]).process(fs.readFileSync(path.join(root,'src/app/globals.css'),'utf8'),{from:path.join(root,'src/app/globals.css')});
  const server=http.createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('content-type','application/javascript');res.end(bundle.outputFiles[0].text);}else{res.setHeader('content-type','text/html; charset=utf-8');res.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.css}body{margin:0;background:#f1f5f9;font-family:Arial,sans-serif}</style><div id="root"></div><script src="/app.js"></script>`);}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;
  try{
    browser=await chromium.launch({headless:true,channel:process.env.QA_BROWSER_CHANNEL||'chrome'});
    const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const base=`http://127.0.0.1:${server.address().port}`;
    await page.goto(base+'/?case=old');
    const select=page.getByRole('button',{name:'Tiêu chí áp dụng',exact:true});
    await select.click();await page.getByRole('listbox').waitFor();
    assert.equal(await page.getByRole('listbox').getByText('TCVN_R2',{exact:true}).isVisible(),true,'Menu is visible inside native dialog top layer');
    await page.screenshot({path:path.join(out,'01-dropdown-tieu-chi.png')});
    await page.getByRole('combobox',{name:'Tìm tiêu chí nghiệm thu'}).fill('R2');
    await page.keyboard.press('Enter');
    await page.getByRole('button',{name:'Lưu kiểm tra',exact:true}).click();
    await page.waitForFunction(()=>window.__saved?.tieu_chuan_id==='r2');
    assert.equal(await page.evaluate(()=>window.__saved.gia_tri_do.chieu_dai_mai),700);
    await select.click();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').isVisible(),true,'Escape closes menu before dialog');assert.equal(await page.getByRole('listbox').count(),0);
    await page.goto(base+'/?case=current');
    await page.getByRole('button',{name:'Tiêu chí áp dụng',exact:true}).getByText('TCVN_R2',{exact:true}).waitFor();
    await page.goto(base+'/?case=training');await page.getByRole('button',{name:'Tiêu chí áp dụng',exact:true}).click();
    await page.getByRole('listbox').getByText('Chưa thiết lập tiêu chí cho FBW · Đào tạo.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Thiết lập tiêu chí cho nhóm này',exact:true}).click();
    assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('weld-quality-rule-target')).weldType),'Đào tạo');
    assert.equal(await page.evaluate(()=>window.__target.tab),'tieu-chi-nghiem-thu');
    await page.evaluate(()=>sessionStorage.clear());
    await page.goto(base+'/?case=criteria');
    await page.getByRole('button',{name:'Áp dụng cho mối chưa chốt',exact:true}).click();
    await page.getByRole('status').getByText('Đã cập nhật 5 mối.',{exact:false}).waitFor();
    await page.screenshot({path:path.join(out,'02-dong-bo-tieu-chi.png'),fullPage:true});
    await page.getByRole('button',{name:'Tạo phiên bản mới',exact:true}).click();
    await page.getByLabel('Tên tiêu chuẩn / căn cứ',{exact:true}).fill('TCVN_R3');
    await page.getByLabel('Tôi xác nhận giới hạn và quy tắc trên đã được chấp thuận cho nhóm mối này.').check();
    await page.getByRole('button',{name:'Lưu và áp dụng tiêu chí',exact:true}).click();
    await page.getByRole('status').getByText('Đã lưu TCVN_R3 · v3.',{exact:false}).waitFor();
    await page.getByLabel('Loại mối',{exact:true}).selectOption('Chấp thuận');
    await page.getByText('Đang áp dụng: Tiêu chí Chấp thuận · v1',{exact:true}).waitFor();
    await page.setViewportSize({width:375,height:812});await page.goto(base+'/?case=old');await page.getByRole('button',{name:'Tiêu chí áp dụng',exact:true}).click();
    await page.getByRole('listbox').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:path.join(out,'03-dropdown-mobile.png')});
    assert.deepEqual(errors,[]);
    console.log('PASS criteria browser: dropdown/search/keyboard/native dialog, current rule default, empty group/configure context, explicit sync, atomic creation result and unrelated group preservation, 375px. Screenshots: '+out);
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
