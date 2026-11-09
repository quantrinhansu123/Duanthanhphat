import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
try {
  // Minimal parent publisher fixture isolates the new transaction wrapper.
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table phieu_yeu_cau_nghiem_thu(id uuid primary key);
    create table lich_su_moi_han(id uuid primary key, ma_lich_su text);
    create table phieu_yeu_cau_nghiem_thu_moi(phieu_id uuid,moi_han_id uuid,du_lieu_chot jsonb);
    create table dieu_kien_nt_tach(moi_han_id uuid,phien_ban int);
    create table phieu_nt_tach(id uuid primary key,du_an_id uuid,loai text,so_phieu text,
      ngay_moi date,nguoi_lap text,phieu_rfi_id uuid,thong_tin jsonb,
      unique(du_an_id,loai,so_phieu));
    create table phieu_nt_tach_moi(phieu_id uuid,loai text,moi_han_id uuid,ma_lich_su text,du_lieu_chot jsonb);
    create function phat_hanh_rfi_moi_han(uuid,uuid,text,date,uuid[],text,jsonb) returns uuid language plpgsql as $$
    begin
      if exists(select 1 from phieu_yeu_cau_nghiem_thu where id=$1) then return $1; end if;
      insert into phieu_yeu_cau_nghiem_thu values($1);
      insert into phieu_yeu_cau_nghiem_thu_moi select $1,id,'{"moi_han":{"ma_lich_su":"WELD"}}'::jsonb from unnest($5) id;
      return $1;
    end $$;
  `);
  await db.exec(fs.readFileSync(new URL('../../supabase/migration_20261108h_rfi_tu_tao_phieu_con.sql', import.meta.url), 'utf8'));
  const uuid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  await db.query('insert into lich_su_moi_han values($1,\'WELD\')', [uuid(1)]);
  const publish = (id, number, info = {}) => db.query(`select phat_hanh_rfi_va_phieu_con($1,$2,$3,'2026-11-08',$4,'tester',$5)`, [uuid(id),uuid(2),number,[uuid(1)],info]);
  await publish(3,'RFI-001');
  await publish(3,'RFI-001');
  const tickets = (await db.query('select so_phieu,ngay_nghiem_thu from (select *,null as ngay_nghiem_thu from phieu_nt_tach) t order by so_phieu')).rows;
  assert.deepEqual(tickets.map(r => r.so_phieu), ['RFI-001-HH','RFI-001-SA']);
  assert.equal((await db.query('select * from phieu_nt_tach_moi')).rows.length, 2);
  await publish(4,'RFI-002',{nt_hinh_hoc:'1',nt_sieu_am:'',dia_diem:'Site'});
  const scoped = (await db.query('select loai,thong_tin from phieu_nt_tach where phieu_rfi_id=$1',[uuid(4)])).rows;
  assert.equal(scoped.length,1);
  assert.equal(scoped[0].loai,'hinh-hoc');
  assert.equal(scoped[0].thong_tin.dia_diem,'Site');
  await assert.rejects(publish(5,'RFI-001'));
  assert.equal((await db.query('select * from phieu_yeu_cau_nghiem_thu where id=$1',[uuid(5)])).rows.length,0,'Child conflict must roll back the parent');
  console.log('PASS: automatic children, retry, scope, copied metadata, transaction rollback');
} finally { await db.close(); }
