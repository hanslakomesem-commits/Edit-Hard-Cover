import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const classifier=fs.readFileSync(new URL('../classifier.js',import.meta.url),'utf8');
const {canonicalUniversity,categorize}=await import('data:text/javascript;base64,'+Buffer.from(classifier).toString('base64'));
assert.equal(canonicalUniversity('UIN MADURA'),'UNIVERSITAS ISLAM NEGERI MADURA');
assert.equal(canonicalUniversity('uin madura'),'UNIVERSITAS ISLAM NEGERI MADURA');
assert.equal(canonicalUniversity('UNIVERSITAS ISLAM NEGERI MADURA'),'UNIVERSITAS ISLAM NEGERI MADURA');
assert.equal(canonicalUniversity('UIN MALANG'),'UIN MALANG');
const ocr=categorize(['JUDUL PENELITIAN','SKRIPSI','OLEH:','SERLI ISTIQLALIA WAHDANIYAH','NIM : 22383032023','UIN MADURA','PROGRAM STUDI EKONOMI SYARIAH','FAKULTAS EKONOMI DAN BISNIS ISLAM','UNIVERSITAS ISLAM NEGERI MADURA','AGUSTUS 2026']);
assert.equal(ocr.universitas,'UNIVERSITAS ISLAM NEGERI MADURA');
const alias=categorize(['JUDUL PENELITIAN','SKRIPSI','OLEH:','SERLI ISTIQLALIA WAHDANIYAH','NIM : 22383032023','UIN MADURA','AGUSTUS 2026']);
assert.equal(alias.universitas,'UNIVERSITAS ISLAM NEGERI MADURA');
console.log('PASS: universidad name is full, logo nickname never preferred');
// Extract exact production classifier functions to unit test the one file-picker's routing.
const detectSrc=app.slice(app.indexOf('const isPdf='),app.indexOf('const MAX_ORDERS='));
const funcs=Function(detectSrc+'\nreturn {isPdf,isWord,isPhoto,isAccepted};')();
assert.equal(funcs.isAccepted({name:'judul.pdf',type:''}),true);
assert.equal(funcs.isAccepted({name:'skripsi.docx',type:'application/octet-stream'}),true);
assert.equal(funcs.isAccepted({name:'foto.JPEG',type:''}),true);
assert.equal(funcs.isAccepted({name:'foto.webp',type:'image/webp'}),true);
assert.equal(funcs.isAccepted({name:'virus.exe',type:''}),false);
console.log('PASS: one picker distinguishes PDF/DOCX/JPG/JPEG/PNG/WEBP');
// Mock browser DOM to exercise exact V4.9 manual download functions.
const dlSrc=app.slice(app.indexOf('const downloadURLs='),app.indexOf('function active()'));
const dom={};for(const name of ['singleDownloadArea','batchDownloadArea','singleDownloadLink','batchDownloadLink','batchDownloadMessage']){
 const attrs={};dom[name]={classList:{add(k){attrs[k]=true},remove(k){delete attrs[k]}},removeAttribute(k){delete this[k]},textContent:'',_attrs:attrs};}
let revoked=[],clicks=0,n=0;
const urlMock={createObjectURL:()=>`blob:test-${++n}`,revokeObjectURL:url=>revoked.push(url)};
const api=Function('URL','$',dlSrc+'\nreturn {offerDownload,releaseDownload,downloadURLs};')(urlMock,key=>dom[key]);
api.offerDownload(new Blob(['abc']), '01_SERLI_13MM.pdf', 'single');
assert.equal(dom.singleDownloadLink.href,'blob:test-1');
assert.equal(dom.singleDownloadLink.download,'01_SERLI_13MM.pdf');
assert.equal(dom.singleDownloadArea._attrs.hidden,undefined);
api.offerDownload(new Blob(['xyz']), 'HASIL_BATCH.zip', 'batch');
assert.equal(dom.batchDownloadLink.download,'HASIL_BATCH.zip');
api.releaseDownload('single');assert.ok(revoked.includes('blob:test-1'));
console.log('PASS: per-person PDF and batch ZIP persistent download links; proper URL cleanup');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.ok(html.includes('id="universalInput"'));
assert.equal(html.includes('id="pdfInput"'),false);
assert.equal(html.includes('id="wordInput"'),false);
assert.ok(html.includes('id="singleDownloadLink"')&&html.includes('id="batchDownloadLink"'));
assert.ok(!html.includes('id="downloadButton" disabled'));
console.log('PASS: UI features one upload picker and visible download button');
const pdfEngine=fs.readFileSync(new URL('../pdf-engine.js',import.meta.url),'utf8');
assert.equal((pdfEngine.match(/upper\(canonicalUniversity\(data\.universitas\)\)/g)||[]).length,4);
console.log('PASS: all plain/color/unira/dummy PDF draw full university name');
