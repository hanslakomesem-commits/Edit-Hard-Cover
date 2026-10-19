import assert from 'node:assert/strict';
import {CD_PAGE_MM,CD_PAGE_PT,CD_LAYOUT,assertCDData,computeCDTitle} from './cover-cd-layout.js';
const exampleTitles=[
 'STRATEGI KEMANDIRIAN FINANSIAL PADA JANDA CERAI MATI (STUDI KASUS DESA PONTEH KECAMATAN GALIS KABUPATEN PAMEKASAN)',
 'FAKTOR-FAKTOR YANG MEMPENGARUHI MINAT NASABAH MENGGUNAKAN TABUNGAN SAHARA (SIMPANAN HAJI DAN UMRAH) DI KSPPS BMT NU JAWA TIMUR CABANG TLANAKAN',
 'PENERAPAN BAGI HASIL PADA TAMBAK GARAM DI DESA PANGARENGAN PERSPEKTIF AKAD MUDHARABAH MUTLAQAH',
 'PENERAPAN PSAK 105 PERHITUNGAN BAGI HASIL PADA PRODUK SIMPANAN BERJANGKA DI KOPERASI SIMPAN PINJAM DAN PEMBIAYAAN SYARIAH NURI',
 'DAMPAK LAYANAN KEUANGAN MIKRO TERHADAP PEMBERDAYAAN EKONOMI MASYARAKAT DI DESA BATUKERBUY KECAMATAN PASEAN PAMEKASAN'
];
// Approximates Tinos Bold width from typical Times character widths for local structural test.
const width=(str,pt)=>Array.from(str).reduce((sum,ch)=>sum+(ch===' '?0.25:ch==='I'?0.35:ch==='M'||ch==='W'?0.9:ch==='.'?0.27:0.57)*pt,0);
assert.equal(Math.round(CD_PAGE_MM),137);
assert(CD_LAYOUT.leftLogo.left+CD_LAYOUT.leftLogo.width<CD_LAYOUT.rightLogo.left);
assert(CD_LAYOUT.leftLogo.top+CD_LAYOUT.leftLogo.height<CD_LAYOUT.titleTop);
assert(CD_LAYOUT.rightLogo.top+CD_LAYOUT.rightLogo.height<CD_LAYOUT.titleTop);
let passes=0;let shrinks=0;
for(const title of exampleTitles){
 assertCDData({nama:'SOFI YULLAH',nim:'22382012024',judul:title});
 const t=computeCDTitle(title,width);
 assert(t.lines.length>=2);
 assert(t.lines.every(s=>width(s,t.size)<=CD_LAYOUT.titleMaxWidth));
 assert(t.top+(t.lines.length-1)*t.pitch+t.size<=CD_LAYOUT.titleMaxBottom);
 passes++;
}
for(let i=0;i<200;i++){
 const title=Array.from({length:9+(i%36)},(_,j)=>['PERLINDUNGAN','KESEJAHTERAAN','FINANSIAL','HUKUM','MASYARAKAT','MAHASISWA','PENELITIAN','BERKELANJUTAN','ISLAM'][((i*3)+j)%9]).join(' ');
 try{
  const t=computeCDTitle(title,width);
  assert(t.lines.every(s=>width(s,t.size)<=CD_LAYOUT.titleMaxWidth));
  assert(t.top+(t.lines.length-1)*t.pitch+t.size<=CD_LAYOUT.titleMaxBottom);
  if(t.size<9)shrinks++;
 }catch(e){assert.match(String(e),/terlalu panjang/u);}
 passes++;
}
assert.throws(()=>assertCDData({judul:'judul',nama:'Nama'}),/nim/);
assert.throws(()=>computeCDTitle('X'.repeat(240),width),/terlalu panjang/);
console.log(`PASS: ${passes} tests (five DOCX example titles + 200 synthetic title lengths), font downsizing: ${shrinks}, oversize correctly rejected`);
