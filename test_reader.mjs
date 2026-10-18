import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';
const require = createRequire(import.meta.url);
globalThis.JSZip=require('../vendor/jszip.min.js');
const {readWord,readPDF}=await import('../document-reader.js');
const {recognizeLocal,resetOCR}=await import('../ocr-fast.js');
const fileOf=(path,name,type)=>new File([fs.readFileSync(path)],name,{type});
let start=performance.now();
const doc=await readWord(fileOf(new URL('./fixtures/cover_125_halaman.docx', import.meta.url),'Skripsi.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
const wordTime=Math.round(performance.now()-start);
assert.match(doc.judul,/ANALISIS PENDIDIKAN KARAKTER/);
assert.match(doc.nama,/MARA QONITA/);
assert.equal(doc.nim,'22381012181');
assert(!doc.judul.includes('Isi penelitian'));
console.log('WORD (DOCX 125 halaman):',wordTime+'ms', doc.judul,doc.nama,doc.warnings[0]);
let getPageCalls=0;let textCalls=0;
globalThis.pdfjsLib = {
 GlobalWorkerOptions: {},
 getDocument: () => ({promise: Promise.resolve({
  numPages: 60,
  getPage: async num => {
   getPageCalls++; assert.equal(num,1);
   return {getTextContent: async () => {
    textCalls++;
    const lines=['ANALISIS PENDIDIKAN KARAKTER ISLAM','SKRIPSI','Oleh:','MARA QONITA FILLAH HIDAYAH','NIM: 22381012181','PROGRAM STUDI PENDIDIKAN AGAMA ISLAM','FAKULTAS TARBIYAH DAN ILMU KEGURUAN','UNIVERSITAS ISLAM NEGERI MADURA','JUNI 2026'];
    return {items:lines.map((str,i)=>({str,transform:[0,0,0,0,0,700-i*25]}))};
   }};
  },
  destroy: async ()=>{}
 })})
};
start=performance.now();const pdf=await readPDF(fileOf(new URL('./fixtures/cover_60_halaman.pdf', import.meta.url),'Skripsi.pdf','application/pdf'));
assert.equal(getPageCalls,1);assert.equal(textCalls,1);
assert.equal(pdf.nim,'22381012181');
console.log('PDF (60 halaman, PDF.js mocked):',Math.round(performance.now()-start)+'ms',pdf.judul,'getPage calls:',getPageCalls);
let creates=0,recognizes=0;
globalThis.Tesseract={createWorker:async(lang,oem,opts)=>{creates++;assert.equal(lang,'ind');return {recognize:async(blob)=>{recognizes++;return {data:{text:'JUDUL UJI COBA\nSKRIPSI\nOleh:\nMAHASISWA TEST\nNIM: 1234567890'}}},terminate:async()=>{}}}};
const first=await recognizeLocal(new Blob(['fake']),{isPrepared:true});
const second=await recognizeLocal(new Blob(['fake']),{isPrepared:true});
assert.equal(creates,1);assert.equal(recognizes,2);
console.log('OCR WORKER CACHE (mock recognizer):',creates,'initializations,',recognizes,'recognitions');
console.log('TOTAL PASS: 3 substantive flows (real DOCX parsing, mocked PDF.js text path, mocked Tesseract worker lifecycle)');

// Stress: 20 DOCX files (125-page test cover each), still only prefix parsed.
let starts=performance.now();
for(let i=0;i<20;i++){const out=await readWord(fileOf(new URL('./fixtures/cover_125_halaman.docx',import.meta.url),'cover_'+i+'.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document'));assert.equal(out.nim,'22381012181');}
console.log('BATCH WORD 20 berkas (125 halaman tiap berkas):',Math.round(performance.now()-starts)+'ms');
// Failure path should not leak a stale worker.
await resetOCR();
let attempts=0;
globalThis.Tesseract={createWorker:async()=>{attempts++;throw Error('Model gagal dimuat');}};
await assert.rejects(()=>recognizeLocal(new Blob(['fake']),{isPrepared:true}),/Model OCR gagal dimuat/);
assert.equal(attempts,1);
console.log('OCR ERROR: model gagal -> promise rejected; UI can mark file GAGAL');
