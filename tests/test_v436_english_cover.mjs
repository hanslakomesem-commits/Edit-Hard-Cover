import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {categorize,plainCoverIdentity,coverLanguage} from '../classifier.js';
import {footerFromZone,mergeZones,nameFromZone,typeFromZone} from '../ocr-zones.js';
const englishTitle='THE EFFECT OF PROBLEM-BASED LEARNINGS ON RECOUNT TEXT LEARNING OUTCOMES OF GRADE X STUDENTS AT SMAN 3 SAMPANG';
const photoLines=[
 'THE EFFECT OF PROBLEM-BASED LEARNINGS ON RECOUNT',
 'TEXT LEARNING OUTCOMES OF GRADE X STUDENTS AT SMAN 3',
 'SAMPANG',
 'THESIS','Written by:','EKA MAULIDYA PUTRI','NIM : 20381032059',
 'ENGLISH TEACHING LEARNING PROGRAM','TARBIYAH FACULTY',
 'MADURA ISLAMIC STATE UNIVERSITY','2026'];
const data=categorize(photoLines);
for(const [key,expected] of Object.entries({
 judul:englishTitle,nama:'EKA MAULIDYA PUTRI',nim:'20381032059',
 prodi:'ENGLISH TEACHING LEARNING PROGRAM',fakultas:'TARBIYAH FACULTY',
 universitas:'MADURA ISLAMIC STATE UNIVERSITY',jenis_dokumen:'THESIS',
 bulan_tahun:'2026',bahasa:'en'}))assert.equal(data[key],expected,`English OCR ${key}`);
assert.deepEqual(plainCoverIdentity(data),{
 language:'en',authorLabel:'Written by:',prodiLine:'ENGLISH TEACHING LEARNING PROGRAM',fakultasLine:'TARBIYAH FACULTY'});
assert.equal(nameFromZone('THESIS\nWritten by:\nEKA MAULIDYA PUTRI\nNIM : 20381032059'),'EKA MAULIDYA PUTRI');
assert.equal(nameFromZone('WRITTEN BY: EKA MAULIDYA PUTRI'),'EKA MAULIDYA PUTRI');
assert.equal(typeFromZone('THESIS'),'THESIS');
assert.deepEqual(footerFromZone(photoLines.slice(7).join('\n')),{universitas:'MADURA ISLAMIC STATE UNIVERSITY',prodi:'ENGLISH TEACHING LEARNING PROGRAM',fakultas:'TARBIYAH FACULTY',bulan_tahun:'2026'});
const recovered=mergeZones({judul:englishTitle,nama:'',nim:'',prodi:'',fakultas:'',universitas:'',jenis_dokumen:'',bulan_tahun:'',bahasa:'id',warnings:[]},{identitas:'THESIS\nWritten by:\nEKA MAULIDYA PUTRI\nNIM : 20381032059',kampus:photoLines.slice(7).join('\n')});
assert.equal(recovered.bahasa,'en');assert.equal(recovered.nama,data.nama);assert.equal(recovered.prodi,data.prodi);
const otherEnglish=categorize([englishTitle,'THESIS','Written by: EKA MAULIDYA PUTRI','NIM: 20381032059','STUDY PROGRAM OF ENGLISH EDUCATION','FACULTY OF TARBIYAH','STATE ISLAMIC UNIVERSITY OF MADURA','2026']);
assert.equal(otherEnglish.prodi,'STUDY PROGRAM OF ENGLISH EDUCATION');assert.equal(otherEnglish.fakultas,'FACULTY OF TARBIYAH');
assert.equal(otherEnglish.universitas,'STATE ISLAMIC UNIVERSITY OF MADURA');
assert.equal(coverLanguage({jenis_dokumen:'SKRIPSI',prodi:'PENDIDIKAN ISLAM ANAK USIA DINI',universitas:'UNIVERSITAS ISLAM NEGERI MADURA'}),'id');
assert.equal(coverLanguage({...data,bahasa:'id'}),'id','manual switch is honored');
assert.equal(coverLanguage({...data,bahasa:'en'}),'en','manual switch is honored');
const ind=categorize(['PENDEKATAN PEDAGOGIS GURU DALAM MENANGANI TANTRUM','SKRIPSI','Oleh:','DINIA NAILUL FARAH','NIM: 20215935021','PROGRAM STUDI PENDIDIKAN ISLAM ANAK USIA DINI','SEKOLAH TINGGI AGAMA ISLAM (STAI) AL MUJTAMA','PAMEKASAN','2026']);
assert.equal(ind.bahasa,'id');assert.equal(plainCoverIdentity(ind).prodiLine,'PROGRAM STUDI PENDIDIKAN ISLAM ANAK USIA DINI');

