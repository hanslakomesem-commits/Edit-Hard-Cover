import assert from 'node:assert/strict';
import {COVER_ZONES,zoneBounds,titleFromZone,nimFromZone,nameFromZone,typeFromZone,footerFromZone,mergeZones} from '../ocr-zones.js';
import {readPhoto} from '../document-reader.js';
import {resetOCR} from '../ocr-fast.js';
assert.equal(COVER_ZONES.length,3);
for(const z of COVER_ZONES){const r=zoneBounds(z,884,1536);assert.ok(r.x>=0&&r.y>=0&&r.width>0&&r.height>0);assert.ok(r.x+r.width<=884&&r.y+r.height<=1536);}
assert.equal(titleFromZone('ANALISIS PENDIDIKAN KARAKTER ISLAM\nPADA BUKU “KARTINI NYANTRI”\nSKRIPSI'),'ANALISIS PENDIDIKAN KARAKTER ISLAM PADA BUKU “KARTINI NYANTRI”');
assert.equal(typeFromZone('judul\nTESIS\nOLEH:'),'TESIS');
assert.equal(nimFromZone('Oleh:\nMARA QONITA\nNIM. 22381012181'),'22381012181');
assert.equal(nimFromZone('NIM: 2238O012181'),'', 'Jangan menebak digit 0 dan huruf O');
assert.equal(nameFromZone('Oleh:\nMARA QONITA FILLAH HIDAYAH\nNIM: 22381012181'),'MARA QONITA FILLAH HIDAYAH');
assert.deepEqual(footerFromZone('PROGRAM STUDI PENDIDIKAN AGAMA ISLAM\nFAKULTAS TARBIYAH DAN ILMU KEGURUAN\nUNIVERSITAS ISLAM NEGERI MADURA\nJUNI 2026'),{prodi:'PENDIDIKAN AGAMA ISLAM',fakultas:'TARBIYAH DAN ILMU KEGURUAN',universitas:'UNIVERSITAS ISLAM NEGERI MADURA',bulan_tahun:'JUNI 2026'});
const merged=mergeZones({judul:'',nama:'',nim:'',prodi:'',fakultas:'',universitas:'',jenis_dokumen:'SKRIPSI',bulan_tahun:'',warnings:[]},{judul:'ANALISIS PENDIDIKAN KARAKTER ISLAM\nPADA BUKU “KARTINI NYANTRI”\nSKRIPSI',identitas:'Oleh:\nMARA QONITA FILLAH HIDAYAH\nNIM. 22381012181',kampus:'PROGRAM STUDI PENDIDIKAN AGAMA ISLAM\nFAKULTAS TARBIYAH DAN ILMU KEGURUAN\nUNIVERSITAS ISLAM NEGERI MADURA\nJUNI 2026'},{full:40});
assert.equal(merged.nama,'MARA QONITA FILLAH HIDAYAH');assert.equal(merged.nim,'22381012181');assert.ok(merged.judul.includes('“KARTINI NYANTRI”'));assert.equal(merged.bulan_tahun,'JUNI 2026');
const titleRecovered=mergeZones({...merged,judul:'ANALISIS PENDIDIKAN KARAKTER ISLAM',warnings:[]},{judul:'ANALISIS PENDIDIKAN KARAKTER ISLAM PADA BUKU KARTINI NYANTRI\nSKRIPSI'},{full:55});
assert.equal(titleRecovered.judul,'ANALISIS PENDIDIKAN KARAKTER ISLAM PADA BUKU KARTINI NYANTRI');
assert.ok(titleRecovered.warnings.some(w=>w.includes('judul') || w.includes('Judul')));
const conflict=mergeZones({...merged,nim:'22381012180',warnings:[]},{identitas:'Oleh:\nMARA QONITA FILLAH HIDAYAH\nNIM. 22381012181'},{full:90});
assert.equal(conflict.nim,'22381012180');assert.ok(conflict.warnings.some(w=>w.includes('Perbedaan')));
let number=0;
let results=[
 'ANALISIS PENDIDIKAN KARAKTER ISLAM PADA BUKU “KARTINI NYANTRI”\nSKRIPSI\nOleh:\nMARA QONITA FILLAH HIDAYAH\nNIM: 22381012181\nPROGRAM STUDI PENDIDIKAN AGAMA ISLAM\nFAKULTAS TARBIYAH DAN ILMU KEGURUAN\nUNIVERSITAS ISLAM NEGERI MADURA\nJUNI 2026',
 'ANALISIS PENDIDIKAN KARAKTER ISLAM\nPADA BUKU “KARTINI NYANTRI”\nSKRIPSI',
 'SKRIPSI\nOleh:\nMARA QONITA FILLAH HIDAYAH\nNIM: 22381012181',
 'PROGRAM STUDI PENDIDIKAN AGAMA ISLAM\nFAKULTAS TARBIYAH DAN ILMU KEGURUAN\nUNIVERSITAS ISLAM NEGERI MADURA\nJUNI 2026'];
const calls={worker:0,recognize:0,modes:[]};
globalThis.createImageBitmap=async()=>({width:884,height:1536,close(){}});
globalThis.document={createElement:tag=>{assert.equal(tag,'canvas');let blob;const canvas={width:0,height:0,getContext(){return {filter:'none',fillStyle:'white',fillRect(){},drawImage(){}}},toBlob(cb){cb(new Blob(['mock png'],{type:'image/png'}))}};return canvas;}};
globalThis.Tesseract={createWorker:async(lang)=>{assert.equal(lang,'ind');calls.worker++;return {setParameters:async(value)=>{calls.modes.push(value.tessedit_pageseg_mode)},recognize:async()=>{calls.recognize++;return {data:{text:results[number++]||'',confidence:87}}},terminate:async()=>{}}}};
const doc=await readPhoto(new Blob(['fake'],{type:'image/png'}),{detail:true,onProgress:()=>{}});
assert.equal(doc.nama,'MARA QONITA FILLAH HIDAYAH');assert.equal(doc.nim,'22381012181');assert.equal(calls.worker,1);assert.equal(calls.recognize,4);assert.deepEqual(calls.modes,['3','6','6','6']);
await resetOCR();number=0;calls.recognize=0;calls.modes=[];
const fast=await readPhoto(new Blob(['fake'],{type:'image/png'}),{detail:false});assert.equal(fast.nim,'22381012181');assert.equal(calls.recognize,1);
await resetOCR();
console.log('PASS V4.6: pengukuran 3 zona, pelestarian karakter, NIM tidak ditebak, penggabungan tanpa menimpa data berbeda, OCR Teliti=4 pass/1 worker, Cepat=1 pass.');
