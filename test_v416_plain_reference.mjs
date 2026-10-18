import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chooseSpine,spineRows,plainSpineTitleGeometry,PLAIN_SPINE_TITLE_SAFE_TOP_PT,PLAIN_SPINE_TITLE_SAFE_BOTTOM_PT} from '../pdf-engine.js';
const layouts=JSON.parse(readFileSync(new URL('../assets/layout.json',import.meta.url),'utf8')).templates;
const font={widthOfTextAtSize:(str,pt)=>[...str].reduce((s,ch)=>s+(ch===' '?0.28:0.55)*pt,0)};
const face={hasGlyphForCodePoint:()=>true};
const fonts={bold:[{font,face}],italic:[{font,face}]};
const seg=text=>[{text,italic:false}];
const title='ANALISIS PENDIDIKAN KARAKTER ISLAM PADA BUKU “KARTINI NYANTRI” DAN RELEVANSINYA DALAM PENEGAKAN ISLAM MODERAT';
let selected=0,blocked=0;
for(let mm=10;mm<=28;mm++){
 const layout=layouts[mm];
 assert.equal(typeof layout.spine_title_center_y,'number');
 for(const text of [title,'PENGARUH PENDIDIKAN ISLAM TERHADAP KARAKTER MAHASISWA',Array.from({length:21},(_,i)=>i%2?'PENDIDIKAN':'KARAKTER').join(' ')]){
  try{
   const r=chooseSpine(fonts,seg(text),mm,[],layout);
   assert.equal(r.cy,layout.spine_title_center_y,`mm=${mm}: tidak boleh offset +6pt`);
   assert.equal(r.xs.length,r.result.length);
   assert.ok(r.xs.every(x=>x>layout.left && x<layout.right),`mm=${mm}: baris keluar fold guides`);
   assert.ok(r.titleBoundsPt.top>=PLAIN_SPINE_TITLE_SAFE_TOP_PT-1e-6);
   assert.ok(r.titleBoundsPt.bottom<=PLAIN_SPINE_TITLE_SAFE_BOTTOM_PT+1e-6);
   assert.ok(r.size>=6&&r.size<=9);
   assert.ok([2,3].includes(r.result.length));
   selected++;
  }catch(e){
   if(!/tidak muat|batas fisik|melewati/.test(String(e.message)))throw e;
   blocked++;
  }
 }
 // Reject text lines entering crop/title forbidden region
 assert.equal(plainSpineTitleGeometry([500],layout).safe,false);
 assert.equal(plainSpineTitleGeometry([200],layout).safe,true);
}
// Verify font is not gratuitously shrunk on wide spine
assert.equal(chooseSpine(fonts,seg(title),23,[],layouts[23]).size,9);
// Byte-stream reference: the calibrated y center for 16mm and 23mm differs naturally.
assert.notEqual(layouts[16].spine_title_center_y,layouts[23].spine_title_center_y);
console.log(`PASS V4.16: ${selected} valid layouts; ${blocked} safely blocked; 19 native anchors, safe margins, 9pt wide spine`);
