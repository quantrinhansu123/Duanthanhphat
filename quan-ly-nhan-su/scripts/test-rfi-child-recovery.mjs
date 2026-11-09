import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const parent = { id: 'parent', du_an_id: 'project', so_phieu: 'RFI-002', ngay_moi: '2026-11-08', nguoi_lap: 'tester', thong_tin: { nt_hinh_hoc: '1', nt_sieu_am: '1' } };
const tables = {
  phieu_yeu_cau_nghiem_thu_moi: [1, 2].map(n => ({ phieu_id: parent.id, moi_han_id: `w${n}`, du_lieu_chot: { moi_han: { ma_lich_su: `W-${n}` }, kiem_tra: { phien_ban: 3 } } })),
  phieu_nt_tach: [], phieu_nt_tach_moi: [],
};
let failRows = false;
const rpcCalls = [];
const db = { async rpc(name, args) { rpcCalls.push({ name, args }); return { error: null }; }, from(table) {
  const filters = [];
  const query = { select() { return query; }, eq(k, v) { filters.push(r => r[k] === v); return query; }, limit() { return query; },
    upsert(rows, { onConflict }) {
      if (table === 'phieu_nt_tach_moi' && failRows) return Promise.resolve({ error: new Error('interrupted') });
      for (const row of [rows].flat()) if (!tables[table].some(r => onConflict.split(',').every(k => r[k] === row[k]))) tables[table].push(structuredClone(row));
      return Promise.resolve({ error: null });
    },
    then(resolve) { return Promise.resolve({ data: tables[table].filter(r => filters.every(f => f(r))), error: null }).then(resolve); },
  }; return query;
} };
function load(file, imports) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { exports, require: k => k in imports ? imports[k] : createRequire(import.meta.url)(k) });
  return exports;
}
const acceptance = load('../src/lib/weldAcceptance.ts', { '@/lib/weldCode': load('../src/lib/weldCode.ts', {}) });
const { ensureRfiChildTickets, completeExistingRfiGeometry } = load('../src/lib/server/rfiChildTickets.ts', { 'server-only': {}, '@/lib/supabase/admin': { createAdminClient: () => db }, '@/lib/weldAcceptance': acceptance });
failRows = true;
await assert.rejects(ensureRfiChildTickets(parent), /interrupted/);
assert.equal(tables.phieu_nt_tach.length, 1);
failRows = false;
await ensureRfiChildTickets(parent);
assert.equal(tables.phieu_nt_tach.length, 2);
assert.equal(tables.phieu_nt_tach_moi.length, 4);
tables.phieu_nt_tach_moi[0].ket_qua = 'Đạt';
await ensureRfiChildTickets(parent);
assert.equal(tables.phieu_nt_tach_moi.length, 4);
assert.equal(tables.phieu_nt_tach_moi[0].ket_qua, 'Đạt', 'Recovery must preserve decisions');
tables.phieu_nt_tach_moi.length = 0;
tables.phieu_nt_tach.length = 0;
tables.phieu_nt_tach.push({ id: 'manual', phieu_rfi_id: parent.id, loai: 'hinh-hoc', ngay_nghiem_thu: '2026-11-08' });
await ensureRfiChildTickets(parent);
assert.equal(tables.phieu_nt_tach.length, 2);
assert.equal(tables.phieu_nt_tach_moi.length, 2, 'Only missing ultrasound gets rows; existing geometry stays intact');
tables.phieu_nt_tach_moi.length = 0;
tables.phieu_nt_tach.length = 0;
await ensureRfiChildTickets({ ...parent, thong_tin: { nt_hinh_hoc: '1', nt_sieu_am: '' } });
assert.equal(tables.phieu_nt_tach.length, 1);
assert.equal(tables.phieu_nt_tach[0].loai, 'hinh-hoc');
const decisions = [1, 2].map(n => ({ moi_han_id: `w${n}`, phien_ban: 3 }));
const existingId = tables.phieu_nt_tach[0].id;
assert.equal(await completeExistingRfiGeometry(parent.id, '2026-11-08', decisions, 'tester'), existingId);
assert.equal(rpcCalls.length, 1);
assert.equal(rpcCalls[0].name, 'chot_phieu_nt_tach');
assert.equal(rpcCalls[0].args.p_id, existingId);
assert.equal(tables.phieu_nt_tach.length, 1, 'Parent completion reuses the prepared child');
await assert.rejects(completeExistingRfiGeometry(parent.id, '2026-11-08', decisions.slice(0, 1), 'tester'), /đầy đủ/);
assert.equal(rpcCalls.length, 1, 'Partial selection cannot overwrite or duplicate a shared ticket');
tables.phieu_nt_tach[0].ngay_nghiem_thu = '2026-11-08';
tables.phieu_nt_tach_moi.forEach(r => { r.ket_qua = 'Đạt'; });
assert.equal(await completeExistingRfiGeometry(parent.id, '2026-11-08', decisions, 'tester'), existingId);
assert.equal(rpcCalls.length, 1, 'Completed child opens without submitting another acceptance');
tables.phieu_nt_tach_moi[0].ket_qua = 'Không đạt';
await assert.rejects(completeExistingRfiGeometry(parent.id, '2026-11-08', decisions, 'tester'), /kết quả khác/);
console.log('PASS: legacy child recovery, interrupted insert, retries, preserved results, scope');
console.log('PASS: shared geometry completion, partial selection guard, completed ticket reuse');
