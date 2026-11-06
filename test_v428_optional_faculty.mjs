import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {PLAIN_V1,PLAIN_V2,plainFrontLayout} from '../plain-variant-layout.js';
const root=new URL('../',import.meta.url),encoder=new TextEncoder(),decoder=new TextDecoder();
const layout=JSON.parse(await readFile(new URL('../assets/layout.json',import.meta.url),'utf8')).templates;
let generated=[];
class Page{constructor(w,h){this.w=w;this.h=h;this.ops=[];}getWidth(){return this.w;}getHeight(){return this.h;}drawText(text,opt){this.ops.push({type:'text',text,x:opt.x,y:opt.y,size:opt.size});}drawImage(_img,o){this.ops.push({type:'image',...o});}drawPage(_img,o){this.ops.push({type:'embeddedPage',...o});}}
class Doc{
 constructor(){this.pages=[];}static async create(){return new Doc();}
 static async load(bytes){const b=Buffer.from(bytes);if(b.subarray(0,4).toString()==='%PDF'){const d=new Doc();d.pages=Array.from({length:19},()=>new Page(483*72/25.4,330*72/25.4));return d;}
 const d=new Doc();d.pages=JSON.parse(decoder.decode(bytes)).pages.map(p=>{const x=new Page(p.w,p.h);x.ops=p.ops;return x;});return d;}
 getPageCount(){return this.pages.length;}getPage(n){return this.pages[n];}async copyPages(d,indices){return indices.map(i=>{const x=d.getPage(i);return new Page(x.w,x.h);});}addPage(p){const a=Array.isArray(p)?new Page(p[0],p[1]):p;this.pages.push(a);return a;}
 registerFontkit(){}async embedFont(){return {widthOfTextAtSize:(s,n)=>Array.from(s).reduce((a,c)=>a+(c===' '?.27:.55)*n,0),getCharacterSet:()=>Array.from({length:65536},(_,i)=>i)};}
 async embedPdf(){return [{embedded:true}];}
 async save(){const j={pages:this.pages.map(p=>({w:p.w,h:p.h,ops:p.ops}))};generated.push(j);return encoder.encode(JSON.stringify(j));}
}
globalThis.PDFLib={PDFDocument:Doc,rgb:(...c)=>c,degrees:v=>v};globalThis.fontkit={};
globalThis.fetch=async url=>{const b=await readFile(fileURLToPath(String(url)));return {ok:true,json:async()=>JSON.parse(b.toString()),arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};};
const {generatePDF,setUserFonts}=await import('../pdf-engine.js');
setUserFonts(new Uint8Array([1,2,3]),new Uint8Array([4,5,6]));
const record={judul:'PENDEKATAN PEDAGOGIS GURU DALAM MENANGANI PERILAKU TANTRUM PADA ANAK USIA DINI DI RA AS-SAKINAH',nama:'DINIA NAILUL FARAH',nim:'202215935021',prodi:'PENDIDIKAN ISLAM ANAK USIA DINI',universitas:'SEKOLAH TINGGI AGAMA ISLAM (STAI) AL MUJTAMA',jenis_dokumen:'SKRIPSI',bulan_tahun:'2026'};
let cases=0;
for(let mm=10;mm<=28;mm++)for(let variant of [PLAIN_V1,PLAIN_V2])for(const withFaculty of [false,true])for(const withCity of [false,true]){
 const data={...record,fakultas:withFaculty?'TARBIYAH':'',kota:withCity?'PAMEKASAN':''};
 generated=[];const out=await generatePDF(data,mm,variant);
 const first=generated.find(g=>g.pages[0]?.ops?.some(o=>o.type==='text'));assert(first);
 const ops=first.pages[0].ops.filter(o=>o.type==='text');
 const faculty=ops.filter(o=>o.text.startsWith('FAKULTAS '));
 assert.equal(faculty.length,Number(withFaculty),`fakultas output ${mm}/${variant}/${withFaculty}`);
 const prodi=ops.find(o=>o.text.startsWith('PROGRAM STUDI '));
 const university=ops.find(o=>o.text.includes('SEKOLAH TINGGI AGAMA ISLAM (STAI) AL MUJTAMA'));
 assert(prodi&&university,`institution and program ${mm}/${variant}`);
 const cityRows=ops.filter(o=>o.text==='PAMEKASAN');
 assert.equal(cityRows.length,Number(withCity),`city output ${mm}/${variant}/${withCity}`);
 const placement=plainFrontLayout(variant,layout[mm]);
 assert(Math.abs(prodi.y-(330*72/25.4-((withFaculty?placement.prodiY:placement.fakultasY)-(withCity?13.29:0))))<.01,`compact prodi position ${mm}/${variant}`);
 cases++;
}
const src=await readFile(new URL('../pdf-engine.js',import.meta.url),'utf8');
for(const tag of ['Fakultas warna','Fakultas UNIRA','Fakultas Dummybook','Fakultas IPS']){
 assert(src.split('\n').some(line=>line.includes(tag)&&line.includes('if(hasFaculty)')||line.includes('if(norm(data.fakultas))')),`${tag} must be conditional`);
}
const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
assert(app.includes("!['fakultas','kota'].includes(name)"));
assert(html.includes('Fakultas (opsional)'));
console.log(`PASS V4.28: ${cases} mocked Polos exports with/without faculty; institution preserved; all other modes conditionally skip faculty.`);
