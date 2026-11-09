const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('module');
let ts;try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}
const root=path.resolve(__dirname,'..');
const util=fs.readFileSync(path.join(root,'src/utils/workloadReport.ts'),'utf8');
const js=ts.transpileModule(util,{fileName:'workloadReport.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const module_=new Module('workloadReport-test');module_.filename=path.join(root,'src/utils/workloadReport-test.js');module_.paths=Module._nodeModulePaths(root);module_._compile(js,module_.filename);
const {summarizeWorkInProgress}=module_.exports;
const direct=(id,prodi,qty)=>({orderId:id,orderKind:'student',prodi,coverCount:qty});
const reseller=(id,company,students,qty,major='Sampul Kolektif')=>({orderId:id,orderKind:'reseller',resellerCompany:company,resellerStudents:students,coverCount:qty,prodi:major});
const rows=[
  direct('d1','MPI',5),direct('d2','Syariah',4),direct('d3','Ekonomi Syariah',4),direct('d4','IPS',2),
  reseller('r1','Sultan Sell',[{name:'A',qty:5,days:3,prodi:'MPI'},{name:'B',qty:4,days:3,prodi:'Syariah'},{name:'C',qty:4,days:2,prodi:'Ekonomi Syariah'},{name:'D',qty:2,days:3,prodi:'IPS'}],15)
];
const recap=summarizeWorkInProgress(rows);
assert.equal(recap.totalCovers,30);
assert.equal(recap.totalNotes,5);
assert.equal(recap.sources.length,2);
assert.equal(recap.sources[0].label,'Langsung ZAIN.NET');
assert.equal(recap.sources[0].covers,15);
assert.equal(recap.sources[1].label,'Reseller Sultan Sell');
assert.equal(recap.sources[1].covers,15);
assert.deepEqual(recap.sources[1].prodi.map(p=>[p.prodi,p.covers]),[['MPI',5],['Ekonomi Syariah',4],['Syariah',4],['IPS',2]]);
assert.deepEqual(rows[4].resellerStudents[0].prodi,'MPI');
const old=summarizeWorkInProgress([reseller('old','Sultan Sell',[{name:'Old',qty:3,days:3}],3,'Pendidikan Agama Islam (PAI)')]);
assert.deepEqual(old.sources[0].prodi,[{prodi:'Prodi belum dicatat',covers:3}]);
assert.equal(old.sources[0].hasUnspecifiedProdi,true);
const mismatch=summarizeWorkInProgress([reseller('bad','Sultan Sell',[{name:'Old',qty:8,days:3,prodi:'MPI'}],3)]);
assert.equal(mismatch.totalCovers,3);assert.equal(mismatch.sources[0].prodi[0].covers,3);
const missing=summarizeWorkInProgress([reseller('bad2','Sultan Sell',[{name:'Old',qty:1,days:3,prodi:'MPI'}],3)]);
assert.equal(missing.sources[0].prodi.reduce((n,p)=>n+p.covers,0),3);
assert.equal(summarizeWorkInProgress([direct('other','MPI',0)]).totalCovers,0);
assert.equal(summarizeWorkInProgress([reseller('r1','sultan sell',[],0),reseller('r2','Barokah Printing',[{name:'A',qty:2,days:3,prodi:'IPS'}],2)]).sources[0].label,'Reseller Barokah Printing');
const admin=fs.readFileSync(path.join(root,'src/components/AdminPanel.tsx'),'utf8');
assert(admin.includes('summarizeWorkInProgress(workboard)'),'report source must follow workboard filter');
assert(admin.includes('TOTAL KESELURUHAN JILID HARD COVER'));
const api=fs.readFileSync(path.join(root,'src/lib/api.ts'),'utf8');
assert(api.includes('create_nota_partner_batch_order_v9121'));
assert(api.includes('admin_create_nota_reseller_batch_for_partner_v9121') || api.includes('admin_create_nota_reseller_batch_v9122')); // Admin V9.12.2 mengganti RPC, tetap menyimpan prodi per mahasiswa
const sql=fs.readFileSync(path.join(root,'supabase/UPDATE_NOTA_V9_12_1_REKAP_PRODI_RESELLER.sql'),'utf8');
assert(sql.includes('public.is_nota_admin()'));
assert(sql.includes('public.create_nota_partner_batch_order('));
assert(sql.includes('public.admin_create_nota_reseller_batch_for_partner('));
assert(sql.includes("'prodi',btrim(m.value->>'prodi')"));
assert(!/\bDROP\s+TABLE\b/i.test(sql));
console.log('PASS V9.12.1: 15 direct + 15 reseller = 30 HC; prodi per student; legacy unknown; mismatch cap; secure RPC; UI');
