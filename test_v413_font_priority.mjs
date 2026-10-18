import assert from 'node:assert/strict';
import {spineRowPreferences,colorSpine,chooseSpine,spineRows,plainSpineTitleGeometry,PLAIN_SPINE_TITLE_SAFE_TOP_PT,PLAIN_SPINE_TITLE_SAFE_BOTTOM_PT,colorTitleMaxLengthPt,calibrateColorSpineTitleRows} from '../pdf-engine.js';
import {colorGuideGeometry} from '../guide-geometry.js';
import {readFileSync} from 'node:fs';

const face={hasGlyphForCodePoint:()=>true};
const font={widthOfTextAtSize:(str,pt)=>Array.from(str).reduce((a,ch)=>a+(ch===' '?0.28:0.55)*pt,0)};
const fonts={bold:[{font,face}],italic:[{font,face}]};
const seg=text=>[{text,italic:false}];
const get=(text,mm)=>colorSpine(fonts,seg(text),mm,[]);
const join=(n)=>Array.from({length:n},(_,i)=>`PENDIDIKAN${i+1}`).join(' ');
const plainLayouts=JSON.parse(readFileSync(new URL('../assets/layout.json',import.meta.url),'utf8')).templates;

// Narrow: two rows with each allowed font tested before any three row.
assert.deepEqual(spineRowPreferences(8,6,10).map(x=>`${x.rows}/${x.size}`),
 ['2/8','2/7','2/6','3/8','3/7','3/6']);
assert.deepEqual(spineRowPreferences(9,6,11).map(x=>`${x.rows}/${x.size}`),
 ['2/9','2/8','2/7','2/6','3/9','3/8','3/7','3/6']);
// Wide: 3 × 9 preferred to tiny 2 × 6 where 2 × 9 doesn't fit.
assert.deepEqual(spineRowPreferences(9,6,23).map(x=>`${x.rows}/${x.size}`),
 ['2/9','3/9','2/8','3/8','2/7','3/7','2/6','3/6']);
// Medium: second chance for legible two rows at 8pt, then 3 × 9pt.
assert.deepEqual(spineRowPreferences(9,6,18).map(x=>`${x.rows}/${x.size}`),
 ['2/9','2/8','3/9','2/7','3/8','2/6','3/7','3/6']);

const title='ANALISIS PENDIDIKAN KARAKTER ISLAM PADA BUKU “KARTINI NYANTRI” DAN RELEVANSINYA DALAM PENEGAKAN ISLAM MODERAT';
for(let mm=23;mm<=27;mm++){
 const r=get(title,mm);
 assert.equal(r.size,9,`Cover Mara ${mm} mm seharusnya memilih 9pt`);
 assert.ok(r.count<=3);
 const g=colorGuideGeometry(mm);
 assert.ok(r.x.every(x=>x>g.left && x<g.right));
 assert.ok(r.titleBoundsPt.top>=30*72/25.4 && r.titleBoundsPt.bottom<=181*72/25.4);
}

let countColor=0,countPlain=0;
for(let mm=10;mm<=28;mm++){
 const g=colorGuideGeometry(mm),available=g.right-g.left;
 for(let words=7;words<=30;words++){
  const text=join(words);
  for(const mode of ['color','plain']){
   try{
    const result=mode==='color'?get(text,mm):chooseSpine(fonts,seg(text),mm,[],plainLayouts[mm]);
    const n=mode==='color'?result.count:result.result.length;
    assert.ok(n>=1&&n<=3);
    assert.ok(result.size>=6&&result.size<=9);
    if(mode==='color'){
     countColor++;
     assert.ok(result.x.every(x=>x>g.left&&x<g.right));
     assert.ok(result.titleBoundsPt.top>=30*72/25.4);
     assert.ok(result.titleBoundsPt.bottom<=181*72/25.4);
    }else{countPlain++;}
    // If two rows at the starting size are possible and safe, NEVER use three.
    let defaultTwoFits=false;
    const base=mm===10?8:9;
    try{
     const plainC=plainLayouts[mm].spine_title_center_y;
     const currentMax=mode==='color'?colorTitleMaxLengthPt():
       2*Math.min(plainC-PLAIN_SPINE_TITLE_SAFE_TOP_PT,PLAIN_SPINE_TITLE_SAFE_BOTTOM_PT-plainC)-2;
     const segments=spineRows(fonts,seg(text),base,currentMax,2,2);
     if(segments.length===2){
      if(mode==='color'){
       const span=(2-1)*base*1.11+base*1.15;
       const bounds=segments.map(row=>font.widthOfTextAtSize(row.map(t=>t.text).join(''),base));
       defaultTwoFits=span<=available-1.1 && calibrateColorSpineTitleRows(bounds).safe;
      }else{
       const span=base*1.11 + (0.892+0.216)*base;
       const bounds=segments.map(row=>font.widthOfTextAtSize(row.map(t=>t.text).join(''),base));
       defaultTwoFits=span<=plainLayouts[mm].right-plainLayouts[mm].left-.30 &&
        plainSpineTitleGeometry(bounds,plainLayouts[mm]).safe;
      }
     }
    }catch{}
    if(defaultTwoFits){assert.equal(n,2,`${mode}/${mm}: 3 baris tak boleh jika 2 baris default muat`);assert.equal(result.size,base);}
   }catch(e){
    if(!/tidak muat|batas fisik|melewati/.test(e.message))throw e;
   }
  }
 }
}
assert.ok(countColor>120 && countPlain>120);
console.log('PASS V4.13: per-ukuran 10–28mm dan 2-vs-3 baris, unicode quotes');
console.log(`TOTAL valid color=${countColor}; valid plain=${countPlain}; Mara 23–27mm = 9pt`);
