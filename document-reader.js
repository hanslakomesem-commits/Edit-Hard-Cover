/* ZAIN.NET • pembaca PDF & DOCX di perangkat pengguna. Tidak ada layanan OCR berbayar. */
import {categorize} from './classifier.js';
import {recognizeLocalResult, prepareOCRZones, setOCRProgress} from './ocr-fast.js';
import {normalizedLines, mergeZones} from './ocr-zones.js';
export {setOCRProgress} from './ocr-fast.js';

export function withTimeout(promise,ms,label){
 let t;return Promise.race([Promise.resolve(promise),new Promise((_,reject)=>{t=setTimeout(()=>reject(new Error(`${label}: waktu proses melewati ${Math.round(ms/1000)} detik. Coba file lebih kecil atau ulangi.`)),ms);})]).finally(()=>clearTimeout(t));
}
const clean=s=>String(s||'').replace(/[\u00a0\u2000-\u200b]/gu,' ').replace(/\s+/gu,' ').trim();
function normalizedResult(lines,warnings=[],rich=null){
 const data=categorize(lines,warnings);
 if(rich?.length && data.judul){
  const plain=rich.map(x=>x.text).join('');
  if(clean(plain)===clean(data.judul))data.title_segments=rich;
 }
 return data;
}
function pdfLines(items){
 const spans=[];
 for(const item of items||[]){const text=clean(item.str);if(!text)continue;const x=item.transform?.[4]||0,y=item.transform?.[5]||0;spans.push({x,y,text});}
 spans.sort((a,b)=>b.y-a.y||a.x-b.x);
 const groups=[];
 for(const item of spans){let group=groups.find(g=>Math.abs(g.y-item.y)<2.3);if(!group){group={y:item.y,items:[]};groups.push(group);}group.items.push(item);}
 return groups.sort((a,b)=>b.y-a.y).map(g=>clean(g.items.sort((a,b)=>a.x-b.x).map(i=>i.text).join(' '))).filter(Boolean);
}
// Baca foto sekali pada mode Cepat; bila judul/NIM hilang atau pengguna memilih Teliti,
// ulangi hanya area yang relevan dengan resolusi lebih besar. Semua proses di browser.
async function localOCR(blob, tag='Foto', options={}) {
 const stage=message=>{try{options.onProgress?.(message);}catch{}};
 const detail=!!options.detail;
 stage('OCR penuh: menyiapkan teks seluruh halaman');
 const full=await recognizeLocalResult(blob,{lang:'ind',psm:'3',maxSide:detail?2400:2100});
 const lines=normalizedLines(full.text);
 const base=normalizedResult(lines,[`OCR ${tag} diproses lokal tanpa token. Selalu cocokkan setiap karakter dengan sumber.`]);
 const confidence=Number.isFinite(full.confidence)?Math.round(full.confidence):null;
 if(confidence!==null && confidence>=0 && confidence<60)base.warnings.push(`Keyakinan OCR penuh ${confidence}% (rendah). Cek judul, nama, dan NIM.`);
 if(!lines.length)base.warnings.push('OCR keseluruhan belum menemukan teks; mode Teliti mencoba membaca zona.');
 const essentialMissing=!base.judul||!base.nama||!base.nim;
 // Mode Cepat: hanya satu percobaan jika lengkap, pembacaan identitas tambahan jika belum lengkap.
 // Mode Teliti: judul, identitas, dan bagian bawah dibaca ulang secara terpisah.
 const zonesNeeded=detail||!lines.length?['judul','identitas','kampus']:(essentialMissing?['judul','identitas','kampus'].filter(k=>k==='judul'?!base.judul:k==='identitas'?!base.nama||!base.nim:false):[]);
 if(!zonesNeeded.length)return base;
 stage(detail?'Mode Teliti: membaca ulang tiga zona':'Memulihkan kolom yang belum terbaca');
 let blobs={};
 try {blobs=await prepareOCRZones(blob,{threshold:detail && confidence!==null && confidence<72});}
 catch(error){base.warnings.push(`Gagal memproses zona: ${error.message}. Hasil utama tetap dapat dikoreksi.`);return base;}
 const zoneText={};
 for(const key of zonesNeeded){
   stage(`OCR zona ${key} (${zonesNeeded.indexOf(key)+1}/${zonesNeeded.length})`);
   try{
     const result=await recognizeLocalResult(blobs[key],{lang:'ind',isPrepared:true,psm:'6'});
     zoneText[key]=result.text;
   }catch(error){
     base.warnings.push(`Zona ${key}: ${error.message}. Koreksi lewat editor bila perlu.`);
   }
 }
 const merged=mergeZones(base,zoneText,{full:full.confidence});
 merged.warnings=merged.warnings.filter(w=>!w.startsWith('Periksa kolom belum terdeteksi:'));
 const remaining=['judul','nama','nim','prodi','fakultas','universitas','jenis_dokumen','bulan_tahun'].filter(k=>!merged[k]);
 if(remaining.length)merged.warnings.push(`Kolom yang masih perlu diisi: ${remaining.join(', ')}.`);
 if(detail)merged.warnings.push('Hasil zona harus diverifikasi. Deteksi italic dan ejaan/transliterasi dari foto belum dijamin oleh OCR lokal.');
 stage('Selesai menggabungkan hasil OCR dan pemeriksaan zona');
 return merged;
}
export async function readPhoto(file,options={}){return localOCR(file,'foto',options);}
export async function readPDF(file,options={}){
 const stage=message=>{try{options.onProgress?.(message);}catch(_){}};
 stage('Membuka PDF lokal, hanya halaman pertama');
 if(!globalThis.pdfjsLib)throw Error('PDF.js gagal dimuat dari CDN. Cek internet dan refresh. Tidak ada API key atau token yang diperlukan.');
 globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
 const data=new Uint8Array(await file.arrayBuffer());
 const task=globalThis.pdfjsLib.getDocument({data,disableAutoFetch:true,disableStream:true});
 let doc=null;
 try{
  doc=await withTimeout(task.promise,20000,'Membuka PDF');
  const first=await withTimeout(doc.getPage(1),12000,'Membaca halaman 1 PDF');
  stage('Mengambil text layer PDF halaman 1 (tanpa OCR)');
  const content=await withTimeout(first.getTextContent(),20000,'Ekstraksi halaman 1 PDF');
  const lines=pdfLines(content.items);
  const found=lines.join(' ').replace(/\s/g,'');
  if(found.length>=35 && (lines.some(line => /\b(SKRIPSI|TESIS|THESIS|DISERTASI|NIM|FAKULTAS|UNIVERSITAS)\b/iu.test(line)) || found.length>90)){stage('Teks PDF halaman 1 berhasil dibaca tanpa OCR');return normalizedResult(lines,[`Hanya halaman 1 dari ${doc.numPages} halaman PDF yang dibaca. Periksa urutan baris.`]);}
  stage('Halaman 1 berupa scan/gambar; menjalankan OCR lokal');
  const base=first.getViewport({scale:1});
  const scale=Math.min(1.55,1800/Math.max(base.width,base.height),Math.sqrt(2500000/(base.width*base.height)));
  const viewport=first.getViewport({scale});
  const canvas=document.createElement('canvas');canvas.width=Math.round(viewport.width);canvas.height=Math.round(viewport.height);
  const renderTask=first.render({canvasContext:canvas.getContext('2d'),viewport});
  try { await withTimeout(renderTask.promise,30000,'Render halaman 1 PDF scan'); }
  catch(error) { try {renderTask.cancel();} catch(_) {} throw error; }
  const image=await new Promise(res=>canvas.toBlob(res,'image/png'));
  if(!image)throw Error('Halaman pertama PDF scan tidak dapat dirender.');
  const result=await localOCR(image,'halaman pertama PDF scan',options);
  result.warnings.push('PDF scan: OCR lokal dipakai hanya untuk halaman 1.');
  return result;
 }finally{try{if(doc)await withTimeout(doc.destroy(),3000,'Menutup dokumen PDF');}catch{} }
}
// DOCX biasanya tidak mempunyai informasi pagination aktual. Ekstraksi cepat ini
// hanya memproses bagian awal body dokumen, dan tidak mem-parse seluruh halaman
// (150+ halaman sering membuat HP macet akibat DOMParser/getElementsByTagName).
function xmlDecode(value) {
 return String(value).replace(/&(?:#(\d+)|#x([\da-fA-F]+)|amp|lt|gt|quot|apos);/g, m => {
  if (m === '&amp;') return '&';
  if (m === '&lt;') return '<';
  if (m === '&gt;') return '>';
  if (m === '&quot;') return '"';
  if (m === '&apos;') return "'";
  const n = m.match(/^&#(?:x([\da-fA-F]+)|(\d+));$/u);
  if (!n) return m;
  const point = parseInt(n[1] || n[2], n[1] ? 16 : 10);
  return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : m;
 });
}
function parseEarlyParagraph(xml) {
 const segments = [];
 function push(text, italic) {
  if (!text) return;
  if (segments.length && segments.at(-1).italic === italic) segments.at(-1).text += text;
  else segments.push({ text, italic });
 }
 const breakAt = xml.search(/<w:(?:lastRenderedPageBreak\b|br\b[^>]*w:type=["']page["'])/u);
 const limited = breakAt >= 0 ? xml.slice(0, breakAt) : xml;
 const runPattern = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/gu;
 let run, found = false;
 while ((run = runPattern.exec(limited)) !== null) {
  found = true;
  const body = run[1];
  const italicTag = body.match(/<w:i\b([^>]*)\/?>(?:<\/w:i>)?/u);
  const italic = !!(italicTag && !/\bw:val=["'](?:0|false|off)["']/iu.test(italicTag[1]));
  const text = [...body.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/gu)].map(m=>xmlDecode(m[1])).join('');
  push(text, italic);
 }
 // Support DOCX text-box text if not represented by outer w:r.
 if (!found) for (const match of limited.matchAll(/<(?:w|a):t(?:\s[^>]*)?>([\s\S]*?)<\/(?:w|a):t>/gu)) push(xmlDecode(match[1]), false);
 return {content:segments.map(s=>s.text).join('').replace(/\s+/gu,' ').trim(), segments, pageBreak:breakAt>=0,
  before:/<w:pageBreakBefore\b/u.test(xml)};
}
export async function readWord(file,options={}) {
 const stage = message => { try { options.onProgress?.(message); } catch (_) {} };
 if (!globalThis.JSZip) throw Error('JSZip tidak tersedia. Website menyertakan JSZip lokal; pastikan folder vendor ikut diunggah.');
 stage('Membuka file DOCX secara lokal');
 const array=await withTimeout(file.arrayBuffer(),15000,'Membaca file Word');
 const zip=await withTimeout(globalThis.JSZip.loadAsync(array),24000,'Membuka paket Word');
 const entry=zip.file('word/document.xml');
 if (!entry) throw Error('Ini bukan DOCX yang valid. Word .doc lama tidak didukung.');
 stage('Mengambil paragraf awal dokumen Word');
 const raw=await withTimeout(entry.async('string'),35000,'Membaca teks Word');
 const bodyStart=raw.search(/<w:body\b/u);
 if (bodyStart<0) throw Error('Isi dokumen Word tidak ditemukan.');
 const body=raw.slice(bodyStart);
 const iterator=body.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/gu);
 const lines=[],pars=[];let explicit=false,approx=false,seenUniversity=false,paragraphs=0;
 const stopTitle=/^(?:ABSTRAK|ABSTRACT|KATA\s+PENGANTAR|DAFTAR\s+ISI|BAB\s+I\b|LEMBAR\s+PENGESAHAN|HALAMAN\s+PERSETUJUAN)/iu;
 for (const result of iterator) {
  if (++paragraphs>90) {approx=true;break;}
  const p=parseEarlyParagraph(result[0]);
  if (p.before && lines.length) {explicit=true;break;}
  const value=p.content;
  if (value) {
   if (lines.length>=2 && stopTitle.test(value)) {approx=true;break;}
   lines.push(value);pars.push(p);
   if (/\b(?:UNIVERSITAS|INSTITUT|UIN|IAIN|STAIN)\b/iu.test(value)) seenUniversity=true;
   if (seenUniversity && lines.length>=5 && /^(?:(?:JANUARI|FEBRUARI|MARET|APRIL|MEI|JUNI|JULI|AGUSTUS|SEPTEMBER|OKTOBER|NOVEMBER|DESEMBER)\s+)?\d{4}$/iu.test(value)) {approx=true;break;}
  }
  if (p.pageBreak) {explicit=true;break;}
  if (lines.length>=48) {approx=true;break;}
 }
 if (!lines.length) throw Error('Halaman awal DOCX tidak mengandung teks. Jika cover dibuat sebagai gambar, gunakan foto/OCR lokal.');
 const warnings=[explicit?'DOCX dibatasi pada penanda halaman yang ada.':'DOCX tidak selalu menyimpan batas halaman fisik. Hanya paragraf awal/cover yang diperkirakan; periksa data sebelum cetak.'];
 const result=normalizedResult(lines,warnings);
 const typeIndex=lines.findIndex(t=>/^(SKRIPSI|TESIS|THESIS|DISERTASI|MAKALAH|LAPORAN(?:\s+AKHIR)?|TUGAS AKHIR)$/iu.test(t));
 if (typeIndex>0) {
  const rich=pars.slice(0,typeIndex).flatMap((p,i)=>i?[{text:' ',italic:false},...p.segments]:p.segments);
  if (clean(rich.map(x=>x.text).join(''))===clean(result.judul)) result.title_segments=rich;
 }
 stage(`Word selesai: ${lines.length} baris awal dibaca tanpa token`);
 return result;
}
