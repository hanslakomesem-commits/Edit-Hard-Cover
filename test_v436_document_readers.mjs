import assert from 'node:assert/strict';
import {readPDF,readWord} from '../document-reader.js';
const lines=[
 'THE EFFECT OF PROBLEM-BASED LEARNINGS ON RECOUNT',
 'TEXT LEARNING OUTCOMES OF GRADE X STUDENTS AT SMAN 3',
 'SAMPANG',
 'THESIS','Written by:','EKA MAULIDYA PUTRI','NIM : 20381032059',
 'ENGLISH TEACHING LEARNING PROGRAM','TARBIYAH FACULTY',
 'MADURA ISLAMIC STATE UNIVERSITY','2026'];
const expected={judul:lines.slice(0,3).join(' '),nama:lines[5],nim:'20381032059',prodi:lines[7],fakultas:lines[8],universitas:lines[9],jenis_dokumen:'THESIS',bulan_tahun:'2026',bahasa:'en'};
const check=(d,prefix)=>{for(const [k,v] of Object.entries(expected))assert.equal(d[k],v,`${prefix} field ${k}`);};
// Stub PDF.js text layer with real coordinate ordering; no OCR required.
globalThis.pdfjsLib={GlobalWorkerOptions:{},getDocument:()=>({promise:Promise.resolve({numPages:7,getPage:async()=>({getTextContent:async()=>({items:lines.map((str,i)=>({str,width:str.length*6,height:12,fontName:'Tinos-Bold',transform:[1,0,0,1,75,780-i*30]})),styles:{'Tinos-Bold':{fontFamily:'Tinos'}}})}),destroy:async()=>{}})})};
const pdf=await readPDF({arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer});
check(pdf,'PDF text layer');
// Stub JSZip DOCX reading for a realistic XML paragraph/run structure.
const xmlLines=lines.map(txt=>`<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${txt}</w:t></w:r></w:p>`).join('');
const xml=`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${xmlLines}</w:body></w:document>`;
globalThis.JSZip={loadAsync:async()=>({file:name=>name==='word/document.xml'?{async:async()=>xml}:null})};
const word=await readWord({arrayBuffer:async()=>new Uint8Array([1,2]).buffer});
check(word,'DOCX paragraphs');
console.log('PASS V4.36: mocked PDF.js real-coordinate text extraction + DOCX paragraph reader preserve English cover identity.');
