// Test V9.12.2: harga khusus, 6 paket, custom, jadwal, dan sumber SQL.
const fs=require('fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const ts=require('typescript');
const root=require('node:path').resolve(__dirname,'..');
const helper=fs.readFileSync(root+'/src/utils/resellerAdminPricing.ts','utf8');
const result=ts.transpileModule(helper,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},reportDiagnostics:true});
assert.equal(result.diagnostics.length,0,'utilitas pricing TypeScript valid');
const context={exports:{},require};vm.runInNewContext(result.outputText,context);
const {resellerMemberTotal,resellerExtras,resellerPickupDate,getResellerDateWindow}=context.exports;
// Harga khusus per HC, tambahan per MAHASISWA (bukan dikali jilid)
assert.equal(resellerMemberTotal({qty:3,days:3,packageId:1}),75000);
assert.equal(resellerMemberTotal({qty:3,days:2,packageId:1}),90000);
assert.equal(resellerMemberTotal({qty:3,days:1,packageId:1}),105000);
assert.equal(resellerMemberTotal({qty:3,days:3,packageId:2}),82000);
assert.equal(resellerMemberTotal({qty:3,days:3,packageId:3}),85000);
assert.equal(resellerMemberTotal({qty:3,days:3,packageId:4}),92000);
assert.equal(resellerMemberTotal({qty:3,days:3,packageId:5}),95000);
assert.equal(resellerMemberTotal({qty:3,days:3,packageId:6}),100000);
assert.equal(resellerMemberTotal({qty:3,days:3,packageId:7,services:['CD','SKEK','Pisah-pisah File']}),90000);
assert.deepEqual(Array.from(resellerExtras({qty:3,days:3,packageId:1})),[]);
assert.equal(resellerPickupDate('2026-11-09',3),'2026-11-12'); // Senin -> Kamis
assert.equal(resellerPickupDate('2026-11-07',1),'2026-11-09'); // Sabtu -> Senin, skip Minggu
assert.equal(resellerPickupDate('2026-11-09',1),'2026-11-10');
assert.equal(resellerPickupDate('2026-11-09',2),'2026-11-11');
assert.equal(resellerPickupDate('2026-02-30',3),'');
assert.equal(getResellerDateWindow('2026-11-09').max,'2026-11-09');
const sql=fs.readFileSync(root+'/supabase/UPDATE_NOTA_V9_12_2_HARGA_RESELLER_DAN_TANGGAL_SETOR.sql','utf8');
assert.match(sql,/SECURITY DEFINER SET search_path = ''/);
assert.match(sql,/is_nota_admin\(\)/);
assert.match(sql,/35000 WHEN 2 THEN 30000 ELSE 25000/);
assert.match(sql,/WHEN 'CD' THEN 7000 WHEN 'Artikel' THEN 10000/);
assert.match(sql,/WHEN 'SKEK' THEN 3000 WHEN 'Pisah-pisah File' THEN 5000/);
assert.match(sql,/p_received_date,v_pickup,v_days_max/);
assert.match(sql,/created_at tetap DEFAULT now\(\)/);
assert.match(sql,/FOR i IN 1\.\.v_days_max LOOP/);
assert.match(sql,/extract\(isodow FROM v_pickup\) <> 7/);
assert.match(sql,/REVOKE ALL ON FUNCTION public\.admin_create_nota_reseller_batch_v9122/);
console.log('LULUS V9.12.2: tarif 1-6/custom, subtotal, tanggal setor, Minggu, dan SQL aman.');
