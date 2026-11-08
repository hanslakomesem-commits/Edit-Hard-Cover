import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {alignTitleFormatting,pdfFontLooksItalic,titleHasTransliteration} from '../title-format.js';
import {readWord,readPDF,readPhoto} from '../document-reader.js';
const require=createRequire(import.meta.url);
let passed=0;
function test(label,fn){return Promise.resolve().then(fn).then(()=>{passed++;console.log('PASS',label);});}
const title='ANALISIS Ta‘līm al-Muta‘allim TERHADAP AKHLAK SANTRI';
await test('mixed italics, Unicode exact',()=>{
 const spans=alignTitleFormatting(title,[{text:'ANALISIS ',italic:false},{text:'Ta‘līm al-Muta‘allim',italic:true},{text:' TERHADAP AKHLAK SANTRI',italic:false}]);
 assert.equal(spans.map(s=>s.text).join(''),title);assert.equal(spans.filter(s=>s.italic).map(s=>s.text).join(''),'Ta‘līmal-Muta‘allim');
 assert.ok(titleHasTransliteration(title));
});
await test('same title split across lines and styles',()=>{
 const spans=alignTitleFormatting('KAJIAN Ta‘līm al-Muta‘allim DALAM PENDIDIKAN',[{text:'KAJIAN',italic:false},{text:' ',italic:false},{text:'Ta‘līm',italic:true},{text:' ',italic:true},{text:'al-Muta‘allim',italic:true},{text:' DALAM PENDIDIKAN',italic:false}]);
 assert.equal(spans.map(s=>s.text).join(''),'KAJIAN Ta‘līm al-Muta‘allim DALAM PENDIDIKAN');
 assert.ok(spans.some(s=>s.italic));
});
await test('no fabricated italic when matching ambiguous',()=>{assert.deepEqual(alignTitleFormatting('KATA DAN KATA',[{text:'KATA',italic:true}]),[]);});
await test('font metadata detection',()=>{assert.equal(pdfFontLooksItalic('Helvetica-BoldOblique'),true);assert.equal(pdfFontLooksItalic('x1_f99',{fontFamily:'Tinos Italic'}),true);assert.equal(pdfFontLooksItalic('g_d0_f1',{fontFamily:'Tinos'}),false);});
await test('DOCX explicit italic run and styled run',async()=>{
 const doc=`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
 <w:p><w:r><w:t>ANALISIS </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>Ta‘līm al-Muta‘allim</w:t></w:r><w:r><w:t> TERHADAP AKHLAK SANTRI</w:t></w:r></w:p>
 <w:p><w:r><w:t>SKRIPSI</w:t></w:r></w:p><w:p><w:r><w:t>Oleh:</w:t></w:r></w:p><w:p><w:r><w:t>SITI NUR</w:t></w:r></w:p>
 <w:p><w:r><w:t>NIM. 22381011234</w:t></w:r></w:p><w:p><w:r><w:t>PROGRAM STUDI PENDIDIKAN AGAMA ISLAM</w:t></w:r></w:p><w:p><w:r><w:t>UNIVERSITAS ISLAM NEGERI MADURA</w:t></w:r></w:p><w:p><w:r><w:t>2026</w:t></w:r></w:p></w:body></w:document>`;
 const source={name:'uji.docx',arrayBuffer:async()=>new ArrayBuffer(1)};
 globalThis.JSZip={loadAsync:async()=>({file:p=>p==='word/document.xml'?{async:async()=>doc}:null})};
 const result=await readWord(source);assert.equal(result.judul,title);assert.ok(result.title_segments.some(s=>s.italic));assert.equal(result.title_segments.map(s=>s.text).join(''),title);
});
await test('DOCX italic off cancels inherited italic paragraph',async()=>{
 const doc=`<w:document><w:body><w:p><w:pPr><w:rPr><w:i/></w:rPr></w:pPr><w:r><w:rPr><w:i w:val="0"/></w:rPr><w:t>KAJIAN PERLINDUNGAN KONSUMEN</w:t></w:r></w:p><w:p><w:r><w:t>SKRIPSI</w:t></w:r></w:p><w:p><w:r><w:t>OLEH:</w:t></w:r></w:p><w:p><w:r><w:t>ANIS</w:t></w:r></w:p><w:p><w:r><w:t>NIM. 22381011234</w:t></w:r></w:p><w:p><w:r><w:t>PROGRAM STUDI HUKUM</w:t></w:r></w:p><w:p><w:r><w:t>UNIVERSITAS ISLAM NEGERI MADURA</w:t></w:r></w:p><w:p><w:r><w:t>2026</w:t></w:r></w:p></w:body></w:document>`;
 globalThis.JSZip={loadAsync:async()=>({file:p=>p==='word/document.xml'?{async:async()=>doc}:null})};
 const r=await readWord({name:'a.docx',arrayBuffer:async()=>new ArrayBuffer(1)});assert.equal(r.title_segments.some(s=>s.italic),false);
});
await test('PDF font style Italic copied from text layer',async()=>{
 const itm=(str,y,x,fontName,width=70)=>({str,transform:[1,0,0,1,x,y],fontName,width,height:12});
 const rows=[itm('ANALISIS ',700,10,'font_regular',68),itm('Ta‘līm al-Muta‘allim',700,80,'font_it',150),itm(' TERHADAP AKHLAK SANTRI',700,230,'font_regular',195),itm('SKRIPSI',680,10,'font_regular'),itm('OLEH:',660,10,'font_regular'),itm('SITI NUR',640,10,'font_regular'),itm('NIM. 22381011234',620,10,'font_regular'),itm('PROGRAM STUDI HUKUM',600,10,'font_regular'),itm('UNIVERSITAS ISLAM NEGERI MADURA',580,10,'font_regular'),itm('2026',560,10,'font_regular')];
 const pg={getTextContent:async()=>({items:rows,styles:{font_regular:{fontFamily:'Tinos'},font_it:{fontFamily:'Tinos Italic'}}})};
 globalThis.pdfjsLib={GlobalWorkerOptions:{},getDocument:()=>({promise:Promise.resolve({numPages:1,getPage:async()=>pg,destroy:async()=>{}})})};
 const r=await readPDF({name:'cover.pdf',arrayBuffer:async()=>new ArrayBuffer(8)});
 assert.equal(r.judul,title);assert.ok(r.title_segments.some(s=>s.italic),JSON.stringify(r.title_segments));
});
console.log('V4.31 tests passed:',passed);
