import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {plainFrontLayout,plainFrontFits,PLAIN_V1,PLAIN_V2} from '../plain-variant-layout.js';
const root=new URL('../',import.meta.url), enc=new TextEncoder(),dec=new TextDecoder();
const template=JSON.parse(await readFile(new URL('../assets/layout.json',import.meta.url),'utf8')).templates;
const all=Object.entries(template);
assert.equal(all.length,19);
for(const [mm,conf] of all){
 const a=plainFrontLayout(PLAIN_V1,conf),b=plainFrontLayout(PLAIN_V2,conf);
 assert(plainFrontFits(a),`V1 ${mm} mm front area`);
 assert(plainFrontFits(b),`V2 ${mm} mm front area`);
 assert(a.nameY<a.logoTopY,`V1 name before logo ${mm}`);
 assert(b.logoTopY+b.logoHeightPt<b.nameY,`V2 logo before name ${mm}`);
 assert.equal(b.frontCX,a.frontCX,`front stays in same region ${mm}`);
 assert(Math.abs(a.frontCX-conf.front_cx)<1e-5);
 assert(b.titleY<a.titleY,`V2 reference title top differs for ${mm}`);
}
class Page{
 constructor(w,h){this.w=w;this.h=h;this.ops=[];}
 getWidth(){return this.w;}getHeight(){return this.h;}
 drawText(t,opt){this.ops.push({type:'text',text:t,x:opt.x,y:opt.y,size:opt.size});}
 drawImage(_img,opt){this.ops.push({type:'image',...opt});}
 drawPage(_img,opt){this.ops.push({type:'embeddedPage',...opt});}
}
let generated=[];
class Doc{
 constructor(){this.pages=[];}
 static async create(){return new Doc();}
 static async load(bytes){
  const buf=Buffer.from(bytes); if(buf.subarray(0,4).toString()==='%PDF'){
   const doc=new Doc();doc.pages=Array.from({length:19},()=>new Page(483*72/25.4,330*72/25.4));return doc;
  }
  const parsed=JSON.parse(dec.decode(bytes));const doc=new Doc();doc.pages=parsed.pages.map(p=>{const a=new Page(p.w,p.h);a.ops=p.ops;return a;});return doc;
 }
 getPageCount(){return this.pages.length;}getPage(i){return this.pages[i];}
 async copyPages(doc,indices){return indices.map(i=>{const p=doc.getPage(i);return new Page(p.w,p.h);});}
 addPage(arg){const p=Array.isArray(arg)?new Page(arg[0],arg[1]):arg;this.pages.push(p);return p;}
 registerFontkit(){}
 async embedFont(){return {widthOfTextAtSize:(txt,size)=>Array.from(txt).reduce((a,c)=>a+(c===' '?.27:.55)*size,0),getCharacterSet:()=>Array.from({length:65536},(_,i)=>i)};}
 async embedPng(bytes){assert(bytes.length>1000);return {width:243,height:266};}
 async embedPdf(bytes){assert(bytes.length>10);return [{src:true}];}
 async save(){const j={pages:this.pages.map(p=>({w:p.w,h:p.h,ops:p.ops}))};generated.push(j);return enc.encode(JSON.stringify(j));}
}
globalThis.PDFLib={PDFDocument:Doc,rgb:(...c)=>c,degrees:v=>v};
globalThis.fontkit={};
globalThis.fetch=async url=>{const buf=await readFile(fileURLToPath(String(url)));return {ok:true,json:async()=>JSON.parse(buf.toString()),arrayBuffer:async()=>buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength)};};
const {generatePDF,setUserFonts,coverTypes}=await import('../pdf-engine.js');
assert(coverTypes.includes(PLAIN_V1)&&coverTypes.includes(PLAIN_V2));
setUserFonts(new Uint8Array([1,2,3]),new Uint8Array([4,5,6]));
const student={judul:'PENGARUH MODEL PEMBELAJARAN SNOWBALL THROWING TERHADAP KETERAMPILAN SOSIAL SISWA PADA MATA PELAJARAN IPS KELAS VII C DI SMP NEGERI 1 PAMEKASAN',nama:'ZAHRATUL LAILI',nim:'22381082038',prodi:'TADRIS ILMU PENGETAHUAN SOSIAL',fakultas:'TARBIYAH DAN ILMU KEGURUAN',universitas:'UNIVERSITAS ISLAM NEGERI MADURA',jenis_dokumen:'SKRIPSI',bulan_tahun:'SEPTEMBER 2026'};
let passed=0;
for(const [mm] of all){
 for(const variant of [PLAIN_V1,PLAIN_V2]){
  generated=[];
  const result=await generatePDF(student,Number(mm),variant);
  assert.equal(result.details.mode,variant);
  assert.equal(result.details.plain_variant,variant);
  const pg=(await Doc.load(result.bytes)).getPage(0);
  assert(Math.abs(pg.w-480*72/25.4)<.1&&Math.abs(pg.h-330*72/25.4)<.1);
  const original=generated.find(x=>x.pages?.[0]?.ops?.some(op=>op.type==='image'));
  assert(original,`${variant} ${mm} first page with logo`);
  const ops=original.pages[0].ops;
  const logos=ops.filter(x=>x.type==='image');assert.equal(logos.length,1);
  const name=ops.find(x=>x.type==='text'&&x.text==='ZAHRATUL LAILI');assert(name);
  const logo=logos[0];const nameTop=935.43-name.y;
  if(variant===PLAIN_V1)assert(nameTop<935.43-logo.y-logo.height,`V1 name before logo ${mm}`);
  else assert(935.43-logo.y<nameTop,`V2 logo above name ${mm}`);
  passed++;
 }
}
console.log(`PASS: ${passed}/38 Polos V1/V2 at 10-28 mm, centered logos, name-order, source paper scaling (mock PDF runtime).`);
