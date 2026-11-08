import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {nameKey,ocrNameBox,underlineScore} from '../name-underline.js';
import {readWord} from '../document-reader.js';
assert.equal(nameKey('DINIA NAILUL FARAH'),'DINIANAILULFARAH');
const box=ocrNameBox({blocks:[{paragraphs:[{lines:[{text:'DINIA NAILUL FARAH',words:[{text:'DINIA'},{text:'NAILUL'},{text:'FARAH'}],bbox:{x0:30,y0:15,x1:250,y1:46}}]}]}]},'DINIA NAILUL FARAH');
assert.equal(box.x1,250);
const img={width:280,height:95,data:new Uint8ClampedArray(280*95*4)};img.data.fill(255);
function black(x,y){const i=(y*img.width+x)*4;img.data[i]=img.data[i+1]=img.data[i+2]=0;}
// Uppercase glyph feet, separated by spaces: should NOT count as an underline.
for(let x=30;x<250;x++)if((x-30)%15<9)for(let y=23;y<35;y++)black(x,y);
assert(underlineScore(img,box)<.82,'Disconnected glyphs may not produce automatic underline');
for(let x=30;x<250;x++)black(x,42+Math.round((x-140)*.02));
assert(underlineScore(img,box)>=.82,'Real horizontal underline should be found despite slight tilt');
async function wordRead(nameBody,styles=''){
 const doc=`<w:document><w:body><w:p><w:r><w:t>STUDI PEMBELAJARAN BAHASA INDONESIA DI SEKOLAH</w:t></w:r></w:p><w:p><w:r><w:t>SKRIPSI</w:t></w:r></w:p><w:p><w:r><w:t>Oleh:</w:t></w:r></w:p><w:p>${nameBody}</w:p><w:p><w:r><w:t>NIM: 20215935021</w:t></w:r></w:p><w:p><w:r><w:t>PROGRAM STUDI PENDIDIKAN ISLAM ANAK USIA DINI</w:t></w:r></w:p><w:p><w:r><w:t>SEKOLAH TINGGI AGAMA ISLAM (STAI) AL MUJTAMA</w:t></w:r></w:p><w:p><w:r><w:t>2026</w:t></w:r></w:p></w:body></w:document>`;
 globalThis.JSZip={loadAsync:async()=>({file:p=>p==='word/document.xml'?{async:async()=>doc}:p==='word/styles.xml'?{async:async()=>styles}:null})};
 return readWord({arrayBuffer:async()=>new ArrayBuffer(8),name:'cover.docx'});
}
const underline=await wordRead('<w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t>DINIA NAILUL FARAH</w:t></w:r>');
assert.equal(underline.nama,'DINIA NAILUL FARAH');assert.equal(underline.nama_garis_bawah,true);
const noUnderline=await wordRead('<w:r><w:t>DINIA NAILUL FARAH</w:t></w:r>');
assert.equal(noUnderline.nama_garis_bawah,false);
const style=`<w:styles><w:style w:styleId="NameStyle"><w:rPr><w:u w:val="single"/></w:rPr></w:style></w:styles>`;
const styled=await wordRead('<w:r><w:rPr><w:rStyle w:val="NameStyle"/></w:rPr><w:t>DINIA NAILUL FARAH</w:t></w:r>',style);
assert.equal(styled.nama_garis_bawah,true);
const disabled=await wordRead('<w:r><w:rPr><w:u w:val="none"/></w:rPr><w:t>DINIA NAILUL FARAH</w:t></w:r>',style);
assert.equal(disabled.nama_garis_bawah,false);
const pdf=await readFile(new URL('../pdf-engine.js',import.meta.url),'utf8');
for(const name of ['Nama depan','Nama warna','Nama UNIRA','Nama Dummybook','Nama depan IPS']){
 const line=pdf.split('\n').find(line=>line.includes(`'${name}'`));
 assert(line?.includes('nameUnderlineEnabled(data)'),`Front name ${name} must support underline`);
}
assert(pdf.includes('line(data.nama,9,l.nameTop,l.maxTextWidth,7,nameUnderlineEnabled(data))'),'CD must support underline');
for(const label of ['Nama punggung','Nama punggung warna','Nama punggung UNIRA','Nama punggung Dummybook','Nama punggung IPS']){
 const line=pdf.split('\n').find(line=>line.includes(`'${label}'`));
 if(line)assert(!line.includes('nameUnderlineEnabled(data)'),`spine ${label} stays unchanged`);
}
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
assert(html.includes('name="nama_garis_bawah"'));assert(app.includes("result.nama_garis_bawah=$('nameUnderline').checked"));
console.log('PASS V4.37: DOCX run/style underline + underline off, OCR visual evidence, 6 output cover types, manual checkbox');
