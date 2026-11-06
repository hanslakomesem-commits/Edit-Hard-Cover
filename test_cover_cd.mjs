import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const here=fileURLToPath(new URL('../',import.meta.url));
const TD=new TextDecoder(),TE=new TextEncoder();
class MockPage{
 constructor(width,height){this.width=width;this.height=height;this.ops=[];}
 getWidth(){return this.width;}
 getHeight(){return this.height;}
 drawText(text,opt){this.ops.push({type:'text',text,x:opt.x,y:opt.y,size:opt.size});}
 drawImage(_im,opt){this.ops.push({type:'image',x:opt.x,y:opt.y,width:opt.width,height:opt.height});}
}
class MockDoc{
 constructor(){this.pages=[];}
 static async create(){return new MockDoc();}
 static async load(bytes){const saved=JSON.parse(TD.decode(bytes));const doc=new MockDoc();doc.pages=saved.pages.map(p=>{const page=new MockPage(p.w,p.h);page.ops=p.ops;return page;});return doc;}
 addPage([w,h]){const page=new MockPage(w,h);this.pages.push(page);return page;}
 async embedPng(bytes){assert(bytes.length>1000);return {bytes};}
 registerFontkit(){}
 async embedFont(){return {widthOfTextAtSize:(txt,size)=>Array.from(txt).reduce((a,c)=>a+(c===' '?.25:c==='I'?.35:c==='M'?.9:.57)*size,0),getCharacterSet:()=>Array.from({length:65536},(_,i)=>i)};}
 getPageCount(){return this.pages.length;}
 getPage(index){return this.pages[index];}
 async save(){return TE.encode(JSON.stringify({pages:this.pages.map(p=>({w:p.width,h:p.height,ops:p.ops}))}));}
}
globalThis.PDFLib={PDFDocument:MockDoc,rgb:(...c)=>c};
globalThis.fontkit={};
globalThis.fetch=async url=>{const href=String(url),path=fileURLToPath(href);const bytes=await readFile(path);return {ok:true,json:async()=>JSON.parse(TD.decode(bytes)),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};};
const {generatePDF,setUserFonts,coverTypes}=await import('../pdf-engine.js');
assert(coverTypes.includes('covercd'));
setUserFonts(new Uint8Array([0x00,0x01]),new Uint8Array([0x00,0x02]));
const titles=[
 'STRATEGI KEMANDIRIAN FINANSIAL PADA JANDA CERAI MATI (STUDI KASUS DESA PONTEH KECAMATAN GALIS KABUPATEN PAMEKASAN)',
 'FAKTOR-FAKTOR YANG MEMPENGARUHI MINAT NASABAH MENGGUNAKAN TABUNGAN SAHARA (SIMPANAN HAJI DAN UMRAH) DI KSPPS BMT NU JAWA TIMUR CABANG TLANAKAN',
 'PENERAPAN BAGI HASIL PADA TAMBAK GARAM DI DESA PANGARENGAN PERSPEKTIF AKAD MUDHARABAH MUTLAQAH',
 'PENERAPAN PSAK 105 PERHITUNGAN BAGI HASIL PADA PRODUK SIMPANAN BERJANGKA DI KOPERASI SIMPAN PINJAM DAN PEMBIAYAAN SYARIAH NURI',
 'DAMPAK LAYANAN KEUANGAN MIKRO TERHADAP PEMBERDAYAAN EKONOMI MASYARAKAT DI DESA BATUKERBUY KECAMATAN PASEAN PAMEKASAN'
];
for(const title of titles){
 const result=await generatePDF({nama:'ROBIATUL ADANIYAH',nim:'22382012024',judul:title,prodi:'HUKUM KELUARGA ISLAM',bulan_tahun:'SEPTEMBER 2026'},null,'covercd');
 assert.equal(result.details.mode,'covercd');
 const page=(await MockDoc.load(result.bytes)).getPage(0);
 assert(Math.abs(page.width-388.4)<.3);
 assert.equal(page.ops.filter(x=>x.type==='image').length,2);
 assert(page.ops.some(x=>x.type==='text'&&x.text.includes('ROBIATUL')));
 assert(page.ops.some(x=>x.type==='text'&&x.text.includes('SEPTEMBER')));
 assert(page.ops.filter(x=>x.type==='text').some(x=>x.text.includes('NIM:')));
 assert(page.ops.filter(x=>x.type==='text').every(op=>op.x>=0&&op.y>0&&op.x<page.width&&op.y<page.height));
}
const minimal=await generatePDF({nama:'Nama',nim:'12345678',judul:'JUDUL SINGKAT'},null,'covercd');
assert.equal(minimal.details.title_lines,1);
console.log('PASS: 5 Word-reference titles + minimal required fields. 2 logos, page size, CD no spine, text bounds. Engine runtime mocked; not a physical PDF export.');