// Browser-side PDF functions emulated to assert every word actually passed to
// PDF rendering and that all four Polos modes accept the English source.
const encoder=new TextEncoder(),decoder=new TextDecoder();let generated=[];
class Page{
 constructor(w,h){this.w=w;this.h=h;this.ops=[];}
 getWidth(){return this.w;}getHeight(){return this.h;}
 drawText(text,opt){this.ops.push({type:'text',text,x:opt.x,y:opt.y,size:opt.size});}
 drawRectangle(o){this.ops.push({type:'rect',...o});}
 drawLine(o){this.ops.push({type:'line',...o});}
 drawPage(_p,o){this.ops.push({type:'page',...o});}
 drawImage(_img,o){this.ops.push({type:'image',...o});}
}
class Doc{
 constructor(){this.pages=[];}
 static async create(){return new Doc();}
 static async load(bytes){
  const b=Buffer.from(bytes);
  if(b.subarray(0,4).toString()==='%PDF'){
   const d=new Doc();d.pages=Array.from({length:19},()=>new Page(483*72/25.4,330*72/25.4));return d;
  }
  const d=new Doc();d.pages=JSON.parse(decoder.decode(bytes)).pages.map(p=>{const pg=new Page(p.w,p.h);pg.ops=p.ops;return pg;});return d;
 }
 getPageCount(){return this.pages.length;}getPage(n){return this.pages[n];}
 async copyPages(d,indices){return indices.map(i=>{const pg=d.getPage(i);return new Page(pg.w,pg.h);});}
 addPage(p){const pg=Array.isArray(p)?new Page(p[0],p[1]):p;this.pages.push(pg);return pg;}
 registerFontkit(){}
 async embedFont(){return {widthOfTextAtSize:(s,n)=>Array.from(s).reduce((a,c)=>a+(c===' '?.26:.54)*n,0),getCharacterSet:()=>Array.from({length:65536},(_,i)=>i)};}
 async embedPdf(){return [{embedded:true}];}
 async save(){const o={pages:this.pages.map(p=>({w:p.w,h:p.h,ops:p.ops}))};generated.push(o);return encoder.encode(JSON.stringify(o));}
}
globalThis.PDFLib={PDFDocument:Doc,rgb:(...x)=>x,degrees:x=>x};globalThis.fontkit={};
globalThis.fetch=async u=>{const b=await readFile(fileURLToPath(String(u)));return {ok:true,json:async()=>JSON.parse(b.toString()),arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};};
const {generatePDF,setUserFonts}=await import('../pdf-engine.js');
setUserFonts(new Uint8Array([1]),new Uint8Array([2]));
const variants=['polos','poloslogoatas','polosv11','polosv22'];
let count=0;
for(let mm=10;mm<=28;mm++)for(const variant of variants){
 generated=[];
 const result=await generatePDF(data,mm,variant);
 const source=generated.find(g=>g.pages[0]?.ops.some(o=>o.type==='text'));
 assert(source,`no rendered source for ${variant}/${mm}`);
 const texts=source.pages[0].ops.filter(o=>o.type==='text').map(o=>o.text);
 for(const txt of ['THESIS','Written by:','EKA MAULIDYA PUTRI','ENGLISH TEACHING LEARNING PROGRAM','TARBIYAH FACULTY','MADURA ISLAMIC STATE UNIVERSITY','2026'])
  assert(texts.some(t=>t.includes(txt)),`${txt} missing in ${variant}/${mm}`);
 assert(!texts.some(t=>t.includes('Oleh:')||t.includes('FAKULTAS TARBIYAH')||t.includes('PROGRAM STUDI ENGLISH')),
   `Indonesian prefix leaked into English ${variant}/${mm}`);
 assert.equal(result.details.side_trim_mm,['polosv11','polosv22'].includes(variant)?215:217);
 count++;
}
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
assert(html.includes('name="bahasa"'));assert(html.includes('English / Bahasa Inggris'));
const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
assert(app.includes("!['fakultas','kota','bahasa'].includes(name)"));
const ocr=await readFile(new URL('../document-reader.js',import.meta.url),'utf8');
assert(ocr.includes("lang:'ind+eng'"));
console.log(`PASS V4.36: English OCR structure, translated-label suppression, language override, ${count} mocked Polos PDF runs (4 variants × 19 sizes), bilingual OCR configuration.`);
