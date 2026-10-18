import assert from 'node:assert/strict';
import {colorSpine,colorSpinePreferences,colorTitleMaxLengthPt,calibrateColorSpineTitleRows} from '../pdf-engine.js';
import {colorGuideGeometry} from '../guide-geometry.js';
const face={hasGlyphForCodePoint:()=>true};
const font={widthOfTextAtSize:(str,size)=>Array.from(str).reduce((sum,ch)=>sum+(ch===' '?0.28:0.55)*size,0)};
const fonts={bold:[{font,face}],italic:[{font,face}]};
const seg=(text)=>[{text,italic:false}];
const words=['STRATEGI','PROMOSI','AFFILIATE','TIKTOK','SEBAGAI','PELUANG','BISNIS','UNTUK','MENINGKATKAN','PENDAPATAN','MAHASISWA','UIN','MADURA','DALAM','PERSPEKTIF','EKONOMI','SYARIAH'];
const text=(count)=>Array.from({length:count},(_,i)=>words[i%words.length]).join(' ');
const mara='ANALISIS PENDIDIKAN KARAKTER ISLAM PADA BUKU “KARTINI NYANTRI” DAN RELEVANSINYA DALAM PENEGAKAN ISLAM MODERAT';
assert.deepEqual(colorSpinePreferences(23),[
 {rows:2,size:9},{rows:3,size:9},
 {rows:2,size:8},{rows:3,size:8},
 {rows:2,size:7},{rows:3,size:7},
 {rows:2,size:6},{rows:3,size:6}
]);
assert.deepEqual(colorSpinePreferences(10),[
 {rows:2,size:8},{rows:2,size:7},{rows:2,size:6},
 {rows:3,size:8},{rows:3,size:7},{rows:3,size:6}
]);
assert.ok(colorTitleMaxLengthPt()>400, 'usable length must be measured from true zone, not hardcoded 320');
let passes=0;
for(let mm=10;mm<=28;mm++){
 for(const input of [mara,text(16),text(22),text(25),text(31)]){
  try{
   const g=colorGuideGeometry(mm);
   const r=colorSpine(fonts,seg(input),mm,[]);
   assert.ok(r.size>=6&&r.size<=9);
   assert.ok(r.count===2||r.count===3);
   assert.ok(r.x.every(x=>x>g.left&&x<g.right));
   assert.ok(r.titleBoundsPt.top>=30*72/25.4-0.01);
   assert.ok(r.titleBoundsPt.bottom<=181*72/25.4+0.01);
   if(mm>=13 && input===mara)assert.equal(r.size,9,'Mara on wide color spine should use 9pt');
   passes++;
  }catch(err){
   if(!/tidak muat|batas/.test(String(err?.message||err)))throw err;
  }
 }
}
assert.equal(colorSpine(fonts,seg(text(25)),15,[]).size,9,
 'Medium-width colored spine should use 3×9 before reducing to 2×8');
assert.equal(colorSpine(fonts,seg(text(25)),15,[]).count,3);
assert.equal(colorSpine(fonts,seg(text(28)),23,[]).size,9,
 'Long colored spine text should fit 3×9 when safe-zone length allows');
console.log(`PASS V4.14: ${passes} color layout scenarios, wide font 9pt, zone safety, 2/3-line preference`);
